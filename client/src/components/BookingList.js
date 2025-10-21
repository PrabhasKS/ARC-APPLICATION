


// import React, { useState } from 'react';

// const BookingList = ({ bookings, user, onEdit, onCancel, onReceipt }) => {
//     const [activeDropdown, setActiveDropdown] = useState(null);

//     const formatDate = (dateString) => {
//         const date = new Date(dateString);
//         const day = String(date.getDate()).padStart(2, '0');
//         const month = String(date.getMonth() + 1).padStart(2, '0');
//         const year = date.getFullYear();
//         return `${day}/${month}/${year}`;
//     };

//     const rowStyle = (booking) => {
//         let style = {};
//         if (booking.status === 'Cancelled') {
//             style.textDecoration = 'line-through';
//             style.color = '#999';
//         }
//         return style;
//     };

//     const toggleDropdown = (bookingId) => {
//         setActiveDropdown(activeDropdown === bookingId ? null : bookingId);
//     };

//     const getPaymentStatusClass = (status) => {
//         if (!status) return '';
//         const lowerCaseStatus = status.toLowerCase();
//         switch (lowerCaseStatus) {
//             case 'completed':
//                 return 'payment-status-completed';
//             case 'pending':
//                 return 'payment-status-pending';
//             case 'received':
//                 return 'payment-status-received';
//             case 'reschedule':
//                 return 'payment-status-reschedule';
//             default:
//                 return '';
//         }
//     };

//     const areActionsDisabled = (booking) => {
//         if (booking.status === 'Cancelled' || booking.status === 'Completed') {
//             return true;
//         }
//         return false;
//     };

//     return (
//         <div className="table-container">
//             <table>
//                 <thead>
//                     <tr>
//                         <th>Booking ID</th>
//                         <th>Sport</th>
//                         <th>Court</th>
//                         <th>Customer</th>
//                         <th>Booked By</th>
//                         <th>Contact</th>
//                         <th>Date</th>
//                         <th>Time Slot</th>
//                         <th>Original Price</th>
//                         <th>Amount Paid</th>
//                         <th>Balance</th>
//                         <th>Discount</th>
//                         <th>Discount Reason</th>
//                         <th>Accessories</th>
//                         <th>Payment Status</th>
//                         <th>Payment ID</th>
//                         <th>Booking Status</th>
//                         <th>Actions</th>
//                     </tr>
//                 </thead>
//                 <tbody>
//                     {bookings.map(booking => {
//                         const subActionsDisabled = areActionsDisabled(booking);
//                         return (
//                             <tr key={booking.id} style={rowStyle(booking)}>
//                                 <td>{booking.id}</td>
//                                 <td>{booking.sport_name}</td>
//                                 <td>{booking.court_name}</td>
//                                 <td>{booking.customer_name}</td>
//                                 <td>{booking.created_by_user || 'N/A'}</td>
//                                 <td>{booking.customer_contact}</td>
//                                 <td>{formatDate(booking.date)}</td>
//                                 <td>{booking.time_slot}</td>
//                                 <td>{booking.original_price}</td>
//                                 <td>{booking.amount_paid}</td>
//                                 <td>{booking.balance_amount}</td>
//                                 <td>{booking.discount_amount || 0}</td>
//                                 <td>{booking.discount_reason || 'N/A'}</td>
//                                 <td>
//                                     {booking.accessories && booking.accessories.length > 0 ? (
//                                         <ul>
//                                             {booking.accessories.map((acc, index) => (
//                                                 <li key={index}>{acc.name} (x{acc.quantity})</li>
//                                             ))}
//                                         </ul>
//                                     ) : 'N/A'}
//                                 </td>
//                                 <td>
//                                     <span className={`payment-status-text ${getPaymentStatusClass(booking.payment_status)}`}>
//                                         {booking.payment_status}
//                                     </span>
//                                 </td>
//                                 <td>{booking.payment_id || 'N/A'}</td>
//                                 <td>{booking.status}</td>
//                                 <td className="actions-cell">
//                                     <button onClick={() => toggleDropdown(booking.id)}>
//                                         Actions
//                                     </button>
//                                     {activeDropdown === booking.id && (
//                                         <div className="actions-dropdown">
//                                             <button onClick={() => { onReceipt(booking); toggleDropdown(booking.id); }}>View Receipt</button>
//                                             <button onClick={() => { onEdit(booking); toggleDropdown(booking.id); }} disabled={subActionsDisabled}>Edit Payment</button>
//                                             {user && user.role === 'admin' && (
//                                                 <button onClick={() => { onCancel(booking.id); toggleDropdown(booking.id); }} disabled={subActionsDisabled}>Cancel booking </button>
//                                             )}
//                                             <button className="action-close-btn" onClick={() => toggleDropdown(booking.id)}>Close</button>

//                                         </div>
//                                     )}
//                                 </td>
//                             </tr>
//                         );
//                     })}
//                 </tbody>
//             </table>
//         </div>
//     );
// };

// export default BookingList;


import React, { useState } from 'react';

