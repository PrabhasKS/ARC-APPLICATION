import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../api'; // Assuming 'api' is configured for HTTP requests
import './PackageEditModal.css'; // Corrected path

const ManageActiveMembersModal = ({ membership, onClose, onMembersUpdated }) => {
    const [allMembers, setAllMembers] = useState([]);
    const [currentTeamMembers, setCurrentTeamMembers] = useState([]); // Members currently in the active membership
    const [selectedNewMembers, setSelectedNewMembers] = useState([]); // Members to be added/kept after update
    const [searchTerm, setSearchTerm] = useState('');
    const [showMemberSearch, setShowMemberSearch] = useState(false);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // New state for adding new members
    const [newMemberFullName, setNewMemberFullName] = useState('');
    const [newMemberPhoneNumber, setNewMemberPhoneNumber] = useState('');
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [showNewMemberForm, setShowNewMemberForm] = useState(false);

    // Function to fetch all members (used initially and after new member creation)
    const fetchAllMembers = useCallback(async () => {
        try {
            const response = await api.get('/memberships/members');
            setAllMembers(response.data);
            return response.data;
        } catch (err) {
            console.error('Failed to fetch all members:', err);
            setError('Failed to load member data.');
            return [];
        }
    }, []);

    // Fetch all members and initialize currentTeamMembers
    useEffect(() => {
        const fetchAndSetInitialData = async () => {
            setSubmitting(true);
            const membersData = await fetchAllMembers();
            if (membership?.team_members && membersData.length > 0) {
                const initialMemberNames = membership.team_members.split(', ').map(name => name.trim());
                const initialMembers = membersData.filter(member =>
                    initialMemberNames.includes(member.full_name)
                );
                setCurrentTeamMembers(initialMembers);
                setSelectedNewMembers(initialMembers); // Start with existing members selected
            }
            setSubmitting(false);
        };

        fetchAndSetInitialData();
    }, [membership, fetchAllMembers]); // fetchAllMembers as dependency

    // Filter members for the search dropdown
    const filteredSearchMembers = useMemo(() => {
        if (!searchTerm) return [];
        return allMembers.filter(member =>
            member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !selectedNewMembers.some(sm => sm.id === member.id) // Exclude already selected members
        );
    }, [searchTerm, allMembers, selectedNewMembers]);

    // Calculate potential price increase based on newly added members
    const priceIncrease = useMemo(() => {
        const currentMemberIds = currentTeamMembers.map(m => m.id);
        const newlyAddedMembers = selectedNewMembers.filter(sm => !currentMemberIds.includes(sm.id));
        return newlyAddedMembers.length * (membership?.package_price || 0);
    }, [currentTeamMembers, selectedNewMembers, membership?.package_price]);

    const handleSearchTermChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleAddMember = (member) => {
        if (selectedNewMembers.length < membership?.max_team_size &&
            !selectedNewMembers.some(m => m.id === member.id)) {
            setSelectedNewMembers([...selectedNewMembers, member]);
            setSearchTerm(''); // Clear search after adding
            setShowMemberSearch(false); // Hide search results
            setError(null); // Clear previous errors
        } else if (selectedNewMembers.some(m => m.id === member.id)) {
            setError('Member is already selected.');
        } else {
            setError(`Maximum team size (${membership.max_team_size}) reached.`);
        }
    };

    const handleRemoveMember = (memberId) => {
        setSelectedNewMembers(selectedNewMembers.filter(member => member.id !== memberId));
        setError(null); // Clear previous errors
    };

    const handleCreateNewMember = async () => {
        setError(null);
        if (!newMemberFullName || !newMemberPhoneNumber) {
            setError('Full name and phone number are required for a new member.');
            return;
        }

        try {
            setSubmitting(true);
            const response = await api.post('/memberships/members', {
                full_name: newMemberFullName,
                phone_number: newMemberPhoneNumber,
                email: newMemberEmail
            });
            const newMember = {
                id: response.data.id,
                full_name: newMemberFullName,
                phone_number: newMemberPhoneNumber,
                email: newMemberEmail
            };

            await fetchAllMembers(); // Refresh the allMembers list with the new member
            handleAddMember(newMember); // Add the newly created member to selected members
            
            // Clear form
            setNewMemberFullName('');
            setNewMemberPhoneNumber('');
            setNewMemberEmail('');
            setShowNewMemberForm(false);
            setError(null); // Clear any errors related to new member creation

        } catch (err) {
            console.error('Error creating new member:', err);
            setError(err.response?.data?.message || 'Failed to create new member.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (selectedNewMembers.length === 0) {
            setError('At least one member must be in the team.');
            return;
        }
        if (selectedNewMembers.length > membership?.max_team_size) {
            setError(`Team size cannot exceed maximum allowed (${membership.max_team_size}).`);
            return;
        }

        setSubmitting(true);
        try {
            const memberIdsToUpdate = selectedNewMembers.map(m => m.id);
            const response = await api.put(`/memberships/active/${membership.id}/manage-members`, {
                member_ids: memberIdsToUpdate,
            });
            onMembersUpdated(response.data); // Callback to refresh parent list
            onClose();
        } catch (err) {
            console.error('Failed to manage active members:', err);
            setError(err.response?.data?.message || 'Failed to update team members.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Manage Team for Membership ID: {membership.id}</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="modal-form">
                    {error && <div className="error-message">{error}</div>}

                    <div className="summary-card" style={{padding: '1rem', marginBottom: '1rem'}}>
                         <p><strong>Package:</strong> {membership?.package_name}</p>
                         <p><strong>Current Team Size:</strong> {currentTeamMembers.length}</p>
                         <p><strong>Max Team Size:</strong> {membership?.max_team_size}</p>
                         <p><strong>Current Final Price:</strong> Rs. {membership?.final_price}</p>
                         {priceIncrease > 0 && <p style={{color: 'green'}}><strong>Potential Price Increase:</strong> Rs. {priceIncrease}</p>}
                    </div>

                    <div className="form-group">
                        <label>Current & New Team Members ({selectedNewMembers.length} / {membership?.max_team_size})</label>
                        <div className="selected-members-list">
                            {selectedNewMembers.map(member => (
                                <span key={member.id} className="member-tag">
                                    {member.full_name}
                                    <button type="button" onClick={() => handleRemoveMember(member.id)}>&times;</button>
                                </span>
                            ))}
                        </div>
                        {selectedNewMembers.length < membership?.max_team_size && (
                            <div className="member-search-container">
                                <input
                                    type="text"
                                    placeholder="Search and add existing members..."
                                    value={searchTerm}
                                    onChange={handleSearchTermChange}
                                    onFocus={() => setShowMemberSearch(true)}
                                    onBlur={() => setTimeout(() => setShowMemberSearch(false), 100)}
                                />
                                {showMemberSearch && (
                                    <div className="member-search-results">
                                        {filteredSearchMembers.length > 0 ? (
                                            filteredSearchMembers.map(member => (
                                                <div key={member.id} className="member-search-item" onMouseDown={() => handleAddMember(member)}>
                                                    {member.full_name} ({member.phone_number})
                                                </div>
                                            ))
                                        ) : (
                                            searchTerm && <p className="no-members-found">No members found matching "{searchTerm}".</p>
                                        )}
                                    </div>
                                )}

                                {!showNewMemberForm && (
                                    <button type="button" className="btn btn-secondary mt-2" onClick={() => {
                                        setShowNewMemberForm(true);
                                        setShowMemberSearch(false); // Hide search when showing new member form
                                        setSearchTerm(''); // Clear search term
                                        setError(null); // Clear any old errors
                                    }}>
                                        + Add New Member
                                    </button>
                                )}

                                {showNewMemberForm && (
                                    <div className="new-member-form mt-3 p-3 border rounded">
                                        <h4>Create New Member</h4>
                                        <div className="form-group">
                                            <label htmlFor="newMemberFullName">Full Name</label>
                                            <input
                                                id="newMemberFullName"
                                                type="text"
                                                className="form-control"
                                                value={newMemberFullName}
                                                onChange={e => setNewMemberFullName(e.target.value)}
                                                placeholder="Full Name"
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="newMemberPhoneNumber">Phone Number</label>
                                            <input
                                                id="newMemberPhoneNumber"
                                                type="text"
                                                className="form-control"
                                                value={newMemberPhoneNumber}
                                                onChange={e => setNewMemberPhoneNumber(e.target.value)}
                                                placeholder="Phone Number"
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="newMemberEmail">Email (Optional)</label>
                                            <input
                                                id="newMemberEmail"
                                                type="email"
                                                className="form-control"
                                                value={newMemberEmail}
                                                onChange={e => setNewMemberEmail(e.target.value)}
                                                placeholder="Email"
                                            />
                                        </div>
                                        <div className="d-flex justify-content-between mt-3">
                                            <button type="button" className="btn btn-primary" onClick={handleCreateNewMember} disabled={submitting}>
                                                Create & Add
                                            </button>
                                            <button type="button" className="btn btn-secondary" onClick={() => {
                                                setShowNewMemberForm(false);
                                                setNewMemberFullName('');
                                                setNewMemberPhoneNumber('');
                                                setNewMemberEmail('');
                                                setError(null);
                                            }}>
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>Update Team</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ManageActiveMembersModal;