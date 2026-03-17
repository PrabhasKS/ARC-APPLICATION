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

// ---------------------------------------------------------
// NEW ONBOARDING LOGIC
// ---------------------------------------------------------

// POST a new membership subscription (Add member to a Team)
// This completely replaces the old `/subscribe` logic
router.post('/subscribe', isPrivilegedUser, async (req, res) => {
    // team_id is the new requirement. You must create a team first before subscribing someone.
    const {
        team_id,
        package_id,
        member_id,
        start_date,
        discount_amount,
        discount_details,
        initial_payment
    } = req.body;

    const created_by_user_id = req.user.id;

    if (!team_id || !package_id || !member_id || !start_date) {
        return res.status(400).json({ message: 'Missing required subscription data (team, package, member, start date).' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Validate the member isn't already active in THIS team
        const [existing] = await connection.query(
            'SELECT id FROM team_memberships WHERE team_id = ? AND member_id = ? AND status = "active"',
            [team_id, member_id]
        );
        if (existing.length > 0) {
            throw new Error('This member is already an active participant in this Team.');
        }

        // 2. Validate the team exists and has capacity
        const [teams] = await connection.query('SELECT max_players, status FROM teams WHERE id = ? FOR UPDATE', [team_id]);
        if (teams.length === 0) throw new Error('Team not found.');
        if (teams[0].status !== 'active') throw new Error('Cannot add a member to an expired or terminated team.');

        const [currentMembers] = await connection.query(
            'SELECT COUNT(*) as active_count FROM team_memberships WHERE team_id = ? AND status = "active"',
            [team_id]
        );
        if (currentMembers[0].active_count >= teams[0].max_players) {
            throw new Error('This Team is already at maximum capacity.');
        }

        // 3. Get Package Details
        const [packages] = await connection.query('SELECT duration_days, per_person_price FROM membership_packages WHERE id = ?', [package_id]);
        if (packages.length === 0) throw new Error('Membership package not found.');

        const { duration_days, per_person_price } = packages[0];
        const final_price = parseFloat(per_person_price) - parseFloat(discount_amount || 0);

        if (final_price < 0) throw new Error('Discount cannot be greater than the package price.');

        const amount_paid = parseFloat(initial_payment?.amount || 0);
        const balance_amount = final_price - amount_paid;

        // Ensure paid amount isn't greater than final price
        if (amount_paid > final_price) {
            throw new Error('Initial payment cannot be greater than the final discounted price.');
        }

        let payment_status = 'Pending';
        if (balance_amount <= 0) {
            payment_status = 'Completed';
        } else if (amount_paid > 0) {
            payment_status = 'Received';
        }

        // 4. Calculate Dates
        const startDateObj = new Date(start_date);
        const endDateObj = new Date(startDateObj);
        endDateObj.setDate(startDateObj.getDate() + duration_days - 1); // -1 to make it inclusive
        const end_date = endDateObj.toISOString().slice(0, 10);

        // 5. Insert Team Membership
        const [subscriptionResult] = await connection.query(
            `INSERT INTO team_memberships 
             (team_id, member_id, package_id, start_date, original_end_date, current_end_date, amount_paid, balance_amount, payment_status, discount_amount, discount_details, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
            [team_id, member_id, package_id, start_date, end_date, end_date, amount_paid, balance_amount, payment_status, discount_amount || 0, discount_details]
        );
        const new_team_membership_id = subscriptionResult.insertId;

        // 6. Log Initial Payment
        if (initial_payment && initial_payment.amount > 0) {
            await connection.query(
                'INSERT INTO payments (team_membership_id, amount, payment_mode, payment_id, created_by_user_id) VALUES (?, ?, ?, ?, ?)',
                [new_team_membership_id, initial_payment.amount, initial_payment.payment_mode, initial_payment.payment_id, created_by_user_id]
            );
        }

        await connection.commit();
        res.status(201).json({
            success: true,
            id: new_team_membership_id,
            message: 'Member successfully added to the team.'
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error adding member to team:', error);
        res.status(400).json({ message: error.message || 'Failed to add member to team' });
    } finally {
        if (connection) connection.release();
    }
});


// ---------------------------------------------------------
// GETTING MEMBERSHIPS
// ---------------------------------------------------------

const baseMembershipQuery = `
    SELECT 
        tm.id, tm.start_date, tm.current_end_date, tm.amount_paid, tm.balance_amount, tm.payment_status, tm.discount_details, tm.discount_amount, tm.status,
        tm.original_end_date,
        m.id as member_id, m.full_name as member_name, m.phone_number as member_contact,
        t.id as team_id, t.name as team_name, t.time_slot, t.max_players,
        c.name as court_name,
        mp.name as package_name, mp.per_person_price as package_price, mp.duration_days,
        (mp.per_person_price - tm.discount_amount) as final_price_calc,
        (
             SELECT GROUP_CONCAT(CONCAT(p.amount, ': ', p.payment_mode, IF(p.payment_id IS NOT NULL, CONCAT(' (', p.payment_id, ')'), '')) SEPARATOR '; ')
             FROM payments p
             WHERE p.team_membership_id = tm.id
        ) as payment_info
    FROM team_memberships tm
    JOIN members m ON tm.member_id = m.id
    JOIN teams t ON tm.team_id = t.id
    JOIN courts c ON t.court_id = c.id
    JOIN membership_packages mp ON tm.package_id = mp.id
`;

router.get('/active', isPrivilegedUser, async (req, res) => {
    try {
        const { date } = req.query;
        let whereClause = ` WHERE tm.status = 'active' `;
        const queryParams = [];

        if (date) {
            whereClause += ' AND tm.start_date <= ? AND tm.current_end_date >= ?';
            queryParams.push(date, date);
        } else {
            whereClause += ' AND tm.current_end_date >= CURDATE()';
        }

        // Group by team to give frontend a structured view
        const query = `
            ${baseMembershipQuery}
            ${whereClause}
            ORDER BY tm.current_end_date ASC
        `;

        const [memberships] = await db.query(query, queryParams);
        res.json(memberships);
    } catch (error) {
        console.error('Error fetching active team memberships:', error);
        res.status(500).json({ message: 'Error fetching active memberships.' });
    }
});

router.get('/ended', isPrivilegedUser, async (req, res) => {
    try {
        const query = `
            ${baseMembershipQuery}
            WHERE tm.status = 'expired' OR (tm.status = 'active' AND tm.current_end_date < CURDATE())
            ORDER BY tm.current_end_date DESC
        `;
        const [memberships] = await db.query(query);
        res.json(memberships);
    } catch (error) {
        console.error('Error fetching ended memberships:', error);
        res.status(500).json({ message: 'Error fetching ended memberships.' });
    }
});

router.get('/terminated', isPrivilegedUser, async (req, res) => {
    try {
        const query = `
            ${baseMembershipQuery}
            WHERE tm.status = 'terminated'
            ORDER BY tm.created_at DESC
        `;
        const [memberships] = await db.query(query);
        res.json(memberships);
    } catch (error) {
        console.error('Error fetching terminated memberships:', error);
        res.status(500).json({ message: 'Error fetching terminated memberships.' });
    }
});


// ---------------------------------------------------------
// CRON JOBS & STATUS UPDATES
// ---------------------------------------------------------

// Cron job to automatically mark individual memberships as 'expired'
cron.schedule('0 1 * * *', async () => { // Runs every day at 1:00 AM
    console.log('Running daily cron job to expire old team_memberships...');
    try {
        // Expire the members
        const [result] = await db.query(
            "UPDATE team_memberships SET status = 'expired' WHERE current_end_date < CURDATE() AND status = 'active'"
        );
        console.log(`Updated ${result.affectedRows} members to 'expired' status.`);

        // Also check if any Teams are completely empty and mark them expired to release courts
        const [teamResult] = await db.query(`
            UPDATE teams t
            SET t.status = 'expired'
            WHERE t.status = 'active'
            AND NOT EXISTS (
                SELECT 1 FROM team_memberships tm 
                WHERE tm.team_id = t.id AND tm.status = 'active'
            )
        `);
        if (teamResult.affectedRows > 0) {
            console.log(`Updated ${teamResult.affectedRows} entirely empty Teams to 'expired'.`);
        }

    } catch (error) {
        console.error('Error in daily membership status update cron job:', error);
    }
});
// Terminate a single member's subscription (balance must be cleared first)
router.delete('/active/:id', isPrivilegedUser, async (req, res) => {
    const { id } = req.params; // ID of the team_memberships row

    try {
        const [rows] = await db.query('SELECT balance_amount FROM team_memberships WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Active membership not found.' });

        if (parseFloat(rows[0].balance_amount) > 0) {
            return res.status(403).json({ message: 'Cannot terminate membership with an outstanding balance. Please clear the balance first.' });
        }

        const [result] = await db.query(
            "UPDATE team_memberships SET status = 'terminated' WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Active membership not found.' });
        }

        res.json({ message: 'Member subscription terminated successfully.' });

    } catch (error) {
        console.error('Error terminating membership:', error);
        res.status(500).json({ message: 'Error terminating membership.' });
    }
});

// Move an ended/expired member to 'terminated' status
router.put('/ended/:id/terminate', isPrivilegedUser, async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT balance_amount, status FROM team_memberships WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Membership not found.' });

        if (parseFloat(rows[0].balance_amount) > 0) {
            return res.status(403).json({ message: 'Cannot terminate membership with an outstanding balance. Please clear the balance first.' });
        }

        await db.query("UPDATE team_memberships SET status = 'terminated' WHERE id = ?", [id]);
        res.json({ message: 'Membership terminated successfully.' });
    } catch (error) {
        console.error('Error terminating ended membership:', error);
        res.status(500).json({ message: 'Error terminating ended membership.' });
    }
});


// ---------------------------------------------------------
// PAYMENTS & RECEIPT
// ---------------------------------------------------------

// Add a partial payment to an existing individual subscription
router.post('/active/:id/payments', isPrivilegedUser, async (req, res) => {
    const { id: team_membership_id } = req.params;
    const { amount, payment_mode, payment_id } = req.body;
    const created_by_user_id = req.user.id;

    if (!amount || !payment_mode) {
        return res.status(400).json({ message: 'Amount and payment mode are required' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [memberships] = await connection.query(
            'SELECT tm.*, mp.per_person_price FROM team_memberships tm JOIN membership_packages mp ON tm.package_id = mp.id WHERE tm.id = ? FOR UPDATE',
            [team_membership_id]
        );
        if (memberships.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Subscription not found.' });
        }
        const membership = memberships[0];

        await connection.query(
            'INSERT INTO payments (team_membership_id, amount, payment_mode, payment_id, created_by_user_id) VALUES (?, ?, ?, ?, ?)',
            [team_membership_id, amount, payment_mode, payment_id, created_by_user_id]
        );

        const new_amount_paid = parseFloat(membership.amount_paid) + parseFloat(amount);

        // Final price logic simplified as we removed final_price column from team_memberships 
        // We calculate balance amount directly based on the package price minus their specific discount amount recorded.
        // For simplicity, we just subtract the payment from the existing balance_amount
        const new_balance_amount = parseFloat(membership.balance_amount) - parseFloat(amount);
        const new_payment_status = new_balance_amount <= 0 ? 'Completed' : 'Received';

        await connection.query(
            'UPDATE team_memberships SET amount_paid = ?, balance_amount = ?, payment_status = ? WHERE id = ?',
            [new_amount_paid, new_balance_amount, new_payment_status, team_membership_id]
        );

        await connection.commit();
        res.status(200).json({ success: true, message: 'Payment added successfully.' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error adding payment to membership:', error);
        res.status(500).json({ message: `Failed to add payment: ${error.message}` });
    } finally {
        if (connection) connection.release();
    }
});

// Renew a single expired member
router.put('/active/:id/renew', isPrivilegedUser, async (req, res) => {
    const { id: team_membership_id } = req.params;
    const { start_date, discount_amount, discount_details, initial_payment, package_id } = req.body;
    const created_by_user_id = req.user.id;

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [memberships] = await connection.query('SELECT * FROM team_memberships WHERE id = ? FOR UPDATE', [team_membership_id]);
        if (memberships.length === 0) throw new Error('Subscription not found.');
        const oldMembership = memberships[0];

        if (parseFloat(oldMembership.balance_amount) > 0) {
            throw new Error('Subscription cannot be renewed due to an outstanding balance.');
        }

        const [packages] = await connection.query('SELECT duration_days, per_person_price FROM membership_packages WHERE id = ?', [package_id || oldMembership.package_id]);
        if (packages.length === 0) throw new Error('Package not found.');
        const { duration_days, per_person_price } = packages[0];

        const final_price = parseFloat(per_person_price); // Discount logic needs refinement if applying again
        const amount_paid = parseFloat(initial_payment?.amount || 0);
        const balance_amount = final_price - amount_paid;
        let payment_status = balance_amount <= 0 ? 'Completed' : (amount_paid > 0 ? 'Received' : 'Pending');

        const startDate = new Date(start_date);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + duration_days - 1);

        await connection.query(
            `UPDATE team_memberships 
            SET package_id = ?,
                start_date = ?, 
                original_end_date = ?, 
                current_end_date = ?, 
                amount_paid = ?, 
                balance_amount = ?, 
                payment_status = ?,
                status = 'active',
                discount_amount = ?,
                discount_details = ?
            WHERE id = ?`,
            [package_id || oldMembership.package_id, start_date, endDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10),
                amount_paid, balance_amount, payment_status, discount_amount || 0, discount_details, team_membership_id]
        );

        if (initial_payment && initial_payment.amount > 0) {
            await connection.query(
                'INSERT INTO payments (team_membership_id, amount, payment_mode, payment_id, created_by_user_id) VALUES (?, ?, ?, ?, ?)',
                [team_membership_id, initial_payment.amount, initial_payment.payment_mode, initial_payment.payment_id, created_by_user_id]
            );
        }

        await connection.commit();
        res.status(200).json({ success: true, message: 'Subscription successfully renewed.' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error renewing membership:', error);
        res.status(500).json({ message: error.message });
    } finally {
        if (connection) connection.release();
    }
});
// ---------------------------------------------------------
// BULK TEAM ACTIONS
// ---------------------------------------------------------

// Renew all expired members in a team with their same package
router.post('/teams/:team_id/renew-all', isPrivilegedUser, async (req, res) => {
    const { team_id } = req.params;
    const { start_date, discount_amount, discount_details, initial_payment } = req.body;
    const created_by_user_id = req.user.id;

    if (!start_date) return res.status(400).json({ message: 'start_date is required.' });

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get all expired/active-but-ended members in this team
        const [members] = await connection.query(
            `SELECT tm.*, mp.duration_days, mp.per_person_price 
             FROM team_memberships tm 
             JOIN membership_packages mp ON tm.package_id = mp.id
             WHERE tm.team_id = ? AND (tm.status = 'expired' OR (tm.status = 'active' AND tm.current_end_date < CURDATE()))`,
            [team_id]
        );

        if (members.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'No ended/expired members found in this team to renew.' });
        }

        // Check no one has an outstanding balance
        const anyWithBalance = members.find(m => parseFloat(m.balance_amount) > 0);
        if (anyWithBalance) {
            await connection.rollback();
            return res.status(403).json({ message: `Cannot renew: member "${anyWithBalance.member_id}" has an outstanding balance. Clear all balances first.` });
        }

        const startDateObj = new Date(start_date);
        const renewedIds = [];

        for (const member of members) {
            const { duration_days, per_person_price } = member;
            const disc = parseFloat(discount_amount || 0);
            const final_price = parseFloat(per_person_price) - disc;
            const paid = parseFloat(initial_payment?.amount || 0);
            const balance = final_price - paid;
            const payStatus = balance <= 0 ? 'Completed' : (paid > 0 ? 'Received' : 'Pending');

            const endDateObj = new Date(startDateObj);
            endDateObj.setDate(startDateObj.getDate() + duration_days - 1);
            const end_date = endDateObj.toISOString().slice(0, 10);

            await connection.query(
                `UPDATE team_memberships 
                 SET start_date = ?, original_end_date = ?, current_end_date = ?,
                     amount_paid = ?, balance_amount = ?, payment_status = ?,
                     discount_amount = ?, discount_details = ?, status = 'active'
                 WHERE id = ?`,
                [start_date, end_date, end_date, paid, balance, payStatus,
                    disc, discount_details || null, member.id]
            );

            if (initial_payment && initial_payment.amount > 0) {
                await connection.query(
                    'INSERT INTO payments (team_membership_id, amount, payment_mode, payment_id, created_by_user_id) VALUES (?, ?, ?, ?, ?)',
                    [member.id, initial_payment.amount, initial_payment.payment_mode, initial_payment.payment_id || null, created_by_user_id]
                );
            }
            renewedIds.push(member.id);
        }

        // Re-activate the team itself if it was expired
        await connection.query("UPDATE teams SET status = 'active' WHERE id = ?", [team_id]);

        await connection.commit();
        res.status(200).json({ success: true, message: `Successfully renewed ${renewedIds.length} member(s).`, renewed_ids: renewedIds });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error renewing whole team:', error);
        res.status(500).json({ message: error.message || 'Failed to renew team.' });
    } finally {
        if (connection) connection.release();
    }
});

// ---------------------------------------------------------
// BULK TEAM PAYMENTS
// ---------------------------------------------------------

router.post('/team-payments/:team_id', isPrivilegedUser, async (req, res) => {
    const { team_id } = req.params;
    let { amount, payment_mode, payment_id } = req.body;
    let paymentAmount = parseFloat(amount);
    const created_by_user_id = req.user.id;

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({ message: 'Invalid payment amount.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Get all active memberships for this team with a balance, ordered by ID
        const [memberships] = await connection.query(
            `SELECT id, balance_amount, amount_paid 
             FROM team_memberships 
             WHERE team_id = ? AND status = 'active' AND balance_amount > 0 
             ORDER BY id ASC FOR UPDATE`,
            [team_id]
        );

        if (memberships.length === 0) {
            throw new Error('No active members with outstanding balances found in this team.');
        }

        let totalBalance = memberships.reduce((sum, m) => sum + parseFloat(m.balance_amount), 0);
        if (paymentAmount > totalBalance) {
            throw new Error(`Amount exceeds the total team balance of Rs. ${totalBalance}.`);
        }

        // Iterate and distribute payment
        for (const member of memberships) {
            if (paymentAmount <= 0) break;

            const memberBal = parseFloat(member.balance_amount);
            const appliedAmount = Math.min(memberBal, paymentAmount);

            const newBalance = memberBal - appliedAmount;
            const newAmountPaid = parseFloat(member.amount_paid) + appliedAmount;
            const paymentStatus = newBalance <= 0 ? 'Completed' : 'Received';

            // Update individual membership
            await connection.query(
                `UPDATE team_memberships SET balance_amount = ?, amount_paid = ?, payment_status = ? WHERE id = ?`,
                [newBalance, newAmountPaid, paymentStatus, member.id]
            );

            // Record payment
            await connection.query(
                `INSERT INTO payments (team_membership_id, amount, payment_mode, payment_id, created_by_user_id) VALUES (?, ?, ?, ?, ?)`,
                [member.id, appliedAmount, payment_mode, payment_id || null, created_by_user_id]
            );

            paymentAmount -= appliedAmount;
        }

        await connection.commit();
        res.status(200).json({ success: true, message: 'Team payment distributed successfully.' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error distributing team payment:', error);
        res.status(500).json({ message: error.message || 'Failed to process team payment.' });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
