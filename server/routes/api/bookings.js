const express = require('express');
const router = express.Router();
const db = require('../../database');
const PDFDocument = require('pdfkit');
const { authenticateToken, isAdmin, isPrivilegedUser } = require('../../middleware/auth');
const sse = require('../../sse');
const { checkOverlap, formatTo12Hour, toMinutes, parseTimeTo24Hour } = require('../../utils/helpers');

router.get('/bookings', authenticateToken, async (req, res) => {
    const { date } = req.query;
    try {
        const query = `
            SELECT 
                b.*, 
                c.name as court_name, 
                s.name as sport_name, 
                u.username as created_by_user 
            FROM bookings b 
            JOIN courts c ON b.court_id = c.id
            JOIN sports s ON b.sport_id = s.id
            LEFT JOIN users u ON b.created_by_user_id = u.id
            WHERE b.date = ?
        `;
        const [rows] = await db.query(query, [date]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all bookings (ledger) with pagination
router.get('/bookings/all', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        await connection.query('SET SESSION group_concat_max_len = 1000000;');

        let { date, sport, customer, startTime, endTime, search, page = 1, limit = 10, status } = req.query;
        let queryParams = [];
        let whereClauses = [];

        // Build WHERE clauses
        if (date) {
            whereClauses.push('b.date = ?');
            queryParams.push(date);
        }
        if (sport) {
            whereClauses.push('s.name LIKE ?');
            queryParams.push(`%${sport}%`);
        }
        if (customer) {
            whereClauses.push('b.customer_name LIKE ?');
            queryParams.push(`%${customer}%`);
        }
        if (startTime) {
            whereClauses.push("STR_TO_DATE(SUBSTRING_INDEX(b.time_slot, ' - ', 1), '%h:%i %p') >= STR_TO_DATE(?, '%H:%i')");
            queryParams.push(startTime);
        }
        if (endTime) {
            whereClauses.push("STR_TO_DATE(SUBSTRING_INDEX(b.time_slot, ' - ', -1), '%h:%i %p') <= STR_TO_DATE(?, '%H:%i')");
            queryParams.push(endTime);
        }
        if (search) {
            whereClauses.push('(b.id LIKE ? OR b.customer_name LIKE ? OR s.name LIKE ?)');
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        // Base query for counting total records
        let countQuery = `
            SELECT COUNT(b.id) as total
            FROM bookings b
            LEFT JOIN courts c ON b.court_id = c.id
            LEFT JOIN sports s ON b.sport_id = s.id
        `;

        if (status) {
            whereClauses.push('b.status != ?');
            queryParams.push('Cancelled');
            if (status === 'closed') {
                whereClauses.push('b.payment_status = ?');
                queryParams.push('Completed');
                whereClauses.push(`STR_TO_DATE(CONCAT(b.date, ' ', SUBSTRING_INDEX(b.time_slot, ' - ', -1)), '%Y-%m-%d %h:%i %p') < NOW()`);
            } else if (status === 'active') {
                whereClauses.push(`NOT (b.payment_status = 'Completed' AND STR_TO_DATE(CONCAT(b.date, ' ', SUBSTRING_INDEX(b.time_slot, ' - ', -1)), '%Y-%m-%d %h:%i %p') < NOW())`);
            }
            // Note: No specific 'else' for 'cancelled' is needed if we assume the frontend sends 'cancelled' as a status.
            // However, to be robust:
            else if (status === 'cancelled') {
                // We need to remove the initial 'b.status != ?' for this case
                whereClauses.pop();
                queryParams.pop();
                whereClauses.push('b.status = ?');
                queryParams.push('Cancelled');
            }
        }



        if (whereClauses.length > 0) {
            countQuery += ' WHERE ' + whereClauses.join(' AND ');
        }

        const [countRows] = await connection.query(countQuery, queryParams);
        const totalBookings = countRows[0].total;
        const totalPages = Math.ceil(totalBookings / limit);

        // Main query for fetching paginated data
        let query = `
            SELECT 
                b.*, 
                b.time_slot,
                COALESCE(c.name, 'Deleted Court') as court_name, 
                COALESCE(s.name, 'Deleted Sport') as sport_name,
                (b.total_price + b.discount_amount) as original_price,
                b.total_price as total_amount,
                u.username as created_by_user,
                DATE_FORMAT(b.date, '%Y-%m-%d') as date,
                (
                    SELECT CONCAT('[', GROUP_CONCAT(JSON_OBJECT('id', a.id, 'name', a.name, 'quantity', ba.quantity, 'price', ba.price_at_booking)), ']')
                    FROM booking_accessories ba
                    JOIN accessories a ON ba.accessory_id = a.id
                    WHERE ba.booking_id = b.id
                ) as accessories,
                (
                    SELECT CONCAT('[', GROUP_CONCAT(JSON_OBJECT('id', p.id, 'amount', p.amount, 'payment_mode', p.payment_mode, 'payment_date', p.payment_date, 'username', u.username, 'payment_id', p.payment_id)), ']')
                    FROM payments p
                    LEFT JOIN users u ON p.created_by_user_id = u.id
                    WHERE p.booking_id = b.id
                ) as payments
            FROM bookings b 
            LEFT JOIN courts c ON b.court_id = c.id
            LEFT JOIN sports s ON b.sport_id = s.id
            LEFT JOIN users u ON b.created_by_user_id = u.id
        `;

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }

        query += ' ORDER BY b.id DESC LIMIT ? OFFSET ?';
        const offset = (page - 1) * limit;

        // Create a separate params array for the main query to avoid mutation issues
        const mainQueryParams = [...queryParams, parseInt(limit, 10), parseInt(offset, 10)];

        const [rows] = await connection.query(query, mainQueryParams);

        const bookings = rows.map(row => ({
            ...row,
            accessories: row.accessories ? JSON.parse(row.accessories) : [],
            payments: row.payments ? JSON.parse(row.payments) : []
        }));

        res.json({
            bookings,
            totalPages
        });

    } catch (err) {
        console.error("Error fetching bookings:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// New endpoint for availability heatmap
router.get('/availability/heatmap', authenticateToken, async (req, res) => {
    const { date } = req.query;
    try {
        const [courts] = await db.query('SELECT c.id, c.name, c.status, s.name as sport_name, s.capacity FROM courts c JOIN sports s ON c.sport_id = s.id ORDER BY s.name, c.name');
        const [bookings] = await db.query('SELECT * FROM bookings WHERE date = ? AND status != ?', [date, 'Cancelled']);
        const [memberships] = await db.query('SELECT * FROM active_memberships WHERE ? BETWEEN start_date AND current_end_date', [date]);
        const [attendances] = await db.query('SELECT membership_id FROM team_attendance WHERE attendance_date = ?', [date]);
        const attendedMembershipIds = attendances.map(a => a.membership_id);

        const timeSlots = Array.from({ length: 19 }, (_, i) => {
            const hour = 5 + i;
            return `${String(hour).padStart(2, '0')}:00`;
        });

        const heatmap = courts.map(court => {
            const courtBookings = bookings.filter(b => b.court_id === court.id);
            const courtMemberships = memberships.filter(m => m.court_id === court.id);

            const slots = timeSlots.map(slot => {
                const slotStartHour = parseInt(slot.split(':')[0]);

                const subSlots = [0, 30].map(minute => {
                    const subSlotStartMinutes = slotStartHour * 60 + minute;
                    const subSlotEndMinutes = subSlotStartMinutes + 30;

                    let availability = 'available';
                    let booking_details = null;

                    const unavailableStatuses = ['Under Maintenance', 'Event', 'Tournament', 'Coaching'];
                    if (unavailableStatuses.includes(court.status)) {
                        availability = court.status.toLowerCase().replace(' ', '-');
                    } else {
                        // Check for bookings first
                        const overlappingBookings = courtBookings.filter(b => {
                            const [startStr, endStr] = b.time_slot.split(' - ');
                            const bookingStart = toMinutes(startStr);
                            let bookingEnd = toMinutes(endStr);
                            // Handle midnight crossing: "11:00 PM - 12:00 AM" gives end=0, treat as 1440
                            if (bookingEnd <= bookingStart) bookingEnd = 1440;
                            return subSlotStartMinutes < bookingEnd && subSlotEndMinutes > bookingStart;
                        });

                        if (overlappingBookings.length > 0) {
                            booking_details = overlappingBookings.map(b => ({ id: b.id, customer_name: b.customer_name, time_slot: b.time_slot, slots_booked: b.slots_booked }));
                            if (court.capacity > 1) {
                                const slots_booked = overlappingBookings.reduce((acc, curr) => acc + curr.slots_booked, 0);
                                if (slots_booked >= court.capacity) {
                                    availability = 'full';
                                } else {
                                    availability = 'partial';
                                }
                            } else {
                                availability = 'booked';
                            }
                        }

                        // If still available, check for memberships
                        if (availability === 'available' || availability === 'partial') {
                            const overlappingMembership = courtMemberships.find(m => {
                                const [startStr, endStr] = m.time_slot.split(' - ');
                                const membershipStart = toMinutes(startStr);
                                let membershipEnd = toMinutes(endStr);
                                if (membershipEnd <= membershipStart) membershipEnd = 1440;
                                return subSlotStartMinutes < membershipEnd && subSlotEndMinutes > membershipStart;
                            });

                            if (overlappingMembership) {
                                const isAttended = attendedMembershipIds.includes(overlappingMembership.id);
                                if (isAttended) {
                                    availability = 'attended'; // This will be colored yellow on the frontend
                                }
                                // If not attended, do nothing, so it remains 'available' (green)
                            }
                        }
                    }
                    return { availability, booking: booking_details };
                });

                return { time: slot, subSlots };
            });

            return { ...court, slots };
        });

        res.json(heatmap);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get active bookings
router.get('/bookings/active', authenticateToken, async (req, res) => {
    try {
        const now = new Date();
        const today = now.toISOString().slice(0, 10);

        const query = `
            SELECT 
                b.*, 
                c.name as court_name, 
                s.name as sport_name
            FROM bookings b 
            JOIN courts c ON b.court_id = c.id
            JOIN sports s ON b.sport_id = s.id
            WHERE b.date = ? AND b.status != 'Cancelled'
        `;
        const [bookings] = await db.query(query, [today]);

        const parseTime = (timeStr) => {
            const [time, modifier] = timeStr.split(' ');
            let [hours, minutes] = time.split(':').map(Number);
            if (modifier === 'PM' && hours < 12) {
                hours += 12;
            }
            if (modifier === 'AM' && hours === 12) {
                hours = 0;
            }
            const date = new Date();
            date.setHours(hours, minutes, 0, 0);
            return date;
        };

        const activeBookings = bookings.map(booking => {
            const [startTimeStr, endTimeStr] = booking.time_slot.split(' - ');
            const startTime = parseTime(startTimeStr);
            const endTime = parseTime(endTimeStr);

            let status = 'upcoming';
            if (now >= startTime && now <= endTime) {
                status = 'active';
            } else if (now > endTime) {
                status = 'ended';
            }
            return { ...booking, status, startTime, endTime };
        });

        res.json(activeBookings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Generate PDF receipt
router.get('/booking/:id/receipt.pdf', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
                b.id as booking_id,
                b.customer_name,
                b.customer_contact,
                DATE_FORMAT(b.date, '%Y-%m-%d') as date,
                b.time_slot,
                b.payment_mode,
                b.amount_paid,
                b.balance_amount,
                b.payment_status,
                b.status as booking_status,
                c.name as court_name,
                s.name as sport_name,
                (b.total_price + b.discount_amount) as original_price,
                b.discount_amount,
                b.total_price as total_amount,
                u.username as created_by
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            JOIN sports s ON b.sport_id = s.id
            LEFT JOIN users u ON b.created_by_user_id = u.id
            WHERE b.id = ?
        `;
        const [rows] = await db.query(query, [id]);
        if (rows.length === 0) {
            return res.status(404).send('Booking not found');
        }
        const booking = rows[0];

        const [accessories] = await db.query('SELECT a.name, ba.quantity, ba.price_at_booking FROM booking_accessories ba JOIN accessories a ON ba.accessory_id = a.id WHERE ba.booking_id = ?', [id]);
        const [payments] = await db.query(`
            SELECT p.amount, p.payment_mode, DATE_FORMAT(p.payment_date, '%Y-%m-%d') as payment_date, u.username 
            FROM payments p 
            LEFT JOIN users u ON p.created_by_user_id = u.id 
            WHERE p.booking_id = ?
        `, [id]);

        const doc = new PDFDocument({ size: [302, 400], margin: 10 });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            const pdfData = Buffer.concat(buffers);
            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="receipt-${booking.booking_id}.pdf"`,
                'Content-Length': pdfData.length
            });
            res.end(pdfData);
        });

        // Header
        doc.fontSize(14).text('ARC SportsZone', { align: 'center' });
        doc.fontSize(8).text('Booking Receipt', { align: 'center' });
        doc.moveDown();

        // Booking Details
        doc.fontSize(8).text(`ID: ${booking.booking_id} | Date: ${booking.date} | Time: ${booking.time_slot}`);
        doc.moveDown(0.5);

        // Customer Details
        doc.fontSize(8).text(`Customer: ${booking.customer_name} | Contact: ${booking.customer_contact}`);
        doc.moveDown(0.5);

        // Booking Info
        doc.fontSize(8).text(`Sport: ${booking.sport_name} | Court: ${booking.court_name}`);
        doc.moveDown();

        // Accessories
        if (accessories.length > 0) {
            doc.fontSize(10).text('Accessories', { underline: true });
            accessories.forEach(acc => {
                doc.fontSize(8).text(`${acc.name} (x${acc.quantity}) - Rs. ${acc.price_at_booking * acc.quantity}`)
            });
            doc.moveDown();
        }

        // Payment Details
        doc.fontSize(10).text('Payment Details', { underline: true });
        doc.fontSize(8).text(`Total: Rs. ${booking.original_price}`);
        if (booking.discount_amount > 0) {
            doc.fontSize(8).text(`Discount: Rs. ${booking.discount_amount}`);
        }
        doc.fontSize(8).text(`Final Amount: Rs. ${booking.total_amount}`);
        doc.fontSize(8).text(`Paid: Rs. ${booking.amount_paid} | Balance: Rs. ${booking.balance_amount}`);
        doc.moveDown();

        // Payment History
        if (payments.length > 0) {
            doc.fontSize(10).text('Payment History', { underline: true });
            payments.forEach(p => {
                doc.fontSize(8).text(`${p.amount} rs via ${p.payment_mode} on ${p.payment_date} by ${p.username || 'N/A'}`);
            });
            doc.moveDown();
        }

        // Footer
        doc.fontSize(8).text('Thank you for your booking!', { align: 'center' });

        doc.end();

    } catch (err) {
        console.error(err);
        res.status(500).send('Error generating PDF');
    }
});


// Calculate price dynamically
router.post('/bookings/calculate-price', authenticateToken, async (req, res) => {
    const { sport_id, startTime, endTime, slots_booked, accessories, discount_amount } = req.body;

    if (!sport_id || !startTime || !endTime) {
        return res.status(400).json({ message: 'sport_id, startTime, and endTime are required.' });
    }

    try {
        const [sports] = await db.query('SELECT name, price, capacity FROM sports WHERE id = ?', [sport_id]);
        if (sports.length === 0) {
            return res.status(404).json({ message: 'Sport not found' });
        }
        const hourly_price = sports[0].price;
        const capacity = sports[0].capacity;

        const parseTime = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };
        let startMinutes = parseTime(startTime);
        let endMinutes = parseTime(endTime);

        // Adjust endMinutes if the booking crosses midnight
        if (endMinutes <= startMinutes) {
            endMinutes += 24 * 60; // Add 24 hours in minutes
        }
        const durationInMinutes = endMinutes - startMinutes;

        let court_price;
        if (capacity > 1) {
            court_price = 0;
            if (durationInMinutes >= 30) { // Only charge for 30 mins or more
                const num_of_hours = Math.floor(durationInMinutes / 60);
                const remaining_minutes = durationInMinutes % 60;

                court_price = num_of_hours * hourly_price;
                if (remaining_minutes >= 30) {
                    court_price += hourly_price / 2;
                }
            }
        } else {
            court_price = (durationInMinutes / 60) * hourly_price;
        }


        if (slots_booked > 1) {
            court_price *= slots_booked;
        }

        let accessories_total_price = 0;
        if (accessories && accessories.length > 0) {
            for (const acc of accessories) {
                const [[accessoryData]] = await db.query('SELECT price FROM accessories WHERE id = ?', [acc.id]);
                if (accessoryData && parseFloat(accessoryData.price) > 0) {
                    accessories_total_price += parseFloat(accessoryData.price) * acc.quantity;
                } else {
                    // Fallback to price provided in the request body if DB price is not found or is 0
                    accessories_total_price += parseFloat(acc.price) * acc.quantity;
                }
            }
        }

        let final_total_price = court_price + accessories_total_price;
        if (discount_amount) {
            final_total_price -= parseFloat(discount_amount);
        }

        res.json({ total_price: final_total_price });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/bookings', authenticateToken, async (req, res) => {
    const { court_id, customer_name, customer_contact, customer_email, date, startTime, endTime,
        payment_mode, payment_id, amount_paid, slots_booked, discount_amount, discount_reason, accessories } = req.body;
    const created_by_user_id = req.user.id;

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [courts] = await connection.query('SELECT sport_id FROM courts WHERE id = ?', [court_id]);
        if (courts.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ message: 'Court not found' });
        }
        const sport_id = courts[0].sport_id;

        const [sports] = await connection.query('SELECT name, price, capacity FROM sports WHERE id = ?', [sport_id]);
        if (sports.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ message: 'Sport not found' });
        }
        const sport_name = sports[0].name;
        const hourly_price = sports[0].price;
        const capacity = sports[0].capacity;

        const parseTime = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };
        let startMinutes = parseTime(startTime);
        let endMinutes = parseTime(endTime);

        // Adjust endMinutes if the booking crosses midnight
        if (endMinutes <= startMinutes) {
            endMinutes += 24 * 60; // Add 24 hours in minutes
        }
        const durationInMinutes = endMinutes - startMinutes;

        if (durationInMinutes <= 0) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ message: 'End time must be after start time.' });
        }

        let base_court_price;
        if (capacity > 1) {
            base_court_price = 0;
            if (durationInMinutes >= 30) { // Only charge for 30 mins or more
                const num_of_hours = Math.floor(durationInMinutes / 60);
                const remaining_minutes = durationInMinutes % 60;

                base_court_price = num_of_hours * hourly_price;
                if (remaining_minutes >= 30) {
                    base_court_price += hourly_price / 2;
                }
            }
        } else {
            base_court_price = (durationInMinutes / 60) * hourly_price;
        }

        if (slots_booked > 1) {
            base_court_price *= slots_booked;
        }

        // Apply discount ONLY to the base court price
        const final_court_price = base_court_price - (discount_amount || 0);

        let accessories_total_price = 0;
        if (accessories && accessories.length > 0) {
            for (const acc of accessories) {
                const [[accessoryData]] = await connection.query('SELECT price FROM accessories WHERE id = ?', [acc.accessory_id]);
                if (accessoryData) {
                    accessories_total_price += accessoryData.price * acc.quantity;
                }
            }
        }

        // Total price is discounted court price + accessories price
        const total_price = final_court_price + accessories_total_price;

        // Server-side validation: amount_paid cannot exceed total_price
        if (parseFloat(amount_paid) > total_price) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ message: 'Amount paid cannot exceed total price.' });
        }

        const balance_amount = total_price - amount_paid;
        let payment_status = balance_amount <= 0 ? 'Completed' : (amount_paid > 0 ? 'Received' : 'Pending');

        const formatTo12Hour = (time) => {
            let [hours, minutes] = time.split(':').map(Number);
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            minutes = minutes < 10 ? '0' + minutes : minutes;
            return `${hours}:${minutes} ${ampm}`;
        };
        const time_slot = `${formatTo12Hour(startTime)} - ${formatTo12Hour(endTime)}`;

        // --- Concurrency Lock and Conflict Check ---
        const [existingBookings] = await connection.query('SELECT time_slot, slots_booked FROM bookings WHERE court_id = ? AND date = ? AND status != ? FOR UPDATE', [court_id, date, 'Cancelled']);

        const [activeMemberships] = await connection.query(
            `SELECT time_slot 
             FROM active_memberships 
             WHERE court_id = ? 
             AND ? BETWEEN start_date AND current_end_date FOR UPDATE`,
            [court_id, date]
        );

        const newStartFormatted = formatTo12Hour(startTime);
        const newEndFormatted = formatTo12Hour(endTime);

        const overlappingDailyBookings = existingBookings.filter(booking => {
            const [existingStart, existingEnd] = booking.time_slot.split(' - ');
            return checkOverlap(newStartFormatted, newEndFormatted, existingStart.trim(), existingEnd.trim());
        });

        const overlappingActiveMemberships = activeMemberships.filter(membership => {
            const [existingStart, existingEnd] = membership.time_slot.split(' - ');
            return checkOverlap(newStartFormatted, newEndFormatted, existingStart.trim(), existingEnd.trim());
        });

        if (capacity > 1) {
            const totalSlotsBookedByDailyBookings = overlappingDailyBookings.reduce((total, booking) => total + parseInt(booking.slots_booked, 10), 0);
            const totalSlotsOccupiedByMemberships = overlappingActiveMemberships.length;

            const totalOccupiedSlots = totalSlotsBookedByDailyBookings + totalSlotsOccupiedByMemberships;
            const slotsForNewBooking = parseInt(slots_booked || 1, 10);

            if ((totalOccupiedSlots + slotsForNewBooking) > capacity) {
                await connection.rollback();
                connection.release();
                const availableSlots = capacity - totalOccupiedSlots;
                return res.status(409).json({ message: `Not enough slots available. Only ${availableSlots} slots left.` });
            }
        } else {
            // Single-capacity logic: any overlap with either a booking or a membership means it's unavailable
            if (overlappingDailyBookings.length > 0 || overlappingActiveMemberships.length > 0) {
                await connection.rollback();
                connection.release();
                return res.status(409).json({ message: 'The selected time slot conflicts with an existing booking or membership.' });
            }
        }
        // --- End Concurrency Lock and Conflict Check ---

        const [result] = await connection.query(
            'INSERT INTO bookings (court_id, sport_id, created_by_user_id, customer_name, customer_contact, customer_email, date, time_slot, total_price, amount_paid, balance_amount, payment_status, payment_mode, payment_id, slots_booked, status, discount_amount, discount_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [court_id, sport_id, created_by_user_id, customer_name, customer_contact, customer_email, date, time_slot, total_price, amount_paid, balance_amount, payment_status, payment_mode, payment_id, slots_booked, 'Booked', discount_amount, discount_reason]
        );
        const bookingId = result.insertId;

        // If there was an initial payment, add it to the payments table
        if (amount_paid && parseFloat(amount_paid) > 0) {
            await connection.query(
                'INSERT INTO payments (booking_id, amount, payment_mode, created_by_user_id) VALUES (?, ?, ?, ?)',
                [bookingId, amount_paid, payment_mode, created_by_user_id]
            );
        }

        if (accessories && accessories.length > 0) {
            for (const acc of accessories) {
                const [[accessoryData]] = await connection.query('SELECT price FROM accessories WHERE id = ?', [acc.accessory_id]);
                if (accessoryData) {
                    await connection.query('INSERT INTO booking_accessories (booking_id, accessory_id, quantity, price_at_booking) VALUES (?, ?, ?, ?)', [bookingId, acc.accessory_id, acc.quantity, accessoryData.price]);
                }
            }
        }

        await connection.commit();
        sse.sendEventsToAll({ message: 'bookings_updated' });
        res.json({ success: true, bookingId: bookingId });

    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});


