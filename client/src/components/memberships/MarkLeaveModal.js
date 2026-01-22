import React, { useState, useCallback, useMemo } from 'react';
import { format, differenceInCalendarDays, addDays } from 'date-fns';
import './PackageEditModal.css'; // Reusing modal styles for consistency

const MarkLeaveModal = ({ membership, onGrantLeave, onClose }) => {
    // Core leave data
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    
    // UI and Error State
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [conflicts, setConflicts] = useState([]);

    // State for handling custom extension flow
    const [showCustomExtensionUI, setShowCustomExtensionUI] = useState(false);
    const [customExtensionStartDate, setCustomExtensionStartDate] = useState('');
    const [leaveDuration, setLeaveDuration] = useState(0);

    const calculatedCustomEndDate = useMemo(() => {
        if (!customExtensionStartDate || !leaveDuration) return null;
        const start = new Date(customExtensionStartDate);
        // We subtract 1 because if leave is 1 day, extension is also 1 day, so start and end are same.
        const end = addDays(start, leaveDuration - 1);
        return format(end, 'yyyy-MM-dd');
    }, [customExtensionStartDate, leaveDuration]);

    const resetState = (clearDates = false) => {
        setError(null);
        setConflicts([]);
        setShowCustomExtensionUI(false);
        setCustomExtensionStartDate('');
        setLeaveDuration(0);
        if(clearDates) {
            setStartDate('');
            setEndDate('');
        }
    };

    const handleStartDateChange = (e) => {
        setStartDate(e.target.value);
        resetState();
    };

    const handleEndDateChange = (e) => {
        setEndDate(e.target.value);
        resetState();
    };
    
    const handleReasonChange = (e) => {
        setReason(e.target.value);
    };

    const handleCustomExtensionDateChange = (e) => {
        setCustomExtensionStartDate(e.target.value);
    };

    const isExtensionConflict = useMemo(() => {
        if (conflicts.length === 0) return false;
        return conflicts.every(c => c.type === 'booking_extension' || c.type === 'membership_extension');
    }, [conflicts]);

    const validateForm = useCallback(() => {
        if (!startDate || !endDate) {
            setError('Both start and end dates are required.');
            return false;
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end) {
            setError('Leave end date must be on or after the start date.');
            return false;
        }
        if (showCustomExtensionUI && !customExtensionStartDate) {
            setError('Please select a new start date for the custom extension.');
            return false;
        }
        return true;
    }, [startDate, endDate, showCustomExtensionUI, customExtensionStartDate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setConflicts([]); // Always clear old conflicts on new submission

        if (!validateForm()) {
            return;
        }

        setSubmitting(true);
        
        const payload = {
            start_date: startDate,
            end_date: endDate,
            reason: reason,
        };

        if (showCustomExtensionUI && customExtensionStartDate) {
            payload.custom_extension_start_date = customExtensionStartDate;
        }

        try {
            const response = await onGrantLeave(membership.id, payload);

            if (response && response.status === 'conflict') {
                const isExtConflict = response.conflicts.every(c => c.type.includes('_extension'));
                
                if (isExtConflict) {
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    const duration = differenceInCalendarDays(end, start) + 1;
                    setLeaveDuration(duration);
                    setError(`The ${duration}-day leave is fine, but the automatic extension conflicts. Please select a new start date for the compensation period.`);
                    setShowCustomExtensionUI(true);
                } else {
                     setError('Could not grant leave. The leave period itself conflicts with existing bookings.');
                }
                setConflicts(response.conflicts || []);

            } else if (response && response.status === 'success') {
                onClose(); // Success
            }
        } catch (err) {
            console.error('MarkLeaveModal: Caught error from onGrantLeave:', err);
            setError(err.response?.data?.message || 'An unexpected error occurred. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '600px' }}>
                <div className="modal-header">
                    <h4>Mark Leave for Team (Membership ID: {membership.id})</h4>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    {error && <div className="error-message" style={{ marginBottom: '15px' }}>{error}</div>}
                    
                    {conflicts.length > 0 && !isExtensionConflict && (
                        <div className="conflicts-section" style={{ marginBottom: '15px', maxHeight: '150px', overflowY: 'auto', border: '1px solid #ffcccc', padding: '10px', borderRadius: '4px' }}>
                            <h5>Conflicts Found In Leave Period:</h5>
                            <ul style={{ paddingLeft: '20px', margin: 0 }}>
                                {conflicts.map((conflict, index) => (
                                    <li key={index} style={{ color: '#c00', marginBottom: '5px' }}>
                                        <strong>{format(new Date(conflict.date), 'dd/MM/yyyy')}:</strong> {conflict.message}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="form-group">
                        <label>Leave Start Date</label>
                        <input 
                            type="date" 
                            required 
                            name="startDate"
                            value={startDate}
                            onChange={handleStartDateChange}
                            min={new Date().toISOString().split('T')[0]}
                            disabled={showCustomExtensionUI}
                        />
                    </div>
                    <div className="form-group">
                        <label>Leave End Date</label>
                        <input 
                            type="date" 
                            required 
                            name="endDate"
                            value={endDate}
                            onChange={handleEndDateChange}
                            min={startDate}
                            disabled={showCustomExtensionUI}
                        />
                    </div>

                    {showCustomExtensionUI && (
                        <div className="custom-extension-section" style={{ border: '1px solid #cce5ff', padding: '15px', borderRadius: '4px', marginTop: '20px', backgroundColor: '#f7faff' }}>
                             <h5 style={{marginTop: '0'}}>Resolve Extension Conflict</h5>
                             <p>
                                 The <strong>{leaveDuration}-day</strong> leave period is valid.
                             </p>
                            <div className="form-group">
                                <label><strong>New Extension Start Date</strong></label>
                                <input 
                                    type="date" 
                                    required 
                                    name="customExtensionStartDate"
                                    value={customExtensionStartDate}
                                    onChange={handleCustomExtensionDateChange}
                                    min={membership.current_end_date}
                                />
                                {calculatedCustomEndDate && (
                                    <p className="form-text" style={{marginTop: '5px'}}>
                                        This will extend the membership from <strong>{format(new Date(customExtensionStartDate), 'dd/MM/yyyy')}</strong> to <strong>{format(new Date(calculatedCustomEndDate), 'dd/MM/yyyy')}</strong>.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="form-group" style={{marginTop: '20px'}}>
                        <label>Reason (Optional)</label>
                        <textarea 
                            name="reason"
                            value={reason}
                            onChange={handleReasonChange}
                            placeholder="e.g. Health issues, travel, etc."
                        />
                    </div>
                    
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                            {submitting ? 'Checking...' : (showCustomExtensionUI ? 'Grant with Custom Extension' : 'Check & Grant Leave')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MarkLeaveModal;