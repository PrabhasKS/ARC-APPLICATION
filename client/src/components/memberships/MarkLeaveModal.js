import React, { useState, useCallback, useEffect } from 'react'; // Added useEffect for potential debugging
import './PackageEditModal.css'; // Reusing modal styles for consistency

const MarkLeaveModal = ({ membership, onGrantLeave, onClose, error }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({}); // New errors state

    // Log to see if error prop changes
    useEffect(() => {
        if (error) {
            console.log('MarkLeaveModal received error prop:', error);
            setErrors(prev => ({ ...prev, general: error }));
        } else {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.general;
                return newErrors;
            });
        }
    }, [error]);

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
        console.log('MarkLeaveModal: handleSubmit called');
        setErrors({}); // Reset errors

        if (!validateForm()) {
            console.log('MarkLeaveModal: Form validation failed', errors);
            setSubmitting(false); // Ensure submitting is reset if validation fails
            return;
        }

        setSubmitting(true);
        console.log('MarkLeaveModal: Submitting state set to true');
        try {
            console.log('MarkLeaveModal: Calling onGrantLeave...');
            await onGrantLeave(membership.id, {
                start_date: startDate,
                end_date: endDate,
                reason: reason
            });
            console.log('MarkLeaveModal: onGrantLeave successful, calling onClose()');
            onClose(); // Only close on successful submission
        } catch (err) {
            console.error('MarkLeaveModal: Caught error from onGrantLeave:', err);
            if (err.response?.status === 409) {
                // Conflict detected, display message and keep modal open
                setErrors({ general: err.response.data.message });
                console.log('MarkLeaveModal: Conflict error set:', err.response.data.message);
            } else {
                // Other errors
                setErrors({ general: err.response?.data?.message || 'Failed to grant leave.' });
                console.log('MarkLeaveModal: General error set:', err.response?.data?.message || 'Failed to grant leave.');
            }
        } finally {
            console.log('MarkLeaveModal: Finally block executed, setting submitting to false');
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