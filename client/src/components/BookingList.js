


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

    const isBookingExpired = (booking) => {
        try {
            if (!booking.date || !booking.time_slot) return false; 
    
            const now = new Date();
            const timeSlotParts = booking.time_slot.split(' - ');
            if (timeSlotParts.length < 2) return false;
    
            const endTimeStr = timeSlotParts[1].trim();
            const timeParts = endTimeStr.split(' ');
            if (timeParts.length < 2) return false;
    
            const [time, modifier] = timeParts;
            const [hoursStr, minutesStr] = time.split(':');
            let hours = parseInt(hoursStr, 10);
            const minutes = parseInt(minutesStr, 10);
    
            if (isNaN(hours) || isNaN(minutes)) return false;
    
            if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
            if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
    
            const bookingEndDateTime = new Date(booking.date);
            bookingEndDateTime.setHours(hours, minutes, 0, 0);
            
            return now > bookingEndDateTime;
        } catch (error) {
            console.error("Error parsing booking time:", error);
            return false;
        }
    };

    const rowStyle = (booking) => {
        let style = {};
        if (booking.status === 'Cancelled') {
            style.textDecoration = 'line-through';
            style.color = '#999';
        } else if (booking.is_rescheduled && !isBookingExpired(booking)) {
            style.backgroundColor = 'lightgreen';
        }
        return style;
    };






    const toggleDropdown = (e, bookingId) => {



        if (!e || (activeDropdown && activeDropdown.id === bookingId)) {



            setActiveDropdown(null);



            return;



        }







        const buttonRect = e.currentTarget.getBoundingClientRect();



        const spaceBelow = window.innerHeight - buttonRect.bottom;



        const dropdownHeight = 180; // Estimated height







        const direction = spaceBelow < dropdownHeight ? 'up' : 'down';



        



        setActiveDropdown({ id: bookingId, direction: direction });



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







    const isEditDisabled = (booking) => {



        const paymentStatus = (booking.payment_status || '').toLowerCase();



        const isCompleted = paymentStatus === 'completed';







        if (!isCompleted) {



            // Enable if status is anything other than 'Completed' (e.g., Pending, Received).



            return false;



        }







        // If status is 'Completed', check if the time has passed.



        try {



            const now = new Date();



            const timeSlotParts = (booking.time_slot || '').split(' - ');



            if (timeSlotParts.length < 2) return true;







            const endTimeStr = timeSlotParts[1].trim();



            const timeParts = endTimeStr.split(' ');



            if (timeParts.length < 2) return true;







            const [time, modifier] = timeParts;



            const [hoursStr, minutesStr] = time.split(':');



            let hours = parseInt(hoursStr, 10);



            const minutes = parseInt(minutesStr, 10);







            if (isNaN(hours) || isNaN(minutes)) return true;







            if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;



            if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;







            const bookingEndDateTime = new Date(booking.date);



            bookingEndDateTime.setHours(hours, minutes, 0, 0);



            



            return now > bookingEndDateTime;



        } catch (error) {



            return true;



        }



    };







    const visibility = columnVisibility || {};







    return (



        <div className="table-container">



            <table>



                <thead>



                    <tr>



                        <th>Booking ID</th>



                        <th>Sport</th>



                        {visibility.court && <th>Court</th>}



                        <th>Customer</th>



                        <th>Contact</th>



                        <th>Date</th>



                        <th>Time Slot</th>



                        <th>Amount Paid</th>



                        <th>Balance</th>



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



                        if (!booking || !booking.id) return null;



                        const editDisabled = isEditDisabled(booking);



                        return (



                            <tr key={booking.id} style={rowStyle(booking)}>



                                <td>{booking.id || 'N/A'}</td>



                                <td>{booking.sport_name || 'N/A'}</td>



                                {visibility.court && <td>{booking.court_name || 'N/A'}</td>}



                                <td>{booking.customer_name || 'N/A'}</td>



                                <td>{booking.customer_contact || 'N/A'}</td>



                                <td>{formatDate(booking.date)}</td>



                                <td>{booking.time_slot || 'N/A'}</td>



                                <td>{booking.amount_paid || 0}</td>



                                <td>{booking.balance_amount || 0}</td>



                                {visibility.discount && <td>{booking.discount_amount || 0}</td>}



                                {visibility.discountReason && <td>{booking.discount_reason || 'N/A'}</td>}



                                {visibility.accessories && <td>{(Array.isArray(booking.accessories) && booking.accessories.length > 0) ? 'Yes' : 'No'}</td>}



                                <td>



                                    <span className={`payment-status-text ${getPaymentStatusClass(booking.payment_status)}`}>



                                        {booking.payment_status || 'N/A'}



                                    </span>



                                </td>



                                {visibility.paymentId && <td>{booking.payment_id || 'N/A'}</td>}



                                <td>{booking.status || 'N/A'}</td>



                                <td className="actions-cell">



                                    <button onClick={(e) => toggleDropdown(e, booking.id)}>



                                        Actions



                                    </button>



                                    {activeDropdown && activeDropdown.id === booking.id && (



                                        <div className={`actions-dropdown ${activeDropdown.direction}`}>



                                            <button onClick={() => { onReceipt(booking); toggleDropdown(null, booking.id); }}>View Receipt</button>



                                            <button onClick={() => { onEdit(booking); toggleDropdown(null, booking.id); }} disabled={editDisabled}>Edit Payment</button>



                                            {user && user.role === 'admin' && (



                                                <button onClick={() => { onCancel(booking.id); toggleDropdown(null, booking.id); }} disabled={editDisabled}>Cancel booking</button>



                                            )}



                                            <button className="action-close-btn" onClick={() => toggleDropdown(null, booking.id)}>Close</button>



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

