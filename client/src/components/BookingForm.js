import React, { useState, useEffect, useMemo } from 'react'; // ✅ Added useMemo here
import api from '../api';
import ConfirmationModal from './ConfirmationModal';
// Assuming Dashboard.css is imported globally or in the parent component

const BookingForm = ({ courts, selectedDate, startTime, endTime, onBookingSuccess, user }) => {
    // --- State Variables ---
    const [courtId, setCourtId] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerContact, setCustomerContact] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [onlinePaymentType, setOnlinePaymentType] = useState('UPI');
    const [paymentId, setPaymentId] = useState('');
    const [amountPaid, setAmountPaid] = useState('');
    const [totalPrice, setTotalPrice] = useState(0);
    const [balance, setBalance] = useState(0);
    const [message, setMessage] = useState('');
    const [slotsBooked, setSlotsBooked] = useState(1);
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [lastBooking, setLastBooking] = useState(null);
    const [discountAmount, setDiscountAmount] = useState('');
    const [discountReason, setDiscountReason] = useState('');
    const [showDiscount, setShowDiscount] = useState(false);
    const [accessories, setAccessories] = useState([]);
    const [selectedAccessories, setSelectedAccessories] = useState([]);
    const [showAccessories, setShowAccessories] = useState(false);
    const [errors, setErrors] = useState({});

    // --- Effects ---
    useEffect(() => {
        const fetchAccessories = async () => {
            try {
                const res = await api.get('/accessories');
                setAccessories(res.data || []);
            } catch (error) {
                console.error("Error fetching accessories:", error);
                setAccessories([]);
            }
        };
        fetchAccessories();
    }, []);

    useEffect(() => {
        const calculatePrice = async () => {
            if (courtId && startTime && endTime) {
                const selectedCourt = courts.find(c => c.id === parseInt(courtId));
                if (!selectedCourt) return;

                try {
                    const res = await api.post('/bookings/calculate-price', {
                        sport_id: selectedCourt.sport_id,
                        startTime,
                        endTime,
                        slots_booked: slotsBooked
                    });
                    let baseCourtPrice = res.data.total_price || 0; // This is the base court price from backend

                    // Calculate total price from selected accessories
                    const accessoriesTotal = selectedAccessories.reduce((total, acc) => {
                        const accessoryDetails = accessories.find(a => a.id === acc.id);
                        return total + ((accessoryDetails?.price || 0) * acc.quantity);
                    }, 0);
                    
                    // totalPrice to display (undiscounted court + accessories)
                    const undiscountedTotalPrice = baseCourtPrice + accessoriesTotal;
                    setTotalPrice(undiscountedTotalPrice); 

                    const currentDiscount = parseFloat(discountAmount) || 0;
                    // Effective total for balance calculation (discounted court + accessories)
                    const effectiveTotalForBalance = (baseCourtPrice - currentDiscount) + accessoriesTotal;

                    // Recalculate balance whenever price, discount, or amount paid changes
                    const currentAmountPaid = parseFloat(amountPaid) || 0;
                    setBalance(effectiveTotalForBalance - currentAmountPaid); // Balance uses the effective total

                } catch (error) {
                    console.error("Error calculating price:", error);
                    setTotalPrice(0);
                    setBalance(0);
                }
            } else {
                setTotalPrice(0);
                setBalance(0);
            }
        };

        const handler = setTimeout(calculatePrice, 300);
        return () => clearTimeout(handler);

    }, [courtId, startTime, endTime, courts, slotsBooked, selectedAccessories, amountPaid, discountAmount, accessories]);

    useEffect(() => {
        const currentAmountPaid = parseFloat(amountPaid) || 0;
        const currentDiscount = parseFloat(discountAmount) || 0;
        setBalance(totalPrice - currentDiscount - currentAmountPaid);
    }, [amountPaid, discountAmount, totalPrice]);

    // --- Handlers ---
    const handleAmountChange = (setter) => (e) => setter(e.target.value);

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

    const validateForm = () => {
        const newErrors = {};

        if (!customerName.trim()) {
            newErrors.customerName = 'Customer name is required.';
        }

        if (!customerContact.trim()) {
            newErrors.customerContact = 'Phone number is required.';
        } else if (!/^\d{10}$/.test(customerContact)) {
            newErrors.customerContact = 'Phone number must be exactly 10 digits.';
        }

        if (amountPaid === '' || amountPaid === null) {
            newErrors.amountPaid = 'Amount paid is required.';
        } else if (isNaN(amountPaid) || amountPaid < 0) {
            newErrors.amountPaid = 'Please enter a valid amount.';
        }

        if ((discountAmount > 0) && !discountReason.trim()) {
            newErrors.discountReason = 'Discount reason is required when a discount is applied.';
        }

        if (customerEmail && !/\S+@\S+\.\S+/.test(customerEmail)) {
            newErrors.customerEmail = 'Please enter a valid email address.';
        }

        if (!courtId) {
            newErrors.courtId = 'Please select a court.';
        }

        if (slotsBooked === '' || slotsBooked === null || isNaN(slotsBooked) || slotsBooked <= 0) {
            newErrors.slotsBooked = 'Please enter a valid number of slots.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };


    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            setMessage('Please fix the errors before submitting.');
            return;
        }

        setMessage('');

        const finalPaymentMethod = paymentMethod === 'Online' ? onlinePaymentType : paymentMethod;
        const finalPaymentId = paymentMethod === 'Online' ? paymentId : null;

        try {
            const res = await api.post('/bookings', {
                court_id: parseInt(courtId),
                customer_name: customerName,
                customer_contact: customerContact,
                customer_email: customerEmail,
                date: selectedDate,
                startTime: startTime,
                endTime: endTime,
                payment_mode: finalPaymentMethod,
                payment_id: finalPaymentId,
                amount_paid: parseFloat(amountPaid) || 0,
                slots_booked: parseInt(slotsBooked) || 1,
                discount_amount: parseFloat(discountAmount) || 0,
                discount_reason: discountReason,
                accessories: selectedAccessories.map(a => ({ accessory_id: a.id, quantity: a.quantity }))
            });

            setLastBooking(res.data);
            setIsConfirmationModalOpen(true);
            setMessage('Booking created successfully!');

            setCourtId(''); setCustomerName(''); setCustomerContact(''); setCustomerEmail('');
            setAmountPaid(''); setDiscountAmount(''); setDiscountReason('');
            setShowDiscount(false); setShowAccessories(false); setSelectedAccessories([]);
            setPaymentMethod('Cash'); setOnlinePaymentType('UPI'); setPaymentId('');
            setSlotsBooked('');
            setErrors({});

            onBookingSuccess();
        } catch (err) {
            setMessage(err.response?.data?.message || 'Error creating booking');
        }
    };

    const selectedCourtDetails = useMemo(() => {
        return courts.find(c => c.id === parseInt(courtId));
    }, [courtId, courts]);

    return (
        <>
            <form onSubmit={handleSubmit} className="booking-form">
                {message && <p className={`message ${message.includes('Error') ? 'error' : 'success'}`}>{message}</p>}

                <div className="form-group">
                    <label>Court</label>
                    <select value={courtId} onChange={(e) => setCourtId(e.target.value)} required>
                        <option value="">Select an Available Court</option>
                        {courts.map(court => (
                            <option key={court.id} value={court.id}>{court.name} ({court.sport_name})</option>
                        ))}
                    </select>
                    {errors.courtId && <p style={{ color: 'red', fontSize: '12px' }}>{errors.courtId}</p>}
                </div>

                {selectedCourtDetails?.sport_name?.toLowerCase() === 'swimming' && (
                    <div className="form-group">
                        <label>Number of People (Slots)</label>
                        <input
                            type="number"
                            value={slotsBooked}
                            onChange={(e) => setSlotsBooked(e.target.value)}
                            min="1"
                            placeholder="Enter number of people"
                            required
                        />
                        {selectedCourtDetails.available_slots !== undefined && slotsBooked > selectedCourtDetails.available_slots && (
                             <p style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>Exceeds capacity ({selectedCourtDetails.available_slots} available)</p>
                        )}
                        {errors.slotsBooked && <p style={{ color: 'red', fontSize: '12px' }}>{errors.slotsBooked}</p>}
                    </div>
                )}

                <div className="form-group">
                    <label>Customer Name</label>
                    <input type="text" value={customerName} onChange={handleAmountChange(setCustomerName)} required />
                    {errors.customerName && <p style={{ color: 'red', fontSize: '12px' }}>{errors.customerName}</p>}
                </div>

                <div className="form-group">
                    <label>Customer Contact</label>
                    <input type="text" value={customerContact} onChange={handleAmountChange(setCustomerContact)} required />
                    {errors.customerContact && <p style={{ color: 'red', fontSize: '12px' }}>{errors.customerContact}</p>}
                </div>

                <div className="form-group">
                    <label>Customer Email (Optional)</label>
                    <input type="email" value={customerEmail} onChange={handleAmountChange(setCustomerEmail)} />
                    {errors.customerEmail && <p style={{ color: 'red', fontSize: '12px' }}>{errors.customerEmail}</p>}
                </div>

                 {!showAccessories ? (
                    <div className="form-group">
                        <button
                            type="button"
                            className="btn-add-discount" // Reusing the class for consistent styling
                            onClick={() => setShowAccessories(true)}
                        >
                            + Add Accessories
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="form-group accessories-selector">
                             <label>Select Accessories</label>
                             <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                                <select id="accessory-select-input" defaultValue="">
                                     <option value="" disabled>Choose...</option>
                                     {accessories.map(acc => (
                                         <option key={acc.id} value={acc.id}>
                                             {acc.name} - ₹{acc.price}
                                         </option>
                                     ))}
                                </select>
                                <button type="button" className="btn btn-secondary" style={{ flexShrink: 0, padding: '8px 12px', marginTop: 0 }}
                                    onClick={() => {
                                        const selectEl = document.getElementById('accessory-select-input');
                                        if (selectEl.value) {
                                            handleAddSelectedAccessory(parseInt(selectEl.value));
                                            selectEl.value = "";
                                        }
                                    }}>
                                    Add
                                </button>
                             </div>
                             {selectedAccessories.length > 0 && (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '14px' }}>
                                    {selectedAccessories.map((acc, index) => {
                                        const details = accessories.find(a => a.id === acc.id);
                                        return (
                                            <li key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                                <span>{details?.name || 'Unknown'} (x{acc.quantity})</span>
                                                <button type="button" onClick={() => handleRemoveAccessory(acc.id)} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer', fontSize: '16px' }}>&times;</button>
                                            </li>
                                        );
                                    })}<button type="button" className="btn-link" onClick={() => setShowAccessories(false)}>
                                    - Remove Accessories
                                </button>
                                </ul>
                             )}
                        </div>
                    </>
                )}

                <div className="form-group">
                    <label>Total Price</label>
                    <input type="number" value={totalPrice.toFixed(2)} readOnly style={{ backgroundColor: '#e9ecef', fontWeight: 'bold' }} />
                </div>

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
                            <input type="number" value={discountAmount} onChange={handleAmountChange(setDiscountAmount)} placeholder="0.00" />
                        </div>
                        <div className="form-group">
                            <label>Discount Reason</label>
                            <input type="text" value={discountReason} onChange={handleAmountChange(setDiscountReason)} />
                            {errors.discountReason && <p style={{ color: 'red', fontSize: '12px' }}>{errors.discountReason}</p>}
                        </div>
                        <button type="button" className="btn-link" onClick={() => setShowDiscount(false)}>
                            - Remove Discount
                        </button>
                    </>
                )}

                <div className="form-group">
                    <label>Amount Paid</label>
                    <input type="number" value={amountPaid} onChange={handleAmountChange(setAmountPaid)} placeholder="0.00" required />
                    {errors.amountPaid && <p style={{ color: 'red', fontSize: '12px' }}>{errors.amountPaid}</p>}
                </div>

                <div className="form-group">
                    <label>Balance</label>
                    <input type="number" value={balance.toFixed(2)} readOnly style={{ backgroundColor: '#e9ecef', fontWeight: 'bold' }} />
                </div>

                <div className="form-group">
                    <label>Payment Method</label>
                    <select value={paymentMethod} onChange={handleAmountChange(setPaymentMethod)}>
                        <option value="Cash">Cash</option>
                        <option value="Online">Online</option>
                        <option value="Cheque">Cheque</option>
                    </select>
                </div>

                {(paymentMethod === 'Online' || paymentMethod === 'Cheque') && (
                    <>
                        {paymentMethod === 'Online' && (
                            <div className="form-group">
                                <label>Online Payment Type</label>
                                 <select value={onlinePaymentType} onChange={handleAmountChange(setOnlinePaymentType)}>
                                    <option value="UPI">UPI</option>
                                    <option value="Card">Card</option>
                                    <option value="Net Banking">Net Banking</option>
                                </select>
                            </div>
                        )}
                         <div className="form-group">
                            <label>Payment ID / Cheque ID</label>
                            <input type="text" value={paymentId} onChange={handleAmountChange(setPaymentId)} />
                        </div>
                    </>
                )}

                <button type="submit" className="btn btn-primary">
                    Create Booking
                </button>
            </form>

            {isConfirmationModalOpen && (
                <ConfirmationModal
                    booking={lastBooking}
                    onClose={() => setIsConfirmationModalOpen(false)}
                    onCreateNew={() => setIsConfirmationModalOpen(false)}
                />
            )}
        </>
    );
};

export default BookingForm;