// Update an existing booking
router.put('/bookings/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const {
        customer_name,
        customer_contact,
        date,
        startTime,
        endTime,
        total_price,
        is_rescheduled,
        stagedPayments,
        accessories,
        discount_amount,
        discount_reason
    } = req.body;
    const created_by_user_id = req.user.id;

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Get existing booking
        const [existingBookings] = await connection.query('SELECT * FROM bookings WHERE id = ? FOR UPDATE', [id]);
        if (existingBookings.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ message: 'Booking not found' });
        }
        const existingBooking = existingBookings[0];

        // 2. Format time and date for update, only if new times are provided
        let newTimeSlot = existingBooking.time_slot;
        if (startTime && endTime) {
            newTimeSlot = `${formatTo12Hour(startTime)} - ${formatTo12Hour(endTime)}`;
        }
        const newDate = date ? new Date(date).toISOString().slice(0, 10) : new Date(existingBooking.date).toISOString().slice(0, 10);

        // 3. Conflict Checking if date or time has changed
        const hasDateChanged = newDate !== new Date(existingBooking.date).toISOString().slice(0, 10);
        const hasTimeChanged = newTimeSlot !== existingBooking.time_slot;

        if (hasDateChanged || hasTimeChanged) {
            // Get the capacity of the sport to determine which logic to use
            const [[sportDetails]] = await connection.query('SELECT capacity FROM sports WHERE id = ?', [existingBooking.sport_id]);
            const capacity = parseInt(sportDetails.capacity, 10);

            const [conflictingBookings] = await connection.query(
                'SELECT * FROM bookings WHERE court_id = ? AND date = ? AND id != ? AND status != ?',
                [existingBooking.court_id, newDate, id, 'Cancelled']
            );

            // Find all bookings that truly overlap with the new time
            const overlappingBookings = conflictingBookings.filter(booking => {
                const [existingStart, existingEnd] = booking.time_slot.split(' - ');
                // Note: `startTime` and `endTime` are the new times from the request body
                return checkOverlap(formatTo12Hour(startTime), formatTo12Hour(endTime), existingStart.trim(), existingEnd.trim());
            });

            if (capacity > 1) {
                // For multi-capacity resources, check if there are enough slots
                const totalSlotsInOverlap = overlappingBookings.reduce((total, b) => total + parseInt(b.slots_booked, 10), 0);
                const slotsBeingMoved = parseInt(existingBooking.slots_booked, 10);

                if ((totalSlotsInOverlap + slotsBeingMoved) > capacity) {
                    await connection.rollback();
                    connection.release();
                    const availableSlots = capacity - totalSlotsInOverlap;
                    return res.status(409).json({ message: `The selected time slot conflicts with another booking. Only ${availableSlots} slots are available.` });
                }
            } else {
                // For single-capacity resources, any overlap is a conflict
                if (overlappingBookings.length > 0) {
                    await connection.rollback();
                    connection.release();
                    return res.status(409).json({ message: 'The selected time slot conflicts with another booking.' });
                }
            }
        }

        // 4. Handle accessories
        if (accessories) {
            // a. Delete existing accessories for this booking
            await connection.query('DELETE FROM booking_accessories WHERE booking_id = ?', [id]);

            // b. Insert new accessories
            for (const acc of accessories) {
                const [[accessoryData]] = await connection.query('SELECT price FROM accessories WHERE id = ?', [acc.id]);
                if (accessoryData) {
                    await connection.query('INSERT INTO booking_accessories (booking_id, accessory_id, quantity, price_at_booking) VALUES (?, ?, ?, ?)', [id, acc.id, acc.quantity, accessoryData.price]);
                }
            }
        }

        // 5. Insert staged payments
        if (stagedPayments && stagedPayments.length > 0) {
            for (const payment of stagedPayments) {
                await connection.query(
                    'INSERT INTO payments (booking_id, amount, payment_mode, payment_id, created_by_user_id) VALUES (?, ?, ?, ?, ?)',
                    [id, payment.amount, payment.payment_mode, payment.payment_id, created_by_user_id]
                );
            }
        }

        // 6. Recalculate payment totals from the database
        const [payments] = await connection.query('SELECT SUM(amount) as total_paid FROM payments WHERE booking_id = ?', [id]);
        const total_paid = payments[0].total_paid || 0;

        const final_total_price = parseFloat(total_price);

        // SERVER-SIDE VALIDATION: Prevent total from being less than amount paid
        if (final_total_price < total_paid) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ message: 'Cannot remove/update items where the total amount would be less than the amount already paid.' });
        }

        const final_balance_amount = final_total_price - total_paid;

        let final_payment_status = 'Pending';
        if (final_balance_amount <= 0) {
            final_payment_status = 'Completed';
        } else if (total_paid > 0) {
            final_payment_status = 'Received';
        }

        const updateFields = {
            customer_name,
            customer_contact,
            date: newDate,
            time_slot: newTimeSlot,
            total_price: final_total_price,
            amount_paid: total_paid, // Use server-calculated total
            balance_amount: final_balance_amount, // Use server-calculated balance
            payment_status: final_payment_status,
            is_rescheduled: is_rescheduled || existingBooking.is_rescheduled,
            discount_amount: discount_amount,
            discount_reason: discount_reason
        };

        // 7. Execute booking update
        const sql = 'UPDATE bookings SET ? WHERE id = ?';
        await connection.query(sql, [updateFields, id]);

        await connection.commit();
        sse.sendEventsToAll({ message: 'bookings_updated' });

        // 8. Fetch and return the fully updated booking
        const [updatedBookingRows] = await connection.query(
            `SELECT 
                b.*, 
                c.name as court_name, 
                s.name as sport_name,
                (b.total_price + b.discount_amount) as original_price,
                b.total_price as total_amount,
                u.username as created_by_user,
                DATE_FORMAT(b.date, '%Y-%m-%d') as date,
                (
                    SELECT CONCAT('[', GROUP_CONCAT(JSON_OBJECT('id', a.id, 'name', a.name, 'quantity', ba.quantity, 'price', ba.price_at_booking)), ']')
                    FROM booking_accessories ba
                    JOIN accessories a ON ba.accessory_id = a.id
                    WHERE ba.booking_id = b.id
                ) as accessories,
                (
                    SELECT CONCAT('[', GROUP_CONCAT(JSON_OBJECT('id', p.id, 'amount', p.amount, 'payment_mode', p.payment_mode, 'payment_date', p.payment_date, 'username', u.username, 'payment_id', p.payment_id)), ']')
                    FROM payments p
                    LEFT JOIN users u ON p.created_by_user_id = u.id
                    WHERE p.booking_id = b.id
                ) as payments
            FROM bookings b 
            JOIN courts c ON b.court_id = c.id
            JOIN sports s ON b.sport_id = s.id
            LEFT JOIN users u ON b.created_by_user_id = u.id
            WHERE b.id = ?`,
            [id]
        );

        const updatedBooking = updatedBookingRows[0];
        updatedBooking.accessories = updatedBooking.accessories ? JSON.parse(updatedBooking.accessories) : [];
        updatedBooking.payments = updatedBooking.payments ? JSON.parse(updatedBooking.payments) : [];

        res.json({ success: true, message: 'Booking updated successfully', booking: updatedBooking });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Error updating booking:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// Extend an existing booking
