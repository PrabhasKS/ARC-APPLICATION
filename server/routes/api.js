const express = require('express');
const router = express.Router();
const db = require('../database');
const twilio = require('twilio');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');

const saltRounds = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key'; // Use environment variable for secret

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);

const userSessions = {};

let clients = [];

const sendEventsToAll = (data) => {
  clients.forEach(client => client.res.write(`data: ${JSON.stringify(data)}\n\n`))
}

router.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();

    const clientId = Date.now();
    const newClient = {
        id: clientId,
        res
    };
    clients.push(newClient);

    req.on('close', () => {
        clients = clients.filter(client => client.id !== clientId);
    });
});

// Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // if there isn't any token

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

const toMinutes = (timeStr) => {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);

    if (modifier === 'PM' && hours < 12) {
        hours += 12;
    }
    if (modifier === 'AM' && hours === 12) { // Handle midnight case
        hours = 0;
    }
    // If there's no modifier, it's already 24-hour format
    return hours * 60 + minutes;
};

const checkOverlap = (startA, endA, startB, endB) => {
    const startAMin = toMinutes(startA);
    const endAMin = toMinutes(endA);
    const startBMin = toMinutes(startB);
    const endBMin = toMinutes(endB);

    return startAMin < endBMin && endAMin > startBMin;
};


// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);

        if (match) {
            // Create JWT
            const tokenPayload = { id: user.id, username: user.username, role: user.role };
            const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });
            res.json({ success: true, token: token, user: tokenPayload });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new user (Admin only)
router.post('/admin/users', authenticateToken, isAdmin, async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ message: 'Username, password, and role are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const [result] = await db.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role]
        );
        res.status(201).json({ success: true, userId: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Username already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});


