const express = require('express');
const router = express.Router();
const db = require('../../database');
const { authenticateToken, isAdmin } = require('../../middleware/auth');
const sse = require('../../sse');

router.get('/', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM accessories');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', authenticateToken, isAdmin, async (req, res) => {
    const { name, price } = req.body;
    if (!name || price === undefined) {
        return res.status(400).json({ message: 'Accessory name and price are required' });
    }
    if (parseFloat(price) < 0) {
        return res.status(400).json({ message: 'Price cannot be negative' });
    }

    try {
        const [result] = await db.query('INSERT INTO accessories (name, price) VALUES (?, ?)', [name, price]);
        sse.sendEventsToAll({ message: 'accessories_updated' });
        res.json({ success: true, accessoryId: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
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
        sse.sendEventsToAll({ message: 'accessories_updated' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM accessories WHERE id = ?', [id]);
        sse.sendEventsToAll({ message: 'accessories_updated' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
