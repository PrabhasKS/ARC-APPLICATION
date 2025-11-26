import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import RenewModal from './RenewModal';
import './PackageMgt.css'; 

const ActiveMembershipsMgt = () => {
    const [activeMemberships, setActiveMemberships] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalError, setModalError] = useState(null);

    const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
    const [selectedMembership, setSelectedMembership] = useState(null);

    const fetchActiveMemberships = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/memberships/active');
            setActiveMemberships(response.data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch active memberships.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchActiveMemberships();
    }, [fetchActiveMemberships]);

    const handleOpenRenewModal = (membership) => {
        setSelectedMembership(membership);
        setIsRenewModalOpen(true);
        setModalError(null);
    };

    const handleCloseRenewModal = () => {
        setIsRenewModalOpen(false);
        setSelectedMembership(null);
        setModalError(null);
    };
    
    const handleRenewSubmit = async (membershipId, renewalData) => {
        try {
            await api.post(`/memberships/active/${membershipId}/renew`, renewalData);
            fetchActiveMemberships();
            handleCloseRenewModal();
        } catch (err) {
            setModalError(err.response?.data?.message || 'Failed to renew membership.');
            console.error(err);
        }
    };
    
    const handleTerminate = async (id) => {
        if (window.confirm('Are you sure you want to terminate this membership? This action cannot be undone.')) {
            try {
                await api.delete(`/memberships/active/${id}`);
                fetchActiveMemberships();
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to terminate membership.');
            }
        }
    };

    if (loading) {
        return <div>Loading active memberships...</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="package-mgt-container">
            <div className="package-mgt-header">
                <h3>Active Memberships</h3>
            </div>
            <table className="dashboard-table">
                <thead>
                    <tr>
                        <th>Package</th>
                        <th>Court</th>
                        <th>Team</th>
                        <th>Time Slot</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {activeMemberships.length > 0 ? (
                        activeMemberships.map(mem => (
                            <tr key={mem.id}>
                                <td>{mem.package_name}</td>
                                <td>{mem.court_name}</td>
                                <td className="team-cell">{mem.team_members}</td>
                                <td>{mem.time_slot}</td>
                                <td>{new Date(mem.start_date).toLocaleDateString()}</td>
                                <td>{new Date(mem.current_end_date).toLocaleDateString()}</td>
                                <td className="actions-cell">
                                    <button className="btn btn-primary btn-sm" onClick={() => handleOpenRenewModal(mem)}>Renew</button>
                                    <button className="btn btn-danger btn-sm" onClick={() => handleTerminate(mem.id)}>Terminate</button>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="7">No active memberships found.</td>
                        </tr>
                    )}
                </tbody>
            </table>
            {isRenewModalOpen && (
                <RenewModal 
                    membership={selectedMembership}
                    onRenew={handleRenewSubmit}
                    onClose={handleCloseRenewModal}
                    error={modalError}
                />
            )}
        </div>
    );
};

export default ActiveMembershipsMgt;
