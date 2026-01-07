import React, { useState, useMemo } from 'react';
// Re-use modal styles
import './PackageEditModal.css'; 

const RenewModal = ({ membership, onRenew, onClose, error }) => {
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [discountAmount, setDiscountAmount] = useState(0);
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [paymentId, setPaymentId] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onRenew(membership.id, {
            start_date: startDate,
            discount_details: `Renewal discount: ${discountAmount}`,
            discount_amount: discountAmount,
            initial_payment: {
                amount: paymentAmount,
                payment_mode: paymentMode,
                payment_id: paymentId
            }
        });
    };

    // Calculate display price (per person price * current members) for display purposes
    const displayBasePrice = useMemo(() => {
        return (membership?.package_price || 0) * (membership?.current_members_count || 0);
    }, [membership]);

    const displayFinalPrice = useMemo(() => {
        return displayBasePrice - (discountAmount || 0);
    }, [displayBasePrice, discountAmount]);


    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Renew Membership</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="modal-form">
                    {error && <div className="error-message">{error}</div>}
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
                    </div>
                    <p className="final-price" style={{fontSize: '1.1rem', fontWeight: 'bold', margin: '1rem 0'}}><strong>Final Price:</strong> Rs. {displayFinalPrice}</p>
                     <div className="form-group">
                        <label>Amount Received</label>
                        <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} max={displayFinalPrice} required />
                    </div>
                     <div className="form-group">
                        <label>Payment Mode</label>
                        <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                            <option>Cash</option>
                            <option>Card</option>
                            <option>Online</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Payment ID (Optional)</label>
                        <input type="text" value={paymentId} onChange={e => setPaymentId(e.target.value)} />
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Renew Subscription</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RenewModal;
