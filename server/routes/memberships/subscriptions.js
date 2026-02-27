const express = require('express');
const router = express.Router();
const db = require('../../database');
const { isPrivilegedUser, isAdmin } = require('../../middleware/auth');
const sse = require('../../sse');
const cron = require('node-cron');
const PDFDocument = require('pdfkit');
const { toMinutes, checkOverlap } = require('../../utils/helpers');

const buildDateFilter = (columnName, startDate, endDate, includeTime = false) => {
    let filterSql = '';
    const queryParams = [];

    if (startDate && endDate) {
        if (includeTime) {
            filterSql += ` AND ${columnName} BETWEEN ? AND ?`;
            queryParams.push(startDate, endDate);
        } else {
            // For date-only comparisons, ensure full day is covered
            filterSql += ` AND ${columnName} >= ? AND ${columnName} <= ?`;
            queryParams.push(startDate, endDate);
        }
    } else if (startDate) {
        filterSql += ` AND ${columnName} >= ?`;
        queryParams.push(startDate);
    } else if (endDate) {
        filterSql += ` AND ${columnName} <= ?`;
        queryParams.push(endDate);
    }

    return { filterSql, queryParams };
};

router.post('/check-clash', isPrivilegedUser, async (req, res) => {
    const { package_id, court_id, start_date, time_slot } = req.body;

    if (!package_id || !court_id || !start_date || !time_slot) {
        return res.status(400).json({ message: 'Missing required fields for conflict check.' });
    }

    try {
        const [packages] = await db.query('SELECT duration_days, sport_id FROM membership_packages WHERE id = ?', [package_id]);
        if (packages.length === 0) {
            return res.status(404).json({ message: 'Package not found.' });
        }
        const { duration_days, sport_id } = packages[0];

        const [sports] = await db.query('SELECT capacity FROM sports WHERE id = ?', [sport_id]);
        const capacity = sports.length > 0 ? sports[0].capacity : 1;

        const startDateObj = new Date(start_date);
        const endDateObj = new Date(startDateObj);
        endDateObj.setDate(startDateObj.getDate() + duration_days);
        const end_date = endDateObj.toISOString().slice(0, 10);

        const [conflictingMemberships] = await db.query(
            `SELECT time_slot 
             FROM active_memberships 
             WHERE court_id = ? 
             AND start_date <= ? 
             AND current_end_date >= ?`,
            [court_id, end_date, start_date]
        );

        const [newStart, newEnd] = time_slot.split(' - ');
        const clashingCount = conflictingMemberships.filter(m => {
            const [existingStart, existingEnd] = m.time_slot.split(' - ');
            return checkOverlap(newStart.trim(), newEnd.trim(), existingStart.trim(), existingEnd.trim());
        }).length;

        if (clashingCount >= capacity) {
            res.json({ is_clashing: true, message: 'This time slot is full and overlaps with an existing membership.' });
        } else {
            res.json({ is_clashing: false, message: 'Slot is available.' });
        }

    } catch (error) {
        console.error('Error checking membership clash:', error);
        res.status(500).json({ message: 'Error checking conflict.' });
    }
});

