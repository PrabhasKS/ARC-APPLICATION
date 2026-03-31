const express = require('express');
const router = express.Router();
const db = require('../../database');
const { authenticateToken, isAdmin } = require('../../middleware/auth');
const sse = require('../../sse');

// ─────────────────────────────────────────────────────────────
// GET /api/inventory/accessories
// List all accessories with full inventory fields
// ─────────────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                id, name, price,
                COALESCE(type, 'for_sale') as type,
                COALESCE(rental_pricing_type, 'flat') as rental_pricing_type,
                rent_price,
                COALESCE(stock_quantity, 0) as stock_quantity,
                COALESCE(available_quantity, 0) as available_quantity,
                COALESCE(discarded_quantity, 0) as discarded_quantity,
                COALESCE(reorder_threshold, 5) as reorder_threshold,
                COALESCE(is_deleted, 0) as is_deleted
            FROM accessories
            ${req.query.include_deleted === 'true' ? '' : 'WHERE is_deleted = FALSE'}
            ORDER BY name ASC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// POST /api/inventory/accessories
// Admin: add a new accessory with inventory details
// ─────────────────────────────────────────────────────────────
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    const {
        name, price, type, rental_pricing_type, rent_price,
        initial_stock, reorder_threshold
    } = req.body;

    if (!name || price === undefined || !type) {
        return res.status(400).json({ message: 'name, price, and type are required.' });
    }

    const stockQty = parseInt(initial_stock || 0, 10);
    const threshold = parseInt(reorder_threshold || 5, 10);

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO accessories 
                (name, price, type, rental_pricing_type, rent_price, 
                 stock_quantity, available_quantity, discarded_quantity, reorder_threshold)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            [name, price, type,
             rental_pricing_type || 'flat',
             (type === 'for_rental' || type === 'both' ? rent_price : null),
             stockQty, stockQty, threshold]
        );
        const accessoryId = result.insertId;

        // Log initial stock if > 0
        if (stockQty > 0) {
            await connection.query(
                `INSERT INTO inventory_stock_log 
                    (accessory_id, change_type, quantity_change, reference_type, notes, performed_by_user_id)
                 VALUES (?, 'restock', ?, 'manual', 'Initial stock on creation', ?)`,
                [accessoryId, stockQty, req.user.id]
            );
        }

        await connection.commit();
        sse.sendEventsToAll({ message: 'inventory_updated' });
        res.json({ success: true, accessoryId });
    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/inventory/accessories/:id
// Admin: edit accessory details
// ─────────────────────────────────────────────────────────────
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, price, type, rental_pricing_type, rent_price, reorder_threshold } = req.body;

    if (!name || price === undefined || !type) {
        return res.status(400).json({ message: 'name, price, and type are required.' });
    }

    try {
        await db.query(
            `UPDATE accessories
             SET name = ?, price = ?, type = ?, rental_pricing_type = ?,
                 rent_price = ?, reorder_threshold = ?
             WHERE id = ?`,
            [name, price, type,
             rental_pricing_type || 'flat',
             (type === 'for_rental' || type === 'both' ? rent_price : null),
             reorder_threshold || 5, id]
        );
        sse.sendEventsToAll({ message: 'inventory_updated' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/inventory/accessories/:id
// Admin: Soft delete accessory (hides it from booking form and active lists)
// ─────────────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('UPDATE accessories SET is_deleted = TRUE WHERE id = ?', [id]);
        sse.sendEventsToAll({ message: 'inventory_updated' });
        res.json({ success: true, message: 'Accessory archived successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ─────────────────────────────────────────────────────────────
// POST /api/inventory/accessories/:id/restock
// Admin: add stock units
// ─────────────────────────────────────────────────────────────
router.post('/:id/restock', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { quantity, notes } = req.body;
    const qty = parseInt(quantity, 10);

    if (!qty || qty <= 0) {
        return res.status(400).json({ message: 'quantity must be a positive number.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Check accessory exists
        const [[acc]] = await connection.query('SELECT id FROM accessories WHERE id = ?', [id]);
        if (!acc) {
            await connection.rollback();
            return res.status(404).json({ message: 'Accessory not found.' });
        }

        // Update stock quantities
        await connection.query(
            `UPDATE accessories
             SET stock_quantity = stock_quantity + ?,
                 available_quantity = available_quantity + ?
             WHERE id = ?`,
            [qty, qty, id]
        );

        // Log the restock
        await connection.query(
            `INSERT INTO inventory_stock_log 
                (accessory_id, change_type, quantity_change, reference_type, notes, performed_by_user_id)
             VALUES (?, 'restock', ?, 'manual', ?, ?)`,
            [id, qty, notes || 'Manual restock', req.user.id]
        );

        await connection.commit();
        sse.sendEventsToAll({ message: 'inventory_updated' });
        res.json({ success: true });
    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// ─────────────────────────────────────────────────────────────
// POST /api/inventory/accessories/:id/discard
// Admin: mark units as worn out / discarded
// ─────────────────────────────────────────────────────────────
router.post('/:id/discard', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { quantity, reason } = req.body;
    const qty = parseInt(quantity, 10);

    if (!qty || qty <= 0) {
        return res.status(400).json({ message: 'quantity must be a positive number.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [[acc]] = await connection.query(
            'SELECT available_quantity FROM accessories WHERE id = ?', [id]
        );
        if (!acc) {
            await connection.rollback();
            return res.status(404).json({ message: 'Accessory not found.' });
        }
        if (acc.available_quantity < qty) {
            await connection.rollback();
            return res.status(400).json({
                message: `Only ${acc.available_quantity} unit(s) available to discard.`
            });
        }

        await connection.query(
            `UPDATE accessories
             SET available_quantity = available_quantity - ?,
                 discarded_quantity = discarded_quantity + ?
             WHERE id = ?`,
            [qty, qty, id]
        );

        await connection.query(
            `INSERT INTO inventory_stock_log 
                (accessory_id, change_type, quantity_change, reference_type, notes, performed_by_user_id)
             VALUES (?, 'discarded', ?, 'manual', ?, ?)`,
            [id, -qty, reason || 'Manual discard', req.user.id]
        );

        await connection.commit();
        sse.sendEventsToAll({ message: 'inventory_updated' });
        res.json({ success: true });
    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// ─────────────────────────────────────────────────────────────
// GET /api/inventory/accessories/stock-log
// Admin: paginated audit log of all stock changes
// ─────────────────────────────────────────────────────────────
router.get('/stock-log', authenticateToken, isAdmin, async (req, res) => {
    const { accessory_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClauses = [];
    let params = [];

    if (accessory_id) {
        whereClauses.push('l.accessory_id = ?');
        params.push(accessory_id);
    }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    try {
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) as total FROM inventory_stock_log l ${whereStr}`, params
        );

        const [rows] = await db.query(
            `SELECT l.*, a.name as accessory_name, u.username as performed_by
             FROM inventory_stock_log l
             JOIN accessories a ON l.accessory_id = a.id
             LEFT JOIN users u ON l.performed_by_user_id = u.id
             ${whereStr}
             ORDER BY l.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit, 10), parseInt(offset, 10)]
        );

        res.json({ logs: rows, total, totalPages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
