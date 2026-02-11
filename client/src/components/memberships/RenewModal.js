import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../api'; // Assuming 'api' is configured for HTTP requests
import './PackageEditModal.css';

const RenewModal = ({ membership, onRenew, onClose }) => { // Removed 'error' from props
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [discountAmount, setDiscountAmount] = useState(0);
    const [discountDetails, setDiscountDetails] = useState(''); // New state variable
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [onlinePaymentType, setOnlinePaymentType] = useState('UPI');
    const [paymentId, setPaymentId] = useState('');
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // State for member management
    const [allMembers, setAllMembers] = useState([]);
    const [selectedRenewMembers, setSelectedRenewMembers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showMemberSearch, setShowMemberSearch] = useState(false);

    // Filter members based on search term for display in the dropdown
    const filteredMembers = useMemo(() => {
        if (!searchTerm) return [];
        return allMembers.filter(member =>
            member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !selectedRenewMembers.some(sm => sm.id === member.id) // Exclude already selected members
        );
    }, [searchTerm, allMembers, selectedRenewMembers]);

    // Calculate display price (per person price * current members) for display purposes
    const displayBasePrice = useMemo(() => {
        return (membership?.package_price || 0) * (selectedRenewMembers.length || 0);
    }, [membership, selectedRenewMembers]);

    const displayFinalPrice = useMemo(() => {
        return displayBasePrice - (discountAmount || 0);
    }, [displayBasePrice, discountAmount]);

    // Fetch all members and initialize selectedRenewMembers
    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const response = await api.get('/memberships/members'); // Assuming an API endpoint for all members
                setAllMembers(response.data);
            } catch (err) {
                console.error('Failed to fetch all members:', err);
                // Handle error appropriately, maybe display a message
            }
        };

        fetchMembers();

        // Initialize selectedRenewMembers with existing members from the 'membership' prop
        // This assumes membership.team_members is a comma-separated string of full_names
        // A more robust solution would have membership.member_objects as an array of objects
        if (membership?.team_members) {
            // Split the string, trim each name, then find corresponding full member objects
            const initialMemberNames = membership.team_members.split(', ').map(name => name.trim());
            
            // Wait for allMembers to be fetched before attempting to match
            if (allMembers.length > 0) {
                const initialMembers = allMembers.filter(member =>
                    initialMemberNames.includes(member.full_name)
                );
                setSelectedRenewMembers(initialMembers);
            }
        }
    }, [membership, allMembers]);


    // Member management handlers
    const handleSearchTermChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleAddRenewMember = (member) => {
        if (selectedRenewMembers.length < membership?.max_team_size &&
            !selectedRenewMembers.some(m => m.id === member.id)) {
            setSelectedRenewMembers([...selectedRenewMembers, member]);
            setSearchTerm('');
            setShowMemberSearch(false);
            setErrors(prev => ({ ...prev, members: undefined })); // Clear members error if present
        } else if (selectedRenewMembers.some(m => m.id === member.id)) {
            setErrors(prev => ({ ...prev, members: 'Member is already selected.' }));
        } else {
            setErrors(prev => ({ ...prev, members: `Maximum team size (${membership.max_team_size}) reached.` }));
        }
    };

    const handleRemoveRenewMember = (memberId) => {
        setSelectedRenewMembers(selectedRenewMembers.filter(member => member.id !== memberId));
        setErrors(prev => ({ ...prev, members: undefined }));
    };


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
        
        if ((parseFloat(discountAmount) > 0) && (!discountDetails || !discountDetails.trim())) {
            newErrors.discountDetails = 'Discount reason is required when a discount is applied.';
        }

        if ((paymentMode === 'Online' || paymentMode === 'Cheque') && !paymentId.trim()) {
            newErrors.paymentId = 'Payment ID is required for online/cheque payments.';
        } else if (paymentId && !/^[a-zA-Z0-9]+$/.test(paymentId)) {
            newErrors.paymentId = 'Payment ID must be alphanumeric.';
        }

        if (selectedRenewMembers.length === 0) {
            newErrors.members = 'At least one member must be selected for renewal.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [paymentAmount, displayFinalPrice, discountAmount, displayBasePrice, paymentMode, paymentId, selectedRenewMembers, discountDetails]);


    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({});
        
        if (!validateForm()) {
            return;
        }

        setSubmitting(true);
        try {
            const finalPaymentMode = paymentMode === 'Online' ? onlinePaymentType : paymentMode;
            const finalPaymentId = (paymentMode === 'Online' || paymentMode === 'Cheque') ? paymentId : null;

            await onRenew(membership.id, {
                start_date: startDate,
                discount_amount: parseFloat(discountAmount) || 0,
                discount_details: discountDetails, // Pass new discount details
                initial_payment: {
                    amount: parseFloat(paymentAmount) || 0,
                    payment_mode: finalPaymentMode,
                    payment_id: finalPaymentId
                },
                new_member_ids: selectedRenewMembers.map(member => member.id)
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
                    {errors.general && <div className="error-message">{errors.general}</div>}
                    {membership?.balance_amount > 0 && (
                        <div className="error-message">
                            <p><strong>Note:</strong> This membership has an outstanding balance of Rs. {membership.balance_amount}. Please clear the balance before renewing.</p>
                        </div>
                    )}
                    <div className="summary-card" style={{padding: '1rem', marginBottom: '1rem'}}>
                         <p><strong>Package:</strong> {membership?.package_name}</p>
                         <p><strong>Max Team Size:</strong> {membership?.max_team_size}</p>
                         <p><strong>Per Person Price:</strong> Rs. {membership?.package_price || 0}</p>
                         <p><strong>Total for {selectedRenewMembers.length} Members:</strong> Rs. {displayBasePrice}</p>
                    </div>

                    <div className="form-group">
                        <label>New Start Date</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} required />
                    </div>

                    <div className="form-group">
                        <label>Team Members for Renewal ({selectedRenewMembers.length} / {membership?.max_team_size})</label>
                        <div className="selected-members-list">
                            {selectedRenewMembers.map(member => (
                                <span key={member.id} className="member-tag">
                                    {member.full_name}
                                    <button type="button" onClick={() => handleRemoveRenewMember(member.id)}>&times;</button>
                                </span>
                            ))}
                        </div>
                        {errors.members && <p style={{ color: 'red', fontSize: '12px' }}>{errors.members}</p>}
                        {selectedRenewMembers.length < membership?.max_team_size && (
                            <div className="member-search-container">
                                <input
                                    type="text"
                                    placeholder="Search and add members..."
                                    value={searchTerm}
                                    onChange={handleSearchTermChange}
                                    onFocus={() => setShowMemberSearch(true)}
                                    onBlur={() => setTimeout(() => setShowMemberSearch(false), 100)}
                                />
                                {showMemberSearch && (
                                    <div className="member-search-results">
                                        {filteredMembers.length > 0 ? (
                                            filteredMembers.map(member => (
                                                <div key={member.id} className="member-search-item" onMouseDown={() => handleAddRenewMember(member)}>
                                                    {member.full_name} ({member.phone_number})
                                                </div>
                                            ))
                                        ) : (
                                            searchTerm && <p className="no-members-found">No members found matching "{searchTerm}".</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Discount Amount (Rs.)</label>
                        <input type="number" value={discountAmount} onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)} />
                        {errors.discountAmount && <p style={{ color: 'red', fontSize: '12px' }}>{errors.discountAmount}</p>}
                    </div>
                    <div className="form-group"> {/* New input field for discountDetails */}
                        <label>Discount Reason</label>
                        <input type="text" value={discountDetails} onChange={e => setDiscountDetails(e.target.value)} />
                        {errors.discountDetails && <p style={{ color: 'red', fontSize: '12px' }}>{errors.discountDetails}</p>}
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