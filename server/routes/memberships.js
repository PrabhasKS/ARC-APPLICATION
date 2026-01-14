const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, isPrivilegedUser } = require('../middleware/auth');
const sse = require('../sse');

// Apply authentication middleware to all routes in this file
router.use(authenticateToken);

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Membership route is working!' });
});

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
router.post('/packages', isPrivilegedUser, async (req, res) => {
  try {
    const { name, sport_id, duration_days, per_person_price, max_team_size, details } = req.body;
    if (!name || !sport_id || !duration_days || per_person_price === undefined || !max_team_size) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const [result] = await db.query(
      'INSERT INTO membership_packages (name, sport_id, duration_days, per_person_price, max_team_size, details) VALUES (?, ?, ?, ?, ?, ?)',
      [name, sport_id, duration_days, per_person_price, max_team_size, details]
    );
    res.status(201).json({ id: result.insertId, message: 'Membership package created successfully' });
  } catch (error) {
    console.error('Error creating membership package:', error);
    res.status(500).json({ message: 'Error creating membership package' });
  }
});

// PUT (update) an existing membership package
router.put('/packages/:id', isPrivilegedUser, async (req, res) => {
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
    res.json({ message: 'Membership package updated successfully' });
  } catch (error) {
    console.error('Error updating membership package:', error);
    res.status(500).json({ message: 'Error updating membership package' });
  }
});

// DELETE a membership package
router.delete('/packages/:id', isPrivilegedUser, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM membership_packages WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Membership package not found' });
    }
    res.json({ message: 'Membership package deleted successfully' });
  } catch (error) {
    console.error('Error deleting membership package:', error);
    res.status(500).json({ message: 'Error deleting membership package' });
  }
});

// ------------------- Members CRUD -------------------

