const express = require('express');
const router = express.Router();
const db = require('../../database');
const { isPrivilegedUser, isAdmin } = require('../../middleware/auth');
const sse = require('../../sse');

router.post('/team-attendance', isPrivilegedUser, async (req, res) => {
    // Note: while route is still named 'team-attendance', it now logs for an INDIVIDUAL team member.
    // membership_id here refers to team_membership_id
    const { membership_id, attendance_date } = req.body;
    const marked_by_user_id = req.user.id;
    
    if (!membership_id || !attendance_date) {
        return res.status(400).json({ message: 'Membership ID and date are required.' });
    }
    try {
        await db.query(
            'INSERT INTO team_attendance (team_membership_id, attendance_date, marked_by_user_id) VALUES (?, ?, ?)',
            [membership_id, attendance_date, marked_by_user_id]
        );
        sse.sendEventsToAll({ message: 'bookings_updated' });
        res.status(201).json({ message: 'Attendance marked successfully.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Attendance for this member has already been marked for this date.' });
        }
        console.error('Error marking attendance:', error);
        res.status(500).json({ message: 'Error marking attendance.' });
    }
});

router.get('/team-attendance', isPrivilegedUser, async (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({ message: 'Date query parameter is required.' });
    }
    try {
        const [rows] = await db.query('SELECT * FROM team_attendance WHERE attendance_date = ?', [date]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching attendance history:', error);
        res.status(500).json({ message: 'Error fetching attendance history.' });
    }
});

// GET attendance history for a specific individual membership (for calendar view)
router.get('/active/:id/attendance-history', isPrivilegedUser, async (req, res) => {
    const { id: team_membership_id } = req.params;
    try {
        const [rows] = await db.query(
            "SELECT DATE_FORMAT(attendance_date, '%Y-%m-%d') as attendance_date_str FROM team_attendance WHERE team_membership_id = ? ORDER BY attendance_date ASC",
            [team_membership_id]
        );
        const dates = rows.map(row => row.attendance_date_str);
        res.json(dates);
    } catch (error) {
        console.error('Error fetching membership attendance history:', error);
        res.status(500).json({ message: 'Error fetching membership attendance history.' });
    }
});

// GET approved leave history for a specific individual membership
router.get('/active/:id/leave-history', isPrivilegedUser, async (req, res) => {
    const { id: team_membership_id } = req.params;
    try {
        const [rows] = await db.query('SELECT DATE_FORMAT(start_date, \'%Y-%m-%d\') as start_date, DATE_FORMAT(end_date, \'%Y-%m-%d\') as end_date FROM membership_leave WHERE team_membership_id = ? AND status = "APPROVED"', [team_membership_id]);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching membership leave history:', error);
        res.status(500).json({ message: 'Error fetching membership leave history.' });
    }
});


module.exports = router;
