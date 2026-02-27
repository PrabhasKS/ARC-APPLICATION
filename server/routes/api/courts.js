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
        const [memberships] = await db.query('SELECT court_id, time_slot FROM active_memberships WHERE ? BETWEEN start_date AND current_end_date', [date]);

        const unavailableStatuses = ['Under Maintenance', 'Event', 'Tournament', 'Coaching'];

        const availability = courts.map(court => {
            if (unavailableStatuses.includes(court.status)) {
                return { ...court, is_available: false, reason: court.status };
            }

            const newStart = startTime;
            const newEnd = endTime;

            let occupiedSlots = 0;

            // Check for daily booking overlaps
            const overlappingBookings = bookings.filter(b => b.court_id === court.id).filter(booking => {
                const [existingStart, existingEnd] = booking.time_slot.split(' - ');
                return checkOverlap(newStart, newEnd, existingStart.trim(), existingEnd.trim());
            });

            if (overlappingBookings.length > 0) {
                if (court.capacity === 1) {
                    return { ...court, is_available: false, reason: 'Booked' };
                }
                occupiedSlots += overlappingBookings.reduce((total, b) => total + parseInt(b.slots_booked, 10), 0);
            }

            // Check for membership overlaps
            const overlappingMemberships = memberships.filter(m => m.court_id === court.id).filter(membership => {
                const [existingStart, existingEnd] = membership.time_slot.split(' - ');
                return checkOverlap(newStart, newEnd, existingStart.trim(), existingEnd.trim());
            });

            if (overlappingMemberships.length > 0) {
                if (court.capacity === 1) {
                    return { ...court, is_available: false, reason: 'Membership' };
                }
                occupiedSlots += overlappingMemberships.length; // Each membership occupies 1 slot
            }

            const availableSlots = Math.max(0, court.capacity - occupiedSlots);

            return {
                ...court,
                is_available: availableSlots > 0,
                available_slots: availableSlots,
                reason: availableSlots === 0 ? 'Full' : (occupiedSlots > 0 ? 'Partial' : 'Available')
            };
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
