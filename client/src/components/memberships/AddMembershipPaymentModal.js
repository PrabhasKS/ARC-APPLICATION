import React, { useState } from 'react';
import api from '../../api';
import './PackageEditModal.css'; // Re-use styles

const AddMembershipPaymentModal = ({ membership, onPaymentAdded, onClose, error }) => {
    const [amount, setAmount] = useState('');
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [paymentId, setPaymentId] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount || parseFloat(amount) <= 0) {
            alert('Please enter a valid payment amount.');
            return;
        }
        setSubmitting(true);
        try {
            const payload = {
                amount: parseFloat(amount),
                payment_mode: paymentMode,
                payment_id: paymentId,
            };
            const response = await api.post(`/memberships/active/${membership.id}/payments`, payload);
            alert('Payment added successfully!');
            onPaymentAdded(response.data.membership); // Pass the updated membership back to the parent
            onClose();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to add payment.');
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
                    </div>
                    <div className="form-group">
                        <label>Payment Mode</label>
                        <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} required>
                            <option>Cash</option>
                            <option>Card</option>
                            <option>Online</option>
                            <option>Cheque</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Payment ID (Optional)</label>
                        <input
                            type="text"
                            value={paymentId}
                            onChange={(e) => setPaymentId(e.target.value)}
                        />
                    </div>

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
