import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

const EditBookingModal = ({ booking, onSave, onClose, error, onPaymentAdded }) => {
    const [formData, setFormData] = useState({});
    const [originalBookingData, setOriginalBookingData] = useState(null);
    const [extensionMinutes, setExtensionMinutes] = useState(0);
    const [availabilityMessage, setAvailabilityMessage] = useState('');
    const [showReschedule, setShowReschedule] = useState(false);
    const [isRescheduled, setIsRescheduled] = useState(false);
    const [timeError, setTimeError] = useState('');
    const [newPaymentAmount, setNewPaymentAmount] = useState('');
    const [newPaymentMode, setNewPaymentMode] = useState('cash');
    const [newPaymentId, setNewPaymentId] = useState(''); // New state for payment ID
    const [newOnlinePaymentType, setNewOnlinePaymentType] = useState('UPI'); // New state for online payment type
    const [stagedPayments, setStagedPayments] = useState([]);


    const checkClash = useCallback(async () => {
        if (formData.date && formData.startTime && formData.endTime && formData.court_id) {
            try {
                const response = await api.post('/bookings/check-clash', {
                    court_id: formData.court_id,
                    date: new Date(formData.date).toISOString().slice(0, 10),
                    startTime: formData.startTime,
                    endTime: formData.endTime,
                    bookingId: formData.id
                });
                setAvailabilityMessage(response.data.message);
            } catch (error) {
                if (error.response?.data?.message) {
                    setAvailabilityMessage(error.response.data.message);
                } else {
                    setAvailabilityMessage('Could not check availability.');
                }
            }
        }
    }, [formData]);

    const parseTime = (timeStr) => {
        if (!timeStr) return null;
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        return { hours, minutes };
    };

    const formatTime24 = (date) => {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    useEffect(() => {
        if (booking) {
            const [startTime, endTime] = booking.time_slot.split(' - ');
            const parsedStartTime = parseTime(startTime);
            const parsedEndTime = parseTime(endTime);
            
            const startDate = new Date(booking.date);
            startDate.setHours(parsedStartTime.hours, parsedStartTime.minutes);

            const endDate = new Date(booking.date);
            endDate.setHours(parsedEndTime.hours, parsedEndTime.minutes);

            const initialFormData = {
                ...booking,
                startTime: formatTime24(startDate),
                endTime: formatTime24(endDate)
            };
            setFormData(initialFormData);
            setOriginalBookingData(initialFormData);
        }
    }, [booking]);

    useEffect(() => {
        const handler = setTimeout(() => {
            checkClash();
        }, 500);
        return () => clearTimeout(handler);
    }, [checkClash, formData.date, formData.startTime, formData.endTime, formData.court_id]);

    useEffect(() => {
        if (formData.startTime && formData.endTime && formData.startTime === formData.endTime) {
            setTimeError('Start time and end time cannot be the same.');
        }

        else {
            setTimeError('');
        }
    }, [formData.startTime, formData.endTime]);

    useEffect(() => {
        if (showReschedule && formData.startTime && formData.endTime && (originalBookingData?.startTime !== formData.startTime || originalBookingData?.endTime !== formData.endTime)) {
            api.post('/bookings/calculate-price', {
                sport_id: formData.sport_id,
                startTime: formData.startTime,
                endTime: formData.endTime,
                slots_booked: formData.slots_booked,
                accessories: booking.accessories,
                discount_amount: booking.discount_amount
            })
            .then(response => {
                setFormData(prev => ({
                    ...prev,
                    total_price: response.data.total_price,
                    balance_amount: response.data.total_price - prev.amount_paid
                }));
            })
            .catch(error => {
                console.error("Error calculating price:", error.response || error);
            });
        }
    }, [formData.startTime, formData.endTime, formData.sport_id, formData.slots_booked, booking.accessories, booking.discount_amount, showReschedule, originalBookingData]);

    const handleExtensionChange = (e) => {
        const minutes = parseInt(e.target.value, 10);
        setExtensionMinutes(minutes);

        if (booking) {
            const [, endTimeStr] = booking.time_slot.split(' - ');
            const parsedEndTime = parseTime(endTimeStr);
            const originalEndDate = new Date(booking.date);
            originalEndDate.setHours(parsedEndTime.hours, parsedEndTime.minutes);

            const newEndDate = new Date(originalEndDate.getTime() + minutes * 60000);
            const newEndTime = formatTime24(newEndDate);

            api.post('/bookings/calculate-price', {
                sport_id: formData.sport_id,
                startTime: formData.startTime,
                endTime: newEndTime,
                slots_booked: formData.slots_booked,
                accessories: booking.accessories, // Use booking.accessories
                discount_amount: booking.discount_amount // Use booking.discount_amount
            })
            .then(response => {
                setFormData(prev => {
                    const newState = {
                        ...prev,
                        endTime: newEndTime,
                        total_price: response.data.total_price,
                        balance_amount: response.data.total_price - prev.amount_paid
                    };
                    return newState;
                });
            })
            .catch(error => {
                console.error("Error calculating price:", error.response || error);
            });
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddPayment = () => {
        if (!newPaymentAmount || parseFloat(newPaymentAmount) <= 0) {
            alert('Please enter a valid payment amount.');
            return;
        }

        const paymentAmount = parseFloat(newPaymentAmount);

        const newPayment = {
            amount: paymentAmount,
            payment_mode: newPaymentMode === 'online' ? newOnlinePaymentType : newPaymentMode,
            payment_id: newPaymentId,
        };

        setStagedPayments(prev => [...prev, newPayment]);

        setFormData(prev => {
            const updatedAmountPaid = parseFloat(prev.amount_paid || 0) + paymentAmount;
            const updatedBalance = prev.total_price - updatedAmountPaid;
            return {
                ...prev,
                amount_paid: updatedAmountPaid,
                balance_amount: updatedBalance,
                payment_status: updatedBalance <= 0 ? 'Completed' : 'Received'
            };
        });

        // Reset fields
        setNewPaymentAmount('');
        setNewPaymentId('');
        setNewPaymentMode('cash');
        setNewOnlinePaymentType('UPI');
    };

    const handleSave = () => {
        if (timeError) {
            alert(timeError);
            return;
        }

        if (showReschedule) {
            const hasDateChanged = originalBookingData.date !== formData.date;
            const hasStartTimeChanged = originalBookingData.startTime !== formData.startTime;
            const hasEndTimeChanged = originalBookingData.endTime !== formData.endTime;
    
            if ((hasDateChanged || hasStartTimeChanged || hasEndTimeChanged) && !isRescheduled) {
                alert('Please check the "Mark as Rescheduled" box to save date or time changes.');
                return;
            }
        }

        onSave(formData.id, { ...formData, is_rescheduled: isRescheduled, stagedPayments });
    };

    const handleSaveAsPaid = async () => {
        if (timeError) {
            alert(timeError);
            return;
        }
    
        let updatedBooking = { ...formData };

        const remainingBalance = formData.balance_amount;
        if (remainingBalance > 0) {
            try {
                const response = await api.post(`/bookings/${booking.id}/payments`, {
                    amount: remainingBalance,
                    payment_mode: newPaymentMode, // Use the selected payment mode
                });
                updatedBooking = response.data.booking; // Get the latest booking data
                setFormData(updatedBooking); // Update the UI immediately
            } catch (error) {
                console.error("Error adding final payment:", error);
                alert('Failed to add final payment.');
                return;
            }
        }
    
        // Now, save any other changes that might have been made in the modal
        onSave(updatedBooking.id, { ...updatedBooking, is_rescheduled: isRescheduled });
    };

    if (!booking) return null;

    return (
        <>
            <div style={overlayStyle} onClick={onClose} />
            <div style={modalStyle}>
                <div style={{ maxHeight: '80vh', overflowY: 'auto', paddingRight: '15px' }}>
                    <h3>Edit Booking #{booking.id}</h3>
                    
                    <p><strong>Date:</strong> {formatDate(formData.date)}</p>
                    <p><strong>Time Slot:</strong> {formData.time_slot}</p>

                    <div style={{ margin: '10px 0' }}>
                        <label>Extend By: </label>
                        <select value={extensionMinutes} onChange={handleExtensionChange}>
                            <option value="0">0 mins</option>
                            <option value="30">30 mins</option>
                            <option value="60">60 mins</option>
                            <option value="90">90 mins</option>
                            <option value="120">120 mins</option>
                        </select>
                    </div>

                    <p><strong>New End Time:</strong> {formData.endTime}</p>
                    <p><strong>New Total Price:</strong> ₹{formData.total_price}</p>

                    <hr style={{ margin: '20px 0' }}/>

                    <h4>Customer Details</h4>
                    <input name="customer_name" value={formData.customer_name || ''} readOnly placeholder="Customer Name" />
                    <input name="customer_contact" value={formData.customer_contact || ''} readOnly placeholder="Customer Contact" />

                    <hr style={{ margin: '20px 0' }}/>

                    <h4>Reschedule</h4>
                    <div>
                        <label>
                            <input type="checkbox" checked={showReschedule} onChange={(e) => setShowReschedule(e.target.checked)} />
                            Reschedule Booking
                        </label>
                    </div>

                    {showReschedule && (
                        <>
                            <div>
                                <label>
                                    <input type="checkbox" checked={isRescheduled} onChange={(e) => setIsRescheduled(e.target.checked)} />
                                    Mark as Rescheduled
                                </label>
                            </div>

                            <div style={{ margin: '10px 0' }}>
                                <label>New Date: </label>
                                <input type="date" name="date" value={formData.date ? new Date(formData.date).toISOString().slice(0, 10) : ''} onChange={handleInputChange} min={new Date().toISOString().slice(0, 10)} />
                            </div>
                            <div style={{ margin: '10px 0' }}>
                                <label>New Start Time: </label>
                                <input type="time" name="startTime" value={formData.startTime || ''} onChange={handleInputChange} />
                            </div>
                            <div style={{ margin: '10px 0' }}>
                                <label>New End Time: </label>
                                <input type="time" name="endTime" value={formData.endTime || ''} onChange={handleInputChange} />
                            </div>
                            {timeError && <p style={{ color: 'red' }}>{timeError}</p>}
                        </>
                    )}
                    {availabilityMessage && (
                        <p style={{ color: availabilityMessage.includes('not') ? 'red' : 'green' }}>
                            {availabilityMessage}
                        </p>
                    )}

                    <hr style={{ margin: '20px 0' }}/>

                    <h4>Payments</h4>
                    <p><strong>Total Price:</strong> ₹{formData.total_price}</p>
                    <p><strong>Amount Paid:</strong> ₹{formData.amount_paid}</p>
                    <p><strong>Balance:</strong> ₹{formData.balance_amount}</p>
                    <p><strong>Payment Status:</strong> {formData.payment_status}</p>

                    {formData.payments && formData.payments.length > 0 && (
                        <div>
                            <h5>Payment History:</h5>
                            <ul>
                                {formData.payments.map(payment => (
                                    <li key={payment.id}>
                                        ₹{payment.amount} via {payment.payment_mode} on {new Date(payment.payment_date).toLocaleDateString()}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div>
                        <h5>Add Payment</h5>
                        <input
                            type="number"
                            placeholder="Amount"
                            value={newPaymentAmount}
                            onChange={(e) => setNewPaymentAmount(e.target.value)}
                        />
                        <select value={newPaymentMode} onChange={(e) => setNewPaymentMode(e.target.value)}>
                            <option value="cash">Cash</option>
                            <option value="online">Online</option>
                            <option value="cheque">Cheque</option>
                        </select>

                        {newPaymentMode === 'online' && (
                            <select value={newOnlinePaymentType} onChange={(e) => setNewOnlinePaymentType(e.target.value)}>
                                <option value="UPI">UPI</option>
                                <option value="Card">Card</option>
                                <option value="Net Banking">Net Banking</option>
                            </select>
                        )}

                        {(newPaymentMode === 'online' || newPaymentMode === 'cheque') && (
                            <input
                                type="text"
                                placeholder="Payment ID / Cheque ID"
                                value={newPaymentId}
                                onChange={(e) => setNewPaymentId(e.target.value)}
                            />
                        )}

                        <button onClick={handleAddPayment}>Add Payment</button>
                    </div>

                    <hr style={{ margin: '20px 0' }}/>

                    {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
                </div>

                <div style={{ marginTop: '20px' }}>
                    <button onClick={handleSave} disabled={!!timeError}>Save Changes</button>
                    <button onClick={handleSaveAsPaid} style={{ marginLeft: '10px' }} disabled={!!timeError}>Mark as Fully Paid & Save</button>
                    <button onClick={onClose} style={{ marginLeft: '10px' }}>Cancel</button>
                </div>
            </div>
        </>
    );
};

const modalStyle = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'white',
    padding: '20px',
    zIndex: 1000,
    border: '1px solid #ccc',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    width: '400px'
};

const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999
};

export default EditBookingModal;
