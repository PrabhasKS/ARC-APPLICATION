const express = require('express');
const router = express.Router();
const db = require('../../database');
const { authenticateToken, isAdmin } = require('../../middleware/auth');

// Get all sports
router.get('/', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM sports');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new sport
router.post('/', authenticateToken, isAdmin, async (req, res) => {
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
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
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

// Delete a sport
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM sports WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
