const express = require('express');
const router = express.Router();
const db = require('../../database');
const { isPrivilegedUser, isAdmin } = require('../../middleware/auth');
const sse = require('../../sse');
const { buildDateFilter, checkOverlap } = require('../../utils/helpers');

router.get('/leave-requests', isPrivilegedUser, async (req, res) => {
    try {
        const query = `
            SELECT 
                ml.id, ml.team_membership_id, ml.leave_days, ml.start_date, ml.end_date, ml.reason, ml.status, ml.requested_at,
                tm.start_date as membership_start_date, tm.current_end_date, mp.name as package_name,
                m.full_name as member_name, t.name as team_name,
                u.username as approved_by
            FROM membership_leave ml
            JOIN team_memberships tm ON ml.team_membership_id = tm.id
            JOIN membership_packages mp ON tm.package_id = mp.id
            JOIN members m ON tm.member_id = m.id
            JOIN teams t ON tm.team_id = t.id
            LEFT JOIN users u ON ml.approved_by_user_id = u.id
            ORDER BY ml.requested_at DESC
        `;
        const [requests] = await db.query(query);
        res.json(requests);
    } catch (error) {
        console.error('Error fetching leave requests:', error);
        res.status(500).json({ message: 'Error fetching leave requests.' });
    }
});

router.post('/request-leave', isPrivilegedUser, async (req, res) => {
    const { membership_id, leave_days, reason } = req.body; // membership_id from FE will be team_membership_id
    if (!membership_id || !leave_days) {
        return res.status(400).json({ message: 'Membership ID and leave days are required.' });
    }
    try {
        const [result] = await db.query(
            'INSERT INTO membership_leave (team_membership_id, leave_days, reason) VALUES (?, ?, ?)',
            [membership_id, leave_days, reason]
        );
        res.status(201).json({ id: result.insertId, message: 'Leave request submitted successfully.' });
    } catch (error) {
        console.error('Error submitting leave request:', error);
        res.status(500).json({ message: 'Error submitting leave request.' });
    }
});

