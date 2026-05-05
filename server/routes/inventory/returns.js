const express = require('express');
const router = express.Router();
const db = require('../../database');
const { authenticateToken } = require('../../middleware/auth');
const sse = require('../../sse');

// ─────────────────────────────────────────────────────────────
// GET /api/inventory/returns
// List all rental returns (admin + desk)
// ─────────────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    const { page = 1, limit = 15, source_type } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    let whereClauses = [];
    let params = [];

    if (source_type) {
        whereClauses.push('r.source_type = ?');
        params.push(source_type);
    }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    try {
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) as total FROM rental_returns r ${whereStr}`, params
        );

        const [rows] = await db.query(
            `SELECT r.*, a.name as accessory_name, u.username as processed_by
             FROM rental_returns r
             JOIN accessories a ON r.accessory_id = a.id
             LEFT JOIN users u ON r.processed_by_user_id = u.id
             ${whereStr}
             ORDER BY r.returned_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit, 10), offset]
        );

        res.json({ returns: rows, total, totalPages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /api/inventory/returns/pending
// List rentals that haven't been returned yet
// ─────────────────────────────────────────────────────────────
router.get('/pending', authenticateToken, async (req, res) => {
    try {
        // Standalone rentals pending return
        const [standaloneRentals] = await db.query(`
            SELECT 
                si.id as item_id, si.standalone_sale_id as source_id, 'standalone' as source_type,
                si.accessory_id, a.name as accessory_name,
                si.quantity, si.price_at_sale, si.rental_hours,
                ss.customer_name, ss.customer_contact, ss.sale_date,
                COALESCE(returned.returned_qty, 0) as returned_qty,
                si.quantity - COALESCE(returned.returned_qty, 0) as pending_qty
            FROM standalone_sale_items si
            JOIN accessories a ON si.accessory_id = a.id
            JOIN standalone_sales ss ON si.standalone_sale_id = ss.id
            LEFT JOIN (
                SELECT source_id, accessory_id, SUM(quantity_returned) as returned_qty
                FROM rental_returns
                WHERE source_type = 'standalone'
                GROUP BY source_id, accessory_id
            ) returned ON returned.source_id = si.standalone_sale_id AND returned.accessory_id = si.accessory_id
            WHERE si.transaction_type = 'rental'
            HAVING pending_qty > 0
            ORDER BY ss.sale_date ASC
        `);

        // Booking rentals pending return
        const [bookingRentals] = await db.query(`
            SELECT 
                ba.id as item_id, ba.booking_id as source_id, 'booking' as source_type,
                ba.accessory_id, a.name as accessory_name,
                ba.quantity, ba.price_at_booking as price_at_sale, NULL as rental_hours,
                b.customer_name, b.customer_contact, b.date as sale_date,
                COALESCE(returned.returned_qty, 0) as returned_qty,
                ba.quantity - COALESCE(returned.returned_qty, 0) as pending_qty
            FROM booking_accessories ba
            JOIN accessories a ON ba.accessory_id = a.id
            JOIN bookings b ON ba.booking_id = b.id
            LEFT JOIN (
                SELECT source_id, accessory_id, SUM(quantity_returned) as returned_qty
                FROM rental_returns
                WHERE source_type = 'booking'
                GROUP BY source_id, accessory_id
            ) returned ON returned.source_id = ba.booking_id AND returned.accessory_id = ba.accessory_id
            WHERE ba.transaction_type = 'rental'
            HAVING pending_qty > 0
            ORDER BY b.date ASC
        `);

        res.json({ standalone: standaloneRentals, booking: bookingRentals });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// POST /api/inventory/returns
// Process a rental return (admin + desk)
// ─────────────────────────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
    const {
        source_type,      // 'standalone' | 'booking'
        source_id,        // standalone_sale_id or booking_id
        accessory_id,
        quantity_returned,
        item_condition,   // 'good' | 'damaged' | 'discarded'
        damage_charge,
        damage_payment_mode,
        notes
    } = req.body;

    if (!source_type || !source_id || !accessory_id || !quantity_returned || !item_condition) {
        return res.status(400).json({
            message: 'source_type, source_id, accessory_id, quantity_returned, and item_condition are required.'
        });
    }

    const qty = parseInt(quantity_returned, 10);
    const damageAmt = parseFloat(damage_charge || 0);

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Insert the rental_return record
        const [returnResult] = await connection.query(
            `INSERT INTO rental_returns 
                (source_type, source_id, accessory_id, quantity_returned, item_condition, damage_charge, notes, processed_by_user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [source_type, source_id, accessory_id, qty, item_condition, damageAmt, notes || null, req.user.id]
        );
        const returnId = returnResult.insertId;

        const [[accInfo]] = await connection.query('SELECT type FROM accessories WHERE id = ? FOR UPDATE', [accessory_id]);
        const isRentalPool = accInfo && (accInfo.type === 'both' || accInfo.type === 'for_rental');

        let changeType;
        if (item_condition === 'good') {
            // Item is back in usable stock
            changeType = 'returned';
            if (isRentalPool) {
                await connection.query(`UPDATE accessories SET rental_available_quantity = rental_available_quantity + ? WHERE id = ?`, [qty, accessory_id]);
            } else {
                await connection.query(`UPDATE accessories SET available_quantity = available_quantity + ? WHERE id = ?`, [qty, accessory_id]);
            }
        } else if (item_condition === 'damaged' || item_condition === 'discarded') {
            // Item removed from available stock
            changeType = item_condition === 'damaged' ? 'damage_replace' : 'discarded';
            if (isRentalPool) {
                await connection.query(`UPDATE accessories SET rental_discarded_quantity = rental_discarded_quantity + ? WHERE id = ?`, [qty, accessory_id]);
            } else {
                await connection.query(`UPDATE accessories SET discarded_quantity = discarded_quantity + ? WHERE id = ?`, [qty, accessory_id]);
            }
        }

        // Stock log
        await connection.query(
            `INSERT INTO inventory_stock_log 
                (accessory_id, change_type, quantity_change, reference_type, reference_id, notes, pool, performed_by_user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [accessory_id, changeType,
             item_condition === 'good' ? qty : -qty,
             source_type, source_id, notes || `Return from ${source_type} #${source_id}`,
             isRentalPool ? 'rental' : 'sale', req.user.id]
        );

        // Create separate damage charge payment if applicable
        let damagePaymentId = null;
        if (damageAmt > 0 && item_condition !== 'good') {
            const paymentData = { amount: damageAmt, payment_mode: damage_payment_mode || 'cash' };

            if (source_type === 'standalone') {
                const [pResult] = await connection.query(
                    `INSERT INTO payments (standalone_sale_id, amount, payment_mode, created_by_user_id)
                     VALUES (?, ?, ?, ?)`,
                    [source_id, paymentData.amount, paymentData.payment_mode, req.user.id]
                );
                damagePaymentId = pResult.insertId;
            } else {
                const [pResult] = await connection.query(
                    `INSERT INTO payments (booking_id, amount, payment_mode, created_by_user_id)
                     VALUES (?, ?, ?, ?)`,
                    [source_id, paymentData.amount, paymentData.payment_mode, req.user.id]
                );
                damagePaymentId = pResult.insertId;
            }

            // Link payment to return record
            await connection.query(
                `UPDATE rental_returns SET damage_payment_id = ? WHERE id = ?`,
                [damagePaymentId, returnId]
            );
        }

        await connection.commit();
        sse.sendEventsToAll({ message: 'inventory_updated' });
        res.json({ success: true, returnId });
    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
