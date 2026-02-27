const express = require('express');
const router = express.Router();
const db = require('../../database');
const { authenticateToken } = require('../../middleware/auth');

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

// --- Overall Analytics ---

// Analytics: Overall Summary

module.exports = router;