router.post('/grant-leave', isPrivilegedUser, async (req, res) => {
    // We now grant leave to the INDIVIDUAL member (team_membership_id), extending only their date.
    // Given the new architecture, the conflict check logic is largely simplified because a single player 
    // extending their leave does NOT block the court if the Team itself expires or they don't show up.
    // However, we still need to calculate the dates correctly. 
    
    const { membership_id, start_date, end_date, reason, custom_extension_start_date } = req.body;
    const approved_by_user_id = req.user.id;

    if (!membership_id || !start_date || !end_date) {
        return res.status(400).json({ message: 'Membership ID, start date, and end date are required.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const conflicts = [];

        // Calculate leave days
        const start = new Date(start_date);
        const end = new Date(end_date);
        const diffTime = Math.abs(end - start);
        const leave_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive

        if (leave_days <= 0) {
            throw new Error('End date must be on or after start date.');
        }

        const [membershipData] = await connection.query(
            `SELECT current_end_date FROM team_memberships WHERE id = ? FOR UPDATE`,
            [membership_id]
        );

        if (membershipData.length === 0) {
            throw new Error('Active membership not found for this member.');
        }

        const { current_end_date: old_current_end_date_str } = membershipData[0];

        // Determine the extension period
        let extension_start_date_str;
        let final_extension_end_date;

        if (custom_extension_start_date) {
            const current_membership_end_date = new Date(old_current_end_date_str);
            const day_after_current_end = new Date(current_membership_end_date);
            day_after_current_end.setDate(day_after_current_end.getDate() + 1);

            const custom_start = new Date(custom_extension_start_date);

            if (custom_start.toISOString().slice(0, 10) < day_after_current_end.toISOString().slice(0, 10)) {
                throw new Error('Custom extension start date cannot be before the day after the current membership end date.');
            }

            extension_start_date_str = custom_extension_start_date;
            const new_end_date_obj = new Date(custom_extension_start_date);
            new_end_date_obj.setDate(new_end_date_obj.getDate() + leave_days); 
            final_extension_end_date = new_end_date_obj.toISOString().slice(0, 10);
        } else {
            const new_end_date_from_old_end = new Date(old_current_end_date_str);
            new_end_date_from_old_end.setDate(new_end_date_from_old_end.getDate() + leave_days + 1); 
            final_extension_end_date = new_end_date_from_old_end.toISOString().slice(0, 10);

            const extension_start_temp = new Date(old_current_end_date_str);
            extension_start_temp.setDate(extension_start_temp.getDate() + 1);
            extension_start_date_str = extension_start_temp.toISOString().slice(0, 10);
        }

        // 1. Check for overlapping APPROVED leaves for this membership
        const [overlappingLeaves] = await connection.query(
            `SELECT start_date, end_date FROM membership_leave 
             WHERE team_membership_id = ? AND status = 'APPROVED' AND (
                 start_date <= ? AND end_date >= ?
             )`,
            [membership_id, end_date, start_date]
        );

        if (overlappingLeaves.length > 0) {
            conflicts.push({
                type: 'leave',
                date: new Date(overlappingLeaves[0].start_date).toISOString().slice(0, 10),
                message: `This member already has an approved leave from ${new Date(overlappingLeaves[0].start_date).toISOString().slice(0, 10)} to ${new Date(overlappingLeaves[0].end_date).toISOString().slice(0, 10)}.`
            });
        }

        if (conflicts.length > 0) {
            await connection.rollback();
            return res.status(200).json({ status: 'conflict', conflicts, old_end_date: old_current_end_date_str });
        }

        // --- ALL CHECKS PASSED, PROCEED ---
        await connection.query(
            `INSERT INTO membership_leave (team_membership_id, start_date, end_date, leave_days, reason, status, approved_by_user_id) 
             VALUES (?, ?, ?, ?, ?, 'APPROVED', ?)`,
            [membership_id, start_date, end_date, leave_days, reason, approved_by_user_id]
        );

        await connection.query(
            'UPDATE team_memberships SET current_end_date = ? WHERE id = ?',
            [final_extension_end_date, membership_id]
        );

        await connection.commit();
        res.status(200).json({ status: 'success', message: `Leave granted successfully. Member's endpoint extended to ${final_extension_end_date}.` });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error granting leave:', error);
        res.status(500).json({ message: error.message || 'Failed to grant leave due to an unexpected error.' });
    } finally {
        if (connection) connection.release();
    }
});

// GET all memberships on leave for a specific date
router.get('/on-leave', isPrivilegedUser, async (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ message: 'Date query parameter is required.' });
    }

    try {
        const [leaveRecords] = await db.query(
            `SELECT team_membership_id FROM membership_leave
             WHERE status = 'APPROVED' AND start_date <= ? AND end_date >= ?`,
            [date, date]
        );

        const onLeaveIds = leaveRecords.map(record => record.team_membership_id);
        res.json(onLeaveIds);

    } catch (error) {
        console.error('Error fetching memberships on leave:', error);
        res.status(500).json({ message: 'Failed to fetch memberships on leave.' });
    }
});

router.put('/leave-requests/:id', isPrivilegedUser, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ message: 'A valid status (APPROVED or REJECTED) is required.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [leaveRequests] = await connection.query('SELECT * FROM membership_leave WHERE id = ? AND status = ?', [id, 'PENDING']);
        if (leaveRequests.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Pending leave request not found or already processed.' });
        }
        const leaveRequest = leaveRequests[0];

        if (status === 'REJECTED') {
            await connection.query("UPDATE membership_leave SET status = 'REJECTED' WHERE id = ?", [id]);
        } else { // Approved
            await connection.query("UPDATE membership_leave SET status = 'APPROVED', compensation_applied = TRUE WHERE id = ?", [id]);
            const [memberships] = await connection.query('SELECT current_end_date FROM team_memberships WHERE id = ?', [leaveRequest.team_membership_id]);
            if (memberships.length === 0) throw new Error('Associated active member not found.');

            const current_end_date = new Date(memberships[0].current_end_date);
            current_end_date.setDate(current_end_date.getDate() + leaveRequest.leave_days);
            const new_end_date = current_end_date.toISOString().slice(0, 10);

            await connection.query('UPDATE team_memberships SET current_end_date = ? WHERE id = ?', [new_end_date, leaveRequest.team_membership_id]);
        }

        await connection.commit();
        res.json({ message: `Leave request ${status.toLowerCase()}.` });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error processing leave request:', error);
        res.status(500).json({ message: `Failed to process leave request: ${error.message}` });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
