const express = require('express');
const router = express.Router();
const db = require('../../database');
const { authenticateToken, isAdmin, isPrivilegedUser } = require('../../middleware/auth');
const { buildDateFilter } = require('../../utils/helpers');

router.get('/analytics/summary', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const { filterSql: bookingDateFilterSql, queryParams: bookingQueryParams } = buildDateFilter('date', startDate, endDate, false); // bookings.date is DATE

        const [[{ total_bookings }]] = await db.query(`SELECT COUNT(*) as total_bookings FROM bookings WHERE status != ?${bookingDateFilterSql}`, ['Cancelled', ...bookingQueryParams]);
        const [[{ active_total_amount }]] = await db.query(`SELECT SUM(total_price) as active_total_amount FROM bookings WHERE status != ?${bookingDateFilterSql}`, ['Cancelled', ...bookingQueryParams]);
        const [[{ amount_received }]] = await db.query(`SELECT SUM(amount_paid) as amount_received FROM bookings WHERE 1=1${bookingDateFilterSql}`, [...bookingQueryParams]);
        const [[{ total_cancellations }]] = await db.query(`SELECT COUNT(*) as total_cancellations FROM bookings WHERE status = ?${bookingDateFilterSql}`, ['Cancelled', ...bookingQueryParams]);
        const [[{ total_sports }]] = await db.query('SELECT COUNT(*) as total_sports FROM sports');
        const [[{ total_courts }]] = await db.query('SELECT COUNT(*) as total_courts FROM courts');
        const [[{ total_discount }]] = await db.query(`SELECT SUM(discount_amount) as total_discount FROM bookings WHERE status != ?${bookingDateFilterSql}`, ['Cancelled', ...bookingQueryParams]);
        const [[{ cancelled_revenue }]] = await db.query(`SELECT SUM(amount_paid) as cancelled_revenue FROM bookings WHERE status = ?${bookingDateFilterSql}`, ['Cancelled', ...bookingQueryParams]);

        const [[{ amount_pending }]] = await db.query(`SELECT COALESCE(SUM(balance_amount), 0) as amount_pending FROM bookings WHERE balance_amount > 0 AND status = 'Booked'${bookingDateFilterSql}`, [...bookingQueryParams]);

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

        const { filterSql: bookingDateFilterSql, queryParams: bookingQueryParams } = buildDateFilter('date', startDate, endDate, false); // bookings.date is DATE

        const [rows] = await db.query(`
            SELECT DATE(date) as date, COUNT(*) as count 
            FROM bookings 
            ${bookingDateFilterSql ? ' WHERE ' + bookingDateFilterSql.substring(5) : ''}
            GROUP BY DATE(date) 
            ORDER BY DATE(date) ASC
        `, bookingQueryParams);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Analytics: Revenue by sport
router.get('/analytics/revenue-by-sport', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const { filterSql: bookingDateFilterSql, queryParams: bookingQueryParams } = buildDateFilter('b.date', startDate, endDate, false); // bookings.date is DATE

        const [rows] = await db.query(`
            SELECT s.name, SUM(b.amount_paid) as revenue
            FROM bookings b
            JOIN sports s ON b.sport_id = s.id
            WHERE b.status != ?
            ${bookingDateFilterSql}
            GROUP BY s.name
            ORDER BY revenue DESC
        `, ['Cancelled', ...bookingQueryParams]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Analytics: Court Utilization Heatmap
router.get('/analytics/utilization-heatmap', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const { filterSql: bookingDateFilterSql, queryParams: bookingQueryParams } = buildDateFilter('date', startDate, endDate, false); // bookings.date is DATE

        const [rows] = await db.query(`
            SELECT 
                DAYNAME(date) as day_of_week,
                HOUR(STR_TO_DATE(SUBSTRING_INDEX(time_slot, ' - ', 1), '%h:%i %p')) as hour_of_day,
                COUNT(*) as booking_count
            FROM 
                bookings
            WHERE
                status != ?
                ${bookingDateFilterSql}
            GROUP BY 
                day_of_week, hour_of_day
            ORDER BY
                FIELD(day_of_week, 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
                hour_of_day;
        `, ['Cancelled', ...bookingQueryParams]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Analytics: Booking Status Distribution
router.get('/analytics/booking-status-distribution', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const { filterSql: bookingDateFilterSql, queryParams: bookingQueryParams } = buildDateFilter('date', startDate, endDate, false); // bookings.date is DATE

        const [rows] = await db.query(`
            SELECT status, COUNT(*) as count 
            FROM bookings 
            ${bookingDateFilterSql ? ' WHERE ' + bookingDateFilterSql.substring(5) : ''}
            GROUP BY status
        `, bookingQueryParams);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Analytics: Revenue by Payment Mode
router.get('/analytics/revenue-by-payment-mode', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const { filterSql: bookingDateFilterSql, queryParams: bookingQueryParams } = buildDateFilter('b.date', startDate, endDate, false); // bookings.date is DATE

        const [rows] = await db.query(`
            SELECT p.payment_mode, SUM(p.amount) as revenue
            FROM payments p
            JOIN bookings b ON p.booking_id = b.id
            WHERE b.status != ?
            ${bookingDateFilterSql}
            GROUP BY p.payment_mode
            ORDER BY revenue DESC
        `, ['Cancelled', ...bookingQueryParams]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Analytics: Staff Performance
router.get('/analytics/staff-performance', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const { filterSql: bookingDateFilterSql, queryParams: bookingQueryParams } = buildDateFilter('b.date', startDate, endDate, false); // bookings.date is DATE

        const [rows] = await db.query(`
            SELECT u.username, COUNT(b.id) as booking_count
            FROM bookings b
            JOIN users u ON b.created_by_user_id = u.id
            WHERE b.status != ?
            ${bookingDateFilterSql}
            GROUP BY u.username
            ORDER BY booking_count DESC
        `, ['Cancelled', ...bookingQueryParams]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Membership Analytics ---

// Analytics: Membership Summary
router.get('/analytics/membership/summary', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const { filterSql: membershipDateFilterSql, queryParams: membershipQueryParams } = buildDateFilter('am.start_date', startDate, endDate, false); // active_memberships.start_date is DATE
        const { filterSql: paymentDateFilterSql, queryParams: paymentQueryParams } = buildDateFilter('p.payment_date', startDate, endDate, true); // payments.payment_date is DATETIME

        // 1. Total Active Memberships (snapshot: currently active, regardless of date range)
        const [[{ total_active }]] = await db.query('SELECT COUNT(*) as total_active FROM active_memberships WHERE current_end_date >= CURDATE()');

        // 2. New Memberships (Started in range)
        const [[{ new_memberships }]] = await db.query(`SELECT COUNT(*) as new_memberships FROM active_memberships am WHERE 1=1 ${membershipDateFilterSql}`, membershipQueryParams);

        // 3. Total Revenue (Payments made in range)
        const [[{ total_revenue }]] = await db.query(`SELECT SUM(amount) as total_revenue FROM payments p WHERE p.membership_id IS NOT NULL ${paymentDateFilterSql}`, paymentQueryParams);

        res.json({
            total_active,
            new_memberships,
            total_revenue: parseFloat(total_revenue) || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Analytics: Membership Revenue by Sport
router.get('/analytics/membership/revenue-by-sport', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const { filterSql: paymentDateFilterSql, queryParams: paymentQueryParams } = buildDateFilter('p.payment_date', startDate, endDate, true); // payments.payment_date is DATETIME

        const [rows] = await db.query(`
            SELECT s.name, SUM(p.amount) as revenue
            FROM payments p
            JOIN active_memberships am ON p.membership_id = am.id
            JOIN membership_packages mp ON am.package_id = mp.id
            JOIN sports s ON mp.sport_id = s.id
            WHERE p.membership_id IS NOT NULL
            ${paymentDateFilterSql}
            GROUP BY s.name
            ORDER BY revenue DESC
        `, paymentQueryParams);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Analytics: Membership Revenue by Payment Mode
router.get('/analytics/membership/revenue-by-payment-mode', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const { filterSql: paymentDateFilterSql, queryParams: paymentQueryParams } = buildDateFilter('payment_date', startDate, endDate, true); // payments.payment_date is DATETIME

        const [rows] = await db.query(`
            SELECT payment_mode, SUM(amount) as revenue
            FROM payments
            WHERE membership_id IS NOT NULL
            ${paymentDateFilterSql}
            GROUP BY payment_mode
            ORDER BY revenue DESC
        `, paymentQueryParams);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ledger Download

router.get('/analytics/overall/summary', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const { filterSql: paymentDateFilterSql, queryParams: paymentQueryParams } = buildDateFilter('payment_date', startDate, endDate, true);
        const { filterSql: bookingDateFilterSql, queryParams: bookingQueryParams } = buildDateFilter('date', startDate, endDate, false);

        // 1. Total Revenue (All payments)
        const [[{ total_revenue }]] = await db.query(`SELECT SUM(amount) as total_revenue FROM payments WHERE 1=1 ${paymentDateFilterSql}`, paymentQueryParams);

        // 2. Total Discount from bookings
        const [[{ booking_discount }]] = await db.query(`SELECT SUM(discount_amount) as booking_discount FROM bookings WHERE status != 'Cancelled' ${bookingDateFilterSql}`, bookingQueryParams);

        // 3. Total Discount from memberships (base_price - final_price)
        const { filterSql: membershipDateFilterSql, queryParams: membershipQueryParams } = buildDateFilter('am.start_date', startDate, endDate, false);
        const [[{ membership_discount }]] = await db.query(
            `SELECT COALESCE(SUM((mp.per_person_price * tc.member_count) - am.final_price), 0) as membership_discount
             FROM active_memberships am
             JOIN membership_packages mp ON am.package_id = mp.id
             JOIN (SELECT membership_id, COUNT(*) as member_count FROM membership_team GROUP BY membership_id) tc ON tc.membership_id = am.id
             WHERE (mp.per_person_price * tc.member_count) > am.final_price
             ${membershipDateFilterSql}`,
            membershipQueryParams
        );

        const total_discount = (parseFloat(booking_discount) || 0) + (parseFloat(membership_discount) || 0);

        res.json({
            total_revenue: parseFloat(total_revenue) || 0,
            total_discount: total_discount
        });
    } catch (err) {
        console.error("Error in /analytics/overall/summary:", err);
        res.status(500).json({ error: err.message });
    }
});

// Analytics: Overall Revenue by Sport
router.get('/analytics/overall/revenue-by-sport', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const { filterSql: paymentDateFilterSql, queryParams: paymentQueryParams } = buildDateFilter('p.payment_date', startDate, endDate, true); // payments.payment_date is DATETIME

        // Combine revenue from Bookings and Memberships linked to sports
        const query = `
            SELECT sport_name, SUM(revenue) as revenue FROM (
                -- Booking Revenue
                SELECT s.name as sport_name, SUM(p.amount) as revenue
                FROM payments p
                JOIN bookings b ON p.booking_id = b.id
                JOIN sports s ON b.sport_id = s.id
                WHERE p.booking_id IS NOT NULL
                ${paymentDateFilterSql}
                GROUP BY s.name

                UNION ALL

                -- Membership Revenue
                SELECT s.name as sport_name, SUM(p.amount) as revenue
                FROM payments p
                JOIN active_memberships am ON p.membership_id = am.id
                JOIN membership_packages mp ON am.package_id = mp.id
                JOIN sports s ON mp.sport_id = s.id
                WHERE p.membership_id IS NOT NULL
                ${paymentDateFilterSql}
                GROUP BY s.name
            ) as combined
            GROUP BY sport_name
            ORDER BY revenue DESC
        `;

        // We need to pass parameters twice because of the UNION
        const fullParams = [...paymentQueryParams, ...paymentQueryParams];

        const [rows] = await db.query(query, fullParams);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Analytics: Overall Revenue by Payment Mode
router.get('/analytics/overall/revenue-by-payment-mode', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const { filterSql: paymentDateFilterSql, queryParams: paymentQueryParams } = buildDateFilter('payment_date', startDate, endDate, true); // payments.payment_date is DATETIME

        const [rows] = await db.query(`
            SELECT payment_mode, SUM(amount) as revenue
            FROM payments
            WHERE 1=1
            ${paymentDateFilterSql}
            GROUP BY payment_mode
            ORDER BY revenue DESC
        `, paymentQueryParams);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Analytics: Revenue Distribution (Bookings vs Memberships)
router.get('/analytics/overall/revenue-distribution', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const { filterSql: paymentDateFilterSql, queryParams: paymentQueryParams } = buildDateFilter('payment_date', startDate, endDate, true); // payments.payment_date is DATETIME

        const [rows] = await db.query(`
            SELECT 
                CASE 
                    WHEN booking_id IS NOT NULL THEN 'Daily Bookings'
                    WHEN membership_id IS NOT NULL THEN 'Memberships'
                    ELSE 'Terminated Memberships (Unlinked)'
                END as source,
                SUM(amount) as revenue
            FROM payments
            WHERE 1=1
            ${paymentDateFilterSql}
            GROUP BY source
            ORDER BY revenue DESC
        `, paymentQueryParams);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Note: The WhatsApp route is not protected by JWT auth as it's for external users.

module.exports = router;
