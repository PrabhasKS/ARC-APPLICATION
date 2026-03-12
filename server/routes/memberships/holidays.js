const express = require('express');
const router = express.Router();
const db = require('../../database');
const { isPrivilegedUser, isAdmin } = require('../../middleware/auth');
const sse = require('../../sse');
router.get('/holidays', isPrivilegedUser, async (req, res) => {
    try {
        const [holidays] = await db.query('SELECT * FROM facility_holidays ORDER BY holiday_date DESC');
        res.json(holidays);
    } catch (error) {
        console.error('Error fetching holidays:', error);
        res.status(500).json({ message: 'Error fetching holidays.' });
    }
});

router.post('/holidays', isPrivilegedUser, async (req, res) => {
    const { holiday_date, reason } = req.body;
    if (!holiday_date || !reason) {
        return res.status(400).json({ message: 'Holiday date and reason are required.' });
    }
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        await connection.query('INSERT INTO facility_holidays (holiday_date, reason) VALUES (?, ?)', [holiday_date, reason]);
        
        // Memberships now reside in team_memberships. Extension applies per member.
        const [affected] = await connection.query('SELECT id, current_end_date FROM team_memberships WHERE ? BETWEEN start_date AND current_end_date AND status = "active"', [holiday_date]);

        for (const membership of affected) {
            const current_end_date = new Date(membership.current_end_date);
            current_end_date.setDate(current_end_date.getDate() + 1);
            const new_end_date = current_end_date.toISOString().slice(0, 10);
            await connection.query('UPDATE team_memberships SET current_end_date = ? WHERE id = ?', [new_end_date, membership.id]);
        }

        await connection.commit();
        res.status(201).json({ message: `Holiday declared. ${affected.length} active memberships were extended.` });
    } catch (error) {
        if (connection) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'This date has already been declared as a holiday.' });
        }
        console.error('Error declaring holiday:', error);
        res.status(500).json({ message: `Failed to declare holiday: ${error.message}` });
    } finally {
        if (connection) connection.release();
    }
});

router.delete('/holidays/:id', isPrivilegedUser, async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM facility_holidays WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Holiday not found.' });
        }
        res.json({ message: 'Holiday deleted successfully. Note: This does not automatically shorten compensated memberships.' });
    } catch (error) {
        console.error('Error deleting holiday:', error);
        res.status(500).json({ message: 'Error deleting holiday.' });
    }
});

module.exports = router;