// POST a new member
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

        const [packages] = await connection.query('SELECT duration_days, max_team_size, per_person_price FROM membership_packages WHERE id = ?', [package_id]);
        if (packages.length === 0) throw new Error('Membership package not found.');
        
        const { duration_days, max_team_size, per_person_price } = packages[0];

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
        endDateObj.setDate(startDateObj.getDate() + duration_days);
        const original_end_date = endDateObj.toISOString().slice(0, 10);
        
        const [activeMembershipResult] = await connection.query(
            `INSERT INTO active_memberships (package_id, court_id, start_date, time_slot, original_end_date, current_end_date, final_price, discount_details, amount_paid, balance_amount, payment_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [package_id, court_id, start_date, time_slot, original_end_date, original_end_date, final_price, discount_details, amount_paid, balance_amount, payment_status]
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

router.get('/leave-requests', isPrivilegedUser, async (req, res) => {
    try {
        const query = `
            SELECT 
                ml.id, ml.membership_id, ml.leave_days, ml.start_date, ml.end_date, ml.reason, ml.status, ml.requested_at,
                am.start_date as membership_start_date, am.current_end_date, mp.name as package_name,
                GROUP_CONCAT(m.full_name SEPARATOR ', ') as team_members
            FROM membership_leave ml
            JOIN active_memberships am ON ml.membership_id = am.id
            JOIN membership_packages mp ON am.package_id = mp.id
            LEFT JOIN membership_team mt ON am.id = mt.membership_id
            LEFT JOIN members m ON mt.member_id = m.id
            GROUP BY ml.id ORDER BY ml.requested_at DESC
        `;
        const [requests] = await db.query(query);
        res.json(requests);
    } catch (error) {
        console.error('Error fetching leave requests:', error);
        res.status(500).json({ message: 'Error fetching leave requests.' });
    }
});

router.post('/request-leave', isPrivilegedUser, async (req, res) => {
    const { membership_id, leave_days, reason } = req.body;
    if (!membership_id || !leave_days) {
        return res.status(400).json({ message: 'Membership ID and leave days are required.' });
    }
    try {
        const [result] = await db.query(
            'INSERT INTO membership_leave (membership_id, leave_days, reason) VALUES (?, ?, ?)',
            [membership_id, leave_days, reason]
        );
        res.status(201).json({ id: result.insertId, message: 'Leave request submitted successfully.' });
    } catch (error) {
        console.error('Error submitting leave request:', error);
        res.status(500).json({ message: 'Error submitting leave request.' });
    }
});

router.post('/grant-leave', isPrivilegedUser, async (req, res) => {
    const { membership_id, start_date, end_date, reason } = req.body;

    if (!membership_id || !start_date || !end_date) {
        return res.status(400).json({ message: 'Membership ID, start date, and end date are required.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Calculate leave days
        const start = new Date(start_date);
        const end = new Date(end_date);
        const diffTime = Math.abs(end - start);
        const leave_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive

        if (leave_days <= 0) {
            throw new Error('End date must be after or same as start date.');
        }

        // 1. Insert into membership_leave as APPROVED
        await connection.query(
            'INSERT INTO membership_leave (membership_id, start_date, end_date, leave_days, reason, status, compensation_applied) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [membership_id, start_date, end_date, leave_days, reason, 'APPROVED', true]
        );

        // 2. Get current membership end date
        const [memberships] = await connection.query('SELECT current_end_date FROM active_memberships WHERE id = ? FOR UPDATE', [membership_id]);
        if (memberships.length === 0) throw new Error('Active membership not found.');

        const current_end_date = new Date(memberships[0].current_end_date);
        
        // 3. Extend membership end date
        current_end_date.setDate(current_end_date.getDate() + leave_days);
        const new_end_date = current_end_date.toISOString().slice(0, 10);

        await connection.query('UPDATE active_memberships SET current_end_date = ? WHERE id = ?', [new_end_date, membership_id]);

        await connection.commit();
        res.status(201).json({ message: `Leave granted successfully. Membership extended by ${leave_days} days. New end date: ${new_end_date}` });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error granting leave:', error);
        res.status(500).json({ message: error.message || 'Failed to grant leave.' });
    } finally {
        if (connection) connection.release();
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
            const [memberships] = await connection.query('SELECT current_end_date FROM active_memberships WHERE id = ?', [leaveRequest.membership_id]);
            if (memberships.length === 0) throw new Error('Associated active membership not found.');
            
            const current_end_date = new Date(memberships[0].current_end_date);
            current_end_date.setDate(current_end_date.getDate() + leaveRequest.leave_days);
            const new_end_date = current_end_date.toISOString().slice(0, 10);

            await connection.query('UPDATE active_memberships SET current_end_date = ? WHERE id = ?', [new_end_date, leaveRequest.membership_id]);
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

// ------------------- Holiday Management -------------------

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

router.get('/active', isPrivilegedUser, async (req, res) => {
    try {
        const { date } = req.query;
        let query = `
            SELECT 
                am.id, am.start_date, am.current_end_date, am.time_slot, am.final_price, am.discount_details, am.amount_paid, am.balance_amount, am.payment_status,
                mp.name as package_name, mp.per_person_price as package_price, mp.max_team_size,
                c.name as court_name,
                GROUP_CONCAT(m.full_name ORDER BY m.full_name SEPARATOR ', ') as team_members,
                COUNT(mt.member_id) as current_members_count
            FROM active_memberships am
            JOIN membership_packages mp ON am.package_id = mp.id
            JOIN courts c ON am.court_id = c.id
            LEFT JOIN membership_team mt ON am.id = mt.membership_id
            LEFT JOIN members m ON mt.member_id = m.id
        `;
        const queryParams = [];
        if (date) {
            query += ' WHERE ? BETWEEN am.start_date AND am.current_end_date';
            queryParams.push(date);
        }
        query += ` GROUP BY am.id, am.start_date, am.current_end_date, am.time_slot, am.final_price, am.discount_details, am.amount_paid, am.balance_amount, am.payment_status, mp.name, mp.per_person_price, mp.max_team_size, c.name ORDER BY am.start_date DESC`;
        const [memberships] = await db.query(query, queryParams);
        res.json(memberships);
    } catch (error) {
        console.error('Error fetching active memberships:', error);
        res.status(500).json({ message: 'Error fetching active memberships.' });
    }
});

router.delete('/active/:id', isPrivilegedUser, async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Delete associated payments
        await connection.query('DELETE FROM payments WHERE membership_id = ?', [id]);
        
        // Delete the active membership itself (team members are cascade deleted)
        await connection.query('DELETE FROM active_memberships WHERE id = ?', [id]);

        await connection.commit();
        res.json({ message: 'Membership terminated successfully.' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error terminating membership:', error);
        res.status(500).json({ message: 'Error terminating membership.' });
    } finally {
        if (connection) connection.release();
    }
});

router.post('/active/:id/renew', isPrivilegedUser, async (req, res) => {
    const { id: old_membership_id } = req.params;
    const { start_date, discount_details, initial_payment } = req.body;
    const created_by_user_id = req.user.id;

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [oldMemberships] = await connection.query('SELECT * FROM active_memberships WHERE id = ?', [old_membership_id]);
        if (oldMemberships.length === 0) throw new Error('Membership to renew not found.');
        const oldMembership = oldMemberships[0];

        const [packages] = await connection.query('SELECT duration_days, per_person_price FROM membership_packages WHERE id = ?', [oldMembership.package_id]);
        if (packages.length === 0) throw new Error('Original package not found.');
        const { duration_days, per_person_price } = packages[0];
        
        const [teamMembers] = await connection.query('SELECT COUNT(*) as member_count FROM membership_team WHERE membership_id = ?', [old_membership_id]);
        const member_count = teamMembers[0].member_count;

        const new_final_price = parseFloat(per_person_price) * member_count;
        const amount_paid = parseFloat(initial_payment?.amount || 0);
        const balance_amount = new_final_price - amount_paid;
        let payment_status = balance_amount <= 0 ? 'Completed' : (amount_paid > 0 ? 'Received' : 'Pending');

        const startDate = new Date(start_date);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + duration_days);

        const [newMembershipResult] = await connection.query(
          `INSERT INTO active_memberships (package_id, court_id, start_date, time_slot, original_end_date, current_end_date, final_price, discount_details, amount_paid, balance_amount, payment_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [oldMembership.package_id, oldMembership.court_id, start_date, oldMembership.time_slot, endDate.toISOString().slice(0,10), endDate.toISOString().slice(0,10), new_final_price, discount_details, amount_paid, balance_amount, payment_status]
        );
        const new_membership_id = newMembershipResult.insertId;

        if (initial_payment && initial_payment.amount > 0) {
            await connection.query(
                'INSERT INTO payments (membership_id, amount, payment_mode, payment_id, created_by_user_id) VALUES (?, ?, ?, ?, ?)',
                [new_membership_id, initial_payment.amount, initial_payment.payment_mode, initial_payment.payment_id, created_by_user_id]
            );
        }

        const [team] = await connection.query('SELECT member_id FROM membership_team WHERE membership_id = ?', [old_membership_id]);
        for (const member of team) {
            await connection.query('INSERT INTO membership_team (membership_id, member_id) VALUES (?, ?)', [new_membership_id, member.member_id]);
        }
        
        await connection.commit();
        res.status(201).json({ id: new_membership_id, message: 'Membership renewed successfully.' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error renewing membership:', error);
        res.status(500).json({ message: `Failed to renew membership: ${error.message}` });
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
                COUNT(mt.member_id) as current_members_count
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
                COUNT(mt.member_id) as current_members_count
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

router.post('/team-attendance', isPrivilegedUser, async (req, res) => {
    const { membership_id, attendance_date } = req.body;
    const marked_by_user_id = req.user.id;
    if (!membership_id || !attendance_date) {
        return res.status(400).json({ message: 'Membership ID and date are required.' });
    }
    try {
        await db.query(
            'INSERT INTO team_attendance (membership_id, attendance_date, marked_by_user_id) VALUES (?, ?, ?)',
            [membership_id, attendance_date, marked_by_user_id]
        );
        sse.sendEventsToAll({ message: 'bookings_updated' });
        res.status(201).json({ message: 'Attendance marked successfully.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Attendance for this team has already been marked for this date.' });
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

// GET attendance history for a specific membership (for calendar view)

router.get('/active/:id/attendance-history', isPrivilegedUser, async (req, res) => {

    const { id } = req.params;

    try {

        const [rows] = await db.query('SELECT attendance_date FROM team_attendance WHERE membership_id = ? ORDER BY attendance_date ASC', [id]);

        // Return array of date strings

        const dates = rows.map(row => {

             // Handle timezone issues by treating the date string directly if possible, or ensuring strict YYYY-MM-DD format

             const d = new Date(row.attendance_date);

             return d.toISOString().slice(0, 10);

        });

        res.json(dates);

    } catch (error) {

        console.error('Error fetching membership attendance history:', error);

        res.status(500).json({ message: 'Error fetching membership attendance history.' });

    }

});



// GET approved leave history for a specific membership

router.get('/active/:id/leave-history', isPrivilegedUser, async (req, res) => {

    const { id } = req.params;

    try {

        const [rows] = await db.query('SELECT start_date, end_date FROM membership_leave WHERE membership_id = ? AND status = "APPROVED"', [id]);

        res.json(rows);

    } catch (error) {

        console.error('Error fetching membership leave history:', error);

        res.status(500).json({ message: 'Error fetching membership leave history.' });

    }

});



module.exports = router;
