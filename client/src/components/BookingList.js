import React, { useState } from 'react';

const BookingList = ({ bookings, user, onEdit, onCancel, onReceipt, isPaymentIdVisible }) => {
    const [activeDropdown, setActiveDropdown] = useState(null);

    const rowStyle = (booking) => {
        const now = new Date();
        
        // Default style
        let style = {};

        if (booking.status === 'Cancelled') {
            style.textDecoration = 'line-through';
            style.color = '#999';
        }

        if (booking.is_rescheduled) {
            const [, endTimeStr] = booking.time_slot.split(' - ');
            const [time, modifier] = endTimeStr.trim().split(' ');
            let [hours, minutes] = time.split(':').map(Number);

            if (modifier === 'PM' && hours < 12) {
                hours += 12;
            }
            if (modifier === 'AM' && hours === 12) { // Handle midnight case
                hours = 0;
            }

            const bookingEndDateTime = new Date(booking.date);
            bookingEndDateTime.setHours(hours, minutes, 0, 0);

            if (now < bookingEndDateTime) {
                style.backgroundColor = '#d4edda'; // A light green color
            }
        }

        return style;
    };

    const toggleDropdown = (bookingId) => {
        setActiveDropdown(activeDropdown === bookingId ? null : bookingId);
    };

    const areActionsDisabled = (booking) => {
        if (booking.payment_status !== 'Completed') {
            return false;
        }

        const now = new Date();
        const [, endTimeStr] = booking.time_slot.split(' - ');
        const [time, modifier] = endTimeStr.trim().split(' ');
        let [hours, minutes] = time.split(':').map(Number);

        if (modifier === 'PM' && hours < 12) {
            hours += 12;
        }
        if (modifier === 'AM' && hours === 12) { // Handle midnight case
            hours = 0;
        }

        const bookingEndDateTime = new Date(booking.date);
        bookingEndDateTime.setHours(hours, minutes, 0, 0);

        return now > bookingEndDateTime;
    };

    return (
        <>
            {/* Improved Styling */}
            <style>{`
                .table-container {
                    overflow-x: auto;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.9rem;
                }
                th, td {
                    padding: 12px 15px;
                    border: 1px solid #ddd;
                    text-align: left;
                    white-space: nowrap;
                }
                thead tr {
                    background-color: #f4f4f4;
                }
                tbody tr:nth-of-type(even) {
                    background-color: #f9f9f9;
                }
                tbody tr:hover {
                    background-color: #f1f1f1;
                }
                .actions-cell {
                    position: relative;
                }
                .actions-dropdown {
                    position: absolute;
                    right: 0;
                    top: 100%;
                    background-color: white;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.15);
                    z-index: 10;
                    min-width: 120px;
                }
                .actions-dropdown button {
                    display: block;
                    width: 100%;
                    padding: 8px 12px;
                    text-align: left;
                    border: none;
                    background: none;
                    cursor: pointer;
                }
                .actions-dropdown button:hover {
                    background-color: #f5f5f5;
                }
                .actions-dropdown button:disabled {
                    cursor: not-allowed;
                    opacity: 0.6;
                    background-color: #f0f0f0;
                }
            `}</style>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Booking ID</th>
                            <th>Sport</th>
                            <th>Court</th>
                            <th>Customer</th>
                            <th>Booked-By</th>
                            <th>Contact</th>
                            <th>Time Slot</th>
                            <th>Original Price</th>
                            <th>Amount Paid</th>
                            <th>Balance</th>
                            <th>Discount</th>
                            <th>Discount Reason</th>
                            <th>Payment Status</th>
                            {isPaymentIdVisible && <th>Payment ID</th>}
                            <th>Booking Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bookings.map(booking => {
                            const subActionsDisabled = areActionsDisabled(booking);
                            return (
                                <tr key={booking.id} style={rowStyle(booking)}>
                                    <td>{booking.id}</td>
                                    <td>{booking.sport_name}</td>
                                    <td>{booking.court_name}</td>
                                    <td>{booking.customer_name}</td>
                                    <td>{booking.created_by_user || 'N/A'}</td>
                                    <td>{booking.customer_contact}</td>
                                    <td>{booking.time_slot}</td>
                                    <td>{booking.original_price}</td>
                                    <td>{booking.amount_paid}</td>
                                    <td>{booking.balance_amount}</td>
                                    <td>{booking.discount_amount || 0}</td>
                                    <td>{booking.discount_reason || 'N/A'}</td>
                                    <td>{booking.payment_status}</td>
                                    {isPaymentIdVisible && <td>{booking.payment_id || 'N/A'}</td>}
                                    <td>{booking.status}</td>
                                    <td className="actions-cell">
                                        <button onClick={() => toggleDropdown(booking.id)}>
                                            Actions
                                        </button>
                                        {activeDropdown === booking.id && (
                                            <div className="actions-dropdown">
                                                <button onClick={() => { onReceipt(booking); toggleDropdown(booking.id); }}>View Receipt</button>
                                                {booking.status !== 'Cancelled' && (
                                                    <>
                                                        <button onClick={() => { onEdit(booking); toggleDropdown(booking.id); }} disabled={subActionsDisabled}>Edit Payment</button>
                                                        {user && user.role === 'admin' && (
                                                            <button onClick={() => { onCancel(booking.id); toggleDropdown(booking.id); }} disabled={subActionsDisabled}>Cancel</button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default BookingList;
