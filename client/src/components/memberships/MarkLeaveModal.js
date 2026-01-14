import React, { useState } from 'react';
import './AddMemberModal.css'; // Reusing modal styles

const MarkLeaveModal = ({ membership, onGrantLeave, onClose, error }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!startDate || !endDate) return;

        setSubmitting(true);
        await onGrantLeave(membership.id, {
            start_date: startDate,
            end_date: endDate,
            reason: reason
        });
        setSubmitting(false);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h4>Mark Leave for Team {membership.id}</h4>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Leave Start Date</label>
                        <input 
                            type="date" 
                            required 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Leave End Date</label>
                        <input 
                            type="date" 
                            required 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Reason (Optional)</label>
                        <textarea 
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Health issues, travel, etc."
                        />
                    </div>
                    
                    {error && <div className="error-message">{error}</div>}
                    
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                            {submitting ? 'Granting...' : 'Grant Leave'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MarkLeaveModal;