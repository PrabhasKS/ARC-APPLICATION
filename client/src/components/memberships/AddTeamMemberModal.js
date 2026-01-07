import React, { useState, useEffect } from 'react';
import api from '../../api';
import './AddTeamMemberModal.css';

const AddTeamMemberModal = ({ activeMembershipId, maxTeamSize, currentTeamSize, onMemberAdded, onClose, error }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchTerm.length > 2) {
                api.get(`/members?q=${searchTerm}`)
                    .then(response => setSearchResults(response.data))
                    .catch(err => console.error("Error searching members:", err));
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const handleAddMember = async (e) => {
        e.preventDefault();
        if (!selectedMember) {
            alert('Please select a member to add.');
            return;
        }
        if (paymentAmount <= 0) {
            alert('Payment amount must be greater than 0.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                member_id: selectedMember.id,
                payment: {
                    amount: paymentAmount,
                    payment_mode: paymentMode
                }
            };
            await api.post(`/memberships/active/${activeMembershipId}/add-member`, payload);
            alert('Member added successfully!');
            onMemberAdded(); // Callback to refresh parent list
            onClose();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to add member.');
            console.error('Failed to add member:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const isTeamFull = currentTeamSize >= maxTeamSize;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Add Member to Team</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                <form onSubmit={handleAddMember} className="modal-form">
                    {error && <div className="error-message">{error}</div>}
                    
                    <p>Current Team Size: {currentTeamSize} / {maxTeamSize}</p>
                    {isTeamFull && <p className="error-message">This team is full. Cannot add more members.</p>}

                    <div className="form-group">
                        <label htmlFor="memberSearch">Search Member</label>
                        <input
                            id="memberSearch"
                            type="text"
                            placeholder="Search by name or phone"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setSelectedMember(null); // Clear selected member on new search
                            }}
                            disabled={isTeamFull || submitting}
                        />
                        {searchResults.length > 0 && !selectedMember && (
                            <ul className="search-results-list">
                                {searchResults.map(member => (
                                    <li key={member.id} onClick={() => {
                                        setSelectedMember(member);
                                        setSearchTerm(`${member.full_name} (${member.phone_number})`);
                                        setSearchResults([]); // Clear results after selection
                                    }}>
                                        {member.full_name} ({member.phone_number})
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {selectedMember && (
                        <div className="selected-member-info">
                            <p><strong>Selected Member:</strong> {selectedMember.full_name}</p>
                            <p>Contact: {selectedMember.phone_number}</p>
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="paymentAmount">Payment Amount (Rs.)</label>
                        <input
                            id="paymentAmount"
                            type="number"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                            required
                            min="0"
                            disabled={isTeamFull || !selectedMember || submitting}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="paymentMode">Payment Mode</label>
                        <select
                            id="paymentMode"
                            value={paymentMode}
                            onChange={(e) => setPaymentMode(e.target.value)}
                            required
                            disabled={isTeamFull || !selectedMember || submitting}
                        >
                            <option>Cash</option>
                            <option>Card</option>
                            <option>Online</option>
                            <option>Cheque</option>
                        </select>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={isTeamFull || !selectedMember || submitting}>
                            {submitting ? 'Adding...' : 'Add Member'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddTeamMemberModal;