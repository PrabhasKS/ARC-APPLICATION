const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, isPrivilegedUser, isAdmin } = require('../middleware/auth');
const sse = require('../sse');
const cron = require('node-cron');
const PDFDocument = require('pdfkit');

// Apply authentication middleware to all routes in this file
router.use(authenticateToken);

// Helper functions for time overlap
const toMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!parts) return 0;

    let hours = parseInt(parts[1], 10);
    const minutes = parseInt(parts[2], 10);
    const modifier = parts[3] ? parts[3].toUpperCase() : null;

    if (modifier === 'PM' && hours < 12) {
        hours += 12;
    } else if (modifier === 'AM' && hours === 12) {
        hours = 0;
    }
    return hours * 60 + minutes;
};

const checkOverlap = (startA, endA, startB, endB) => {
    const startAMin = toMinutes(startA);
    const endAMin = toMinutes(endA);
    const startBMin = toMinutes(startB);
    const endBMin = toMinutes(endB);

    return startAMin < endBMin && endAMin > startBMin;
};

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
    res.status(201).json({ id: result.insertId, message: 'Membership package created successfully' });
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
    res.json({ message: 'Membership package updated successfully' });
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

// Check for membership conflicts (Frontend Helper)
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
        endDateObj.setDate(startDateObj.getDate() + duration_days);
        const original_end_date = endDateObj.toISOString().slice(0, 10);

        // --- Conflict Check ---
        const [sports] = await connection.query('SELECT capacity FROM sports WHERE id = ?', [sport_id]);
        const capacity = sports.length > 0 ? sports[0].capacity : 1;

        const [conflictingMemberships] = await connection.query(
            `SELECT time_slot 
             FROM active_memberships 
             WHERE court_id = ? 
             AND start_date <= ? 
             AND current_end_date >= ?`,
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
    const { membership_id, start_date, end_date, reason, custom_extension_start_date } = req.body;

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
            `SELECT court_id, time_slot, current_end_date FROM active_memberships WHERE id = ? FOR UPDATE`,
            [membership_id]
        );

        if (membershipData.length === 0) {
            throw new Error('Active membership not found.');
        }
        
        const { court_id, time_slot, current_end_date: old_current_end_date_str } = membershipData[0];
        
        // Determine the extension period
        let extension_start_date_str;
        let final_extension_end_date;

        if (custom_extension_start_date) {
            extension_start_date_str = custom_extension_start_date;
            const new_end_date_obj = new Date(custom_extension_start_date);
            new_end_date_obj.setDate(new_end_date_obj.getDate() + leave_days -1); // -1 because it's inclusive
            final_extension_end_date = new_end_date_obj.toISOString().slice(0, 10);
        } else {
            const old_current_end_date_obj = new Date(old_current_end_date_str);
            old_current_end_date_obj.setDate(old_current_end_date_obj.getDate() + 1);
            extension_start_date_str = old_current_end_date_obj.toISOString().slice(0, 10);

            const new_end_date_obj = new Date(old_current_end_date_str);
            new_end_date_obj.setDate(new_end_date_obj.getDate() + leave_days);
            final_extension_end_date = new_end_date_obj.toISOString().slice(0, 10);
        }
        
        const [leaveSlotStart, leaveSlotEnd] = time_slot.split(' - ');

        // --- CONFLICT CHECKS ---

        // 1. Check for overlapping APPROVED leaves for this membership
        const [overlappingLeaves] = await connection.query(
            `SELECT start_date, end_date FROM membership_leave 
             WHERE membership_id = ? AND status = 'APPROVED' AND (
                 (? BETWEEN start_date AND end_date) OR (? BETWEEN start_date AND end_date) OR
                 (start_date BETWEEN ? AND ?) OR (end_date BETWEEN ? AND ?)
             )`,
            [membership_id, start_date, end_date, start_date, end_date, start_date, end_date]
        );

        if (overlappingLeaves.length > 0) {
            conflicts.push({
                type: 'leave',
                date: new Date(overlappingLeaves[0].start_date).toISOString().slice(0, 10),
                message: `This member already has an approved leave from ${new Date(overlappingLeaves[0].start_date).toISOString().slice(0, 10)} to ${new Date(overlappingLeaves[0].end_date).toISOString().slice(0, 10)}.`
            });
        }
        
        // 2. Check for conflicts in the LEAVE period itself
        const [bookingsInLeavePeriod] = await connection.query(
            `SELECT id, customer_name, date FROM bookings
             WHERE court_id = ? AND time_slot = ? AND status != 'Cancelled'
             AND date BETWEEN ? AND ?`,
            [court_id, time_slot, start_date, end_date]
        );

        bookingsInLeavePeriod.forEach(booking => {
            conflicts.push({
                type: 'booking_leave',
                date: new Date(booking.date).toISOString().slice(0, 10),
                message: `Slot is booked by ${booking.customer_name} on ${new Date(booking.date).toISOString().slice(0, 10)}.`
            });
        });

        // 3. Check for conflicts in the EXTENDED period.
        if (final_extension_end_date >= extension_start_date_str) {
            // 3a. Overlapping one-off bookings in EXTENDED period
            const [bookingsInExtension] = await connection.query(
                `SELECT id, customer_name, date FROM bookings
                 WHERE court_id = ? AND time_slot = ? AND status != 'Cancelled'
                 AND date BETWEEN ? AND ?`,
                [court_id, time_slot, extension_start_date_str, final_extension_end_date]
            );

            bookingsInExtension.forEach(booking => {
                conflicts.push({
                    type: 'booking_extension',
                    date: new Date(booking.date).toISOString().slice(0, 10),
                    message: `Extension conflicts with booking on ${new Date(booking.date).toISOString().slice(0, 10)}.`
                });
            });

            // 3b. Overlapping MEMBERSHIPS in EXTENDED period
            const [membershipsInExtension] = await connection.query(
                `SELECT id, time_slot, current_end_date FROM active_memberships
                 WHERE court_id = ? AND id != ? AND status = 'active'
                 AND start_date <= ? AND current_end_date >= ?`,
                [court_id, membership_id, final_extension_end_date, extension_start_date_str]
            );

            const clashingMembership = membershipsInExtension.find(m => {
                const [existingStart, existingEnd] = m.time_slot.split(' - ');
                return checkOverlap(leaveSlotStart.trim(), leaveSlotEnd.trim(), existingStart.trim(), existingEnd.trim());
            });

            if (clashingMembership) {
                conflicts.push({
                    type: 'membership_extension',
                    date: new Date(clashingMembership.current_end_date).toISOString().slice(0,10),
                    message: `Extension conflicts with another membership (ID: ${clashingMembership.id}).`
                });
            }
        }
        
        // --- FINAL DECISION ---
        if (conflicts.length > 0) {
            await connection.rollback();
            return res.status(200).json({ status: 'conflict', conflicts, old_end_date: old_current_end_date_str });
        }
        
        // --- ALL CHECKS PASSED, PROCEED ---
        await connection.query(
            `INSERT INTO membership_leave (membership_id, start_date, end_date, leave_days, reason, status) 
             VALUES (?, ?, ?, ?, ?, 'APPROVED')`,
            [membership_id, start_date, end_date, leave_days, reason]
        );
        
        await connection.query(
            'UPDATE active_memberships SET current_end_date = ? WHERE id = ?',
            [final_extension_end_date, membership_id]
        );

        await connection.commit();
        res.status(200).json({ status: 'success', message: `Leave granted successfully. Membership extended to ${final_extension_end_date}.` });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error granting leave:', error);
        res.status(500).json({ message: error.message || 'Failed to grant leave due to an unexpected error.' });
    } finally {
        if (connection) connection.release();
    }
});

