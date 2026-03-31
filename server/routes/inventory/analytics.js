const express = require('express');
const router = express.Router();
const db = require('../../database');
const { authenticateToken, isAdmin } = require('../../middleware/auth');
const { buildDateFilter } = require('../../utils/helpers');

// ─────────────────────────────────────────────────────────────
// GET /api/inventory/analytics/summary
// Overall inventory health snapshot
// ─────────────────────────────────────────────────────────────
router.get('/analytics/summary', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [[{ total_accessories }]] = await db.query('SELECT COUNT(*) as total_accessories FROM accessories');
        const [[stockData]] = await db.query(`
            SELECT 
                SUM(available_quantity) as total_available,
                SUM(discarded_quantity) as total_discarded,
                SUM(stock_quantity) as total_stocked,
                SUM(available_quantity * price) as inventory_value
            FROM accessories
        `);
        const [[{ low_stock_count }]] = await db.query(`
            SELECT COUNT(*) as low_stock_count FROM accessories
            WHERE available_quantity <= reorder_threshold AND available_quantity > 0
        `);
        const [[{ out_of_stock }]] = await db.query(`
            SELECT COUNT(*) as out_of_stock FROM accessories WHERE available_quantity = 0
        `);

        res.json({
            total_accessories,
            total_available: parseInt(stockData.total_available) || 0,
            total_discarded: parseInt(stockData.total_discarded) || 0,
            total_stocked: parseInt(stockData.total_stocked) || 0,
            inventory_value: parseFloat(stockData.inventory_value) || 0,
            low_stock_count,
            out_of_stock
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /api/inventory/analytics/standalone-revenue
// Revenue from standalone (walk-in) sales
// ─────────────────────────────────────────────────────────────
router.get('/analytics/standalone-revenue', authenticateToken, isAdmin, async (req, res) => {
    const { startDate, endDate } = req.query;
    const { filterSql, queryParams } = buildDateFilter('p.payment_date', startDate, endDate, true);

    try {
        const [[{ total_revenue }]] = await db.query(
            `SELECT COALESCE(SUM(p.amount), 0) as total_revenue
             FROM payments p WHERE p.standalone_sale_id IS NOT NULL ${filterSql}`,
            queryParams
        );
        const [[{ total_sales }]] = await db.query(
            `SELECT COUNT(DISTINCT standalone_sale_id) as total_sales
             FROM payments p WHERE p.standalone_sale_id IS NOT NULL ${filterSql}`,
            queryParams
        );
        const [[{ damage_revenue }]] = await db.query(
            `SELECT COALESCE(SUM(r.damage_charge), 0) as damage_revenue
             FROM rental_returns r WHERE r.damage_charge > 0 AND r.source_type = 'standalone'`
        );
        res.json({
            total_revenue: parseFloat(total_revenue),
            total_sales: parseInt(total_sales) || 0,
            damage_revenue: parseFloat(damage_revenue)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /api/inventory/analytics/booking-accessory-revenue
// Revenue from accessories added to court bookings
// ─────────────────────────────────────────────────────────────
router.get('/analytics/booking-accessory-revenue', authenticateToken, isAdmin, async (req, res) => {
    const { startDate, endDate } = req.query;
    const { filterSql, queryParams } = buildDateFilter('b.date', startDate, endDate, false);

    try {
        const [[{ total_revenue }]] = await db.query(
            `SELECT COALESCE(SUM(ba.quantity * ba.price_at_booking), 0) as total_revenue
             FROM booking_accessories ba
             JOIN bookings b ON ba.booking_id = b.id
             WHERE b.status != 'Cancelled' ${filterSql}`,
            queryParams
        );
        const [[{ damage_revenue }]] = await db.query(
            `SELECT COALESCE(SUM(r.damage_charge), 0) as damage_revenue
             FROM rental_returns r WHERE r.damage_charge > 0 AND r.source_type = 'booking'`
        );

        res.json({
            total_revenue: parseFloat(total_revenue),
            damage_revenue: parseFloat(damage_revenue)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /api/inventory/analytics/revenue-by-accessory
// Per-item revenue breakdown (standalone + booking combined)
// ─────────────────────────────────────────────────────────────
router.get('/analytics/revenue-by-accessory', authenticateToken, isAdmin, async (req, res) => {
    const { startDate, endDate } = req.query;
    const { filterSql: pFilter, queryParams: pParams } = buildDateFilter('p.payment_date', startDate, endDate, true);
    const { filterSql: bFilter, queryParams: bParams } = buildDateFilter('b.date', startDate, endDate, false);

    try {
        const [rows] = await db.query(`
            SELECT accessory_name, SUM(revenue) as revenue, SUM(transactions) as transactions FROM (
                -- Standalone sales revenue
                SELECT a.name as accessory_name,
                       SUM(si.price_at_sale * si.quantity) as revenue,
                       COUNT(*) as transactions
                FROM standalone_sale_items si
                JOIN accessories a ON si.accessory_id = a.id
                JOIN standalone_sales ss ON si.standalone_sale_id = ss.id
                JOIN payments p ON p.standalone_sale_id = ss.id
                WHERE 1=1 ${pFilter}
                GROUP BY a.name

                UNION ALL

                -- Booking accessories revenue
                SELECT a.name as accessory_name,
                       SUM(ba.price_at_booking * ba.quantity) as revenue,
                       COUNT(*) as transactions
                FROM booking_accessories ba
                JOIN accessories a ON ba.accessory_id = a.id
                JOIN bookings b ON ba.booking_id = b.id
                WHERE b.status != 'Cancelled' ${bFilter}
                GROUP BY a.name
            ) as combined
            GROUP BY accessory_name
            ORDER BY revenue DESC
        `, [...pParams, ...bParams]);

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /api/inventory/analytics/rental-vs-sale
// Split revenue between rentals and outright sales
// ─────────────────────────────────────────────────────────────
router.get('/analytics/rental-vs-sale', authenticateToken, isAdmin, async (req, res) => {
    const { startDate, endDate } = req.query;
    const { filterSql: bFilter, queryParams: bParams } = buildDateFilter('ss.sale_date', startDate, endDate, false);

    try {
        const [rows] = await db.query(`
            SELECT 
                si.transaction_type as type,
                SUM(si.price_at_sale * si.quantity) as revenue,
                COUNT(*) as transactions
            FROM standalone_sale_items si
            JOIN standalone_sales ss ON si.standalone_sale_id = ss.id
            WHERE 1=1 ${bFilter}
            GROUP BY si.transaction_type
        `, bParams);

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /api/inventory/analytics/stock-alerts
// Accessories at or below reorder threshold
// ─────────────────────────────────────────────────────────────
router.get('/analytics/stock-alerts', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, name, type, available_quantity, reorder_threshold, stock_quantity, discarded_quantity
            FROM accessories
            WHERE available_quantity <= reorder_threshold
            ORDER BY available_quantity ASC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /api/inventory/analytics/discard-log
// Summary of discarded items
// ─────────────────────────────────────────────────────────────
router.get('/analytics/discard-log', authenticateToken, isAdmin, async (req, res) => {
    const { startDate, endDate } = req.query;
    const { filterSql, queryParams } = buildDateFilter('l.created_at', startDate, endDate, true);

    try {
        const [rows] = await db.query(`
            SELECT l.*, a.name as accessory_name, u.username as performed_by
            FROM inventory_stock_log l
            JOIN accessories a ON l.accessory_id = a.id
            LEFT JOIN users u ON l.performed_by_user_id = u.id
            WHERE l.change_type IN ('discarded', 'damage_replace') ${filterSql}
            ORDER BY l.created_at DESC
            LIMIT 100
        `, queryParams);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
