import React, { useState } from 'react';
import { useActiveBookings } from '../hooks/useActiveBookings';
import BookingDetailsModal from './BookingDetailsModal';
import './ActiveBookings.css';

const ActiveBookings = () => {
    const { inProgress, upcoming, removeBooking, markAsCompletedAndClear } = useActiveBookings();
    const [selectedBooking, setSelectedBooking] = useState(null);

    const handleCardClick = (booking) => {
        setSelectedBooking(booking);
    };

    const handleCloseModal = () => {
        setSelectedBooking(null);
    };

    const BookingCard = ({ booking, onCardClick, showClear }) => {
        const formattedDate = new Date(booking.date).toLocaleDateString(undefined, { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });

        return (
            <div className={`active-booking-card ${booking.displayStatus}`} onClick={() => onCardClick(booking)}>
                <div className="booking-info">
                    <span className="sport-name">{booking.sport_name}</span>
                    <span className="court-name">{booking.court_name}</span>
                </div>
                <div className="booking-date">{formattedDate}</div>
                <div className="booking-time">{booking.time_slot}</div>
                <div className="customer-name">{booking.customer_name}</div>
                {showClear && booking.displayStatus === 'ended' && (
                    <div className="ended-message">
                        Time has ended, inform customer.
                        {booking.payment_status === 'Completed' ? (
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation();
                                    removeBooking(booking.id); 
                                }} 
                                className="clear-btn"
                            >
                                Clear
                            </button>
                        ) : (
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation();
                                    markAsCompletedAndClear(booking); 
                                }} 
                                className="clear-btn mark-completed-btn"
                            >
                                Mark as Completed & Clear
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <>
            <div className="active-bookings-container">
                <h4>In-Progress Bookings</h4>
                {inProgress.length === 0 ? (
                    <p>No active bookings at the moment.</p>
                ) : (
                    <div className="active-bookings-list">
                        {inProgress.map(booking => (
                            <BookingCard 
                                key={booking.id} 
                                booking={booking} 
                                onCardClick={handleCardClick} 
                                showClear={true} 
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="active-bookings-container upcoming-container">
                <h4>Upcoming Bookings</h4>
                {upcoming.length === 0 ? (
                    <p>No upcoming bookings.</p>
                ) : (
                    <div className="active-bookings-list">
                        {upcoming.map(booking => (
                            <BookingCard 
                                key={booking.id} 
                                booking={booking} 
                                onCardClick={handleCardClick} 
                                showClear={false} 
                            />
                        ))}
                    </div>
                )}
            </div>

            {selectedBooking && (
                <BookingDetailsModal 
                    booking={selectedBooking} 
                    onClose={handleCloseModal} 
                />
            )}
        </>
    );
};

export default ActiveBookings;

