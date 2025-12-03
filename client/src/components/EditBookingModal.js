import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import './EditBookingModal.css';

const EditBookingModal = ({ booking, onSave, onClose, error }) => {
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
    const [accessories, setAccessories] = useState([]);
    const [selectedAccessories, setSelectedAccessories] = useState([]);
    const [showDiscount, setShowDiscount] = useState(false);
    const [showAccessories, setShowAccessories] = useState(false);
    const [errors, setErrors] = useState({}); // For validation errors
    const [generalError, setGeneralError] = useState(''); // For general, non-field-specific errors


    useEffect(() => {
        const fetchAccessories = async () => {
            try {
                const res = await api.get('/accessories');
                setAccessories(res.data || []);
            } catch (error) {
                console.error("Error fetching accessories:", error);
            }
        };
        fetchAccessories();
    }, []);

    const checkClash = useCallback(async () => {
        if (formData.date && formData.startTime && formData.endTime && formData.court_id) {
            try {
                const response = await api.post('/bookings/check-clash', {
                    court_id: formData.court_id,
                    date: new Date(formData.date).toISOString().slice(0, 10),
                    startTime: formData.startTime,
                    endTime: formData.endTime,
                    bookingId: formData.id,
                    slots_booked: formData.slots_booked
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
            setSelectedAccessories(booking.accessories || []);
            // Reset errors when a new booking is loaded
            setErrors({});
            setGeneralError('');
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
        if (!booking) return;

        const calculatePrice = () => {
            if (!formData.sport_id || !formData.startTime || !formData.endTime) return;

            api.post('/bookings/calculate-price', {
                sport_id: formData.sport_id,
                startTime: formData.startTime,
                endTime: formData.endTime,
                slots_booked: formData.slots_booked,
                accessories: selectedAccessories,
                discount_amount: formData.discount_amount
            })
            .then(response => {
                setFormData(prev => {
                    const newTotal = response.data.total_price;
                    const newBalance = newTotal - prev.amount_paid;
                    if (prev.total_price !== newTotal || prev.balance_amount !== newBalance) {
                        return { ...prev, total_price: newTotal, balance_amount: newBalance };
                    }
                    return prev;
                });
            })
            .catch(error => {
                console.error("Error calculating price:", error.response || error);
            });
        };

        const handler = setTimeout(calculatePrice, 300);
        return () => clearTimeout(handler);

    }, [booking, formData.sport_id, formData.startTime, formData.endTime, formData.slots_booked, formData.discount_amount, formData.amount_paid, selectedAccessories]);

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

            setFormData(prev => ({
                ...prev,
                endTime: newEndTime,
            }));
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
    
        // Clear previous errors for this field
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
        setGeneralError(''); // Clear general errors on any input change

        if (name === 'discount_amount') {
            const amount = parseFloat(value);
            if (amount < 0) {
                setErrors(prev => ({ ...prev, discount_amount: "Discount amount cannot be negative." }));
                return; // Prevent state update for negative values
            }
        }
    
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddPayment = () => {
        setErrors({}); // Clear previous errors
        let hasError = false;

        if (!newPaymentAmount || parseFloat(newPaymentAmount) <= 0) {
            setErrors(prev => ({ ...prev, newPayment: 'Please enter a valid payment amount.' }));
            hasError = true;
        }

        const paymentAmount = parseFloat(newPaymentAmount);
        const currentAmountPaid = parseFloat(formData.amount_paid || 0);
        const totalPrice = parseFloat(formData.total_price);

        if ((currentAmountPaid + paymentAmount) > totalPrice) {
            setErrors(prev => ({ ...prev, newPayment: `Cannot pay more than the total. Balance is ₹${(totalPrice - currentAmountPaid).toFixed(2)}.` }));
            hasError = true;
        }

        if (hasError) return;

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

    const validateForm = () => {
        const newErrors = {};

        if (timeError) {
            newErrors.time = timeError;
        }

        if (parseFloat(formData.discount_amount) > 0 && (!formData.discount_reason || formData.discount_reason.trim() === '')) {
            newErrors.discount_reason = 'Discount reason is mandatory when a discount is applied.';
        }

        const total = parseFloat(formData.total_price);
        const paid = parseFloat(formData.amount_paid || 0);
        if (total < paid && Math.abs(total - paid) > 0.01) {
            newErrors.balance = `The new total (₹${total.toFixed(2)}) is less than the amount paid (₹${paid.toFixed(2)}).`;
        }

        if (showReschedule) {
            const hasDateChanged = originalBookingData.date !== formData.date;
            const hasStartTimeChanged = originalBookingData.startTime !== formData.startTime;
            const hasEndTimeChanged = originalBookingData.endTime !== formData.endTime;
            if ((hasDateChanged || hasStartTimeChanged || hasEndTimeChanged) && !isRescheduled) {
                newErrors.reschedule = 'Please check "Mark as Rescheduled" to save date/time changes.';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    const handleSave = () => {
        if (!validateForm()) {
            setGeneralError("Please fix the errors before saving.");
            return;
        }
        setGeneralError('');
        setErrors({});
        onSave(formData.id, { ...formData, is_rescheduled: isRescheduled, stagedPayments, accessories: selectedAccessories });
    };

    const handleClose = () => {
        setErrors({});
        setGeneralError('');
        onClose();
    };

    const handleAddSelectedAccessory = (accessoryId) => {
        if (!accessoryId) return;
        const existingAcc = selectedAccessories.find(a => a.id === accessoryId);
        if (existingAcc) {
            setSelectedAccessories(
                selectedAccessories.map(a =>
                    a.id === accessoryId ? { ...a, quantity: a.quantity + 1 } : a
                )
            );
        } else {
            setSelectedAccessories([...selectedAccessories, { id: accessoryId, quantity: 1 }]);
        }
    };

    const handleRemoveAccessory = (accessoryId) => {
        setSelectedAccessories(selectedAccessories.filter(a => a.id !== accessoryId));
    };

    if (!booking) return null;

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="edit-booking-modal-content" onClick={e => e.stopPropagation()}>
                <h3>Edit Booking #{booking.id}</h3>
                <div className="modal-body">
                    {generalError && <p style={{ color: 'red', fontSize: '14px', textAlign: 'center' }}>{generalError}</p>}
                    
                    <div className="form-section">
                        <h4>Timing & Price</h4>
                        <p><strong>Date:</strong> {formatDate(formData.date)}</p>
                        <p><strong>Time Slot:</strong> {formData.time_slot}</p>

                        <div className="form-group">
                            <label>Extend By:</label>
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
                        {errors.balance && <p style={{ color: 'red', fontSize: '12px' }}>{errors.balance}</p>}
                    </div>

                    <div className="form-section">
                        <h4>Customer Details</h4>
                        <div className="form-group">
                            <label>Customer Name</label>
                            <input name="customer_name" value={formData.customer_name || ''} readOnly />
                        </div>
                        <div className="form-group">
                            <label>Customer Contact</label>
                            <input name="customer_contact" value={formData.customer_contact || ''} readOnly />
                        </div>
                    </div>

                    <div className="form-section">
                        <h4>Accessories</h4>
                        {!showAccessories ? (
                            <div className="form-group">
                                <button
                                    type="button"
                                    className="btn-add-discount"
                                    onClick={() => setShowAccessories(true)}
                                >
                                    + Add Accessories
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="form-group">
                                    <label>Add Accessory</label>
                                    <select
                                        onChange={(e) => handleAddSelectedAccessory(parseInt(e.target.value))}
                                    >
                                        <option value="">Select an accessory</option>
                                        {accessories.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name} - ₹{acc.price}</option>
                                        ))}
                                    </select>
                                </div>
                                <ul>
                                    {selectedAccessories.map(acc => {
                                        const accessoryDetails = accessories.find(a => a.id === acc.id);
                                        return (
                                            <li key={acc.id}>
                                                {accessoryDetails?.name} (x{acc.quantity})
                                                <button
                                                    onClick={() => handleRemoveAccessory(acc.id)}
                                                    disabled={formData.payment_status === 'Completed'}
                                                >
                                                    &times;
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                                <button type="button" className="btn-link" onClick={() => {
                                    setShowAccessories(false);
                                    setSelectedAccessories([]);
                                }}>
                                    - Clear Accessories
                                </button>
                            </>
                        )}
                    </div>

                    <div className="form-section">
                        <h4>Discount</h4>
                        {!showDiscount ? (
                            <div className="form-group">
                                <button
                                    type="button"
                                    className="btn-add-discount"
                                    onClick={() => setShowDiscount(true)}
                                >
                                    + Add Discount
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="form-group">
                                    <label>Discount Amount</label>
                                    <input type="number" name="discount_amount" value={formData.discount_amount === 0 ? '' : formData.discount_amount || ''} onChange={handleInputChange} onWheel={(e) => e.currentTarget.blur()} placeholder="Enter discount amount" />
                                    {errors.discount_amount && <p style={{ color: 'red', fontSize: '12px' }}>{errors.discount_amount}</p>}
                                </div>
                                <div className="form-group">
                                    <label>Discount Reason</label>
                                    <input type="text" name="discount_reason" value={formData.discount_reason || ''} onChange={handleInputChange} />
                                    {errors.discount_reason && <p style={{ color: 'red', fontSize: '12px' }}>{errors.discount_reason}</p>}
                                </div>
                                <button type="button" className="btn-link" onClick={() => {
                                    setShowDiscount(false);
                                    setFormData(prev => ({ ...prev, discount_amount: 0, discount_reason: '' }));
                                    setErrors(prev => ({...prev, discount_amount: undefined, discount_reason: undefined}));
                                }}>
                                    - Clear Discount
                                </button>
                            </>
                        )}
                    </div>

                    <div className="form-section">
                        <h4>Reschedule</h4>
                        <div className="form-group">
                            <label>
                                <input type="checkbox" checked={showReschedule} onChange={(e) => setShowReschedule(e.target.checked)} />
                                Reschedule Booking
                            </label>
                        </div>

                        {showReschedule && (
                            <>
                                <div className="form-group">
                                    <label>
                                        Mark as Rescheduled
                                        <input type="checkbox" checked={isRescheduled} onChange={(e) => setIsRescheduled(e.target.checked)} />
                                    </label>
                                    {errors.reschedule && <p style={{ color: 'red', fontSize: '12px' }}>{errors.reschedule}</p>}
                                </div>

                                <div className="form-group">
                                    <label>New Date:</label>
                                    <input type="date" name="date" value={formData.date ? new Date(formData.date).toISOString().slice(0, 10) : ''} onChange={handleInputChange} min={new Date().toISOString().slice(0, 10)} />
                                </div>
                                <div className="form-group">
                                    <label>New Start Time:</label>
                                    <input type="time" name="startTime" value={formData.startTime || ''} onChange={handleInputChange} />
                                </div>
                                <div className="form-group">
                                    <label>New End Time:</label>
                                    <input type="time" name="endTime" value={formData.endTime || ''} onChange={handleInputChange} />
                                </div>
                                {timeError && <p style={{ color: 'red' }}>{timeError}</p>}
                                {errors.time && <p style={{ color: 'red', fontSize: '12px' }}>{errors.time}</p>}
                            </>
                        )}
                        {availabilityMessage && (
                            <p style={{ color: availabilityMessage.includes('not') ? 'red' : 'green' }}>
                                {availabilityMessage}
                            </p>
                        )}
                    </div>

                    <div className="form-section">
                        <h4>Payments</h4>
                        <p><strong>Total Price:</strong> ₹{formData.total_price}</p>
                        <p><strong>Amount Paid:</strong> ₹{formData.amount_paid}</p>
                        <p><strong>Balance:</strong> ₹{formData.balance_amount}</p>
                        <p><strong>Payment Status:</strong> {formData.payment_status}</p>

                        {formData.payments && formData.payments.length > 0 && (
                            <div className="payment-history">
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

                        <div className="form-group">
                            <h5>Add Payment</h5>
                            <input
                                type="number"
                                placeholder="Amount"
                                value={newPaymentAmount}
                                onChange={(e) => setNewPaymentAmount(e.target.value)}
                                onWheel={(e) => e.currentTarget.blur()}
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

                            <button onClick={handleAddPayment} className="btn-add-payment">Add Payment</button>
                            {errors.newPayment && <p style={{ color: 'red', fontSize: '12px', marginTop: '5px' }}>{errors.newPayment}</p>}
                        </div>
                    </div>

                    {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
                </div>

                <div className="modal-actions">
                    <button onClick={handleSave} className="btn-save" disabled={!!timeError}>Save Changes</button>
                    <button onClick={handleClose} className="btn-cancel">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default EditBookingModal;
