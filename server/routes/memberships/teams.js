const express = require('express');
const router = express.Router();
const db = require('../../database');

// @route   POST /api/memberships/teams
// @desc    Create a new Team (Reservation)
// @access  Private
router.post('/teams', async (req, res) => {
    const { name, court_id, time_slot, max_players, dry_run } = req.body;

    // During a dry run, we only check for clashes. name and max_players are not yet needed.
    if (!dry_run && (!name || !court_id || !time_slot || max_players === undefined)) {
        return res.status(400).json({ msg: 'Please enter all required fields for a Team' });
    }
    if (dry_run && (!court_id || !time_slot)) {
        return res.status(400).json({ msg: 'Court and Time Slot are required for availability check.' });
    }

    try {
        // Validate court capacity if creating multiple teams vs single team
        const [courtData] = await db.execute('SELECT s.capacity FROM courts c JOIN sports s ON c.sport_id = s.id WHERE c.id = ?', [court_id]);
        if (courtData.length === 0) {
            return res.status(404).json({ msg: 'Court not found' });
        }
        
        const capacity = courtData[0].capacity;

        if (capacity === 1) {
            // Single-capacity sport (Badminton): Only 1 Team per time slot allowed
            const [existingTeam] = await db.execute(
                'SELECT * FROM teams WHERE court_id = ? AND time_slot = ? AND status = "active"',
                [court_id, time_slot]
            );
            if (existingTeam.length > 0) {
                return res.status(400).json({ msg: 'A Team already exists for this Court and Time Slot.', is_clashing: true });
            }
        } else {
            // High-capacity sport (Swimming): Multiple Teams allowed up to total capacity. max_players MUST be 1.
            if (!dry_run && max_players !== 1) {
                 return res.status(400).json({ msg: 'For high-capacity sports, each person must be on their own individual Team (max_players = 1).' });
            }
            const [existingTeams] = await db.execute(
                'SELECT COUNT(id) as current_teams FROM teams WHERE court_id = ? AND time_slot = ? AND status = "active"',
                [court_id, time_slot]
            );
            if (existingTeams[0].current_teams >= capacity) {
                 return res.status(400).json({ msg: 'This time slot has reached maximum capacity.', is_clashing: true });
            }
        }

        if (dry_run) {
            return res.json({ success: true, msg: 'Time slot is available.' });
        }

        const [result] = await db.execute(
            'INSERT INTO teams (name, court_id, time_slot, max_players, status, created_by_user_id) VALUES (?, ?, ?, ?, "active", ?)',
            [name, court_id, time_slot, max_players, req.user.id] // req.user.id from auth middleware
        );

        res.status(201).json({
            success: true,
            msg: 'Team created successfully',
            team_id: result.insertId
        });

    } catch (error) {
        console.error('Create Team Error:', error);
        res.status(500).json({ msg: 'Server error while creating team' });
    }
});

// @route   GET /api/memberships/teams
// @desc    Get all active teams with their member counts
// @access  Private
router.get('/teams', async (req, res) => {
    try {
        const query = `
            SELECT 
                t.id, t.name, t.time_slot, t.max_players, t.status, t.created_at,
                c.name as court_name,
                c.id as court_id,
                s.name as sport_name,
                s.id as sport_id,
                s.capacity as sport_capacity,
                (SELECT COUNT(*) FROM team_memberships tm WHERE tm.team_id = t.id AND tm.status = 'active') as active_members_count
            FROM teams t
            JOIN courts c ON t.court_id = c.id
            JOIN sports s ON c.sport_id = s.id
            WHERE t.status != 'terminated'
            ORDER BY t.created_at DESC
        `;
        const [teams] = await db.execute(query);
        res.json(teams);
    } catch (error) {
        console.error('Get Teams Error:', error);
        res.status(500).json({ msg: 'Server error while fetching teams' });
    }
});

// @route   GET /api/memberships/teams/:id
// @desc    Get a single team with all its members
// @access  Private
router.get('/teams/:id', async (req, res) => {
    try {
        const teamId = req.params.id;

        const [teams] = await db.execute(`
            SELECT 
                t.*, c.name as court_name, s.name as sport_name, s.capacity as sport_capacity
            FROM teams t
            JOIN courts c ON t.court_id = c.id
            JOIN sports s ON c.sport_id = s.id
            WHERE t.id = ?
        `, [teamId]);

        if (teams.length === 0) {
            return res.status(404).json({ msg: 'Team not found' });
        }

        const [members] = await db.execute(`
            SELECT 
                tm.*, m.full_name as member_name, m.phone_number,
                mp.name as package_name, mp.duration_days, mp.per_person_price
            FROM team_memberships tm
            JOIN members m ON tm.member_id = m.id
            JOIN membership_packages mp ON tm.package_id = mp.id
            WHERE tm.team_id = ?
            ORDER BY tm.status ASC, tm.current_end_date ASC
        `, [teamId]);

        res.json({
            success: true,
            team: teams[0],
            members: members
        });
    } catch (error) {
        console.error('Get Team Details Error:', error);
        res.status(500).json({ msg: 'Server error while fetching team details' });
    }
});

module.exports = router;