// NEW: GET all memberships on leave for a specific date
router.get('/on-leave', isPrivilegedUser, async (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ message: 'Date query parameter is required.' });
    }

    try {
        const [leaveRecords] = await db.query(
            `SELECT membership_id FROM membership_leave
             WHERE status = 'APPROVED' AND ? BETWEEN start_date AND end_date`,
            [date]
        );
        
        const onLeaveIds = leaveRecords.map(record => record.membership_id);
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
            FROM payments p 
            JOIN users u ON p.created_by_user_id = u.id 
            WHERE p.membership_id = am.id 
            ORDER BY p.payment_date ASC 
            LIMIT 1
        ) as created_by,
        (
             SELECT GROUP_CONCAT(CONCAT(p.amount, ': ', p.payment_mode, IF(p.payment_id IS NOT NULL, CONCAT(' (', p.payment_id, ')'), '')) SEPARATOR '; ')
             FROM payments p
             WHERE p.membership_id = am.id
        ) as payment_info
    FROM active_memberships am
    JOIN membership_packages mp ON am.package_id = mp.id
    JOIN courts c ON am.court_id = c.id
    LEFT JOIN membership_team mt ON am.id = mt.membership_id
    LEFT JOIN members m ON mt.member_id = m.id
`;

router.get('/active', isPrivilegedUser, async (req, res) => {
    try {
        const { date } = req.query;
        let whereClause = ` WHERE am.status = 'active' `;
        const queryParams = [];
        
        if (date) {
            whereClause += ' AND ? BETWEEN am.start_date AND am.current_end_date';
            queryParams.push(date);
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
    const { start_date, discount_details, initial_payment } = req.body;
    const created_by_user_id = req.user.id;

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [memberships] = await connection.query('SELECT * FROM active_memberships WHERE id = ? FOR UPDATE', [membership_id]);
        if (memberships.length === 0) throw new Error('Membership to renew not found.');
        const oldMembership = memberships[0];

        // Ensure membership is 'ended' or 'active' and past its current_end_date to be renewed
        if (oldMembership.status !== 'ended' && !(oldMembership.status === 'active' && new Date(oldMembership.current_end_date) < new Date())) {
            throw new Error('Membership cannot be renewed unless it is ended or active and past its end date.');
        }

        const [packages] = await connection.query('SELECT duration_days, per_person_price FROM membership_packages WHERE id = ?', [oldMembership.package_id]);
        if (packages.length === 0) throw new Error('Original package not found.');
        const { duration_days, per_person_price } = packages[0];
        
        const [teamMembers] = await connection.query('SELECT COUNT(*) as member_count FROM membership_team WHERE membership_id = ?', [membership_id]);
        const member_count = teamMembers[0].member_count;

        const new_final_price = parseFloat(per_person_price) * member_count;
        const amount_paid = parseFloat(initial_payment?.amount || 0);
        const balance_amount = new_final_price - amount_paid;
        let payment_status = balance_amount <= 0 ? 'Completed' : (amount_paid > 0 ? 'Received' : 'Pending');

        const startDate = new Date(start_date);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + duration_days);

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
          [start_date, endDate.toISOString().slice(0,10), endDate.toISOString().slice(0,10), new_final_price, discount_details, amount_paid, balance_amount, payment_status, membership_id]
        );

        if (initial_payment && initial_payment.amount > 0) {
            await connection.query(
                'INSERT INTO payments (membership_id, amount, payment_mode, payment_id, created_by_user_id) VALUES (?, ?, ?, ?, ?)',
                [membership_id, initial_payment.amount, initial_payment.payment_mode, initial_payment.payment_id, created_by_user_id]
            );
        }

        // No changes to membership_team as renewal applies to existing team members.
        
        await connection.commit();
        res.status(200).json({ id: membership_id, message: 'Membership renewed successfully.' }); // Changed status to 200
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

router.put('/ended/:id/terminate', isPrivilegedUser, async (req, res) => {
    const { id } = req.params;
    
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Check if membership exists and is in 'ended' status
        const [memberships] = await connection.query(
            "SELECT id FROM active_memberships WHERE id = ? AND status = 'ended' FOR UPDATE",
            [id]
        );

        if (memberships.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Ended membership not found.' });
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
                (SELECT u.username FROM users u JOIN payments p ON u.id = p.created_by_user_id WHERE p.membership_id = am.id ORDER BY p.payment_date ASC LIMIT 1) as created_by_user,
                GROUP_CONCAT(DISTINCT m.full_name SEPARATOR ', ') AS member_name,
                GROUP_CONCAT(DISTINCT m.phone_number SEPARATOR ', ') as member_contact,
                COUNT(DISTINCT mt.member_id) as member_count
            FROM 
                active_memberships am
            JOIN 
                membership_packages mp ON am.package_id = mp.id
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
                (SELECT u.username FROM users u JOIN payments p ON u.id = p.created_by_user_id WHERE p.membership_id = am.id ORDER BY p.payment_date ASC LIMIT 1) as created_by_user,
                GROUP_CONCAT(DISTINCT m.full_name SEPARATOR ', ') AS team_members,
                GROUP_CONCAT(DISTINCT m.phone_number SEPARATOR ', ') as member_contact
            FROM 
                active_memberships am
            JOIN 
                membership_packages mp ON am.package_id = mp.id
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
