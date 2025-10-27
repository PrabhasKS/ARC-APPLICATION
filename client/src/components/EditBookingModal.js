import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

const EditBookingModal = ({ booking, onSave, onClose, error }) => {
    const [formData, setFormData] = useState({});
    const [extensionMinutes, setExtensionMinutes] = useState(0);
    const [availabilityMessage, setAvailabilityMessage] = useState('');

    const [showReschedule, setShowReschedule] = useState(false);
    const [isRescheduled, setIsRescheduled] = useState(false);

    // ✅ Wrap in useCallback to fix missing dependency warning
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

            setFormData({
                ...booking,
                startTime: formatTime24(startDate),
                endTime: formatTime24(endDate)
            });
        }
    }, [booking]);

    // ✅ Add checkClash dependency properly
    useEffect(() => {
        const handler = setTimeout(() => {
            checkClash();
        }, 500);
        return () => clearTimeout(handler);
    }, [checkClash, formData.date, formData.startTime, formData.endTime, formData.court_id]);

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
                slots_booked: formData.slots_booked
            })
            .then(response => {
                setFormData(prev => ({
                    ...prev,
                    endTime: newEndTime,
                    total_price: response.data.total_price,
                    balance_amount: response.data.total_price - prev.amount_paid
                }));
            })
            .catch(error => {
                console.error("Error calculating price:", error);
            });
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newFormData = { ...prev, [name]: value };
            if (name === 'amount_paid') {
                const amountPaid = parseFloat(value) || 0;
                newFormData.balance_amount = newFormData.total_price - amountPaid;
                if (amountPaid === 0) {
                    newFormData.payment_status = 'Pending';
                } else if (amountPaid < newFormData.total_price) {
                    newFormData.payment_status = 'Received';
                } else {
                    newFormData.payment_status = 'Completed';
                }
            }
            return newFormData;
        });
    };

    const handleSave = () => {
        onSave(formData.id, { ...formData, is_rescheduled: isRescheduled });
    };

    const handleSaveAsPaid = () => {
        const updatedFormData = {
            ...formData,
            amount_paid: formData.total_price,
            balance_amount: 0,
            payment_status: 'Completed',
            is_rescheduled: false
        };
        onSave(formData.id, updatedFormData);
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
                    <input name="customer_name" value={formData.customer_name || ''} onChange={handleInputChange} placeholder="Customer Name" />
                    <input name="customer_contact" value={formData.customer_contact || ''} onChange={handleInputChange} placeholder="Customer Contact" />

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
                                <input type="date" name="date" value={formData.date ? new Date(formData.date).toISOString().slice(0, 10) : ''} onChange={handleInputChange} />
                            </div>
                            <div style={{ margin: '10px 0' }}>
                                <label>New Start Time: </label>
                                <input type="time" name="startTime" value={formData.startTime || ''} onChange={handleInputChange} />
                            </div>
                            <div style={{ margin: '10px 0' }}>
                                <label>New End Time: </label>
                                <input type="time" name="endTime" value={formData.endTime || ''} onChange={handleInputChange} />
                            </div>
                        </>
                    )}
                    {availabilityMessage && (
                        <p style={{ color: availabilityMessage.includes('not') ? 'red' : 'green' }}>
                            {availabilityMessage}
                        </p>
                    )}

                    <hr style={{ margin: '20px 0' }}/>

                    <h4>Payment</h4>
                    <input type="number" name="amount_paid" value={formData.amount_paid || 0} onChange={handleInputChange} placeholder="Amount Paid" />
                    <p><strong>Payment Status:</strong> {formData.payment_status}</p>

                    <hr style={{ margin: '20px 0' }}/>

                    {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
                </div>

                <div style={{ marginTop: '20px' }}>
                    <button onClick={handleSave}>Save Changes</button>
                    <button onClick={handleSaveAsPaid} style={{ marginLeft: '10px' }}>Mark as Fully Paid & Save</button>
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