// Get all sports
router.get('/sports', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM sports');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all courts
router.get('/courts', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT c.id, c.name, c.status, s.name as sport_name, s.price FROM courts c JOIN sports s ON c.sport_id = s.id');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get court availability for a specific date and time
router.get('/courts/availability', authenticateToken, async (req, res) => {
    const { date, startTime, endTime } = req.query;
    if (!date || !startTime || !endTime) {
        return res.status(400).json({
            message: 'SERVER CODE IS UPDATED. Params are still missing.',
            received_query: req.query
        });
    }

    // If end time is not after start time, return all courts as available
    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);
    if (end <= start) {
        try {
            const [courts] = await db.query('SELECT c.id, c.name, c.status, c.sport_id, s.name as sport_name, s.price, s.capacity FROM courts c JOIN sports s ON c.sport_id = s.id');
            const availability = courts.map(court => ({ ...court, is_available: true, available_slots: court.capacity }));
            return res.json(availability);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    try {
        const [courts] = await db.query('SELECT c.id, c.name, c.status, c.sport_id, s.name as sport_name, s.price, s.capacity FROM courts c JOIN sports s ON c.sport_id = s.id');
        const [bookings] = await db.query('SELECT court_id, time_slot, slots_booked FROM bookings WHERE date = ?', [date]);
                const unavailableStatuses = ['Under Maintenance', 'Event', 'Tournament', 'Membership', 'Coaching'];
        const availability = courts.map(court => {
            if (unavailableStatuses.includes(court.status)) {
                return { ...court, is_available: false };
            }

            const courtBookings = bookings.filter(b => b.court_id === court.id);

            if (court.capacity > 1) {
                const isOverlapping = courtBookings.some(booking => {
                    const [existingStart, existingEnd] = booking.time_slot.split(' - ');
                    return checkOverlap(startTime, endTime, existingStart.trim(), existingEnd.trim());
                });

                if(isOverlapping) {
                    const slotsBooked = courtBookings.reduce((total, booking) => total + booking.slots_booked, 0);
                    const availableSlots = court.capacity - slotsBooked;
                    return { ...court, is_available: availableSlots > 0, available_slots: availableSlots };
                } else {
                    return { ...court, is_available: true, available_slots: court.capacity };
                }

            } else {
                const isOverlapping = courtBookings.some(booking => {
                    const [existingStart, existingEnd] = booking.time_slot.split(' - ');
                    return checkOverlap(startTime, endTime, existingStart.trim(), existingEnd.trim());
                });
    
                return { ...court, is_available: !isOverlapping };
            }
        });

        res.json(availability);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get bookings for a specific date
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

// Get all bookings (ledger)
router.get('/bookings/all', authenticateToken, async (req, res) => {
    try {
        let { date, sport, customer, startTime, endTime } = req.query;
        let queryParams = [];
        let query = `
            SELECT 
                b.*, 
                c.name as court_name, 
                s.name as sport_name,
                (b.total_price + b.discount_amount) as original_price,
                b.total_price as total_amount,
                u.username as created_by_user,
                DATE_FORMAT(b.date, '%Y-%m-%d') as date,
                b.is_rescheduled,
                b.discount_amount,
                b.discount_reason,
                GROUP_CONCAT(JSON_OBJECT('name', a.name, 'quantity', ba.quantity, 'price', ba.price_at_booking)) as accessories
            FROM bookings b 
            LEFT JOIN booking_accessories ba ON b.id = ba.booking_id
            LEFT JOIN accessories a ON ba.accessory_id = a.id
            JOIN courts c ON b.court_id = c.id
            JOIN sports s ON b.sport_id = s.id
            LEFT JOIN users u ON b.created_by_user_id = u.id
        `;

        let whereClauses = [];
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
            whereClauses.push("STR_TO_DATE(SUBSTRING_INDEX(b.time_slot, ' - ', 1), '%h:%i %p') >= STR_TO_DATE(?, '%h:%i %p')");
            queryParams.push(startTime);
        }
        if (endTime) {
            whereClauses.push("STR_TO_DATE(SUBSTRING_INDEX(b.time_slot, ' - ', -1), '%h:%i %p') <= STR_TO_DATE(?, '%h:%i %p')");
            queryParams.push(endTime);
        }

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }

        query += ' GROUP BY b.id ORDER BY b.date DESC';

        const [rows] = await db.query(query, queryParams);
        
        const bookings = rows.map(row => {
            if (row.accessories) {
                try {
                    // The GROUP_CONCAT with JSON_OBJECT returns a string that needs to be wrapped in an array and parsed.
                    row.accessories = JSON.parse(`[${row.accessories}]`);
                } catch (e) {
                    console.error("Error parsing accessories JSON:", e);
                    row.accessories = []; // Set to empty array on parsing error
                }
            } else {
                row.accessories = []; // Set to empty array if no accessories
            }
            return row;
        });

        res.json(bookings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// New endpoint for availability heatmap
router.get('/availability/heatmap', authenticateToken, async (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({ message: 'Date parameter is required' });
    }

    try {
        const [courts] = await db.query('SELECT c.id, c.name, c.status, s.name as sport_name, s.capacity FROM courts c JOIN sports s ON c.sport_id = s.id ORDER BY s.name, c.name');
        const [bookings] = await db.query('SELECT * FROM bookings WHERE date = ? AND status != ?', [date, 'Cancelled']);

        const timeSlots = Array.from({ length: 16 }, (_, i) => {
            const hour = 6 + i;
            return `${String(hour).padStart(2, '0')}:00`;
        });

        const heatmap = courts.map(court => {
            const courtBookings = bookings.filter(b => b.court_id === court.id);
            const slots = timeSlots.map(slot => {
                const slotStartHour = parseInt(slot.split(':')[0]);
                
                const subSlots = [0, 30].map(minute => {
                    const subSlotStartMinutes = slotStartHour * 60 + minute;
                    const subSlotEndMinutes = subSlotStartMinutes + 30;

                    let availability = 'available';
                    let booking_details = null;

                    const unavailableStatuses = ['Under Maintenance', 'Event', 'Tournament', 'Membership', 'Coaching'];
                    if (unavailableStatuses.includes(court.status)) {
                        availability = court.status.toLowerCase();
                    } else {
                        const overlappingBookings = courtBookings.filter(b => {
                            const [startStr, endStr] = b.time_slot.split(' - ');
                            const toMinutes = (timeStr) => {
                                const [time, modifier] = timeStr.split(' ');
                                let [hours, minutes] = time.split(':').map(Number);
                                if (modifier === 'PM' && hours < 12) hours += 12;
                                if (modifier === 'AM' && hours === 12) hours = 0;
                                return hours * 60 + minutes;
                            };
                            const bookingStart = toMinutes(startStr);
                            const bookingEnd = toMinutes(endStr);

                            return subSlotStartMinutes < bookingEnd && subSlotEndMinutes > bookingStart;
                        });

                        if (overlappingBookings.length > 0) {
                            booking_details = overlappingBookings.map(b => ({ id: b.id, customer_name: b.customer_name, time_slot: b.time_slot, slots_booked: b.slots_booked }));
                            if (court.capacity > 1) {
                                const slots_booked = overlappingBookings.reduce((acc, curr) => acc + curr.slots_booked, 0);
                                const available_slots = court.capacity - slots_booked;
                                if (slots_booked >= court.capacity) {
                                    availability = 'full';
                                } else {
                                    availability = 'partial';
                                }
                                booking_details.available_slots = available_slots;
                            } else {
                                availability = 'booked';
                            }
                        }
                    }
                    return { availability, booking: booking_details, available_slots: booking_details ? booking_details.available_slots : court.capacity };
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
            WHERE b.date = ?
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

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
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
        doc.fontSize(20).text('ARC SportsZone Booking Receipt', { align: 'center' });
        doc.moveDown();

        // Booking Details
        doc.fontSize(12).text(`Booking ID: ${booking.booking_id}`);
        doc.text(`Date: ${booking.date}`);
        doc.text(`Time: ${booking.time_slot}`);
        doc.moveDown();

        // Customer Details
        doc.fontSize(14).text('Customer Details', { underline: true });
        doc.fontSize(12).text(`Name: ${booking.customer_name}`);
        doc.text(`Contact: ${booking.customer_contact}`);
        doc.moveDown();
        
        // Booking Info
        doc.fontSize(14).text('Booking Information', { underline: true });
        doc.fontSize(12).text(`Sport: ${booking.sport_name}`);
        doc.text(`Court: ${booking.court_name}`);
        doc.moveDown();

        // Accessories
        if (accessories.length > 0) {
            doc.fontSize(14).text('Accessories', { underline: true });
            accessories.forEach(acc => {
                doc.fontSize(12).text(`${acc.name} (x${acc.quantity}) - Rs. ${acc.price_at_booking * acc.quantity}`)
            });
            doc.moveDown();
        }

        // Payment Details
        doc.fontSize(14).text('Payment Details', { underline: true });
        doc.fontSize(12).text(`Total Amount: Rs. ${booking.total_amount}`);
        doc.text(`Amount Paid: Rs. ${booking.amount_paid}`);
        doc.font('Helvetica-Bold').text(`Balance: Rs. ${booking.balance_amount}`);
        doc.font('Helvetica').text(`Payment Status: ${booking.payment_status}`);
        doc.moveDown();

        // Footer
        doc.fontSize(10).text('Thank you for your booking!', { align: 'center' });

        doc.end();

    } catch (err) {
        console.error(err);
        res.status(500).send('Error generating PDF');
    }
});


// Calculate price dynamically
router.post('/bookings/calculate-price', authenticateToken, async (req, res) => {
    const { sport_id, startTime, endTime, slots_booked } = req.body;

    if (!sport_id || !startTime || !endTime) {
        return res.status(400).json({ message: 'sport_id, startTime, and endTime are required.' });
    }

    try {
        const [sports] = await db.query('SELECT price FROM sports WHERE id = ?', [sport_id]);
        if (sports.length === 0) {
            return res.status(404).json({ message: 'Sport not found' });
        }
        const hourly_price = sports[0].price;

        const parseTime = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };
        const durationInMinutes = parseTime(endTime) - parseTime(startTime);

        if (durationInMinutes < 30) { // Only charge for 30 mins or more
            return res.json({ total_price: 0 });
        }

        const num_of_hours = Math.floor(durationInMinutes / 60);
        const remaining_minutes = durationInMinutes % 60;
        
        let total_price = num_of_hours * hourly_price;
        if (remaining_minutes >= 30) {
            total_price += hourly_price / 2;
        }

        if (slots_booked > 1) {
            total_price *= slots_booked;
        }

        res.json({ total_price });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new booking
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

        const [sports] = await connection.query('SELECT price, capacity FROM sports WHERE id = ?', [sport_id]);
        if (sports.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ message: 'Sport not found' });
        }
        const hourly_price = sports[0].price;
        const capacity = sports[0].capacity;

        const parseTime = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };
        const durationInMinutes = parseTime(endTime) - parseTime(startTime);

        if (durationInMinutes <= 0) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ message: 'End time must be after start time.' });
        }

        let total_price = (durationInMinutes / 60) * hourly_price;
        if (slots_booked > 1) {
            total_price *= slots_booked;
        }

        let accessories_total_price = 0;
        if (accessories && accessories.length > 0) {
            for (const acc of accessories) {
                const [[accessoryData]] = await connection.query('SELECT price FROM accessories WHERE id = ?', [acc.accessory_id]);
                if (accessoryData) {
                    accessories_total_price += accessoryData.price * acc.quantity;
                }
            }
        }
        total_price += accessories_total_price;
        total_price -= discount_amount || 0;

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
        const [existingBookings] = await connection.query('SELECT * FROM bookings WHERE court_id = ? AND date = ? AND status != ? FOR UPDATE', [court_id, date, 'Cancelled']);
        
        const overlappingBookings = existingBookings.filter(booking => {
            const [existingStart, existingEnd] = booking.time_slot.split(' - ');
            return checkOverlap(formatTo12Hour(startTime), formatTo12Hour(endTime), existingStart.trim(), existingEnd.trim());
        });

        if (overlappingBookings.length > 0) {
            if (capacity > 1) {
                const totalSlotsBooked = overlappingBookings.reduce((total, booking) => total + booking.slots_booked, 0);
                const availableSlots = capacity - totalSlotsBooked;
                if (parseInt(slots_booked) > availableSlots) {
                    await connection.rollback();
                    connection.release();
                    return res.status(409).json({ message: `Not enough slots available. Only ${availableSlots} slots left.` });
                }
            } else {
                await connection.rollback();
                connection.release();
                return res.status(409).json({ message: 'The selected time slot is unavailable.' });
            }
        }

        const [result] = await connection.query(
            'INSERT INTO bookings (court_id, sport_id, created_by_user_id, customer_name, customer_contact, customer_email, date, time_slot, total_price, amount_paid, balance_amount, payment_status, payment_mode, payment_id, slots_booked, status, discount_amount, discount_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [court_id, sport_id, created_by_user_id, customer_name, customer_contact, customer_email, date, time_slot, total_price, amount_paid, balance_amount, payment_status, payment_mode, payment_id, slots_booked, 'Booked', discount_amount, discount_reason]
        );
        const bookingId = result.insertId;

        if (accessories && accessories.length > 0) {
            for (const acc of accessories) {
                const [[accessoryData]] = await connection.query('SELECT price FROM accessories WHERE id = ?', [acc.accessory_id]);
                if (accessoryData) {
                    await connection.query('INSERT INTO booking_accessories (booking_id, accessory_id, quantity, price_at_booking) VALUES (?, ?, ?, ?)', [bookingId, acc.accessory_id, acc.quantity, accessoryData.price]);
                }
            }
        }

        await connection.commit();
        sendEventsToAll({ message: 'bookings_updated' });
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
    const fields = req.body;

    try {
        // 1. Get existing booking details to get court_id and to check if time/date changed
        const [existingBookings] = await db.query('SELECT * FROM bookings WHERE id = ?', [id]);
        if (existingBookings.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        const existingBooking = existingBookings[0];

        // 2. Format new time slot for comparison and potential update
        const formatTo12Hour = (time) => {
            if(!time) return '';
            let [hours, minutes] = time.split(':').map(Number);
            if(isNaN(hours) || isNaN(minutes)) return '';
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            minutes = minutes < 10 ? '0' + minutes : minutes;
            return `${hours}:${minutes} ${ampm}`;
        };
        
        const newTimeSlot = (fields.startTime && fields.endTime) ? `${formatTo12Hour(fields.startTime)} - ${formatTo12Hour(fields.endTime)}` : existingBooking.time_slot;
        const newDate = fields.date ? new Date(fields.date).toISOString().slice(0, 10) : new Date(existingBooking.date).toISOString().slice(0, 10);

        const hasTimeChanged = newTimeSlot !== existingBooking.time_slot;
        const hasDateChanged = newDate !== new Date(existingBooking.date).toISOString().slice(0, 10);

        // 3. Conflict Checking
        if (hasTimeChanged || hasDateChanged) {
            const [conflictingBookings] = await db.query(
                'SELECT * FROM bookings WHERE court_id = ? AND date = ? AND id != ? AND status != ?',
                [existingBooking.court_id, newDate, id, 'Cancelled']
            );

            const overlappingBookings = conflictingBookings.filter(booking => {
                const [existingStart, existingEnd] = booking.time_slot.split(' - ');
                return checkOverlap(newTimeSlot.split(' - ')[0], newTimeSlot.split(' - ')[1], existingStart.trim(), existingEnd.trim());
            });

            if (overlappingBookings.length > 0) {
                return res.status(409).json({ message: 'The selected time slot conflicts with another booking.' });
            }
        }

        // 4. Prepare fields for dynamic update
        delete fields.id;
        delete fields.court_id; // Should not be changed
        delete fields.sport_id; // Should not be changed
        delete fields.created_by_user_id; // Should not be changed
        delete fields.accessories; 
        delete fields.court_name;
        delete fields.sport_name;
        delete fields.original_price;
        delete fields.total_amount;
        delete fields.created_by_user;
        
        if (fields.startTime && fields.endTime) {
            fields.time_slot = newTimeSlot;
        }
        delete fields.startTime;
        delete fields.endTime;

        const fieldEntries = Object.entries(fields).filter(([, value]) => value !== undefined);
        if (fieldEntries.length === 0) {
            return res.status(400).json({ message: 'No fields to update' });
        }

        const setClause = fieldEntries.map(([key]) => `${key} = ?`).join(', ');
        const values = fieldEntries.map(([, value]) => value);

        // 5. Execute update
        const sql = `UPDATE bookings SET ${setClause} WHERE id = ?`;
        await db.query(sql, [...values, id]);
        sendEventsToAll({ message: 'bookings_updated' });
        res.json({ success: true, message: 'Booking updated successfully' });

    } catch (err) {
        console.error("Error updating booking:", err);
        res.status(500).json({ error: err.message });
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
        sendEventsToAll({ message: 'bookings_updated' });
        res.json({ success: true, message: 'Payment updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Cancel a booking
router.put('/bookings/:id/cancel', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query("UPDATE bookings SET status = 'Cancelled' WHERE id = ?", [id]);
        sendEventsToAll({ message: 'bookings_updated' });
        res.json({ success: true, message: 'Booking cancelled successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update court status
router.put('/courts/:id/status', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await db.query('UPDATE courts SET status = ? WHERE id = ?', [status, id]);
        req.io.emit('courts_updated');
        sendEventsToAll({ message: 'bookings_updated' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new sport
router.post('/sports', authenticateToken, isAdmin, async (req, res) => {
    const { name, price } = req.body;
    if (!name || price === undefined) {
        return res.status(400).json({ message: 'Sport name and price are required' });
    }
    try {
        const [result] = await db.query('INSERT INTO sports (name, price) VALUES (?, ?)', [name, price]);
        res.json({ success: true, sportId: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update sport price
router.put('/sports/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { price } = req.body;
    if (price === undefined) {
        return res.status(400).json({ message: 'Price is required' });
    }
    try {
        await db.query('UPDATE sports SET price = ? WHERE id = ?', [price, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new court
router.post('/courts', authenticateToken, isAdmin, async (req, res) => {
    const { name, sport_id } = req.body;
    if (!name || !sport_id) {
        return res.status(400).json({ message: 'Court name and sport ID are required' });
    }
    try {
        const [result] = await db.query('INSERT INTO courts (name, sport_id) VALUES (?, ?)', [name, sport_id]);
        res.json({ success: true, courtId: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a court
router.delete('/courts/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM courts WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a sport
router.delete('/sports/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM sports WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Accessories CRUD
router.get('/accessories', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM accessories');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/accessories', authenticateToken, isAdmin, async (req, res) => {
    const { name, price } = req.body;
    if (!name || price === undefined) {
        return res.status(400).json({ message: 'Accessory name and price are required' });
    }
    try {
        const [result] = await db.query('INSERT INTO accessories (name, price) VALUES (?, ?)', [name, price]);
        res.json({ success: true, accessoryId: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/accessories/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, price } = req.body;
    if (!name || price === undefined) {
        return res.status(400).json({ message: 'Accessory name and price are required' });
    }
    try {
        await db.query('UPDATE accessories SET name = ?, price = ? WHERE id = ?', [name, price, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/accessories/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM accessories WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Analytics: Summary
router.get('/analytics/summary', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let dateFilter = '';
        let queryParams = [];

        if (startDate && endDate) {
            dateFilter = ' AND date BETWEEN ? AND ?';
            queryParams.push(startDate, endDate);
        }

        const [[{ total_bookings }]] = await db.query(`SELECT COUNT(*) as total_bookings FROM bookings WHERE status != ?${dateFilter}`, ['Cancelled', ...queryParams]);
        const [[{ total_revenue }]] = await db.query(`SELECT SUM(amount_paid) as total_revenue FROM bookings WHERE status != ?${dateFilter}`, ['Cancelled', ...queryParams]);
        const [[{ total_cancellations }]] = await db.query(`SELECT COUNT(*) as total_cancellations FROM bookings WHERE status = ?${dateFilter}`, ['Cancelled', ...queryParams]);
        const [[{ total_sports }]] = await db.query('SELECT COUNT(*) as total_sports FROM sports');
        const [[{ total_courts }]] = await db.query('SELECT COUNT(*) as total_courts FROM courts');
        const [[{ total_discount }]] = await db.query(`SELECT SUM(discount_amount) as total_discount FROM bookings WHERE status != ?${dateFilter}`, ['Cancelled', ...queryParams]);

        res.json({
            total_bookings,
            total_revenue,
            total_cancellations,
            total_sports,
            total_courts,
            total_discount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Analytics: Bookings over time
router.get('/analytics/bookings-over-time', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let dateFilter = '';
        let queryParams = [];

        if (startDate && endDate) {
            dateFilter = ' WHERE date BETWEEN ? AND ?';
            queryParams.push(startDate, endDate);
        }

        const [rows] = await db.query(`
            SELECT DATE(date) as date, COUNT(*) as count 
            FROM bookings 
            ${dateFilter}
            GROUP BY DATE(date) 
            ORDER BY DATE(date) ASC
        `, queryParams);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Analytics: Revenue by sport
router.get('/analytics/revenue-by-sport', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let dateFilter = '';
        let queryParams = ['Cancelled'];

        if (startDate && endDate) {
            dateFilter = ' AND b.date BETWEEN ? AND ?';
            queryParams.push(startDate, endDate);
        }

        const [rows] = await db.query(`
            SELECT s.name, SUM(b.amount_paid) as revenue
            FROM bookings b
            JOIN sports s ON b.sport_id = s.id
            WHERE b.status != ?
            ${dateFilter}
            GROUP BY s.name
            ORDER BY revenue DESC
        `, queryParams);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Analytics: Court Utilization Heatmap
router.get('/analytics/utilization-heatmap', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let dateFilter = '';
        let queryParams = ['Cancelled'];

        if (startDate && endDate) {
            dateFilter = ' AND date BETWEEN ? AND ?';
            queryParams.push(startDate, endDate);
        }

        const [rows] = await db.query(`
            SELECT 
                DAYNAME(date) as day_of_week,
                HOUR(STR_TO_DATE(SUBSTRING_INDEX(time_slot, ' - ', 1), '%h:%i %p')) as hour_of_day,
                COUNT(*) as booking_count
            FROM 
                bookings
            WHERE
                status != ?
                ${dateFilter}
            GROUP BY 
                day_of_week, hour_of_day
            ORDER BY
                FIELD(day_of_week, 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
                hour_of_day;
        `, queryParams);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Analytics: Booking Status Distribution
router.get('/analytics/booking-status-distribution', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let dateFilter = '';
        let queryParams = [];

        if (startDate && endDate) {
            dateFilter = ' WHERE date BETWEEN ? AND ?';
            queryParams.push(startDate, endDate);
        }

        const [rows] = await db.query(`
            SELECT status, COUNT(*) as count 
            FROM bookings 
            ${dateFilter}
            GROUP BY status
        `, queryParams);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Analytics: Revenue by Payment Mode
router.get('/analytics/revenue-by-payment-mode', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let dateFilter = '';
        let queryParams = ['Cancelled'];

        if (startDate && endDate) {
            dateFilter = ' AND date BETWEEN ? AND ?';
            queryParams.push(startDate, endDate);
        }

        const [rows] = await db.query(`
            SELECT payment_mode, SUM(amount_paid) as revenue
            FROM bookings
            WHERE status != ?
            ${dateFilter}
            GROUP BY payment_mode
            ORDER BY revenue DESC
        `, queryParams);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Analytics: Staff Performance
router.get('/analytics/staff-performance', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let dateFilter = '';
        let queryParams = ['Cancelled'];

        if (startDate && endDate) {
            dateFilter = ' AND b.date BETWEEN ? AND ?';
            queryParams.push(startDate, endDate);
        }

        const [rows] = await db.query(`
            SELECT u.username, COUNT(b.id) as booking_count
            FROM bookings b
            JOIN users u ON b.created_by_user_id = u.id
            WHERE b.status != ?
            ${dateFilter}
            GROUP BY u.username
            ORDER BY booking_count DESC
        `, queryParams);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ledger Download
router.get('/ledger/download', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                b.id as booking_id,
                b.customer_name,
                b.customer_contact,
                b.customer_email,
                s.name as sport_name,
                c.name as court_name,
                DATE_FORMAT(b.date, '%Y-%m-%d') as date,
                b.time_slot,
                b.payment_mode,
                b.amount_paid,
                b.balance_amount,
                b.payment_status,
                b.status as booking_status,
                u.username as created_by
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            JOIN sports s ON b.sport_id = s.id
            LEFT JOIN users u ON b.created_by_user_id = u.id
            ORDER BY b.id DESC
        `);

        const fields = ['booking_id', 'customer_name', 'customer_contact', 'customer_email', 'sport_name', 'court_name', 'date', 'time_slot', 'payment_mode', 'amount_paid', 'balance_amount', 'payment_status', 'booking_status', 'created_by'];
        const json2csv = require('json2csv').parse;
        const csv = json2csv(rows, { fields });

        res.header('Content-Type', 'text/csv');
        res.attachment('ledger.csv');
        res.send(csv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Note: The WhatsApp route is not protected by JWT auth as it's for external users.
router.post('/whatsapp', async (req, res) => {

    const twiml = new twilio.twiml.MessagingResponse();
    const userMessage = req.body.Body; // Use original case for names, etc.
    const trimmedMessage = userMessage.trim();
    const from = req.body.From;
    const to = req.body.To;

    const formatTo12Hour = (time) => {
        let [hours, minutes] = time.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0' + minutes : minutes;
        return `${hours}:${minutes} ${ampm}`;
    };

    let session = userSessions[from];

    if (!session) {
        session = { step: 'welcome' };
        userSessions[from] = session;
    }

    if (trimmedMessage.toLowerCase() === 'hi') {
        // Reset session
        userSessions[from] = { step: 'welcome' };
        session = userSessions[from];
    }

    try {
        switch (session.step) {
            case 'welcome':
                const [sports] = await db.query('SELECT * FROM sports');
                let sportList = sports.map(s => s.name).join('\n');
                twiml.message(`Welcome to ARC SportsZone Booking!\n\nPlease select a sport by replying with the name:${sportList}`);
                session.step = 'select_sport';
                break;

            case 'select_sport':
                const [selectedSport] = await db.query('SELECT * FROM sports WHERE name LIKE ?', [`%${trimmedMessage}%`]);
                if (selectedSport.length > 0) {
                    session.sport_id = selectedSport[0].id;
                    session.sport_name = selectedSport[0].name;
                    session.amount = selectedSport[0].price;
                    twiml.message('Great! Please enter the date for your booking (e.g., YYYY-MM-DD).');
                    session.step = 'select_date';
                } else {
                    twiml.message('Invalid sport. Please select a sport from the list.');
                }
                break;

            case 'select_date':
                // Basic validation for date format
                if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(trimmedMessage)) {
                    twiml.message('Invalid date format. Please use YYYY-MM-DD.');
                    break;
                }
                session.date = trimmedMessage;
                twiml.message('Please enter the start time for your booking (e.g., 10:00 or 14:00).');
                session.step = 'select_time';
                break;

            case 'select_time':
                // Basic validation for time format
                if (!/^\\d{2}:\\d{2}$/.test(trimmedMessage)) {
                    twiml.message('Invalid time format. Please use HH:MM (e.g., 09:00 or 15:00).');
                    break;
                }
                const startHour = parseInt(trimmedMessage.split(':')[0]);
                if (startHour < 6 || startHour > 21) {
                    twiml.message('Sorry, bookings are only available from 6:00 to 22:00. Please choose another time.');
                    break;
                }

                session.startTime = trimmedMessage;
                session.endTime = `${String(startHour + 1).padStart(2, '0')}:00`; // Assume 1 hour booking

                const time_slot_12hr = `${formatTo12Hour(session.startTime)} - ${formatTo12Hour(session.endTime)}`;

                const [availableCourts] = await db.query(
                    'SELECT c.id, c.name FROM courts c LEFT JOIN bookings b ON c.id = b.court_id AND b.date = ? AND b.time_slot = ? WHERE c.sport_id = ? AND c.status = ? AND b.id IS NULL',
                    [session.date, time_slot_12hr, session.sport_id, 'Available']
                );

                if (availableCourts.length > 0) {
                    session.court_id = availableCourts[0].id;
                    session.court_name = availableCourts[0].name;
                    twiml.message(`Court available! The price is ₹${session.amount}.\n\nPlease enter your full name to proceed.`);
                    session.step = 'enter_name';
                } else {
                    twiml.message('Sorry, no courts available at that time. Please try another time.');
                    session.step = 'select_time';
                }
                break;

            case 'enter_name':
                session.customer_name = trimmedMessage;
                twiml.message('Thank you. Please enter your 10-digit phone number.');
                session.step = 'enter_phone';
                break;

            case 'enter_phone':
                if (!/^\\d{10}$/.test(trimmedMessage)) {
                    twiml.message('Invalid phone number. Please enter a 10-digit number.');
                    break;
                }
                session.customer_contact = trimmedMessage;
                const time_slot = `${formatTo12Hour(session.startTime)} - ${formatTo12Hour(session.endTime)}`;
                const sql = 'INSERT INTO bookings (court_id, sport_id, customer_name, customer_contact, date, time_slot, payment_mode, amount_paid, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
                const values = [session.court_id, session.sport_id, session.customer_name, session.customer_contact, session.date, time_slot, 'online', session.amount, 'Booked'];
                
                try {
                    const [result] = await db.query(sql, values);
                    const bookingId = result.insertId;

                    // Send confirmation message
                    const receipt = `
*Booking Confirmed!*
-------------------------
Receipt ID: ${bookingId}
Name: ${session.customer_name}
Contact: ${session.customer_contact}
Sport: ${session.sport_name}
Court: ${session.court_name}
Date: ${session.date}
Time: ${time_slot}
Amount: ₹${session.amount}
Status: Booked
-------------------------
Thank you for booking with ARC SportsZone!
                    `;

                    await client.messages.create({
                        body: receipt,
                        from: to, // Twilio number
                        to: from  // User's number
                    });

                    twiml.message('Thank you! Your booking is confirmed. I have sent you a receipt.');
                    delete userSessions[from]; // End session

                } catch (dbError) {
                    console.error("Database error:", dbError);
                    twiml.message('Sorry, there was an error processing your booking. Please try again later.');
                    delete userSessions[from];
                }
                break;
        }
    } catch (error) {
        console.error('Error in /whatsapp route:', error);
        twiml.message('An unexpected error occurred. Please try again later.');
    }

    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
});

// Check for booking conflicts in real-time
router.post('/bookings/check-clash', authenticateToken, async (req, res) => {
    const { court_id, date, startTime, endTime, bookingId } = req.body;

    if (!court_id || !date || !startTime || !endTime) {
        return res.status(400).json({ message: 'court_id, date, startTime, and endTime are required.' });
    }

    try {
        const query = 'SELECT * FROM bookings WHERE court_id = ? AND date = ? AND status != ?' + (bookingId ? ' AND id != ?' : '');
        const params = [court_id, date, 'Cancelled'];
        if (bookingId) {
            params.push(bookingId);
        }

        const [conflictingBookings] = await db.query(query, params);

        const toMinutes = (timeStr) => {
            const [time, modifier] = timeStr.split(' ');
            let [hours, minutes] = time.split(':').map(Number);
            if (modifier === 'PM' && hours < 12) hours += 12;
            if (modifier === 'AM' && hours === 12) hours = 0;
            return hours * 60 + minutes;
        };

        const checkOverlap = (startA, endA, startB, endB) => {
            const startAMin = toMinutes(startA);
            const endAMin = toMinutes(endA);
            const startBMin = toMinutes(startB);
            const endBMin = toMinutes(endB);
            return startAMin < endBMin && endAMin > startBMin;
        };

        const formatTo12Hour = (time) => {
            let [hours, minutes] = time.split(':').map(Number);
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            minutes = minutes < 10 ? '0' + minutes : minutes;
            return `${hours}:${minutes} ${ampm}`;
        };

        const newTimeSlot = `${formatTo12Hour(startTime)} - ${formatTo12Hour(endTime)}`;
        const [newStart, newEnd] = newTimeSlot.split(' - ');

        const isOverlapping = conflictingBookings.some(booking => {
            const [existingStart, existingEnd] = booking.time_slot.split(' - ');
            return checkOverlap(newStart.trim(), newEnd.trim(), existingStart.trim(), existingEnd.trim());
        });

        if (isOverlapping) {
            return res.status(200).json({ is_clashing: true, message: 'The selected time slot conflicts with another booking.' });
        } else {
            return res.status(200).json({ is_clashing: false, message: 'The selected time slot is available.' });
        }

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;