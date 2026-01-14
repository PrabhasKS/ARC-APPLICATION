import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import RenewModal from './RenewModal';
import AddTeamMemberModal from './AddTeamMemberModal';
import AddMembershipPaymentModal from './AddMembershipPaymentModal';
import MarkLeaveModal from './MarkLeaveModal';
import './PackageMgt.css'; 

const ActiveMembershipsMgt = () => {
    const [activeMemberships, setActiveMemberships] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalError, setModalError] = useState(null);

    const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
    const [selectedMembership, setSelectedMembership] = useState(null);

    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
    const [membershipToAddMemberTo, setMembershipToAddMemberTo] = useState(null);

    const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);
    const [selectedMembershipForPayment, setSelectedMembershipForPayment] = useState(null);

    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
    const [selectedMembershipForLeave, setSelectedMembershipForLeave] = useState(null);

    const [openMenuId, setOpenMenuId] = useState(null);

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

    useEffect(() => {
        const handleClickOutside = () => {
            setOpenMenuId(null);
        };
        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    const handleOpenRenewModal = (membership) => {
        setSelectedMembership(membership);
        setIsRenewModalOpen(true);
        setModalError(null);
        setOpenMenuId(null);
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

    const handleOpenAddMemberModal = (membership) => {
        setMembershipToAddMemberTo(membership);
        setIsAddMemberModalOpen(true);
        setModalError(null);
        setOpenMenuId(null);
    };

    const handleCloseAddMemberModal = () => {
        setIsAddMemberModalOpen(false);
        setMembershipToAddMemberTo(null);
        setModalError(null);
    };

    const handleOpenAddPaymentModal = (membership) => {
        setSelectedMembershipForPayment(membership);
        setIsAddPaymentModalOpen(true);
        setModalError(null);
        setOpenMenuId(null);
    };

    const handleCloseAddPaymentModal = () => {
        setIsAddPaymentModalOpen(false);
        setSelectedMembershipForPayment(null);
        setModalError(null);
    };

    const handleOpenLeaveModal = (membership) => {
        setSelectedMembershipForLeave(membership);
        setIsLeaveModalOpen(true);
        setModalError(null);
        setOpenMenuId(null);
    };

    const handleCloseLeaveModal = () => {
        setIsLeaveModalOpen(false);
        setSelectedMembershipForLeave(null);
        setModalError(null);
    };

    const handleGrantLeaveSubmit = async (membershipId, leaveData) => {
        try {
            await api.post('/memberships/grant-leave', { membership_id: membershipId, ...leaveData });
            fetchActiveMemberships();
            handleCloseLeaveModal();
        } catch (err) {
            setModalError(err.response?.data?.message || 'Failed to grant leave.');
            console.error(err);
        }
    };

    const handlePaymentAdded = (updatedMembership) => {
        setActiveMemberships(prevMemberships =>
            prevMemberships.map(mem =>
                mem.id === updatedMembership.id ? updatedMembership : mem
            )
        );
    };

    const handleTerminate = async (id) => {
        if (window.confirm('Are you sure you want to terminate this membership? This action cannot be undone.')) {
            try {
                await api.delete(`/memberships/active/${id}`);
                fetchActiveMemberships();
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to terminate membership.');
            } finally {
                setOpenMenuId(null);
            }
        }
    };

    const handleToggleMenu = (membershipId, event) => {
        event.stopPropagation();
        setOpenMenuId(openMenuId === membershipId ? null : membershipId);
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
                        <th>Team ID</th>
                        <th>Package</th>
                        <th>Court</th>
                        <th>Team (Current/Max)</th>
                        <th>Time Slot</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Total Price</th>
                        <th>Paid</th>
                        <th>Balance</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {activeMemberships.length > 0 ? (
                        activeMemberships.map(mem => (
                            <tr key={mem.id}>
                                <td>{mem.id}</td>
                                <td>{mem.package_name}</td>
                                <td>{mem.court_name}</td>
                                <td className="team-cell">{mem.current_members_count || 0} / {mem.max_team_size || 'N/A'}</td>
                                <td>{mem.time_slot}</td>
                                <td>{new Date(mem.start_date).toLocaleDateString()}</td>
                                <td>{new Date(mem.current_end_date).toLocaleDateString()}</td>
                                <td>Rs. {mem.final_price}</td>
                                <td>Rs. {mem.amount_paid}</td>
                                <td style={{ color: mem.balance_amount > 0 ? 'red' : 'green' }}>Rs. {mem.balance_amount}</td>
                                <td className="actions-cell">
                                    <div className="actions-menu-container">
                                        <button className="three-dots-btn" onClick={(e) => handleToggleMenu(mem.id, e)}>
                                            &#8285;
                                        </button>
                                        {openMenuId === mem.id && (
                                            <div className="actions-dropdown">
                                                {mem.balance_amount > 0 && <button className="btn btn-success btn-sm" onClick={() => handleOpenAddPaymentModal(mem)}>Add Payment</button>}
                                                <button className="btn btn-primary btn-sm" onClick={() => handleOpenRenewModal(mem)}>Renew</button>
                                                <button className="btn btn-info btn-sm" onClick={() => handleOpenAddMemberModal(mem)}>Add Member</button>
                                                <button className="btn btn-warning btn-sm" onClick={() => handleOpenLeaveModal(mem)}>Mark Leave</button>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleTerminate(mem.id)}>Terminate</button>
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="11">No active memberships found.</td>
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
            {isAddMemberModalOpen && membershipToAddMemberTo && (
                <AddTeamMemberModal
                    activeMembershipId={membershipToAddMemberTo.id}
                    maxTeamSize={membershipToAddMemberTo.max_team_size}
                    currentTeamSize={membershipToAddMemberTo.current_members_count}
                    onMemberAdded={fetchActiveMemberships}
                    onClose={handleCloseAddMemberModal}
                    error={modalError}
                />
            )}
            {isAddPaymentModalOpen && selectedMembershipForPayment && (
                <AddMembershipPaymentModal
                    membership={selectedMembershipForPayment}
                    onPaymentAdded={handlePaymentAdded}
                    onClose={handleCloseAddPaymentModal}
                    error={modalError}
                />
            )}
            {isLeaveModalOpen && selectedMembershipForLeave && (
                <MarkLeaveModal
                    membership={selectedMembershipForLeave}
                    onGrantLeave={handleGrantLeaveSubmit}
                    onClose={handleCloseLeaveModal}
                    error={modalError}
                />
            )}
        </div>
    );
};

export default ActiveMembershipsMgt;

