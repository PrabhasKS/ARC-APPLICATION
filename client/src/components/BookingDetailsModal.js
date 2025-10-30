import React from 'react';
import './ReceiptModal.css'; // Reuse the same CSS for styling consistency

const BookingDetailsModal = ({ booking, onClose }) => {
    if (!booking) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div id="receipt-content-to-print"> 
                    <div className="receipt-header">
                        <h1>Booking Details</h1>
                        <p>ARC SportsZone</p>
                    </div>
                    <div className="receipt-body">
                        <div className="receipt-section">
                            <h2>Booking ID: {booking.id}</h2>
                            <p><strong>Customer:</strong> {booking.customer_name}</p>
                            <p><strong>Contact:</strong> {booking.customer_contact}</p>
                        </div>
                        <div className="receipt-section">
                            <h3>Booking Info</h3>
                            <p><strong>Sport:</strong> {booking.sport_name}</p>
                            <p><strong>Court:</strong> {booking.court_name}</p>
                            <p><strong>Date:</strong> {new Date(booking.date).toLocaleDateString()}</p>
                            <p><strong>Time:</strong> {booking.time_slot}</p>
                        </div>
                        <div className="receipt-section">
                            <h3>Payment Details</h3>
                            <p><strong>Total Amount:</strong> ₹{booking.total_price || booking.total_amount}</p>
                            <p><strong>Amount Paid:</strong> ₹{booking.amount_paid}</p>
                            <p><strong>Balance:</strong> ₹{booking.balance_amount}</p>
                            <p><strong>Payment Status:</strong> <span className={`status ${booking.payment_status}`}>{booking.payment_status}</span></p>
                            {booking.payments && booking.payments.length > 0 && (
                                <div>
                                    <h4>Payment History:</h4>
                                    <ul>
                                        {booking.payments.map(payment => (
                                            <li key={payment.id}>
                                                ₹{payment.amount} via {payment.payment_mode} on {new Date(payment.payment_date).toLocaleDateString()}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div className="receipt-footer">
                            <div className="booking-info">
                                <p><strong>Booked By:</strong> {booking.created_by_user || 'N/A'}</p>
                                <p><strong>Booking Status:</strong> <span className={`status ${booking.status}`}>{booking.status}</span></p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="modal-actions">
                    <button onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default BookingDetailsModal;