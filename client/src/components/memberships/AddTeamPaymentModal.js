import React, { useState, useCallback, useMemo } from 'react';
import api from '../../api';
import './PackageEditModal.css'; // Re-use styles

const AddTeamPaymentModal = ({ group, onPaymentAdded, onClose, error }) => {
    const [amount, setAmount] = useState('');
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [onlinePaymentType, setOnlinePaymentType] = useState('UPI');
    const [paymentId, setPaymentId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    // Calculate total balance across all active members in the group
    const totalBalance = useMemo(() => {
        return group.members
            .filter(mem => mem.status === 'active' || mem.status === 'ended' || mem.status === 'Expired') // Wait, we just check balance
            .reduce((sum, mem) => sum + parseFloat(mem.balance_amount || 0), 0);
    }, [group]);

    const activeMembersCount = useMemo(() => {
        return group.members.filter(mem => parseFloat(mem.balance_amount || 0) > 0).length;
    }, [group]);


    // Validation function
    const validateForm = useCallback(() => {
        const newErrors = {};

        if (amount === '' || amount === null) {
            newErrors.amount = 'Amount is required.';
        } else if (isNaN(amount) || parseFloat(amount) <= 0) {
            newErrors.amount = 'Amount must be a positive number.';
        } else if (parseFloat(amount) > totalBalance) {
            newErrors.amount = `Amount cannot exceed total team balance (Rs. ${totalBalance}).`;
        }

        if ((paymentMode === 'Online' || paymentMode === 'Cheque') && !paymentId.trim()) {
            newErrors.paymentId = 'Payment ID is required for online/cheque payments.';
        } else if (paymentId && !/^[a-zA-Z0-9]+$/.test(paymentId)) {
            newErrors.paymentId = 'Payment ID must be alphanumeric.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [amount, totalBalance, paymentMode, paymentId]);


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
            await api.post(`/memberships/team-payments/${group.team_id}`, payload);
            alert('Team payment distributed successfully!');
            onPaymentAdded(); // Trigger a refetch
            onClose();
        } catch (err) {
            setErrors({ general: err.response?.data?.message || 'Failed to process team payment.' });
            console.error('Failed to add team payment:', err);
        } finally {
            setSubmitting(false);
        }
    };

    if (totalBalance <= 0) {
         return (
             <div className="modal-overlay">
                 <div className="modal-content">
                     <div className="modal-header">
                         <h2>Add Bulk Payment for Team</h2>
                         <button onClick={onClose} className="close-button">&times;</button>
                     </div>
                     <div style={{ padding: '20px', textAlign: 'center' }}>
                         <p>There are no outstanding balances for any active members in this team.</p>
                         <button className="btn btn-secondary" onClick={onClose}>Close</button>
                     </div>
                 </div>
             </div>
         );
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Add Bulk Payment for Team: {group.team_name}</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="modal-form">
                    {error && <div className="error-message">{error}</div>}
                    {errors.general && <div className="error-message">{errors.general}</div>}
                    
                    <div className="summary-card" style={{padding: '1rem', marginBottom: '1rem', backgroundColor: '#e9ecef', borderRadius: '8px'}}>
                         <p><strong>Team:</strong> {group.team_name || 'Individual / No Team'}</p>
                         <p><strong>Members with Balance:</strong> {activeMembersCount}</p>
                         <p style={{ fontWeight: 'bold', color: '#dc3545', fontSize: '18px', marginTop: '10px' }}>
                            <strong>Total Team Balance:</strong> Rs. {totalBalance}
                         </p>
                         <p style={{ fontSize: '12px', color: '#555' }}>
                            The payment amount will be automatically distributed across members' individual balances until exhausted.
                         </p>
                    </div>

                    <div className="form-group">
                        <label>Lump Sum Payment Amount</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            max={totalBalance}
                            min="1"
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
                            {submitting ? 'Processing...' : 'Submit Bulk Payment'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddTeamPaymentModal;