router.post('/bookings/:id/extend', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { extend_duration } = req.body; // in minutes

    if (!extend_duration) {
        return res.status(400).json({ message: 'Extend duration is required' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get existing booking
        const [bookings] = await connection.query('SELECT * FROM bookings WHERE id = ? FOR UPDATE', [id]);
        if (bookings.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Booking not found' });
        }
        const booking = bookings[0];

        // Get sport details for price calculation
        const [sports] = await connection.query('SELECT price FROM sports WHERE id = ?', [booking.sport_id]);
        if (sports.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Sport not found' });
        }
        const hourly_price = sports[0].price;

        // Calculate new end time
        const [startTimeStr, endTimeStr] = booking.time_slot.split(' - ');
        const to24Hour = (timeStr) => {
            let [time, modifier] = timeStr.split(' ');
            let [hours, minutes] = time.split(':').map(Number);
            if (modifier === 'PM' && hours < 12) hours += 12;
            if (modifier === 'AM' && hours === 12) hours = 0;
            return { hours, minutes };
        };

        const endTime24 = to24Hour(endTimeStr);
        const bookingDate = new Date(booking.date); // Use booking's date
        bookingDate.setHours(endTime24.hours, endTime24.minutes, 0, 0);
        bookingDate.setMinutes(bookingDate.getMinutes() + extend_duration);

        const newEndTime = bookingDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        // Check for conflicts
        const newTimeSlotForCheck = `${startTimeStr} - ${newEndTime}`;
        const [conflictingBookings] = await connection.query(
            'SELECT * FROM bookings WHERE court_id = ? AND date = ? AND id != ? AND status != ?',
            [booking.court_id, booking.date, id, 'Cancelled']
        );

        const isOverlapping = conflictingBookings.some(b => {
            const [existingStart, existingEnd] = b.time_slot.split(' - ');
            return checkOverlap(newTimeSlotForCheck.split(' - ')[0], newTimeSlotForCheck.split(' - ')[1], existingStart.trim(), existingEnd.trim());
        });

        if (isOverlapping) {
            await connection.rollback();
            return res.status(409).json({ message: 'The extended time slot conflicts with another booking.' });
        }

        // Calculate new price
        const newTimeSlot = `${startTimeStr} - ${newEndTime}`;

        const startTime24 = to24Hour(startTimeStr);
        const startDate = new Date(booking.date);
        startDate.setHours(startTime24.hours, startTime24.minutes, 0, 0);

        const durationInMinutes = (bookingDate.getTime() - startDate.getTime()) / (1000 * 60);

        const new_total_price = (durationInMinutes / 60) * hourly_price;
        const new_balance_amount = new_total_price - booking.amount_paid;
        const payment_status = new_balance_amount <= 0 ? 'Completed' : 'Pending';

        // Update booking
        await connection.query(
            'UPDATE bookings SET time_slot = ?, total_price = ?, balance_amount = ?, payment_status = ? WHERE id = ?',
            [newTimeSlot, new_total_price, new_balance_amount, payment_status, id]
        );

        await connection.commit();
        sse.sendEventsToAll({ message: 'bookings_updated' });
        res.json({ success: true, message: 'Booking extended successfully' });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Error extending booking:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// Update payment status for a booking
router.put('/bookings/:id/payment', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { amount_paid, payment_status } = req.body;

    try {
        // First, get the total_price directly from the booking
        const [bookings] = await db.query('SELECT total_price FROM bookings WHERE id = ?', [id]);
        if (bookings.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        const total_price = bookings[0].total_price;

        const new_balance = total_price - amount_paid;

        await db.query(
            'UPDATE bookings SET amount_paid = ?, balance_amount = ?, payment_status = ? WHERE id = ?',
            [amount_paid, new_balance, payment_status, id]
        );
        sse.sendEventsToAll({ message: 'bookings_updated' });
        res.json({ success: true, message: 'Payment updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new payment to a booking
router.post('/bookings/:id/payments', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { amount, payment_mode, new_total_price, endTime, payment_id } = req.body;
    const created_by_user_id = req.user.id;

    if (!amount || !payment_mode) {
        return res.status(400).json({ message: 'Amount and payment mode are required' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 0. If a new total price is provided (e.g., from an extension), update it first.
        if (new_total_price !== undefined) {
            await connection.query('UPDATE bookings SET total_price = ? WHERE id = ?', [new_total_price, id]);
        }

        // If endTime is provided, update the time_slot
        if (endTime) {
            const [existingBooking] = await connection.query('SELECT time_slot FROM bookings WHERE id = ?', [id]);
            const [startTime] = existingBooking[0].time_slot.split(' - ');
            const newTimeSlot = `${startTime} - ${formatTo12Hour(endTime)}`;
            await connection.query('UPDATE bookings SET time_slot = ? WHERE id = ?', [newTimeSlot, id]);
        }

        // 1. Add the new payment
        await connection.query(
            'INSERT INTO payments (booking_id, amount, payment_mode, created_by_user_id, payment_id) VALUES (?, ?, ?, ?, ?)',
            [id, amount, payment_mode, created_by_user_id, payment_id]
        );

        // 2. Recalculate total amount paid
        const [payments] = await connection.query('SELECT SUM(amount) as total_paid FROM payments WHERE booking_id = ?', [id]);
        const total_paid = payments[0].total_paid || 0;

        // 3. Get booking total price (which is now up-to-date)
        const [bookings] = await connection.query('SELECT total_price FROM bookings WHERE id = ?', [id]);
        if (bookings.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ message: 'Booking not found' });
        }
        const total_price = bookings[0].total_price;

        // 4. Update the booking with new payment totals
        const balance_amount = total_price - total_paid;
        const payment_status = balance_amount <= 0 ? 'Completed' : 'Received';

        await connection.query(
            'UPDATE bookings SET amount_paid = ?, balance_amount = ?, payment_status = ? WHERE id = ?',
            [total_paid, balance_amount, payment_status, id]
        );

        await connection.commit();

        // Fetch the complete updated booking to return to the client
        const [updatedBookingRows] = await connection.query(
            `SELECT 
                b.*, 
                b.time_slot, -- Explicitly select time_slot to ensure it's not lost
                c.name as court_name, 
                s.name as sport_name,
                (b.total_price + b.discount_amount) as original_price,
                b.total_price as total_amount,
                u.username as created_by_user,
                DATE_FORMAT(b.date, '%Y-%m-%d') as date,
                (
                    SELECT CONCAT('[', GROUP_CONCAT(JSON_OBJECT('id', a.id, 'name', a.name, 'quantity', ba.quantity, 'price', ba.price_at_booking)), ']')
                    FROM booking_accessories ba
                    JOIN accessories a ON ba.accessory_id = a.id
                    WHERE ba.booking_id = b.id
                ) as accessories,
                (
                    SELECT CONCAT('[', GROUP_CONCAT(JSON_OBJECT('id', p.id, 'amount', p.amount, 'payment_mode', p.payment_mode, 'payment_date', p.payment_date, 'username', u.username, 'payment_id', p.payment_id)), ']')
                    FROM payments p
                    LEFT JOIN users u ON p.created_by_user_id = u.id
                    WHERE p.booking_id = b.id
                ) as payments
            FROM bookings b 
            JOIN courts c ON b.court_id = c.id
            JOIN sports s ON b.sport_id = s.id
            LEFT JOIN users u ON b.created_by_user_id = u.id
            WHERE b.id = ?`,
            [id]
        );

        const updatedBooking = updatedBookingRows[0];

        // Parse accessories and payments
        updatedBooking.accessories = updatedBooking.accessories ? JSON.parse(updatedBooking.accessories) : [];
        updatedBooking.payments = updatedBooking.payments ? JSON.parse(updatedBooking.payments) : [];

        sse.sendEventsToAll({ message: 'bookings_updated' });
        res.json({ success: true, message: 'Payment added successfully', booking: updatedBooking });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Error adding payment:", err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// Cancel a booking
router.put('/bookings/:id/cancel', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query("UPDATE bookings SET status = 'Cancelled' WHERE id = ?", [id]);
        sse.sendEventsToAll({ message: 'bookings_updated' });
        res.json({ success: true, message: 'Booking cancelled successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/bookings/check-clash', authenticateToken, async (req, res) => {
    const { court_id, date, startTime, endTime, bookingId, slots_booked } = req.body;

    if (!court_id || !date || !startTime || !endTime) {
        return res.status(400).json({ message: 'court_id, date, startTime, and endTime are required.' });
    }

    try {
        // Get sport_id from court_id
        const [[courtDetails]] = await db.query('SELECT sport_id FROM courts WHERE id = ?', [court_id]);
        if (!courtDetails) {
            return res.status(404).json({ message: 'Court not found' });
        }
        const sport_id = courtDetails.sport_id;

        // Get capacity for the sport
        const [[sportDetails]] = await db.query('SELECT capacity FROM sports WHERE id = ?', [sport_id]);
        const capacity = parseInt(sportDetails.capacity, 10);

        const newStart = formatTo12Hour(startTime);
        const newEnd = formatTo12Hour(endTime);

        // 1. Check for overlapping daily bookings
        let bookingQuery = 'SELECT time_slot, slots_booked FROM bookings WHERE court_id = ? AND date = ? AND status != ?';
        const bookingParams = [court_id, date, 'Cancelled'];
        if (bookingId) {
            bookingQuery += ' AND id != ?';
            bookingParams.push(bookingId);
        }
        const [conflictingBookings] = await db.query(bookingQuery, bookingParams);

        const overlappingDailyBookings = conflictingBookings.filter(booking => {
            const [existingStart, existingEnd] = booking.time_slot.split(' - ');
            return checkOverlap(newStart, newEnd, existingStart.trim(), existingEnd.trim());
        });

        // 2. Check for overlapping active memberships
        const [conflictingMemberships] = await db.query(
            `SELECT time_slot 
             FROM active_memberships 
             WHERE court_id = ? 
             AND ? BETWEEN start_date AND current_end_date`,
            [court_id, date]
        );

        const overlappingActiveMemberships = conflictingMemberships.filter(membership => {
            const [existingStart, existingEnd] = membership.time_slot.split(' - ');
            return checkOverlap(newStart, newEnd, existingStart.trim(), existingEnd.trim());
        });

        if (capacity > 1) {
            // Multi-capacity logic
            const totalSlotsBookedByDailyBookings = overlappingDailyBookings.reduce((total, b) => total + parseInt(b.slots_booked, 10), 0);
            const totalSlotsOccupiedByMemberships = overlappingActiveMemberships.length; // Each membership occupies 1 slot for capacity check

            const totalOccupiedSlots = totalSlotsBookedByDailyBookings + totalSlotsOccupiedByMemberships;
            const slotsForNewBooking = parseInt(slots_booked || 1, 10);

            if ((totalOccupiedSlots + slotsForNewBooking) > capacity) {
                const availableSlots = capacity - totalOccupiedSlots;
                return res.status(200).json({ is_clashing: true, message: `Not enough slots available. Only ${availableSlots} slots left.` });
            } else {
                return res.status(200).json({ is_clashing: false, message: 'The selected time slot is available.' });
            }
        } else {
            // Single-capacity logic: any overlap with either a booking or a membership means it's unavailable
            if (overlappingDailyBookings.length > 0 || overlappingActiveMemberships.length > 0) {
                return res.status(200).json({ is_clashing: true, message: 'The selected time slot conflicts with an existing booking or membership.' });
            } else {
                return res.status(200).json({ is_clashing: false, message: 'The selected time slot is available.' });
            }
        }
    } catch (err) {
        console.error("Error checking booking clash:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
