const express = require('express');
const router = express.Router();
const db = require('../database');
const twilio = require('twilio');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');

const saltRounds = 10;
const JWT_SECRET = process.env.JWT_SECRET; // Use environment variable for secret

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

const isPrivilegedUser = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'desk') {
        return res.status(403).json({ message: 'Access denied' });
    }
    next();
};

const toMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!parts) return 0;

    let hours = parseInt(parts[1], 10);
    const minutes = parseInt(parts[2], 10);
    const modifier = parts[3] ? parts[3].toUpperCase() : null;

    if (modifier === 'PM' && hours < 12) {
        hours += 12;
    } else if (modifier === 'AM' && hours === 12) {
        hours = 0;
    }
    return hours * 60 + minutes;
};

const parseTimeTo24Hour = (timeStr) => {
    if (!timeStr) return null;
    const parts = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!parts) return null;

    let hours = parseInt(parts[1], 10);
    const minutes = parseInt(parts[2], 10);
    const modifier = parts[3] ? parts[3].toUpperCase() : null;

    if (modifier === 'PM' && hours < 12) {
        hours += 12;
    } else if (modifier === 'AM' && hours === 12) {
        hours = 0;
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatTo12Hour = (time24hStr) => {
    if (!time24hStr) return '';
    let [hours, minutes] = time24hStr.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
};

const checkOverlap = (startA, endA, startB, endB) => {
    const startAMin = toMinutes(startA);
    const endAMin = toMinutes(endA);
    const startBMin = toMinutes(startB);
    const endBMin = toMinutes(endB);

    return startAMin < endBMin && endAMin > startBMin;
};
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

// Get all users (Admin only)
router.get('/admin/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, username, role FROM users');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a user (Admin only)
router.delete('/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
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
                const overlappingBookings = courtBookings.filter(booking => {
                    const [existingStart, existingEnd] = booking.time_slot.split(' - ');
                    return checkOverlap(startTime, endTime, existingStart.trim(), existingEnd.trim());
                });

                if (overlappingBookings.length > 0) {
                    const slotsBooked = overlappingBookings.reduce((total, booking) => total + booking.slots_booked, 0);
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

        if (status === 'closed') {
             whereClauses.push('b.status != ?');
             queryParams.push('Cancelled');
             whereClauses.push('b.payment_status = ?');
             queryParams.push('Completed');
             // This logic assumes a booking is "closed" if it's in the past and completed.
             // We'll check the end time against the current time.
             whereClauses.push(`STR_TO_DATE(CONCAT(b.date, ' ', SUBSTRING_INDEX(b.time_slot, ' - ', -1)), '%Y-%m-%d %h:%i %p') < NOW()`);
        } else if (status === 'cancelled') {
            whereClauses.push('b.status = ?');
            queryParams.push('Cancelled');
        } else if (status === 'active') {
            whereClauses.push('b.status != ?');
            queryParams.push('Cancelled');
            whereClauses.push(`NOT (b.payment_status = 'Completed' AND STR_TO_DATE(CONCAT(b.date, ' ', SUBSTRING_INDEX(b.time_slot, ' - ', -1)), '%Y-%m-%d %h:%i %p') < NOW())`);
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
        queryParams.push(parseInt(limit, 10), parseInt(offset, 10));

        const [rows] = await connection.query(query, queryParams);
        
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
    if (!date) {
        return res.status(400).json({ message: 'Date parameter is required' });
    }

    try {
        const [courts] = await db.query('SELECT c.id, c.name, c.status, s.name as sport_name, s.capacity FROM courts c JOIN sports s ON c.sport_id = s.id ORDER BY s.name, c.name');
        const [bookings] = await db.query('SELECT * FROM bookings WHERE date = ? AND status != ?', [date, 'Cancelled']);

        const timeSlots = Array.from({ length: 18 }, (_, i) => {
            const hour = 5 + i;
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
            WHERE b.date = ? OR (b.payment_status IN ('Pending', 'Received') AND b.status != 'Cancelled')
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
        const durationInMinutes = parseTime(endTime) - parseTime(startTime);

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
        const durationInMinutes = parseTime(endTime) - parseTime(startTime);

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
        sendEventsToAll({ message: 'bookings_updated' });

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
        sendEventsToAll({ message: 'bookings_updated' });
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
        sendEventsToAll({ message: 'bookings_updated' });
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

        sendEventsToAll({ message: 'bookings_updated' });
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
        sendEventsToAll({ message: 'bookings_updated' });
        res.json({ success: true, message: 'Booking cancelled successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update court status
router.put('/courts/:id/status', authenticateToken, isPrivilegedUser, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await db.query('UPDATE courts SET status = ? WHERE id = ?', [status, id]);
        sendEventsToAll({ message: 'courts_updated' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new sport
router.post('/sports', authenticateToken, isAdmin, async (req, res) => {
    const { name, price, capacity } = req.body;
    if (!name || price === undefined) {
        return res.status(400).json({ message: 'Sport name and price are required' });
    }
    if (parseFloat(price) < 0) {
        return res.status(400).json({ message: 'Price cannot be negative' });
    }
    if (capacity !== undefined && parseInt(capacity) <= 0) {
        return res.status(400).json({ message: 'Capacity must be a positive number' });
    }
    try {
        const [result] = await db.query('INSERT INTO sports (name, price, capacity) VALUES (?, ?, ?)', [name, price, capacity || 1]);
        res.json({ success: true, sportId: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update sport price
router.put('/sports/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { price, capacity } = req.body;
    if (price === undefined) {
        return res.status(400).json({ message: 'Price is required' });
    }
    if (parseFloat(price) < 0) {
        return res.status(400).json({ message: 'Price cannot be negative' });
    }
    if (capacity !== undefined && parseInt(capacity) <= 0) {
        return res.status(400).json({ message: 'Capacity must be a positive number' });
    }
    try {
        await db.query('UPDATE sports SET price = ?, capacity = ? WHERE id = ?', [price, capacity || 1, id]);
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
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Court name already exists' });
        }
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
    if (parseFloat(price) < 0) {
        return res.status(400).json({ message: 'Price cannot be negative' });
    }

    try {
        const [result] = await db.query('INSERT INTO accessories (name, price) VALUES (?, ?)', [name, price]);
        sendEventsToAll({ message: 'accessories_updated' });
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
    if (parseFloat(price) < 0) {
        return res.status(400).json({ message: 'Price cannot be negative' });
    }
    try {
        await db.query('UPDATE accessories SET name = ?, price = ? WHERE id = ?', [name, price, id]);
        sendEventsToAll({ message: 'accessories_updated' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/accessories/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM accessories WHERE id = ?', [id]);
        sendEventsToAll({ message: 'accessories_updated' });
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
        const [[{ active_total_amount }]] = await db.query(`SELECT SUM(total_price) as active_total_amount FROM bookings WHERE status != ?${dateFilter}`, ['Cancelled', ...queryParams]);
        const [[{ amount_received }]] = await db.query(`SELECT SUM(amount_paid) as amount_received FROM bookings WHERE 1=1${dateFilter}`, [...queryParams]);
        const [[{ total_cancellations }]] = await db.query(`SELECT COUNT(*) as total_cancellations FROM bookings WHERE status = ?${dateFilter}`, ['Cancelled', ...queryParams]);
        const [[{ total_sports }]] = await db.query('SELECT COUNT(*) as total_sports FROM sports');
        const [[{ total_courts }]] = await db.query('SELECT COUNT(*) as total_courts FROM courts');
        const [[{ total_discount }]] = await db.query(`SELECT SUM(discount_amount) as total_discount FROM bookings WHERE status != ?${dateFilter}`, ['Cancelled', ...queryParams]);
        const [[{ cancelled_revenue }]] = await db.query(`SELECT SUM(amount_paid) as cancelled_revenue FROM bookings WHERE status = ?${dateFilter}`, ['Cancelled', ...queryParams]);

        const [[{ amount_pending }]] = await db.query(`SELECT COALESCE(SUM(balance_amount), 0) as amount_pending FROM bookings WHERE balance_amount > 0${dateFilter}`, [...queryParams]);

        const total_amount = (parseFloat(active_total_amount) || 0) + (parseFloat(cancelled_revenue) || 0);

        res.json({
            total_bookings,
            total_amount,
            amount_received,
            amount_pending: parseFloat(amount_pending) || 0,
            total_cancellations,
            total_sports,
            total_courts,
            total_discount,
            cancelled_revenue
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Analytics: Desk Summary
router.get('/analytics/desk-summary', authenticateToken, isPrivilegedUser, async (req, res) => {
    try {
        const { date } = req.query; // Optional: filter by date

        let whereClauses = ["status != 'Cancelled'"];
        let queryParams = [];

        if (date) {
            whereClauses.push('date = ?');
            queryParams.push(date);
        }

        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const [[{ total_bookings }]] = await db.query(`SELECT COUNT(*) as total_bookings FROM bookings ${whereString}`, queryParams);
        
        // Total revenue should probably include revenue from cancelled bookings, so we query it separately.
        const totalRevenueParams = date ? [date] : [];
        const totalRevenueFilter = date ? 'WHERE date = ?' : '';
        const [[{ total_revenue }]] = await db.query(`SELECT COALESCE(SUM(amount_paid), 0) as total_revenue FROM bookings ${totalRevenueFilter}`, totalRevenueParams);

        const [[{ pending_amount }]] = await db.query(`SELECT COALESCE(SUM(balance_amount), 0) as pending_amount FROM bookings ${whereString} AND balance_amount > 0`, queryParams);
        
        const paymentModeQuery = `
            SELECT p.payment_mode, SUM(p.amount) as total
            FROM payments p
            ${date ? 'JOIN bookings b ON p.booking_id = b.id WHERE b.date = ?' : ''}
            GROUP BY p.payment_mode
        `;
        const paymentModeParams = date ? [date] : [];
        const [revenue_by_mode_rows] = await db.query(paymentModeQuery, paymentModeParams);
        const revenue_by_mode = revenue_by_mode_rows.map(row => ({
            ...row,
            total: parseFloat(row.total) || 0
        }));

        res.json({
            total_bookings: total_bookings || 0,
            total_revenue: parseFloat(total_revenue) || 0,
            pending_amount: parseFloat(pending_amount) || 0,
            revenue_by_mode: revenue_by_mode || [],
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
            dateFilter = ' AND b.date BETWEEN ? AND ?';
            queryParams.push(startDate, endDate);
        }

        const [rows] = await db.query(`
            SELECT p.payment_mode, SUM(p.amount) as revenue
            FROM payments p
            JOIN bookings b ON p.booking_id = b.id
            WHERE b.status != ?
            ${dateFilter}
            GROUP BY p.payment_mode
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
    const { court_id, date, startTime, endTime, bookingId, slots_booked } = req.body;

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

        const newStart = formatTo12Hour(startTime);
        const newEnd = formatTo12Hour(endTime);

        // Get sport_id from court_id
        const [[courtDetails]] = await db.query('SELECT sport_id FROM courts WHERE id = ?', [court_id]);
        if (!courtDetails) {
            return res.status(404).json({ message: 'Court not found' });
        }
        const sport_id = courtDetails.sport_id;

        // Get capacity for the sport
        const [[sportDetails]] = await db.query('SELECT capacity FROM sports WHERE id = ?', [sport_id]);
        const capacity = parseInt(sportDetails.capacity, 10);

        // Filter conflicting bookings to only those that actually overlap
        const overlappingBookings = conflictingBookings.filter(booking => {
            const [existingStart, existingEnd] = booking.time_slot.split(' - ');
            return checkOverlap(newStart, newEnd, existingStart.trim(), existingEnd.trim());
        });

        if (capacity > 1) {
            // Multi-capacity logic
            const totalSlotsInOverlap = overlappingBookings.reduce((total, b) => total + parseInt(b.slots_booked, 10), 0);
            const slotsForNewBooking = parseInt(slots_booked || 1, 10); // Use slots_booked from req.body, default to 1

            if ((totalSlotsInOverlap + slotsForNewBooking) > capacity) {
                const availableSlots = capacity - totalSlotsInOverlap;
                return res.status(200).json({ is_clashing: true, message: `Not enough slots available. Only ${availableSlots} slots left.` });
            } else {
                return res.status(200).json({ is_clashing: false, message: 'The selected time slot is available.' });
            }
        } else {
            // Single-capacity logic
            if (overlappingBookings.length > 0) {
                return res.status(200).json({ is_clashing: true, message: 'The selected time slot conflicts with another booking.' });
            } else {
                return res.status(200).json({ is_clashing: false, message: 'The selected time slot is available.' });
            }
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;