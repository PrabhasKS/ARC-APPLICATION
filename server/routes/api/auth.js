const express = require('express');
const router = express.Router();
const db = require('../../database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticateToken, isAdmin } = require('../../middleware/auth');

const saltRounds = 10;
const JWT_SECRET = process.env.JWT_SECRET;

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);

        if (match) {
            // Create JWT
            const tokenPayload = { id: user.id, username: user.username, role: user.role };
            const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
            res.json({ success: true, token: token, user: tokenPayload });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new user (Admin only)
router.post('/admin/users', authenticateToken, isAdmin, async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ message: 'Username, password, and role are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const [result] = await db.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role]
        );
        res.status(201).json({ success: true, userId: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Username already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Get all users (Admin only)
router.get('/admin/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, username, role FROM users');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a user (Admin only)
router.delete('/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // Step 1: Get the role of the user to be deleted
        const [userToDelete] = await db.query('SELECT role FROM users WHERE id = ?', [id]);

        if (userToDelete.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Step 2: If the user is an admin, check if they are the last admin
        if (userToDelete[0].role === 'admin') {
            const [adminCount] = await db.query('SELECT COUNT(*) as count FROM users WHERE role = "admin"');
            if (adminCount[0].count === 1) {
                return res.status(403).json({ message: 'Cannot delete the last administrator. Please create another admin user first.' });
            }
        }

        // Step 3: Proceed with deletion if not the last admin or not an admin
        await db.query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