// POST a new membership subscription
router.post('/subscribe', isPrivilegedUser, async (req, res) => {
    const {
        package_id,
        court_id,
        start_date,
        time_slot,
        team_members,
        discount_amount,
        discount_details,
        initial_payment
    } = req.body;

    const created_by_user_id = req.user.id;

    if (!package_id || !court_id || !start_date || !time_slot || !team_members || team_members.length === 0) {
        return res.status(400).json({ message: 'Missing required subscription data.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [packages] = await connection.query('SELECT duration_days, max_team_size, per_person_price, sport_id FROM membership_packages WHERE id = ?', [package_id]);
        if (packages.length === 0) throw new Error('Membership package not found.');

        const { duration_days, max_team_size, per_person_price, sport_id } = packages[0];

        if (team_members.length > max_team_size) {
            throw new Error(`The number of members (${team_members.length}) exceeds the maximum allowed for this package (${max_team_size}).`);
        }

        const base_price = parseFloat(per_person_price) * team_members.length;
        const final_price = base_price - parseFloat(discount_amount || 0);
        const amount_paid = parseFloat(initial_payment?.amount || 0);
        const balance_amount = final_price - amount_paid;

        let payment_status = 'Pending';
        if (balance_amount <= 0) {
            payment_status = 'Completed';
        } else if (amount_paid > 0) {
            payment_status = 'Received';
        }

        const startDateObj = new Date(start_date);
        const endDateObj = new Date(startDateObj);
        endDateObj.setDate(startDateObj.getDate() + duration_days - 1); // -1 to make it inclusive
        const original_end_date = endDateObj.toISOString().slice(0, 10);

        // --- Conflict Check ---
        const [sports] = await connection.query('SELECT capacity FROM sports WHERE id = ?', [sport_id]);
        const capacity = sports.length > 0 ? sports[0].capacity : 1;

        const [conflictingMemberships] = await connection.query(
            `SELECT time_slot 
             FROM active_memberships 
             WHERE court_id = ? 
             AND start_date < ? 
             AND current_end_date > ?`,
            [court_id, original_end_date, start_date]
        );

        const [newStart, newEnd] = time_slot.split(' - ');
        const clashingCount = conflictingMemberships.filter(m => {
            const [existingStart, existingEnd] = m.time_slot.split(' - ');
            return checkOverlap(newStart.trim(), newEnd.trim(), existingStart.trim(), existingEnd.trim());
        }).length;

        if (clashingCount >= capacity) {
            throw new Error('This time slot is full and overlaps with an existing membership on the selected dates.');
        }
        // ----------------------

        const [activeMembershipResult] = await connection.query(
            `INSERT INTO active_memberships (package_id, court_id, start_date, time_slot, original_end_date, current_end_date, final_price, discount_details, amount_paid, balance_amount, payment_status, created_by_user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [package_id, court_id, start_date, time_slot, original_end_date, original_end_date, final_price, discount_details, amount_paid, balance_amount, payment_status, created_by_user_id]
        );
        const active_membership_id = activeMembershipResult.insertId;

        if (initial_payment && initial_payment.amount > 0) {
            await connection.query(
                'INSERT INTO payments (membership_id, amount, payment_mode, payment_id, created_by_user_id) VALUES (?, ?, ?, ?, ?)',
                [active_membership_id, initial_payment.amount, initial_payment.payment_mode, initial_payment.payment_id, created_by_user_id]
            );
        }

        for (const member of team_members) {
            if (!member.member_id) {
                throw new Error('A team member has an invalid ID. Cannot create subscription.');
            }
            await connection.query(
                'INSERT INTO membership_team (membership_id, member_id) VALUES (?, ?)',
                [active_membership_id, member.member_id]
            );
        }

        await connection.commit();
        res.status(201).json({ id: active_membership_id, message: 'Membership created successfully.' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error creating membership subscription:', error);
        res.status(500).json({ message: `Failed to create subscription: ${error.message}` });
    } finally {
        if (connection) connection.release();
    }
});

// ------------------- Leave Management -------------------


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

// GET team members for a specific active membership (returns IDs to avoid name-based matching bugs)
router.get('/active/:id/team-members', isPrivilegedUser, async (req, res) => {
    const { id } = req.params;
    try {
        const [members] = await db.query(
            `SELECT m.id, m.full_name, m.phone_number, m.email 
             FROM membership_team mt 
             JOIN members m ON mt.member_id = m.id 
             WHERE mt.membership_id = ?`,
            [id]
        );
        res.json(members);
    } catch (error) {
        console.error('Error fetching team members:', error);
        res.status(500).json({ message: 'Error fetching team members.' });
    }
});

router.get('/active', isPrivilegedUser, async (req, res) => {
    try {
        const { date } = req.query;
        let whereClause = ` WHERE am.status = 'active' `;
        const queryParams = [];

        if (date) {
            whereClause += ' AND am.start_date <= ? AND am.current_end_date >= ?';
            queryParams.push(date, date);
        } else {
            // For the general 'active' list, only include memberships that have not expired.
            whereClause += ' AND am.current_end_date >= CURDATE()';
        }

        const query = `
            ${baseMembershipQuery}
            ${whereClause}
            GROUP BY am.id
            ORDER BY am.start_date DESC
        `;

        const [memberships] = await db.query(query, queryParams);
        res.json(memberships);
    } catch (error) {
        console.error('Error fetching active memberships:', error);
        res.status(500).json({ message: 'Error fetching active memberships.' });
    }
});

router.get('/terminated', isPrivilegedUser, async (req, res) => {
    try {
        const query = `
            ${baseMembershipQuery}
            WHERE am.status = 'terminated'
            GROUP BY am.id
            ORDER BY am.updated_at DESC
        `;
        const [memberships] = await db.query(query);
        res.json(memberships);
    } catch (error) {
        console.error('Error fetching terminated memberships:', error);
        res.status(500).json({ message: 'Error fetching terminated memberships.' });
    }
});

router.get('/ended', isPrivilegedUser, async (req, res) => {
    try {
        const query = `
            ${baseMembershipQuery}
            WHERE am.status = 'ended' OR (am.status = 'active' AND am.current_end_date < CURDATE())
            GROUP BY am.id
            ORDER BY am.current_end_date DESC
        `;
        const [memberships] = await db.query(query);
        res.json(memberships);
    } catch (error) {
        console.error('Error fetching ended memberships:', error);
        res.status(500).json({ message: 'Error fetching ended memberships.' });
    }
});

// Cron job to automatically mark memberships as 'ended'
cron.schedule('0 1 * * *', async () => { // Runs every day at 1:00 AM
    console.log('Running daily cron job to update ended memberships...');
    try {
        const [result] = await db.query(
            "UPDATE active_memberships SET status = 'ended' WHERE current_end_date < CURDATE() AND status = 'active'"
        );
        console.log(`Updated ${result.affectedRows} memberships to 'ended' status.`);
    } catch (error) {
        console.error('Error in daily membership status update cron job:', error);
    }
});

router.delete('/active/:id', isPrivilegedUser, async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.query(
            "UPDATE active_memberships SET status = 'terminated' WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Active membership not found.' });
        }

        res.json({ message: 'Membership terminated successfully. It has been moved to the terminated list.' });

    } catch (error) {
        console.error('Error terminating membership:', error);
        res.status(500).json({ message: 'Error terminating membership.' });
    }
});

router.put('/active/:id/renew', isPrivilegedUser, async (req, res) => {
    const { id: membership_id } = req.params; // Renamed for clarity
    const { start_date, discount_details, initial_payment, new_member_ids } = req.body; // Added new_member_ids
    const created_by_user_id = req.user.id;

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [memberships] = await connection.query('SELECT * FROM active_memberships WHERE id = ? FOR UPDATE', [membership_id]);
        if (memberships.length === 0) throw new Error('Membership to renew not found.');
        const oldMembership = memberships[0];

        // Check if there's a pending balance
        if (parseFloat(oldMembership.balance_amount) > 0) {
            throw new Error('Membership cannot be renewed due to an outstanding balance.');
        }

        // Ensure membership is 'ended' or 'active' and past its current_end_date to be renewed
        if (oldMembership.status !== 'ended' && !(oldMembership.status === 'active' && new Date(oldMembership.current_end_date) < new Date())) {
            throw new Error('Membership cannot be renewed unless it is ended or active and past its end date.');
        }

        if (!Array.isArray(new_member_ids) || new_member_ids.length === 0) {
            throw new Error('New member IDs are required for renewal.');
        }

        const [packages] = await connection.query('SELECT duration_days, per_person_price, max_team_size FROM membership_packages WHERE id = ?', [oldMembership.package_id]);
        if (packages.length === 0) throw new Error('Original package not found.');
        const { duration_days, per_person_price, max_team_size } = packages[0];

        if (new_member_ids.length > max_team_size) {
            throw new Error(`The number of members (${new_member_ids.length}) exceeds the maximum allowed for this package (${max_team_size}).`);
        }

        const new_final_price = parseFloat(per_person_price) * new_member_ids.length;
        const amount_paid = parseFloat(initial_payment?.amount || 0);
        const balance_amount = new_final_price - amount_paid;
        let payment_status = balance_amount <= 0 ? 'Completed' : (amount_paid > 0 ? 'Received' : 'Pending');

        const startDate = new Date(start_date);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + duration_days - 1);

        // --- UPDATE existing active_memberships record ---
        await connection.query(
            `UPDATE active_memberships 
           SET start_date = ?, 
               original_end_date = ?, 
               current_end_date = ?, 
               final_price = ?, 
               discount_details = ?, 
               amount_paid = ?, 
               balance_amount = ?, 
               payment_status = ?,
               status = 'active'
           WHERE id = ?`,
            [start_date, endDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10), new_final_price, discount_details, amount_paid, balance_amount, payment_status, membership_id]
        );

        // --- Update membership_team ---
        // 1. Delete existing team members for this membership
        await connection.query('DELETE FROM membership_team WHERE membership_id = ?', [membership_id]);

        // 2. Insert new team members
        for (const member_id_item of new_member_ids) {
            await connection.query(
                'INSERT INTO membership_team (membership_id, member_id) VALUES (?, ?)',
                [membership_id, member_id_item]
            );
        }

        if (initial_payment && initial_payment.amount > 0) {
            await connection.query(
                'INSERT INTO payments (membership_id, amount, payment_mode, payment_id, created_by_user_id) VALUES (?, ?, ?, ?, ?)',
                [membership_id, initial_payment.amount, initial_payment.payment_mode, initial_payment.payment_id, created_by_user_id]
            );
        }

        // No changes to membership_team as renewal applies to existing team members.

        // Fetch the updated membership details to send back to the frontend
        const [renewedMembershipRows] = await connection.query(
            `SELECT
                am.id, am.start_date, am.current_end_date, am.time_slot, am.final_price, am.discount_details,
                am.amount_paid, am.balance_amount, am.payment_status, am.status,
                mp.name as package_name, mp.per_person_price as package_price, mp.max_team_size,
                c.name as court_name,
                GROUP_CONCAT(DISTINCT m.full_name ORDER BY m.full_name SEPARATOR ', ') as team_members,
                COUNT(DISTINCT mt.member_id) as current_members_count
            FROM active_memberships am
            JOIN membership_packages mp ON am.package_id = mp.id
            JOIN courts c ON am.court_id = c.id
            LEFT JOIN membership_team mt ON am.id = mt.membership_id
            LEFT JOIN members m ON mt.member_id = m.id
            WHERE am.id = ?
            GROUP BY am.id`,
            [membership_id]
        );

        await connection.commit();

        if (renewedMembershipRows.length > 0) {
            res.status(200).json(renewedMembershipRows[0]);
        } else {
            res.status(404).json({ message: 'Renewed membership details not found.' });
        }
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error renewing membership:', error);
        res.status(500).json({ message: `Failed to renew membership: ${error.message}` });
    } finally {
        if (connection) connection.release();
    }
});

// PUT (manage members) for an active membership
router.put('/active/:id/manage-members', isPrivilegedUser, async (req, res) => {
    const { id: membership_id } = req.params;
    const { member_ids } = req.body; // Expect an array of member IDs that should be in the team

    if (!Array.isArray(member_ids)) {
        return res.status(400).json({ message: 'Member IDs must be provided as an array.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Fetch current membership details and lock row
        const [memberships] = await connection.query(
            `SELECT am.*, mp.per_person_price, mp.max_team_size,
                    (SELECT COUNT(*) FROM membership_team WHERE membership_id = am.id) as current_members_count
             FROM active_memberships am
             JOIN membership_packages mp ON am.package_id = mp.id
             WHERE am.id = ? FOR UPDATE`,
            [membership_id]
        );
        if (memberships.length === 0) {
            throw new Error('Active membership not found.');
        }
        const membership = memberships[0];

        // Validate new member count
        if (member_ids.length === 0) {
            throw new Error('At least one member must be in the team.');
        }
        if (member_ids.length > membership.max_team_size) {
            throw new Error(`Team size (${member_ids.length}) exceeds maximum allowed (${membership.max_team_size}).`);
        }

        // Fetch current members associated with this membership
        const [currentTeamMembers] = await connection.query(
            'SELECT member_id FROM membership_team WHERE membership_id = ?',
            [membership_id]
        );
        const currentMemberIds = new Set(currentTeamMembers.map(row => row.member_id));
        const newMemberIdsSet = new Set(member_ids);

        // Determine members to remove and members to add
        const membersToRemove = [...currentMemberIds].filter(id => !newMemberIdsSet.has(id));
        const membersToAdd = [...newMemberIdsSet].filter(id => !currentMemberIds.has(id));

        // Remove members
        if (membersToRemove.length > 0) {
            await connection.query(
                `DELETE FROM membership_team WHERE membership_id = ? AND member_id IN (?)`,
                [membership_id, membersToRemove]
            );
        }

        // Add members
        for (const memberId of membersToAdd) {
            await connection.query(
                'INSERT INTO membership_team (membership_id, member_id) VALUES (?, ?)',
                [membership_id, memberId]
            );
        }

        // Recalculate price based on new team composition rules
        const old_members_count = membership.current_members_count; // This is the count from the DB at the start of transaction
        const new_members_count = member_ids.length; // This is the count of members after this operation
        const per_person_price = parseFloat(membership.per_person_price);

        let final_price_to_set = parseFloat(membership.final_price); // Start with current final price

        // The rule is: price increases if actual members go up. Price does NOT decrease.
        // So, the final_price should be the maximum of:
        // 1. The current (previous) final_price.
        // 2. The price if all 'new_members_count' slots were filled from scratch.
        final_price_to_set = Math.max(final_price_to_set, per_person_price * new_members_count);

        let new_amount_paid = parseFloat(membership.amount_paid); // Amount paid does not change by managing members, only by payment additions

        // The balance_amount needs to reflect the new final_price (if it increased)
        let new_balance_amount = final_price_to_set - new_amount_paid;
        let payment_status = new_balance_amount <= 0 ? 'Completed' : (new_amount_paid > 0 ? 'Received' : 'Pending');

        // Update active_memberships table
        await connection.query(
            `UPDATE active_memberships 
             SET final_price = ?, 
                 balance_amount = ?, 
                 payment_status = ? 
             WHERE id = ?`,
            [final_price_to_set, new_balance_amount, payment_status, membership_id]
        );

        // Fetch the full updated membership object to return
        const [updatedMembershipRows] = await connection.query(
            `SELECT 
                am.id, am.start_date, am.current_end_date, am.time_slot, am.final_price, am.discount_details, 
                am.amount_paid, am.balance_amount, am.payment_status, am.status,
                mp.name as package_name, mp.per_person_price as package_price, mp.max_team_size,
                c.name as court_name,
                GROUP_CONCAT(DISTINCT m.full_name ORDER BY m.full_name SEPARATOR ', ') as team_members,
                COUNT(DISTINCT mt.member_id) as current_members_count
            FROM active_memberships am
            JOIN membership_packages mp ON am.package_id = mp.id
            JOIN courts c ON am.court_id = c.id
            LEFT JOIN membership_team mt ON am.id = mt.membership_id
            LEFT JOIN members m ON mt.member_id = m.id
            WHERE am.id = ?
            GROUP BY am.id`,
            [membership_id]
        );

        await connection.commit();

        if (updatedMembershipRows.length > 0) {
            res.status(200).json(updatedMembershipRows[0]);
        } else {
            res.status(404).json({ message: 'Managed membership details not found.' });
        }

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error managing active membership members:', error);
        res.status(500).json({ message: `Failed to manage members: ${error.message}` });
    } finally {
        if (connection) connection.release();
    }
});

// NEW: Add a member to an existing active membership
router.post('/active/:id/add-member', isPrivilegedUser, async (req, res) => {
    const { id: active_membership_id } = req.params;
    const { member_id, payment } = req.body;
    const created_by_user_id = req.user.id;

    if (!member_id) {
        return res.status(400).json({ message: 'Missing required field: member_id.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [activeMemberships] = await connection.query(
            `SELECT am.*, mp.per_person_price, mp.max_team_size
             FROM active_memberships am
             JOIN membership_packages mp ON am.package_id = mp.id
             WHERE am.id = ? FOR UPDATE`,
            [active_membership_id]
        );
        if (activeMemberships.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Active membership not found.' });
        }
        const membership = activeMemberships[0];

        const [currentTeam] = await connection.query('SELECT COUNT(*) as member_count FROM membership_team WHERE membership_id = ?', [active_membership_id]);
        if (currentTeam[0].member_count >= membership.max_team_size) {
            await connection.rollback();
            return res.status(400).json({ message: `Team is already full. Max team size: ${membership.max_team_size}.` });
        }

        const [existingMember] = await connection.query('SELECT * FROM membership_team WHERE membership_id = ? AND member_id = ?', [active_membership_id, member_id]);
        if (existingMember.length > 0) {
            await connection.rollback();
            return res.status(409).json({ message: 'Member is already part of this team.' });
        }

        await connection.query('INSERT INTO membership_team (membership_id, member_id) VALUES (?, ?)', [active_membership_id, member_id]);

        const new_final_price = parseFloat(membership.final_price) + parseFloat(membership.per_person_price);
        let new_amount_paid = parseFloat(membership.amount_paid);

        if (payment && payment.amount > 0) {
            new_amount_paid += parseFloat(payment.amount);
            await connection.query(
                'INSERT INTO payments (membership_id, amount, payment_mode, payment_id, created_by_user_id) VALUES (?, ?, ?, ?, ?)',
                [active_membership_id, payment.amount, payment.payment_mode, payment.payment_id, created_by_user_id]
            );
        }

        const new_balance_amount = new_final_price - new_amount_paid;
        const new_payment_status = new_balance_amount <= 0 ? 'Completed' : 'Received';

        await connection.query(
            'UPDATE active_memberships SET final_price = ?, amount_paid = ?, balance_amount = ?, payment_status = ? WHERE id = ?',
            [new_final_price, new_amount_paid, new_balance_amount, new_payment_status, active_membership_id]
        );

        await connection.commit();

        const [updatedMembershipRows] = await connection.query(
            `SELECT 
                am.id, am.start_date, am.current_end_date, am.time_slot, am.final_price, am.discount_details, am.amount_paid, am.balance_amount, am.payment_status,
                mp.name as package_name, mp.per_person_price as package_price, mp.max_team_size,
                c.name as court_name,
                GROUP_CONCAT(m.full_name ORDER BY m.full_name SEPARATOR ', ') as team_members,
                COUNT(DISTINCT mt.member_id) as current_members_count
            FROM active_memberships am
            JOIN membership_packages mp ON am.package_id = mp.id
            JOIN courts c ON am.court_id = c.id
            LEFT JOIN membership_team mt ON am.id = mt.membership_id
            LEFT JOIN members m ON mt.member_id = m.id
            WHERE am.id = ?
            GROUP BY am.id`,
            [active_membership_id]
        );
        res.status(200).json({ message: 'Member added and membership updated successfully.', membership: updatedMembershipRows[0] });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error adding member to active membership:', error);
        res.status(500).json({ message: `Failed to add member: ${error.message}` });
    } finally {
        if (connection) connection.release();
    }
});

router.put('/ended/:id/terminate', isPrivilegedUser, async (req, res) => {
    const { id } = req.params;

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Check if membership exists, is in 'ended' status or active but past its end date, AND get balance_amount
        const [memberships] = await connection.query(
            "SELECT id, balance_amount FROM active_memberships WHERE id = ? AND (status = 'ended' OR (status = 'active' AND current_end_date < CURDATE())) FOR UPDATE",
            [id]
        );

        if (memberships.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Ended membership not found.' });
        }

        const membership = memberships[0];

        // NEW: Check for outstanding balance
        if (parseFloat(membership.balance_amount) > 0) {
            await connection.rollback();
            return res.status(403).json({ message: 'Cannot terminate membership with outstanding balance. Please clear the balance first.' });
        }

        // Update status to 'terminated'
        await connection.query(
            "UPDATE active_memberships SET status = 'terminated' WHERE id = ?",
            [id]
        );

        await connection.commit();
        res.json({ message: 'Membership successfully terminated from ended status.' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error terminating ended membership:', error);
        res.status(500).json({ message: 'Failed to terminate ended membership.' });
    } finally {
        if (connection) connection.release();
    }
});

// NEW: Add a partial payment to an existing active membership
router.post('/active/:id/payments', isPrivilegedUser, async (req, res) => {
    const { id: active_membership_id } = req.params;
    const { amount, payment_mode, payment_id } = req.body;
    const created_by_user_id = req.user.id;

    if (!amount || !payment_mode) {
        return res.status(400).json({ message: 'Amount and payment mode are required' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [memberships] = await connection.query('SELECT * FROM active_memberships WHERE id = ? FOR UPDATE', [active_membership_id]);
        if (memberships.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Active membership not found.' });
        }
        const membership = memberships[0];

        await connection.query(
            'INSERT INTO payments (membership_id, amount, payment_mode, payment_id, created_by_user_id) VALUES (?, ?, ?, ?, ?)',
            [active_membership_id, amount, payment_mode, payment_id, created_by_user_id]
        );

        const new_amount_paid = parseFloat(membership.amount_paid) + parseFloat(amount);
        const new_balance_amount = parseFloat(membership.final_price) - new_amount_paid;
        const new_payment_status = new_balance_amount <= 0 ? 'Completed' : 'Received';

        await connection.query(
            'UPDATE active_memberships SET amount_paid = ?, balance_amount = ?, payment_status = ? WHERE id = ?',
            [new_amount_paid, new_balance_amount, new_payment_status, active_membership_id]
        );

        await connection.commit();

        const [updatedMembershipRows] = await connection.query(
            `SELECT 
                am.id, am.start_date, am.current_end_date, am.time_slot, am.final_price, am.discount_details, am.amount_paid, am.balance_amount, am.payment_status,
                mp.name as package_name, mp.per_person_price as package_price, mp.max_team_size,
                c.name as court_name,
                GROUP_CONCAT(m.full_name ORDER BY m.full_name SEPARATOR ', ') as team_members,
                COUNT(DISTINCT mt.member_id) as current_members_count
            FROM active_memberships am
            JOIN membership_packages mp ON am.package_id = mp.id
            JOIN courts c ON am.court_id = c.id
            LEFT JOIN membership_team mt ON am.id = mt.membership_id
            LEFT JOIN members m ON mt.member_id = m.id
            WHERE am.id = ?
            GROUP BY am.id`,
            [active_membership_id]
        );

        res.status(200).json({ message: 'Payment added successfully.', membership: updatedMembershipRows[0] });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error adding payment to membership:', error);
        res.status(500).json({ message: `Failed to add payment: ${error.message}` });
    } finally {
        if (connection) connection.release();
    }
});


// ------------------- Team Attendance -------------------


router.get('/:id/details', isPrivilegedUser, async (req, res) => {
    const { id } = req.params;
    try {
        const membershipQuery = `
            SELECT 
                am.id AS membership_id,
                am.start_date,
                am.current_end_date AS end_date,
                am.status,
                am.final_price AS price,
                am.amount_paid,
                am.balance_amount,
                am.payment_status,
                am.discount_details,
                mp.name AS package_name,
                mp.duration_days,
                mp.per_person_price,
                creator.username AS created_by_user,
                GROUP_CONCAT(DISTINCT m.full_name SEPARATOR ', ') AS member_name,
                GROUP_CONCAT(DISTINCT m.phone_number SEPARATOR ', ') as member_contact,
                COUNT(DISTINCT mt.member_id) as member_count
            FROM 
                active_memberships am
            JOIN 
                membership_packages mp ON am.package_id = mp.id
            LEFT JOIN
                users creator ON am.created_by_user_id = creator.id
            LEFT JOIN 
                membership_team mt ON am.id = mt.membership_id
            LEFT JOIN 
                members m ON mt.member_id = m.id
            WHERE 
                am.id = ?
            GROUP BY
                am.id;
        `;
        const [membershipRows] = await db.query(membershipQuery, [id]);
        if (membershipRows.length === 0) {
            return res.status(404).json({ message: 'Membership not found' });
        }
        const membership = membershipRows[0];

        const base_price = parseFloat(membership.per_person_price) * membership.member_count;
        const discount_amount = base_price - parseFloat(membership.price);

        membership.base_price = base_price;
        membership.discount_amount = discount_amount;

        const paymentsQuery = `
            SELECT p.payment_id, p.amount, p.payment_mode, p.payment_date, u.username 
            FROM payments p
            LEFT JOIN users u ON p.created_by_user_id = u.id
            WHERE p.membership_id = ?
            ORDER BY p.payment_date ASC
        `;
        const [payments] = await db.query(paymentsQuery, [id]);
        membership.payments = payments;

        const leaveQuery = `
            SELECT ml.start_date, ml.end_date, ml.reason, u.username as approved_by
            FROM membership_leave ml
            LEFT JOIN users u ON ml.approved_by_user_id = u.id
            WHERE ml.membership_id = ? AND ml.status = 'APPROVED'
            ORDER BY ml.start_date ASC
        `;
        const [leaves] = await db.query(leaveQuery, [id]);
        membership.leaves = leaves;

        //In the baseMembershipQuery it is duration_days, but in modal it is duration_months so I am converting it
        membership.duration_months = membership.duration_days;

        res.json(membership);

    } catch (error) {
        console.error('Error fetching membership details:', error);
        res.status(500).json({ message: 'Error fetching membership details' });
    }
});


module.exports = router;

// PDF Receipt Generation
router.get('/:id/receipt.pdf', isPrivilegedUser, async (req, res) => {
    const { id } = req.params;
    try {
        const membershipQuery = `
            SELECT 
                am.id AS membership_id,
                am.start_date,
                am.current_end_date AS end_date,
                am.status,
                am.final_price AS price,
                am.amount_paid,
                (am.final_price - am.amount_paid) AS balance,
                am.payment_status,
                am.discount_details,
                mp.name AS package_name,
                mp.duration_days,
                mp.per_person_price,
                (SELECT COUNT(DISTINCT mt.member_id) FROM membership_team mt WHERE mt.membership_id = am.id) as member_count,
                creator.username as created_by_user,
                GROUP_CONCAT(DISTINCT m.full_name SEPARATOR ', ') AS team_members,
                GROUP_CONCAT(DISTINCT m.phone_number SEPARATOR ', ') as member_contact
            FROM 
                active_memberships am
            JOIN 
                membership_packages mp ON am.package_id = mp.id
            LEFT JOIN
                users creator ON am.created_by_user_id = creator.id
            LEFT JOIN 
                membership_team mt ON am.id = mt.membership_id
            LEFT JOIN 
                members m ON mt.member_id = m.id
            WHERE 
                am.id = ?
            GROUP BY
                am.id;
        `;
        const [membershipRows] = await db.query(membershipQuery, [id]);
        if (membershipRows.length === 0) {
            return res.status(404).send('Membership not found');
        }
        const membership = membershipRows[0];

        const base_price = parseFloat(membership.per_person_price) * membership.member_count;
        const discount_amount = base_price - parseFloat(membership.price);

        membership.base_price = base_price;
        membership.discount_amount = discount_amount;

        const paymentsQuery = `
            SELECT p.amount, p.payment_mode, p.payment_date, u.username 
            FROM payments p
            LEFT JOIN users u ON p.created_by_user_id = u.id
            WHERE p.membership_id = ?
            ORDER BY p.payment_date ASC
        `;
        const [payments] = await db.query(paymentsQuery, [id]);

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="membership-receipt-${membership.membership_id}.pdf"`);
        doc.pipe(res);

        const formatDate = (dateString) => {
            if (!dateString) return 'N/A';
            const date = new Date(dateString);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        };

        // Header
        doc.fontSize(20).text('ARC SportsZone', { align: 'center' });
        doc.fontSize(14).text('Membership Receipt', { align: 'center' });
        doc.moveDown();

        // Membership Details
        doc.fontSize(12).text(`Membership ID: ${membership.membership_id}`);
        doc.text(`Package: ${membership.package_name} (${membership.duration_days} days)`);
        doc.text(`Status: ${membership.status}`);
        doc.text(`Start Date: ${formatDate(membership.start_date)}`);
        doc.text(`End Date: ${formatDate(membership.end_date)}`);
        doc.moveDown();

        // Member Details
        doc.fontSize(14).text('Member(s)', { underline: true });
        doc.fontSize(12).text(membership.team_members);
        doc.text(`Contact: ${membership.member_contact}`);
        doc.moveDown();

        // Payment Details
        doc.fontSize(14).text('Payment Details', { underline: true });
        doc.fontSize(12).text(`Actual Price: Rs. ${membership.base_price.toFixed(2)}`);
        doc.text(`Discount: Rs. ${membership.discount_amount.toFixed(2)}`);
        if (membership.discount_details) {
            doc.text(`Discount Details: ${membership.discount_details}`);
        }
        doc.font('Helvetica-Bold').text(`Final Price: Rs. ${membership.price.toFixed(2)}`);
        doc.font('Helvetica').text(`Amount Paid: Rs. ${membership.amount_paid.toFixed(2)}`);
        doc.text(`Balance: Rs. ${membership.balance.toFixed(2)}`);
        doc.text(`Payment Status: ${membership.payment_status}`);
        doc.moveDown();

        // Payment History
        if (payments.length > 0) {
            doc.fontSize(14).text('Payment History', { underline: true });
            payments.forEach(p => {
                doc.fontSize(10).text(`- Rs. ${p.amount.toFixed(2)} via ${p.payment_mode} on ${formatDate(p.payment_date)} (by ${p.username || 'N/A'})`);
            });
            doc.moveDown();
        }

        // Footer
        doc.fontSize(10).text(`Generated by: ${membership.created_by_user || 'N/A'}`, { align: 'right' });
        doc.text(`Date: ${formatDate(new Date())}`, { align: 'right' });

        doc.end();

    } catch (error) {
        console.error('Error generating membership PDF receipt:', error);
        res.status(500).send('Error generating PDF receipt');
    }
});


module.exports = router;
