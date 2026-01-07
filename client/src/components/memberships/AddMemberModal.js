import React, { useState, useCallback } from 'react';
import api from '../../api';
import './AddMemberModal.css';

const AddMemberModal = ({ onAddMember, onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showNewMemberForm, setShowNewMemberForm] = useState(false);

    // New member form state
    const [newMember, setNewMember] = useState({
        full_name: '',
        phone_number: '',
        email: '',
        notes: ''
    });
    const [error, setError] = useState('');

    const handleSearchChange = (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (query.length > 2) {
            searchMembers(query);
        } else {
            setSearchResults([]);
        }
    };
    
    const searchMembers = useCallback(async (query) => {
        setIsLoading(true);
        try {
            const res = await api.get(`/memberships/members?q=${query}`);
            setSearchResults(res.data);
        } catch (err) {
            console.error("Error searching members:", err);
        }
        setIsLoading(false);
    }, []);

    const handleNewMemberChange = (e) => {
        const { name, value } = e.target;
        setNewMember(prev => ({ ...prev, [name]: value }));
    };

    const handleCreateNewMember = async (e) => {
        e.preventDefault();
        setError('');
        if (!newMember.full_name || !newMember.phone_number) {
            setError('Full Name and Phone Number are required.');
            return;
        }

        try {
            const res = await api.post('/memberships/members', newMember);
            // Pass the newly created member back to the parent and close
            onAddMember({ id: res.data.id, ...newMember });
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create new member.');
            console.error(err);
        }
    };


    const renderNewMemberForm = () => (
        <div className="new-member-form">
            <hr />
            <h4>Create New Member</h4>
            {error && <p className="error-message">{error}</p>}
            <form onSubmit={handleCreateNewMember}>
                <div className="form-group-row">
                    <input type="text" name="full_name" placeholder="Full Name*" value={newMember.full_name} onChange={handleNewMemberChange} required />
                    <input type="text" name="phone_number" placeholder="Phone Number*" value={newMember.phone_number} onChange={handleNewMemberChange} required />
                </div>
                 <div className="form-group-row">
                    <input type="email" name="email" placeholder="Email" value={newMember.email} onChange={handleNewMemberChange} />
                </div>
                <div className="form-group-row">
                     <textarea name="notes" placeholder="Notes..." value={newMember.notes} onChange={handleNewMemberChange}></textarea>
                </div>
                <button type="submit" className="btn btn-primary">Create and Add</button>
            </form>
        </div>
    );

    return (
        <div className="modal-overlay">
            <div className="modal-content add-member-modal">
                <div className="modal-header">
                    <h2>Add Team Member</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                <div className="modal-body">
                    <input
                        type="text"
                        placeholder="Search by name or phone..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        className="search-input"
                    />
                    {isLoading && <p>Searching...</p>}
                    <ul className="search-results-list">
                        {searchResults.map(member => (
                            <li key={member.id}>
                                <span>{member.full_name} ({member.phone_number})</span>
                                <button className="btn btn-secondary btn-sm" onClick={() => onAddMember(member)}>Add</button>
                            </li>
                        ))}
                    </ul>
                    {searchResults.length === 0 && searchQuery.length > 2 && !isLoading && (
                         <p>No members found for "{searchQuery}".</p>
                    )}
                    
                    {!showNewMemberForm ? (
                        <div className="new-member-actions">
                            <button className="btn btn-secondary" onClick={() => setShowNewMemberForm(true)}>+ New Member</button>
                        </div>
                    ) : (
                        renderNewMemberForm()
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddMemberModal;
