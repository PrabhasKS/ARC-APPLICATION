import React, { useState, useCallback } from 'react'; // Added useCallback
import './PackageEditModal.css'; // Reusing modal styles for consistency

const MarkLeaveModal = ({ membership, onGrantLeave, onClose, error }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({}); // New errors state

    const handleChange = (setter) => (e) => {
        setter(e.target.value);
        // Clear error for this field on change
        setErrors(prev => ({ ...prev, [e.target.name]: undefined }));
    };

    const validateForm = useCallback(() => {
        const newErrors = {};

        if (!startDate) {
            newErrors.startDate = 'Leave start date is required.';
        }
        if (!endDate) {
            newErrors.endDate = 'Leave end date is required.';
        }
        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            newErrors.endDate = 'Leave end date must be after start date.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [startDate, endDate]);


    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({}); // Reset errors

        if (!validateForm()) {
            return;
        }

        setSubmitting(true);
        try {
            await onGrantLeave(membership.id, {
                start_date: startDate,
                end_date: endDate,
                reason: reason
            });
            onClose();
        } catch (err) {
            setErrors({ general: err.response?.data?.message || 'Failed to grant leave.' });
            console.error('Failed to grant leave:', err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h4>Mark Leave for Team {membership.id}</h4>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    {error && <div className="error-message">{error}</div>}
                    {errors.general && <div className="error-message">{errors.general}</div>}
                    <div className="form-group">
                        <label>Leave Start Date</label>
                        <input 
                            type="date" 
                            required 
                            name="startDate"
                            value={startDate}
                            onChange={handleChange(setStartDate)}
                        />
                        {errors.startDate && <p style={{ color: 'red', fontSize: '12px' }}>{errors.startDate}</p>}
                    </div>
                    <div className="form-group">
                        <label>Leave End Date</label>
                        <input 
                            type="date" 
                            required 
                            name="endDate"
                            value={endDate}
                            onChange={handleChange(setEndDate)}
                        />
                        {errors.endDate && <p style={{ color: 'red', fontSize: '12px' }}>{errors.endDate}</p>}
                    </div>
                    <div className="form-group">
                        <label>Reason (Optional)</label>
                        <textarea 
                            name="reason"
                            value={reason}
                            onChange={handleChange(setReason)}
                            placeholder="e.g. Health issues, travel, etc."
                        />
                    </div>
                    
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
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