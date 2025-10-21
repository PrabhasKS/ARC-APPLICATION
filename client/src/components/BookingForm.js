import React, { useState, useEffect } from 'react';
import api from '../api';
import ConfirmationModal from './ConfirmationModal';

const BookingForm = ({ courts, selectedDate, startTime, endTime, onBookingSuccess, user }) => {
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };
    const [courtId, setCourtId] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerContact, setCustomerContact] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [onlinePaymentType, setOnlinePaymentType] = useState('UPI');
    const [paymentId, setPaymentId] = useState('');
    const [amountPaid, setAmountPaid] = useState(0);
    const [totalPrice, setTotalPrice] = useState(0);
    const [balance, setBalance] = useState(0);
    const [message, setMessage] = useState('');
    const [slotsBooked, setSlotsBooked] = useState(1);
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [lastBooking, setLastBooking] = useState(null);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [discountPercentage, setDiscountPercentage] = useState(0);
    const [discountReason, setDiscountReason] = useState('');
    const [showDiscount, setShowDiscount] = useState(false);

    const [accessories, setAccessories] = useState([]);
    const [selectedAccessories, setSelectedAccessories] = useState([]);
    const [showAccessories, setShowAccessories] = useState(false);

    // ✅ FIX #1: This effect fetches accessories only ONCE when the component loads.
    // It doesn't depend on customer details, so the dependency array should be empty.
    useEffect(() => {
        const fetchAccessories = async () => {
            try {
                const res = await api.get('/accessories');
                setAccessories(res.data);
            } catch (error) {
                console.error("Error fetching accessories:", error);
            }
        };
        fetchAccessories();
    }, []); // <-- Dependency array is now correctly empty

    // ✅ FIX #2: THIS was the real source of the warning.
    // This effect needs to run when customer details change to decide if it should reset the court.
    useEffect(() => {
        if (!customerName && !customerContact && !customerEmail) {
            setCourtId('');
        }
    }, [courts, customerName, customerContact, customerEmail]); // <-- Added missing dependencies here

    // Debounced effect for calculating price (This one was already correct)
    useEffect(() => {
        const calculatePrice = async () => {
            if (courtId && startTime && endTime) {
                const selectedCourt = courts.find(c => c.id === parseInt(courtId));
                if (!selectedCourt) return;

                const start = new Date(`1970-01-01T${startTime}`);
                const end = new Date(`1970-01-01T${endTime}`);
                if (end <= start) {
                    setTotalPrice(0);
                    setAmountPaid(0);
                    setBalance(0);
                    return;
                }

                try {
                    const res = await api.post('/bookings/calculate-price', {
                        sport_id: selectedCourt.sport_id,
                        startTime,
                        endTime,
                        slots_booked: slotsBooked
                    });
                    let newTotalPrice = res.data.total_price || 0;

                    const accessoriesTotal = selectedAccessories.reduce((total, acc) => total + (acc.price * acc.quantity), 0);
                    newTotalPrice += accessoriesTotal;

                    setTotalPrice(newTotalPrice);
                    setAmountPaid(0);
                    setBalance(newTotalPrice);
                } catch (error) {
                    console.error("Error calculating price:", error);
                    setTotalPrice(0);
                    setAmountPaid(0);
                    setBalance(0);
                }
            }
        };

        const handler = setTimeout(() => {
            calculatePrice();
        }, 300);

        return () => {
            clearTimeout(handler);
        };
    }, [courtId, startTime, endTime, courts, slotsBooked, selectedAccessories]);

    const handleAmountPaidChange = (e) => {
        const newAmountPaid = parseFloat(e.target.value) || 0;
        setAmountPaid(newAmountPaid);
    };

    const handleDiscountPercentageChange = (e) => {
        const percentage = parseFloat(e.target.value) || 0;
        setDiscountPercentage(percentage);
        const newDiscountAmount = (percentage / 100) * totalPrice;
        setDiscountAmount(newDiscountAmount);
    };

    const handleDiscountAmountChange = (e) => {
        const amount = parseFloat(e.target.value) || 0;
        setDiscountAmount(amount);
        if (totalPrice > 0) {
            const newDiscountPercentage = (amount / totalPrice) * 100;
            setDiscountPercentage(newDiscountPercentage);
        }
    };

    // This effect correctly recalculates the balance whenever its dependencies change
    useEffect(() => {
        const newBalance = totalPrice - discountAmount - amountPaid;
        setBalance(newBalance);
    }, [totalPrice, discountAmount, amountPaid]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!courtId) {
            setMessage('Please select a court.');
            return;
        }
        if (totalPrice <= 0) {
            setMessage('Cannot create a booking with zero or negative price. Please check the times.');
            return;
        }

        const finalPaymentMethod = paymentMethod === 'Online' ? onlinePaymentType : paymentMethod;
        const finalPaymentId = paymentMethod === 'Online' ? paymentId : null;

        try {
            const res = await api.post('/bookings', {
                court_id: courtId,
                customer_name: customerName,
                customer_contact: customerContact,
                customer_email: customerEmail,
                date: selectedDate,
                startTime: startTime,
                endTime: endTime,
                payment_mode: finalPaymentMethod,
                payment_id: finalPaymentId,
                amount_paid: amountPaid,
                slots_booked: slotsBooked,
                discount_amount: discountAmount,
                discount_reason: discountReason,
                accessories: selectedAccessories.map(a => ({ accessory_id: a.id, quantity: a.quantity }))
            });
            setLastBooking(res.data);
            setIsConfirmationModalOpen(true);
            
            // Reset form fields after successful submission
            setCustomerName('');
            setCustomerContact('');
            setCustomerEmail('');
            setPaymentMethod('Cash');
            setOnlinePaymentType('UPI');
            setPaymentId('');
            setAmountPaid(0);
            setTotalPrice(0);
            setBalance(0);
            setCourtId('');
            setDiscountAmount(0);
            setDiscountPercentage(0);
            setDiscountReason('');
            setShowDiscount(false);
            setSelectedAccessories([]);
            setShowAccessories(false);
            onBookingSuccess();
        } catch (err) {
            setMessage(err.response?.data?.message || 'Error creating booking');
        }
    };

    // --- JSX Return ---
    // (Your return statement with the form UI is unchanged)
    return (
        <>
            <div style={{ maxHeight: '80vh', overflowY: 'auto', padding: '20px' }}>
            <form onSubmit={handleSubmit}>
                {message && <p>{message}</p>}
                <p>Booking for: <strong>{formatDate(selectedDate)}</strong> from <strong>{startTime}</strong> to <strong>{endTime}</strong></p>
                <div>
                    <label>Court</label>
                    <select value={courtId} onChange={(e) => setCourtId(e.target.value)} required>
                        <option value="">Select an Available Court</option>
                        {courts.map(court => (
                            <option key={court.id} value={court.id}>{court.name} ({court.sport_name}) {court.available_slots ? `(${court.available_slots} slots available)` : ''}</option>
                        ))}
                    </select>
                </div>
                {courts.find(c => c.id === parseInt(courtId) && c.sport_name === 'Swimming') && (
                    <div>
                        <label>Number of People</label>
                        <input type="number" value={slotsBooked} onChange={(e) => setSlotsBooked(e.target.value)} min="1" required />
                        {courts.find(c => c.id === parseInt(courtId))?.available_slots < slotsBooked && (
                            <p style={{ color: 'red' }}>Not Available: Exceeds capacity</p>
                        )}
                    </div>
                )}
                <div>
                    <label>Customer Name</label>
                    <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                </div>
                <div>
                    <label>Customer Contact</label>
                    <input type="text" value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} required />
                </div>
                <div>
                    <label>Customer Email (Optional)</label>
                    <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                </div>
                
                <div>
                    <label>Total Price</label>
                    <input type="number" value={totalPrice} readOnly style={{ backgroundColor: '#f0f0f0' }} />
                </div>

                <div>
                    <label>
                        <input type="checkbox" checked={showDiscount} onChange={(e) => setShowDiscount(e.target.checked)} />
                        Add Discount
                    </label>
                </div>

                {showDiscount && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label>Discount (%)</label>
                            <input type="number" value={discountPercentage} onChange={handleDiscountPercentageChange} style={{ width: '100%' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label>Discount (Price)</label>
                            <input type="number" value={discountAmount} onChange={handleDiscountAmountChange} style={{ width: '100%' }} />
                        </div>
                    </div>
                )}

                {showDiscount && (
                    <div>
                        <label>Reason for Discount</label>
                        <input type="text" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} />
                    </div>
                )}

                <div>
                    <label>
                        <input type="checkbox" checked={showAccessories} onChange={(e) => setShowAccessories(e.target.checked)} />
                        Add Accessories
                    </label>
                </div>

                {showAccessories && (
                    <div>
                        <h4>Accessories</h4>
                        <div>
                            <select id="accessory-select">
                                <option value="">Select an accessory</option>
                                {accessories.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name} - Rs. {acc.price}</option>
                                ))}
                            </select>
                            <input type="number" id="accessory-quantity" defaultValue="1" min="1" />
                            <button type="button" onClick={() => {
                                const select = document.getElementById('accessory-select');
                                const quantityInput = document.getElementById('accessory-quantity');
                                const accessoryId = parseInt(select.value);
                                const quantity = parseInt(quantityInput.value);
                                if (accessoryId && quantity > 0) {
                                    const accessory = accessories.find(a => a.id === accessoryId);
                                    setSelectedAccessories([...selectedAccessories, { ...accessory, quantity }]);
                                }
                            }}>Add</button>
                        </div>
                        <ul>
                            {selectedAccessories.map((acc, index) => (
                                <li key={index}>{acc.name} (x{acc.quantity}) - Rs. {acc.price * acc.quantity}
                                    <button type="button" onClick={() => {
                                        const newSelected = [...selectedAccessories];
                                        newSelected.splice(index, 1);
                                        setSelectedAccessories(newSelected);
                                    }}>Remove</button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}


                {/* New Payment Section */}
                <div>
                    <label>Payment Method</label>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} required>
                        <option value="Cash">Cash</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Online">Online</option>
                    </select>
                </div>

                {paymentMethod === 'Online' && (
                    <>
                        <div>
                            <label>Online Payment Type</label>
                            <select value={onlinePaymentType} onChange={(e) => setOnlinePaymentType(e.target.value)} required>
                                <option value="UPI">UPI</option>
                                <option value="Card">Card</option>
                                <option value="Internet Banking">Internet Banking</option>
                            </select>
                        </div>
                        <div>
                            <label>Payment ID</label>
                            <input type="text" value={paymentId} onChange={(e) => setPaymentId(e.target.value)} required />
                        </div>
                    </>
                )}
                {/* End of New Payment Section */}

                <div>
                    <label>Amount Paid</label>
                    <input type="number" value={amountPaid} onChange={handleAmountPaidChange} required />
                </div>
                <div>
                    <label>Balance</label>
                    <input type="number" value={balance} readOnly style={{ backgroundColor: '#f0f0f0' }} />
                </div>
                <button type="submit">Create Booking</button>
            </form>
            </div>
            {isConfirmationModalOpen && (
                <ConfirmationModal 
                    booking={lastBooking}
                    onClose={() => {
                        console.log('Close button clicked');
                        setIsConfirmationModalOpen(false);
                    }}
                    onCreateNew={() => {
                        console.log('Create New Booking button clicked');
                        setIsConfirmationModalOpen(false);
                    }}
                />
            )}
        </>
    );
};

export default BookingForm;
