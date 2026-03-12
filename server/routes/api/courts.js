const express = require('express');
const router = express.Router();
const db = require('../../database');
const { authenticateToken, isAdmin, isPrivilegedUser } = require('../../middleware/auth');
const sse = require('../../sse');
const { checkOverlap } = require('../../utils/helpers');

// Get all courts
router.get('/', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT c.id, c.name, c.status, c.sport_id, s.name as sport_name, s.price FROM courts c JOIN sports s ON c.sport_id = s.id');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get court availability for a specific date and time
router.get('/availability', authenticateToken, async (req, res) => {
    const { date, startTime, endTime } = req.query;
    if (!date || !startTime || !endTime) {
        return res.status(400).json({
            message: 'Date, startTime, and endTime are required.',
            received_query: req.query
        });
    }

    try {
        const [courts] = await db.query('SELECT c.id, c.name, c.status, c.sport_id, s.name as sport_name, s.price, s.capacity FROM courts c JOIN sports s ON c.sport_id = s.id');
        const [bookings] = await db.query('SELECT court_id, time_slot, slots_booked FROM bookings WHERE date = ? AND status != "Cancelled"', [date]);
        
        // Memberships now reserve based on active Teams
        const [activeTeams] = await db.query('SELECT court_id, time_slot, max_players FROM teams WHERE status = "active"');

        const unavailableStatuses = ['Under Maintenance', 'Event', 'Tournament', 'Coaching'];

        const availability = courts.map(court => {
            if (unavailableStatuses.includes(court.status)) {
                return { ...court, is_available: false, reason: court.status };
            }

            const newStart = startTime;
            const newEnd = endTime;

            let occupiedByBookings = 0;
            let occupiedByTeams = 0;

            // 1. Check for Daily Bookings (These take highest priority and dictate hard capacity limits)
            const overlappingBookings = bookings.filter(b => b.court_id === court.id).filter(booking => {
                const [existingStart, existingEnd] = booking.time_slot.split(' - ');
                return checkOverlap(newStart, newEnd, existingStart.trim(), existingEnd.trim());
            });

            if (overlappingBookings.length > 0) {
                 occupiedByBookings = overlappingBookings.reduce((total, b) => total + parseInt(b.slots_booked, 10), 0);
            }

            // 2. Check for Membership Teams 
            const overlappingTeams = activeTeams.filter(t => t.court_id === court.id).filter(team => {
                const [existingStart, existingEnd] = team.time_slot.split(' - ');
                return checkOverlap(newStart, newEnd, existingStart.trim(), existingEnd.trim());
            });

            if (overlappingTeams.length > 0) {
                 // Even if it's high capacity, a team blocks its `max_players` amount of slots. But we don't cap hard yet.
                 occupiedByTeams = overlappingTeams.reduce((total, t) => total + parseInt(t.max_players, 10), 0);
            }

            // --- CAPACITY CALCULATION & OVERRIDE LOGIC ---

            if (court.capacity === 1) {
                // SINGLE CAPACITY LOGIC (e.g., Badminton)
                if (occupiedByBookings > 0) {
                    // Daily Booking wins. Court is fully booked.
                    return { ...court, is_available: false, reason: 'Booked' };
                } else if (occupiedByTeams > 0) {
                    // Membership Team is scheduled. We show it as "Membership" occupied, BUT because of the Dynamic Override rule, 
                    // we actually still allow the admin frontend to visually see it's blocked, 
                    // though the booking API itself won't reject a daily booking if forced.
                    // For the Heatmap, returning available_slots = 0 makes it greyed out/grouped.
                    return { ...court, is_available: false, available_slots: 0, reason: 'Membership' }; 
                } else {
                    return { ...court, is_available: true, available_slots: 1, reason: 'Available' };
                }
            } else {
                // MULTI CAPACITY LOGIC (e.g., Swimming)
                // Overlap: The true hard limit is capacity. 
                // We show (Capacity - Bookings - Teams) as available, but cap at 0 minimum.
                // Because daily bookings can "override", we technically only HARD block on occupiedByBookings >= capacity.
                // However, for the UI Heatmap, we want to show the net remaining standard slots.
                
                let totalOccupied = occupiedByBookings + occupiedByTeams;
                let availableSlots = Math.max(0, court.capacity - totalOccupied);
                
                return {
                    ...court,
                    is_available: availableSlots > 0 || (court.capacity - occupiedByBookings > 0), // available if slots left OR if we are just overriding team slots
                    available_slots: availableSlots, 
                    reason: totalOccupied >= court.capacity ? 'Full' : (totalOccupied > 0 ? 'Partial' : 'Available')
                };
            }
        });

        res.json(availability);
    } catch (err) {
        console.error('Error fetching court availability:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update court status
router.put('/:id/status', authenticateToken, isPrivilegedUser, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await db.query('UPDATE courts SET status = ? WHERE id = ?', [status, id]);
        sse.sendEventsToAll({ message: 'courts_updated' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new court
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    const { name, sport_id } = req.body;
    if (!name || !sport_id) {
        return res.status(400).json({ message: 'Court name and sport ID are required' });
    }
    try {
        const [result] = await db.query('INSERT INTO courts (name, sport_id) VALUES (?, ?)', [name, sport_id]);
        res.json({ success: true, courtId: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Court name already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Delete a court
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM courts WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
