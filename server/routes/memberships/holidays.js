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
        const [affected] = await connection.query('SELECT id, current_end_date FROM active_memberships WHERE ? BETWEEN start_date AND current_end_date', [holiday_date]);

        for (const membership of affected) {
            const current_end_date = new Date(membership.current_end_date);
            current_end_date.setDate(current_end_date.getDate() + 1);
            const new_end_date = current_end_date.toISOString().slice(0, 10);
            await connection.query('UPDATE active_memberships SET current_end_date = ? WHERE id = ?', [new_end_date, membership.id]);
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

// ------------------- Active Membership Management -------------------

const baseMembershipQuery = `
    SELECT 
        am.id, am.start_date, am.current_end_date, am.time_slot, am.final_price, am.discount_details, 
        am.amount_paid, am.balance_amount, am.payment_status, am.status,
        mp.name as package_name, mp.per_person_price as package_price, mp.max_team_size,
        c.name as court_name,
        GROUP_CONCAT(DISTINCT m.full_name ORDER BY m.full_name SEPARATOR ', ') as team_members,
        COUNT(DISTINCT mt.member_id) as current_members_count,
        (
            SELECT u.username 
            FROM users u 
            WHERE u.id = am.created_by_user_id
        ) as created_by,
        (
             SELECT GROUP_CONCAT(CONCAT(p.amount, ': ', p.payment_mode, IF(p.payment_id IS NOT NULL, CONCAT(' (', p.payment_id, ')'), '')) SEPARATOR '; ')
             FROM payments p
             WHERE p.membership_id = am.id
        ) as payment_info
    FROM active_memberships am
    JOIN membership_packages mp ON am.package_id = mp.id
    JOIN courts c ON am.court_id = c.id
    LEFT JOIN users creator ON am.created_by_user_id = creator.id
    LEFT JOIN membership_team mt ON am.id = mt.membership_id
    LEFT JOIN members m ON mt.member_id = m.id
`;


module.exports = router;
