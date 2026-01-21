import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import RenewModal from './RenewModal';
import AddTeamMemberModal from './AddTeamMemberModal';
import AddMembershipPaymentModal from './AddMembershipPaymentModal';
import MarkLeaveModal from './MarkLeaveModal';
import './PackageMgt.css'; 
import { format } from 'date-fns'; // Import date-fns

const ActiveMembershipsMgt = ({ status = 'active' }) => {
    const [memberships, setMemberships] = useState([]);
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
    const [filterText, setFilterText] = useState('');
    const [showColumnMenu, setShowColumnMenu] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState({
        id: true,
        package: true,
        court: true,
        team: true,
        time_slot: true,
        start_date: true,
        end_date: true,
        price: true,
        paid: true,
        balance: true,
        created_by: true,
        payment_info: false,
        discount_details: false,
        actions: true
    });

    const fetchMemberships = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get(`/memberships/${status}`);
            setMemberships(response.data);
            setError(null);
        } catch (err) {
            setError(`Failed to fetch ${status} memberships.`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => {
        fetchMemberships();
    }, [fetchMemberships]);

    useEffect(() => {
        const handleClickOutside = () => {
            setOpenMenuId(null);
            setShowColumnMenu(false);
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
            await api.put(`/memberships/active/${membershipId}/renew`, renewalData); // Changed to api.put
            fetchMemberships();
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
        console.log('ActiveMembershipsMgt: handleGrantLeaveSubmit called with membershipId:', membershipId, 'and leaveData:', leaveData);
        try {
            console.log('ActiveMembershipsMgt: Calling API to grant leave...');
            await api.post('/memberships/grant-leave', { membership_id: membershipId, ...leaveData });
            console.log('ActiveMembershipsMgt: API call successful. Fetching memberships...');
            fetchMemberships();
            console.log('ActiveMembershipsMgt: Memberships fetched. Closing leave modal...');
            handleCloseLeaveModal();
            console.log('ActiveMembershipsMgt: Leave modal closed.');
        } catch (err) {
            console.error('ActiveMembershipsMgt: Caught error in handleGrantLeaveSubmit:', err);
            setModalError(err.response?.data?.message || 'Failed to grant leave.');
            throw err; // Re-throw the error so MarkLeaveModal can catch it
        }
    };

    const handlePaymentAdded = (updatedMembership) => {
        setMemberships(prevMemberships =>
            prevMemberships.map(mem =>
                mem.id === updatedMembership.id ? updatedMembership : mem
            )
        );
    };

    const handleTerminate = async (id) => {
        if (window.confirm('Are you sure you want to terminate this membership? This action cannot be undone.')) {
            try {
                await api.delete(`/memberships/active/${id}`);
                fetchMemberships();
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to terminate membership.');
            } finally {
                setOpenMenuId(null);
            }
        }
    };

    const handleTerminateEnded = async (id) => {
        if (window.confirm('Are you sure you want to terminate this ended membership? This will move it to the terminated list.')) {
            try {
                await api.put(`/memberships/ended/${id}/terminate`);
                fetchMemberships(); // Refresh the list to reflect the status change
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to terminate ended membership.');
            } finally {
                setOpenMenuId(null);
            }
        }
    };

    const handleToggleMenu = (membershipId, event) => {
        event.stopPropagation();
        setOpenMenuId(openMenuId === membershipId ? null : membershipId);
    };

    const toggleColumn = (key) => {
        setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const filteredMemberships = memberships.filter(mem => {
        const search = filterText.toLowerCase();
        return (
            mem.id.toString().includes(search) ||
            mem.package_name?.toLowerCase().includes(search) ||
            mem.court_name?.toLowerCase().includes(search) ||
            mem.team_members?.toLowerCase().includes(search) ||
            mem.created_by?.toLowerCase().includes(search)
        );
    });

    const pageTitle = `${status.charAt(0).toUpperCase() + status.slice(1)} Memberships`;

    if (loading) {
        return <div>Loading {status} memberships...</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="package-mgt-container">
            <div className="package-mgt-header">
                <h3>{pageTitle}</h3>
                <div className="controls-container">
                    <input 
                        type="text" 
                        placeholder="Search memberships..." 
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                        className="search-input"
                    />
                    <div className="column-menu-wrapper" onClick={e => e.stopPropagation()}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowColumnMenu(!showColumnMenu)}>
                            Columns &#9662;
                        </button>
                        {showColumnMenu && (
                            <div className="column-menu-dropdown">
                                {Object.keys(visibleColumns).map(key => (
                                    <label key={key} className="column-option">
                                        <input 
                                            type="checkbox" 
                                            checked={visibleColumns[key]} 
                                            onChange={() => toggleColumn(key)} 
                                        />
                                        {key.replace('_', ' ').toUpperCase()}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <table className="dashboard-table">
                <thead>
                    <tr>
                        {visibleColumns.id && <th>ID</th>}
                        {visibleColumns.package && <th>Package</th>}
                        {visibleColumns.court && <th>Court</th>}
                        {visibleColumns.team && <th>Team</th>}
                        {visibleColumns.time_slot && <th>Time Slot</th>}
                        {visibleColumns.start_date && <th>Start Date</th>}
                        {visibleColumns.end_date && <th>End Date</th>}
                        {visibleColumns.price && <th>Total Price</th>}
                        {visibleColumns.paid && <th>Paid</th>}
                        {visibleColumns.balance && <th>Balance</th>}
                        {visibleColumns.created_by && <th>Created By</th>}
                        {visibleColumns.payment_info && <th>Payment Info</th>}
                        {visibleColumns.discount_details && <th>Discount Reason</th>}
                        {visibleColumns.actions && <th>Actions</th>}
                    </tr>
                </thead>
                <tbody>
                    {filteredMemberships.length > 0 ? (
                        filteredMemberships.map(mem => (
                            <tr key={mem.id}>
                                {visibleColumns.id && <td>{mem.id}</td>}
                                {visibleColumns.package && <td>{mem.package_name}</td>}
                                {visibleColumns.court && <td>{mem.court_name}</td>}
                                {visibleColumns.team && <td className="team-cell">{mem.current_members_count || 0} / {mem.max_team_size || 'N/A'}</td>}
                                {visibleColumns.time_slot && <td>{mem.time_slot}</td>}
                                {visibleColumns.start_date && <td>{format(new Date(mem.start_date), 'dd/MM/yyyy')}</td>}
                                {visibleColumns.end_date && <td>{format(new Date(mem.current_end_date), 'dd/MM/yyyy')}</td>}
                                {visibleColumns.price && <td>Rs. {mem.final_price}</td>}
                                {visibleColumns.paid && <td>Rs. {mem.amount_paid}</td>}
                                {visibleColumns.balance && <td style={{ color: mem.balance_amount > 0 ? 'red' : 'green' }}>Rs. {mem.balance_amount}</td>}
                                {visibleColumns.created_by && <td>{mem.created_by || '-'}</td>}
                                {visibleColumns.payment_info && <td className="small-text" title={mem.payment_info}>{mem.payment_info || '-'}</td>}
                                {visibleColumns.discount_details && <td>{mem.discount_details || '-'}</td>}
                                {visibleColumns.actions && (
                                    <td className="actions-cell">
                                        {status === 'active' && (
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
                                                                                 )}
                                                                                {status === 'ended' && (
                                                                                    <div className="actions-menu-container">
                                                                                        <button className="three-dots-btn" onClick={(e) => handleToggleMenu(mem.id, e)}>
                                                                                            &#8285;
                                                                                        </button>
                                                                                        {openMenuId === mem.id && (
                                                                                            <div className="actions-dropdown">
                                                                                                <button className="btn btn-primary btn-sm" onClick={() => handleOpenRenewModal(mem)}>Renew</button>
                                                                                                <button className="btn btn-danger btn-sm" onClick={() => handleTerminateEnded(mem.id)}>Terminate</button>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                                {status === 'terminated' && (
                                                                                    <button className="btn btn-secondary btn-sm" disabled>Receipt</button>
                                                                                )}
                                                                            </td>
                                                                        )}
                                                                    </tr>
                                                                ))
                                                            ) : (
                                                                <tr>
                                                                    <td colSpan={Object.values(visibleColumns).filter(Boolean).length}>No {pageTitle} found.</td>
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
                                                    )}            {isAddMemberModalOpen && membershipToAddMemberTo && (
                <AddTeamMemberModal
                    activeMembershipId={membershipToAddMemberTo.id}
                    maxTeamSize={membershipToAddMemberTo.max_team_size}
                    currentTeamSize={membershipToAddMemberTo.current_members_count}
                    onMemberAdded={fetchMemberships}
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
