const express = require('express');
const router = express.Router();
const db = require('../../database');
const PDFDocument = require('pdfkit');
const { authenticateToken, isAdmin } = require('../../middleware/auth');
const sse = require('../../sse');

// ─────────────────────────────────────────────────────────────
// GET /api/inventory/standalone-sales
// List all standalone sales (admin + desk)
// ─────────────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    const { date, search, page = 1, limit = 15 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    let whereClauses = [];
    let params = [];

    if (date) {
        whereClauses.push('s.sale_date = ?');
        params.push(date);
    }
    if (search) {
        whereClauses.push('(s.customer_name LIKE ? OR s.customer_contact LIKE ? OR s.id LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    try {
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) as total FROM standalone_sales s ${whereStr}`, params
        );

        const [rows] = await db.query(
            `SELECT s.*, u.username as created_by
             FROM standalone_sales s
             LEFT JOIN users u ON s.created_by_user_id = u.id
             ${whereStr}
             ORDER BY s.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit, 10), offset]
        );

        res.json({ sales: rows, total, totalPages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /api/inventory/standalone-sales/:id
// Get single sale with items and payments
// ─────────────────────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const [[sale]] = await db.query(
            `SELECT s.*, u.username as created_by
             FROM standalone_sales s
             LEFT JOIN users u ON s.created_by_user_id = u.id
             WHERE s.id = ?`,
            [id]
        );
        if (!sale) return res.status(404).json({ message: 'Sale not found.' });

        const [items] = await db.query(
            `SELECT si.*, a.name as accessory_name, a.type as accessory_type,
                    a.rental_pricing_type
             FROM standalone_sale_items si
             JOIN accessories a ON si.accessory_id = a.id
             WHERE si.standalone_sale_id = ?`,
            [id]
        );

        const [payments] = await db.query(
            `SELECT p.*, u.username
             FROM payments p
             LEFT JOIN users u ON p.created_by_user_id = u.id
             WHERE p.standalone_sale_id = ?
             ORDER BY p.payment_date ASC`,
            [id]
        );

        res.json({ ...sale, items, payments });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// POST /api/inventory/standalone-sales
// Create a new walk-in sale / rental (admin + desk)
// ─────────────────────────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
    const {
        customer_name, customer_contact, sale_date,
        items, // [{ accessory_id, transaction_type, quantity, rental_hours }]
        payment_mode, amount_paid, notes
    } = req.body;

    if (!customer_name || !customer_contact || !items || items.length === 0) {
        return res.status(400).json({ message: 'customer_name, customer_contact, and items are required.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Calculate total from items
        let total_amount = 0;
        const resolvedItems = [];

        for (const item of items) {
            const [[acc]] = await connection.query(
                'SELECT id, name, price, type, rental_pricing_type, rent_price, available_quantity, rental_available_quantity FROM accessories WHERE id = ?',
                [item.accessory_id]
            );
            if (!acc) {
                await connection.rollback();
                return res.status(404).json({ message: `Accessory ID ${item.accessory_id} not found.` });
            }

            const qty = parseInt(item.quantity || 1, 10);
            const isRentalPool = acc.type === 'both' && item.transaction_type === 'rental';
            const availableStock = isRentalPool ? acc.rental_available_quantity : acc.available_quantity;

            // Stock availability check
            if (availableStock < qty) {
                await connection.rollback();
                return res.status(400).json({
                    message: `Insufficient stock for "${acc.name}" in ${isRentalPool ? 'rental' : 'sale'} pool. Available: ${availableStock}, Requested: ${qty}`
                });
            }

            // Calculate price
            let unit_price;
            if (item.transaction_type === 'rental') {
                const hours = acc.rental_pricing_type === 'hourly' ? parseFloat(item.rental_hours || 1) : 1;
                unit_price = parseFloat(acc.rent_price || 0) * hours;
            } else {
                unit_price = parseFloat(acc.price || 0);
            }

            const line_total = unit_price * qty;
            total_amount += line_total;

            resolvedItems.push({
                accessory_id: acc.id,
                transaction_type: item.transaction_type || 'sale',
                quantity: qty,
                price_at_sale: unit_price,
                rental_hours: item.rental_hours || null,
                acc_name: acc.name,
                acc_type: acc.type
            });
        }

        const paid = parseFloat(amount_paid || 0);
        const balance = total_amount - paid;
        const payment_status = balance <= 0 ? 'Completed' : (paid > 0 ? 'Received' : 'Pending');
        const today = sale_date || new Date().toISOString().slice(0, 10);

        // Insert standalone_sale
        const [saleResult] = await connection.query(
            `INSERT INTO standalone_sales 
                (customer_name, customer_contact, sale_date, total_amount, amount_paid, balance_amount, payment_status, notes, created_by_user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [customer_name, customer_contact, today, total_amount, paid, balance, payment_status, notes || null, req.user.id]
        );
        const saleId = saleResult.insertId;

        // Insert items + deduct stock + log
        for (const item of resolvedItems) {
            await connection.query(
                `INSERT INTO standalone_sale_items 
                    (standalone_sale_id, accessory_id, transaction_type, quantity, price_at_sale, rental_hours)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [saleId, item.accessory_id, item.transaction_type, item.quantity, item.price_at_sale, item.rental_hours]
            );

            // Deduct from appropriate quantity pool
            const isRentalPoolUpdate = item.transaction_type === 'rental' && item.acc_type === 'both';
            if (isRentalPoolUpdate) {
                await connection.query(
                    `UPDATE accessories SET rental_available_quantity = rental_available_quantity - ? WHERE id = ?`,
                    [item.quantity, item.accessory_id]
                );
            } else {
                await connection.query(
                    `UPDATE accessories SET available_quantity = available_quantity - ? WHERE id = ?`,
                    [item.quantity, item.accessory_id]
                );
            }

            // Stock log
            const changeType = item.transaction_type === 'rental' ? 'rented_out' : 'sold';
            const pool = item.transaction_type === 'rental' ? 'rental' : 'sale';
            await connection.query(
                `INSERT INTO inventory_stock_log 
                    (accessory_id, change_type, quantity_change, reference_type, reference_id, notes, pool, performed_by_user_id)
                 VALUES (?, ?, ?, 'standalone_sale', ?, ?, ?, ?)`,
                [item.accessory_id, changeType, -item.quantity,
                    saleId, `${changeType} via standalone sale #${saleId}`, pool, req.user.id]
            );
        }

        // Insert initial payment if paid > 0
        if (paid > 0) {
            await connection.query(
                `INSERT INTO payments (standalone_sale_id, amount, payment_mode, created_by_user_id)
                 VALUES (?, ?, ?, ?)`,
                [saleId, paid, payment_mode || 'cash', req.user.id]
            );
        }

        await connection.commit();
        sse.sendEventsToAll({ message: 'inventory_updated' });
        res.json({ success: true, saleId });
    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// ─────────────────────────────────────────────────────────────
// POST /api/inventory/standalone-sales/:id/payment
// Add a payment to an existing standalone sale
// ─────────────────────────────────────────────────────────────
router.post('/:id/payment', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { amount, payment_mode, payment_id } = req.body;
    const paid = parseFloat(amount);

    if (!paid || paid <= 0) {
        return res.status(400).json({ message: 'amount must be positive.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [[sale]] = await connection.query(
            'SELECT id, balance_amount, amount_paid FROM standalone_sales WHERE id = ? FOR UPDATE', [id]
        );
        if (!sale) {
            await connection.rollback();
            return res.status(404).json({ message: 'Sale not found.' });
        }
        if (paid > parseFloat(sale.balance_amount)) {
            await connection.rollback();
            return res.status(400).json({ message: 'Amount exceeds outstanding balance.' });
        }

        const new_paid = parseFloat(sale.amount_paid) + paid;
        const new_balance = parseFloat(sale.balance_amount) - paid;
        const payment_status = new_balance <= 0 ? 'Completed' : 'Received';

        await connection.query(
            `UPDATE standalone_sales SET amount_paid = ?, balance_amount = ?, payment_status = ? WHERE id = ?`,
            [new_paid, new_balance, payment_status, id]
        );

        await connection.query(
            `INSERT INTO payments (standalone_sale_id, amount, payment_mode, payment_id, created_by_user_id)
             VALUES (?, ?, ?, ?, ?)`,
            [id, paid, payment_mode || 'cash', payment_id || null, req.user.id]
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
// GET /api/inventory/standalone-sales/:id/receipt.pdf
// Generate PDF receipt for a standalone sale
// ─────────────────────────────────────────────────────────────
router.get('/:id/receipt.pdf', async (req, res) => {
    const { id } = req.params;
    try {
        const [[sale]] = await db.query(
            `SELECT s.*, u.username as created_by FROM standalone_sales s
             LEFT JOIN users u ON s.created_by_user_id = u.id WHERE s.id = ?`, [id]
        );
        if (!sale) return res.status(404).send('Sale not found');

        const [items] = await db.query(
            `SELECT si.*, a.name as accessory_name FROM standalone_sale_items si
             JOIN accessories a ON si.accessory_id = a.id WHERE si.standalone_sale_id = ?`, [id]
        );
        const [payments] = await db.query(
            `SELECT p.*, u.username FROM payments p
             LEFT JOIN users u ON p.created_by_user_id = u.id
             WHERE p.standalone_sale_id = ?`, [id]
        );

        const doc = new PDFDocument({ size: [302, 550], margin: 15 });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            const pdfData = Buffer.concat(buffers);
            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="sale-receipt-${id}.pdf"`,
                'Content-Length': pdfData.length
            });
            res.end(pdfData);
        });

        const drawLine = () => {
            doc.moveDown(0.5);
            doc.moveTo(15, doc.y).lineTo(287, doc.y).dash(3, { space: 3 }).stroke();
            doc.undash();
            doc.moveDown(0.5);
        };

        const printRow = (left, right) => {
            const y = doc.y;
            doc.text(left, 15, y, { width: 180, align: 'left' });
            doc.text(right, 195, y, { width: 92, align: 'right' });
        };

        // Header
        doc.fontSize(16).font('Helvetica-Bold').text('ARC SportsZone', 15, 20, { align: 'center' });
        doc.fontSize(10).font('Helvetica').text('Inventory Receipt', { align: 'center' });
        drawLine();

        // Customer Details
        doc.fontSize(9).font('Helvetica-Bold').text(`Sale ID: ${sale.id}`);
        doc.font('Helvetica').text(`Customer: ${sale.customer_name}`);
        doc.text(`Contact: ${sale.customer_contact}`);
        doc.text(`Date: ${sale.sale_date}`);
        drawLine();

        // Items
        doc.fontSize(10).font('Helvetica-Bold').text('Items');
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica');
        items.forEach(item => {
            const lineTotal = parseFloat(item.price_at_sale) * item.quantity;
            const label = item.transaction_type === 'rental' ? '(Rent)' : '(Sale)';
            printRow(`${item.accessory_name} ${label} x${item.quantity}`, `Rs. ${lineTotal.toFixed(2)}`);
            doc.moveDown(0.2);
        });
        drawLine();

        // Payment Details
        doc.fontSize(10).font('Helvetica-Bold').text('Payment Details');
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica');
        printRow('Total Amount:', `Rs. ${parseFloat(sale.total_amount).toFixed(2)}`);
        doc.moveDown(0.2);
        printRow('Amount Paid:', `Rs. ${parseFloat(sale.amount_paid).toFixed(2)}`);
        doc.moveDown(0.2);
        printRow('Balance:', `Rs. ${parseFloat(sale.balance_amount).toFixed(2)}`);
        doc.moveDown(0.2);
        printRow('Status:', sale.payment_status);
        drawLine();

        // Payment History
        if (payments.length > 0) {
            doc.fontSize(10).font('Helvetica-Bold').text('Payment History');
            doc.moveDown(0.3);
            doc.fontSize(8).font('Helvetica');
            payments.forEach(p => {
                const d = new Date(p.payment_date).toLocaleDateString('en-IN');
                doc.text(`Rs. ${parseFloat(p.amount).toFixed(2)} via ${p.payment_mode} on ${d}`);
                doc.moveDown(0.2);
            });
            drawLine();
        }

        doc.fontSize(9).text(`Processed By: ${sale.created_by || 'N/A'}`, { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica-Bold').text('Thank you!', { align: 'center' });
        doc.end();
    } catch (err) {
        res.status(500).send('Error generating receipt.');
    }
});

module.exports = router;
