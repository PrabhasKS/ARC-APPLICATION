import React, { useState, useCallback } from 'react';
import api from '../../api';
import './PackageEditModal.css'; // Re-use styles

const AddMembershipPaymentModal = ({ membership, onPaymentAdded, onClose, error }) => {
    const [amount, setAmount] = useState('');
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [onlinePaymentType, setOnlinePaymentType] = useState('UPI'); // New state
    const [paymentId, setPaymentId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({}); // New state

    // Validation function
    const validateForm = useCallback(() => {
        const newErrors = {};

        if (amount === '' || amount === null) {
            newErrors.amount = 'Amount is required.';
        } else if (isNaN(amount) || parseFloat(amount) < 0) {
            newErrors.amount = 'Amount must be a non-negative number.';
        } else if (parseFloat(amount) > membership.balance_amount) {
            newErrors.amount = `Amount cannot exceed balance amount (Rs. ${membership.balance_amount}).`;
        }

        if ((paymentMode === 'Online' || paymentMode === 'Cheque') && !paymentId.trim()) {
            newErrors.paymentId = 'Payment ID is required for online/cheque payments.';
        } else if (paymentId && !/^[a-zA-Z0-9]+$/.test(paymentId)) {
            newErrors.paymentId = 'Payment ID must be alphanumeric.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [amount, membership.balance_amount, paymentMode, paymentId]);


    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({}); // Reset errors

        if (!validateForm()) {
            return;
        }
        
        setSubmitting(true);
        try {
            const finalPaymentMode = paymentMode === 'Online' ? onlinePaymentType : paymentMode;
            const finalPaymentId = (paymentMode === 'Online' || paymentMode === 'Cheque') ? paymentId : null;

            const payload = {
                amount: parseFloat(amount),
                payment_mode: finalPaymentMode,
                payment_id: finalPaymentId,
            };
            const response = await api.post(`/memberships/active/${membership.id}/payments`, payload);
            alert('Payment added successfully!');
            onPaymentAdded(response.data.membership); // Pass the updated membership back to the parent
            onClose();
        } catch (err) {
            setErrors({ general: err.response?.data?.message || 'Failed to add payment.' });
            console.error('Failed to add payment:', err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Add Payment for Team ID: {membership.id}</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="modal-form">
                    {error && <div className="error-message">{error}</div>}
                    {errors.general && <div className="error-message">{errors.general}</div>}
                    
                    <div className="summary-card" style={{padding: '1rem', marginBottom: '1rem'}}>
                         <p><strong>Package:</strong> {membership.package_name}</p>
                         <p><strong>Total Price:</strong> Rs. {membership.final_price}</p>
                         <p><strong>Amount Paid:</strong> Rs. {membership.amount_paid}</p>
                         <p style={{ fontWeight: 'bold', color: '#dc3545' }}>
                            <strong>Balance Amount:</strong> Rs. {membership.balance_amount}
                         </p>
                    </div>

                    <div className="form-group">
                        <label>Payment Amount</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            max={membership.balance_amount}
                            min="0.01"
                            step="0.01"
                            required
                        />
                        {errors.amount && <p style={{ color: 'red', fontSize: '12px' }}>{errors.amount}</p>}
                    </div>
                    <div className="form-group">
                        <label>Payment Mode</label>
                        <select value={paymentMode} onChange={(e) => {setPaymentMode(e.target.value); setPaymentId(''); setErrors(prev => ({...prev, paymentId: undefined}))}} required>
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
                                    <select value={onlinePaymentType} onChange={(e) => setOnlinePaymentType(e.target.value)}>
                                        <option value="UPI">UPI</option>
                                        <option value="Card">Card</option>
                                        <option value="Net Banking">Net Banking</option>
                                    </select>
                                </div>
                            )}
                            <div className="form-group">
                                <label>Payment ID {paymentMode === 'Cheque' ? '(Cheque No.)' : ''}</label>
                                <input
                                    type="text"
                                    value={paymentId}
                                    onChange={(e) => setPaymentId(e.target.value)}
                                    required={paymentMode !== 'Cash'}
                                />
                                {errors.paymentId && <p style={{ color: 'red', fontSize: '12px' }}>{errors.paymentId}</p>}
                            </div>
                        </>
                    )}

                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                            {submitting ? 'Submitting...' : 'Submit Payment'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddMembershipPaymentModal;

