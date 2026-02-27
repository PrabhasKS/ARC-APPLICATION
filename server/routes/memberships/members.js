const express = require('express');
const router = express.Router();
const db = require('../../database');
const { isPrivilegedUser, isAdmin } = require('../../middleware/auth');
router.post('/members', isPrivilegedUser, async (req, res) => {
    const { full_name, phone_number, email, notes } = req.body;
    if (!full_name || !phone_number) {
        return res.status(400).json({ message: 'Full name and phone number are required.' });
    }
    try {
        const [result] = await db.query(
            'INSERT INTO members (full_name, phone_number, email, notes) VALUES (?, ?, ?, ?)',
            [full_name, phone_number, email, notes]
        );
        res.status(201).json({ id: result.insertId, message: 'Member created successfully.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'A member with this phone number already exists.' });
        }
        console.error('Error creating member:', error);
        res.status(500).json({ message: 'Error creating member.' });
    }
});

// GET (search) for members
router.get('/members', isPrivilegedUser, async (req, res) => {
    const { q } = req.query;
    if (!q) {
        try {
            const [rows] = await db.query('SELECT id, full_name, phone_number, email FROM members');
            return res.json(rows);
        } catch (error) {
            console.error('Error fetching all members:', error);
            return res.status(500).json({ message: 'Error fetching members.' });
        }
    }
    try {
        const searchQuery = `%${q}%`;
        const [rows] = await db.query(
            'SELECT id, full_name, phone_number, email FROM members WHERE full_name LIKE ? OR phone_number LIKE ?',
            [searchQuery, searchQuery]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error searching for members:', error);
        res.status(500).json({ message: 'Error searching for members.' });
    }
});

// PUT (update) a member
router.put('/members/:id', isPrivilegedUser, async (req, res) => {
    const { id } = req.params;
    const { full_name, phone_number, email, notes } = req.body;
    if (!full_name || !phone_number) {
        return res.status(400).json({ message: 'Full name and phone number are required.' });
    }
    try {
        const [result] = await db.query(
            'UPDATE members SET full_name = ?, phone_number = ?, email = ?, notes = ? WHERE id = ?',
            [full_name, phone_number, email, notes, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Member not found.' });
        }
        res.json({ message: 'Member updated successfully.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Another member with this phone number already exists.' });
        }
        console.error('Error updating member:', error);
        res.status(500).json({ message: 'Error updating member.' });
    }
});

// DELETE a member
router.delete('/members/:id', isPrivilegedUser, async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM members WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Member not found.' });
        }
        res.json({ message: 'Member deleted successfully.' });
    } catch (error) {
        console.error('Error deleting member:', error);
        res.status(500).json({ message: 'Error deleting member.' });
    }
});

// ------------------- Active Memberships -------------------

// Check for membership conflicts (Frontend Helper)

module.exports = router;