const BookingList = ({ bookings, user, onEdit, onCancel, onReceipt, columnVisibility }) => {
    const [activeDropdown, setActiveDropdown] = useState(null);

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date)) return 'Invalid Date';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const toggleDropdown = (bookingId) => {
        setActiveDropdown(activeDropdown === bookingId ? null : bookingId);
    };

    const getPaymentStatusClass = (status) => {
        if (!status) return '';
        const lowerCaseStatus = status.toLowerCase();
        switch (lowerCaseStatus) {
            case 'completed': return 'payment-status-completed';
            case 'pending': return 'payment-status-pending';
            case 'received': return 'payment-status-received';
            case 'reschedule': return 'payment-status-reschedule';
            default: return '';
        }
    };

    const areActionsDisabled = (booking) => {
        if (!booking || !booking.status) return true;

        const isPastBooking = () => {
            if (!booking.date || !booking.time_slot) return false;

            const now = new Date();
            const bookingDate = new Date(booking.date);
            
            // Assuming time_slot is in a format like "10:00 AM - 11:00 AM"
            const timeParts = booking.time_slot.split(' - ');
            if (timeParts.length < 2) return false;

            const endTimeStr = timeParts[1];
            const [time, modifier] = endTimeStr.split(' ');
            let [hours, minutes] = time.split(':');

            if (hours === '12') {
                hours = '00';
            }
            if (modifier === 'PM') {
                hours = parseInt(hours, 10) + 12;
            }

            bookingDate.setHours(hours);
            bookingDate.setMinutes(minutes);

            return now > bookingDate;
        };

        if (booking.status.toLowerCase() === 'cancelled') {
            return true;
        }

        if (booking.payment_status && booking.payment_status.toLowerCase() === 'completed' && isPastBooking()) {
            return true;
        }
        
        if (booking.payment_status && (booking.payment_status.toLowerCase() === 'pending' || booking.payment_status.toLowerCase() === 'received')) {
            return false;
        }

        // For any other status, the button should be disabled.
        return true;
    };

    const visibility = columnVisibility || {}; // Safety fallback

    return (
        <div className="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Booking ID</th>
                        <th>Customer</th>
                        <th>Contact</th>
                        <th>Date</th>
                        <th>Time Slot</th>
                        <th>Amount Paid</th>
                        <th>Balance</th>
                        {visibility.court && <th>Court</th>}
                        {visibility.discount && <th>Discount</th>}
                        {visibility.discountReason && <th>Discount Reason</th>}
                        {visibility.accessories && <th>Accessories</th>}
                        <th>Payment Status</th>
                        {visibility.paymentId && <th>Payment ID</th>}
                        <th>Booking Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {bookings.map(booking => {
                        if (!booking || !booking.id) return null; // Safety check for invalid booking data
                        const subActionsDisabled = areActionsDisabled(booking);
                        return (
                            <tr key={booking.id}>
                                <td>{booking.id || 'N/A'}</td>
                                <td>{booking.customer_name || 'N/A'}</td>
                                <td>{booking.customer_contact || 'N/A'}</td>
                                <td>{formatDate(booking.date)}</td>
                                <td>{booking.time_slot || 'N/A'}</td>
                                <td>{booking.amount_paid || 0}</td>
                                <td>{booking.balance_amount || 0}</td>
                                {visibility.court && <td>{booking.court_name || 'N/A'}</td>}
                                {visibility.discount && <td>{booking.discount_amount || 0}</td>}
                                {visibility.discountReason && <td>{booking.discount_reason || 'N/A'}</td>}
                                {visibility.accessories && (
                                     <td>
                                    {booking.accessories && booking.accessories.length > 0 ? (
                                        <ul>
                                            {booking.accessories.map((acc, index) => (
                                                <li key={index}>{acc.name} (x{acc.quantity})</li>
                                           ))}
                                        </ul>
                                    ) : 'N/A'}
                                 </td>
                                )}
                                <td>
                                    <span className={`payment-status-text ${getPaymentStatusClass(booking.payment_status)}`}>
                                        {booking.payment_status || 'N/A'}
                                    </span>
                                </td>
                                {visibility.paymentId && <td>{booking.payment_id || 'N/A'}</td>}
                                <td>{booking.status || 'N/A'}</td>
                                <td className="actions-cell">
                                    <button onClick={() => toggleDropdown(booking.id)}>Actions</button>
                                    {activeDropdown === booking.id && (
                                        <div className="actions-dropdown">
                                            <button onClick={() => { onReceipt(booking); toggleDropdown(booking.id); }}>View Receipt</button>
                                            <button onClick={() => { onEdit(booking); toggleDropdown(booking.id); }} disabled={subActionsDisabled}>Edit Payment</button>
                                            {user && user.role === 'admin' && (
                                                <button onClick={() => { onCancel(booking.id); toggleDropdown(booking.id); }} disabled={subActionsDisabled}>Cancel booking</button>
                                            )}
                                            <button className="action-close-btn" onClick={() => toggleDropdown(booking.id)}>Close</button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default BookingList;




