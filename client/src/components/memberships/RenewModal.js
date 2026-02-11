import React, { useState, useMemo, useCallback } from 'react'; // Added useCallback
// Re-use modal styles
import './PackageEditModal.css'; 

const RenewModal = ({ membership, onRenew, onClose, error }) => {
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [discountAmount, setDiscountAmount] = useState(0);
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [onlinePaymentType, setOnlinePaymentType] = useState('UPI'); // New state
    const [paymentId, setPaymentId] = useState('');
    const [errors, setErrors] = useState({}); // New state
    const [submitting, setSubmitting] = useState(false); // Enable submitting state

    // Calculate display price (per person price * current members) for display purposes
    const displayBasePrice = useMemo(() => {
        return (membership?.package_price || 0) * (membership?.current_members_count || 0);
    }, [membership]);

    const displayFinalPrice = useMemo(() => {
        return displayBasePrice - (discountAmount || 0);
    }, [displayBasePrice, discountAmount]);

    // Validation function
    const validateForm = useCallback(() => {
        const newErrors = {};

        if (paymentAmount === '' || paymentAmount === null) {
            newErrors.paymentAmount = 'Amount received is required.';
        } else if (isNaN(paymentAmount) || parseFloat(paymentAmount) < 0) {
            newErrors.paymentAmount = 'Amount received must be a non-negative number.';
        } else if (parseFloat(paymentAmount) > displayFinalPrice) {
            newErrors.paymentAmount = 'Amount received cannot exceed final price.';
        }

        if (isNaN(discountAmount) || parseFloat(discountAmount) < 0) {
            newErrors.discountAmount = 'Discount must be a non-negative number.';
        } else if (parseFloat(discountAmount) > displayBasePrice) {
             newErrors.discountAmount = 'Discount cannot exceed base price.';
        }
        
        if ((parseFloat(discountAmount) > 0) && !membership?.discount_details) { // Check for existing details if this is an edit
            // For renewal, always require reason if discount is applied
            // Assuming we don't have a separate discountReason state for renewal currently,
            // so this part might need adjustment based on full renewal logic if it differs from initial subscription
        }

        if ((paymentMode === 'Online' || paymentMode === 'Cheque') && !paymentId.trim()) {
            newErrors.paymentId = 'Payment ID is required for online/cheque payments.';
        } else if (paymentId && !/^[a-zA-Z0-9]+$/.test(paymentId)) {
            newErrors.paymentId = 'Payment ID must be alphanumeric.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [paymentAmount, displayFinalPrice, discountAmount, displayBasePrice, paymentMode, paymentId, membership?.discount_details]);


    const handleSubmit = async (e) => { // Made async
        e.preventDefault();
        setErrors({}); // Reset errors
        
        if (!validateForm()) {
            return;
        }

        setSubmitting(true);
        try {
            const finalPaymentMode = paymentMode === 'Online' ? onlinePaymentType : paymentMode;
            const finalPaymentId = (paymentMode === 'Online' || paymentMode === 'Cheque') ? paymentId : null;

            await onRenew(membership.id, {
                start_date: startDate,
                // discount_details: `Renewal discount: ${discountAmount}`, // This field doesn't exist on membership directly in backend
                discount_amount: parseFloat(discountAmount) || 0,
                initial_payment: { // Assuming initial_payment is a structure the backend expects
                    amount: parseFloat(paymentAmount) || 0,
                    payment_mode: finalPaymentMode,
                    payment_id: finalPaymentId
                }
            });
            onClose();
        } catch (err) {
            setErrors({ general: err.response?.data?.message || 'Failed to renew membership.' });
            console.error('Failed to renew membership:', err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Renew Membership</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="modal-form">
                    {error && <div className="error-message">{error}</div>}
                    {errors.general && <div className="error-message">{errors.general}</div>}
                    {membership?.balance_amount > 0 && (
                        <div className="error-message">
                            <p><strong>Note:</strong> This membership has an outstanding balance of Rs. {membership.balance_amount}. Please clear the balance before renewing.</p>
                        </div>
                    )}
                    <div className="summary-card" style={{padding: '1rem', marginBottom: '1rem'}}>
                         <p><strong>Package:</strong> {membership?.package_name}</p>
                         <p><strong>Team:</strong> {membership?.team_members}</p>
                         <p><strong>Per Person Price:</strong> Rs. {membership?.package_price || 0}</p>
                         <p><strong>Total for {membership?.current_members_count || 0} Members:</strong> Rs. {displayBasePrice}</p>
                    </div>
                    <div className="form-group">
                        <label>New Start Date</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} required />
                    </div>
                    <div className="form-group">
                        <label>Discount Amount (Rs.)</label>
                        <input type="number" value={discountAmount} onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)} />
                        {errors.discountAmount && <p style={{ color: 'red', fontSize: '12px' }}>{errors.discountAmount}</p>}
                    </div>
                    <p className="final-price" style={{fontSize: '1.1rem', fontWeight: 'bold', margin: '1rem 0'}}><strong>Final Price:</strong> Rs. {displayFinalPrice}</p>
                     <div className="form-group">
                        <label>Amount Received</label>
                        <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} max={displayFinalPrice} required />
                        {errors.paymentAmount && <p style={{ color: 'red', fontSize: '12px' }}>{errors.paymentAmount}</p>}
                    </div>
                     <div className="form-group">
                        <label>Payment Mode</label>
                        <select value={paymentMode} onChange={e => {setPaymentMode(e.target.value); setPaymentId(''); setErrors(prev => ({...prev, paymentId: undefined}));}}>
                            <option value="Cash">Cash</option>
                            <option value="Online">Online</option>
                            <option value="Cheque">Cheque</option>
                        </select>
                    </div>
                    {(paymentMode === 'Online' || paymentMode === 'Cheque') && (
                        <>
                            {paymentMode === 'Online' && (
                                <div className="form-group">
                                    <label>Online Payment Type</label>
                                    <select value={onlinePaymentType} onChange={e => setOnlinePaymentType(e.target.value)}>
                                        <option value="UPI">UPI</option>
                                        <option value="Card">Card</option>
                                        <option value="Net Banking">Net Banking</option>
                                    </select>
                                </div>
                            )}
                            <div className="form-group">
                                <label>Payment ID {paymentMode === 'Cheque' ? '(Cheque No.)' : ''}</label>
                                <input type="text" value={paymentId} onChange={e => setPaymentId(e.target.value)} required={paymentMode !== 'Cash'} />
                                {errors.paymentId && <p style={{ color: 'red', fontSize: '12px' }}>{errors.paymentId}</p>}
                            </div>
                        </>
                    )}
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting || membership?.balance_amount > 0}>Renew Subscription</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RenewModal;
