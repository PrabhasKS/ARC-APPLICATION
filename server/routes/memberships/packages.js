const express = require('express');
const router = express.Router();
const db = require('../../database');
const { isPrivilegedUser, isAdmin } = require('../../middleware/auth');
// ------------------- Membership Packages CRUD -------------------

// GET all membership packages
router.get('/packages', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM membership_packages');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching membership packages:', error);
        res.status(500).json({ message: 'Error fetching membership packages' });
    }
});

// GET a specific membership package by ID
router.get('/packages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM membership_packages WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Membership package not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching membership package by ID:', error);
        res.status(500).json({ message: 'Error fetching membership package' });
    }
});

// POST a new membership package
router.post('/packages', isAdmin, async (req, res) => {
    try {
        const { name, sport_id, duration_days, per_person_price, max_team_size, details } = req.body;
        if (!name || !sport_id || !duration_days || per_person_price === undefined || !max_team_size) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        const [result] = await db.query(
            'INSERT INTO membership_packages (name, sport_id, duration_days, per_person_price, max_team_size, details) VALUES (?, ?, ?, ?, ?, ?)',
            [name, sport_id, duration_days, per_person_price, max_team_size, details]
        );
        res.status(201).json({ id: result.insertId, message: 'Membership package created successfully.' });
    } catch (error) {
        console.error('Error creating membership package:', error);
        res.status(500).json({ message: 'Error creating membership package' });
    }
});

// PUT (update) an existing membership package
router.put('/packages/:id', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, sport_id, duration_days, per_person_price, max_team_size, details } = req.body;
        if (!name || !sport_id || !duration_days || per_person_price === undefined || !max_team_size) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        const [result] = await db.query(
            'UPDATE membership_packages SET name = ?, sport_id = ?, duration_days = ?, per_person_price = ?, max_team_size = ?, details = ? WHERE id = ?',
            [name, sport_id, duration_days, per_person_price, max_team_size, details, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Membership package not found or no changes made' });
        }
        res.json({ message: 'Membership package updated successfully.' });
    } catch (error) {
        console.error('Error updating membership package:', error);
        res.status(500).json({ message: 'Error updating membership package' });
    }
});

// DELETE a membership package
router.delete('/packages/:id', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM membership_packages WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Membership package not found.' });
        }
        res.json({ message: 'Membership package deleted successfully.' });
    } catch (error) {
        console.error('Error deleting membership package:', error);
        res.status(500).json({ message: 'Error deleting membership package' });
    }
});

// ------------------- Members CRUD -------------------


module.exports = router;
