const express = require('express');
const router = express.Router();
const db = require('../../database');
const twilio = require('twilio');
const { formatTo12Hour } = require('../../utils/helpers');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);

const userSessions = {};

router.post('/whatsapp', async (req, res) => {

    const twiml = new twilio.twiml.MessagingResponse();
    const userMessage = req.body.Body; // Use original case for names, etc.
    const trimmedMessage = userMessage.trim();
    const from = req.body.From;
    const to = req.body.To;

    const formatTo12Hour = (time) => {
        let [hours, minutes] = time.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0' + minutes : minutes;
        return `${hours}:${minutes} ${ampm}`;
    };

    let session = userSessions[from];

    if (!session) {
        session = { step: 'welcome' };
        userSessions[from] = session;
    }

    if (trimmedMessage.toLowerCase() === 'hi') {
        // Reset session
        userSessions[from] = { step: 'welcome' };
        session = userSessions[from];
    }

    try {
        switch (session.step) {
            case 'welcome':
                const [sports] = await db.query('SELECT * FROM sports');
                let sportList = sports.map(s => s.name).join('\n');
                twiml.message(`Welcome to ARC SportsZone Booking!\n\nPlease select a sport by replying with the name:${sportList}`);
                session.step = 'select_sport';
                break;

            case 'select_sport':
                const [selectedSport] = await db.query('SELECT * FROM sports WHERE name LIKE ?', [`%${trimmedMessage}%`]);
                if (selectedSport.length > 0) {
                    session.sport_id = selectedSport[0].id;
                    session.sport_name = selectedSport[0].name;
                    session.amount = selectedSport[0].price;
                    twiml.message('Great! Please enter the date for your booking (e.g., YYYY-MM-DD).');
                    session.step = 'select_date';
                } else {
                    twiml.message('Invalid sport. Please select a sport from the list.');
                }
                break;

            case 'select_date':
                // Basic validation for date format
                if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(trimmedMessage)) {
                    twiml.message('Invalid date format. Please use YYYY-MM-DD.');
                    break;
                }
                session.date = trimmedMessage;
                twiml.message('Please enter the start time for your booking (e.g., 10:00 or 14:00).');
                session.step = 'select_time';
                break;

            case 'select_time':
                // Basic validation for time format
                if (!/^\\d{2}:\\d{2}$/.test(trimmedMessage)) {
                    twiml.message('Invalid time format. Please use HH:MM (e.g., 09:00 or 15:00).');
                    break;
                }
                const startHour = parseInt(trimmedMessage.split(':')[0]);
                if (startHour < 6 || startHour > 21) {
                    twiml.message('Sorry, bookings are only available from 6:00 to 22:00. Please choose another time.');
                    break;
                }

                session.startTime = trimmedMessage;
                session.endTime = `${String(startHour + 1).padStart(2, '0')}:00`; // Assume 1 hour booking

                const time_slot_12hr = `${formatTo12Hour(session.startTime)} - ${formatTo12Hour(session.endTime)}`;

                const [availableCourts] = await db.query(
                    'SELECT c.id, c.name FROM courts c LEFT JOIN bookings b ON c.id = b.court_id AND b.date = ? AND b.time_slot = ? WHERE c.sport_id = ? AND c.status = ? AND b.id IS NULL',
                    [session.date, time_slot_12hr, session.sport_id, 'Available']
                );

                if (availableCourts.length > 0) {
                    session.court_id = availableCourts[0].id;
                    session.court_name = availableCourts[0].name;
                    twiml.message(`Court available! The price is ₹${session.amount}.\n\nPlease enter your full name to proceed.`);
                    session.step = 'enter_name';
                } else {
                    twiml.message('Sorry, no courts available at that time. Please try another time.');
                    session.step = 'select_time';
                }
                break;

            case 'enter_name':
                session.customer_name = trimmedMessage;
                twiml.message('Thank you. Please enter your 10-digit phone number.');
                session.step = 'enter_phone';
                break;

            case 'enter_phone':
                if (!/^\\d{10}$/.test(trimmedMessage)) {
                    twiml.message('Invalid phone number. Please enter a 10-digit number.');
                    break;
                }
                session.customer_contact = trimmedMessage;
                const time_slot = `${formatTo12Hour(session.startTime)} - ${formatTo12Hour(session.endTime)}`;
                const sql = 'INSERT INTO bookings (court_id, sport_id, customer_name, customer_contact, date, time_slot, payment_mode, amount_paid, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
                const values = [session.court_id, session.sport_id, session.customer_name, session.customer_contact, session.date, time_slot, 'online', session.amount, 'Booked'];

                try {
                    const [result] = await db.query(sql, values);
                    const bookingId = result.insertId;

                    // Send confirmation message
                    const receipt = `
*Booking Confirmed!*
-------------------------
Receipt ID: ${bookingId}
Name: ${session.customer_name}
Contact: ${session.customer_contact}
Sport: ${session.sport_name}
Court: ${session.court_name}
Date: ${session.date}
Time: ${time_slot}
Amount: ₹${session.amount}
Status: Booked
-------------------------
Thank you for booking with ARC SportsZone!
                    `;

                    await client.messages.create({
                        body: receipt,
                        from: to, // Twilio number
                        to: from  // User's number
                    });

                    twiml.message('Thank you! Your booking is confirmed. I have sent you a receipt.');
                    delete userSessions[from]; // End session

                } catch (dbError) {
                    console.error("Database error:", dbError);
                    twiml.message('Sorry, there was an error processing your booking. Please try again later.');
                    delete userSessions[from];
                }
                break;
        }
    } catch (error) {
        console.error('Error in /whatsapp route:', error);
        twiml.message('An unexpected error occurred. Please try again later.');
    }

    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
});

module.exports = router;
