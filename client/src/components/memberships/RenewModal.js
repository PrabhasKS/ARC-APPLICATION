import React, { useState, useMemo } from 'react';
// Re-use modal styles
import './PackageEditModal.css'; 

const RenewModal = ({ membership, onRenew, onClose, error }) => {
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [discountAmount, setDiscountAmount] = useState(0);
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentMode, setPaymentMode] = useState('Cash');

    const originalPrice = membership?.package_price || 0;
    const finalPrice = useMemo(() => originalPrice - discountAmount, [originalPrice, discountAmount]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onRenew(membership.id, {
            start_date: startDate,
            final_price: finalPrice,
            discount_details: `Renewal discount: ${discountAmount}`,
            initial_payment: {
                amount: paymentAmount,
                payment_mode: paymentMode
            }
        });
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
                    <div className="summary-card" style={{padding: '1rem', marginBottom: '1rem'}}>
                         <p><strong>Package:</strong> {membership?.package_name}</p>
                         <p><strong>Team:</strong> {membership?.team_members}</p>
                         <p><strong>Original Price:</strong> Rs. {originalPrice}</p>
                    </div>
                    <div className="form-group">
                        <label>New Start Date</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} required />
                    </div>
                    <div className="form-group">
                        <label>Discount Amount (Rs.)</label>
                        <input type="number" value={discountAmount} onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)} />
                    </div>
                    <p className="final-price" style={{fontSize: '1.1rem', fontWeight: 'bold', margin: '1rem 0'}}><strong>Final Price:</strong> Rs. {finalPrice}</p>
                     <div className="form-group">
                        <label>Amount Received</label>
                        <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} max={finalPrice} required />
                    </div>
                     <div className="form-group">
                        <label>Payment Mode</label>
                        <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                            <option>Cash</option>
                            <option>Card</option>
                            <option>Online</option>
                        </select>
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
