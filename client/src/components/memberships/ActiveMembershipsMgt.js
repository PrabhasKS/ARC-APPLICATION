import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api';
import RenewModal from './RenewModal';
import AddMembershipPaymentModal from './AddMembershipPaymentModal';
import AddTeamPaymentModal from './AddTeamPaymentModal';
import MarkLeaveModal from './MarkLeaveModal';
import RenewalConfirmationModal from './RenewalConfirmationModal';
import MembershipReceiptModal from './MembershipReceiptModal';
import './PackageMgt.css';
import { format } from 'date-fns';

const ActiveMembershipsMgt = ({ status = 'active' }) => {
    const [memberships, setMemberships] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalError, setModalError] = useState(null);

    const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
    const [selectedMembership, setSelectedMembership] = useState(null);

    const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);
    const [selectedMembershipForPayment, setSelectedMembershipForPayment] = useState(null);

    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
    const [selectedMembershipForLeave, setSelectedMembershipForLeave] = useState(null);

    const [isAddTeamPaymentModalOpen, setIsAddTeamPaymentModalOpen] = useState(false);
    const [selectedTeamForPayment, setSelectedTeamForPayment] = useState(null);

    const [isRenewalConfirmationModalOpen, setIsRenewalConfirmationModalOpen] = useState(false);
    const [renewedMembershipDetails, setRenewedMembershipDetails] = useState(null);

    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [selectedMembershipForReceipt, setSelectedMembershipForReceipt] = useState(null);
    const [isTeamReceipt, setIsTeamReceipt] = useState(false);

    // Renew Whole Team state
    const [isRenewTeamModalOpen, setIsRenewTeamModalOpen] = useState(false);
    const [selectedGroupForRenew, setSelectedGroupForRenew] = useState(null);
    const [renewTeamStartDate, setRenewTeamStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [renewTeamPaymentAmount, setRenewTeamPaymentAmount] = useState(0);
    const [renewTeamPaymentMode, setRenewTeamPaymentMode] = useState('Cash');
    const [renewTeamSubmitting, setRenewTeamSubmitting] = useState(false);

    const [expandedTeams, setExpandedTeams] = useState(new Set()); // New state for collapsible teams

    const [openMenuId, setOpenMenuId] = useState(null);
    const [openTeamMenuId, setOpenTeamMenuId] = useState(null);
    const [filterText, setFilterText] = useState('');
    const [showColumnMenu, setShowColumnMenu] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState({
        id: true,
        member: true,
        team: true,
        package: true,
        court: true,
        time_slot: true,
        start_date: true,
        end_date: true,
        price: true,
        paid: true,
        balance: true,
        payment_info: false,
        discount_details: false,
        actions: true
    });

    const fetchMemberships = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get(`/memberships/${status}`);
            setMemberships(response.data);
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

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                setError(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

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

    const handleCloseRenewalConfirmationModal = () => {
        setIsRenewalConfirmationModalOpen(false);
        setRenewedMembershipDetails(null);
    };

    const handleOpenReceiptModal = (membership) => {
        setSelectedMembershipForReceipt(membership);
        setIsTeamReceipt(false);
        setIsReceiptModalOpen(true);
        setOpenMenuId(null);
    };

    const handleOpenTeamReceiptModal = (group) => {
        setSelectedMembershipForReceipt(group);
        setIsTeamReceipt(true);
        setIsReceiptModalOpen(true);
        setOpenTeamMenuId(null);
    };

    const handleCloseReceiptModal = () => {
        setIsReceiptModalOpen(false);
        setSelectedMembershipForReceipt(null);
    };

    const handleRenewSubmit = async (membershipId, renewalData) => {
        try {
            const response = await api.put(`/memberships/active/${membershipId}/renew`, renewalData);
            fetchMemberships();
            handleCloseRenewModal();
            setRenewedMembershipDetails(response.data);
            setIsRenewalConfirmationModalOpen(true);
        } catch (err) {
            setModalError(err.response?.data?.message || 'Failed to renew membership.');
            console.error(err);
        }
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

    const handleOpenAddTeamPaymentModal = (group) => {
        setSelectedTeamForPayment(group);
        setIsAddTeamPaymentModalOpen(true);
        setModalError(null);
        setOpenTeamMenuId(null);
    };

    const handleCloseAddTeamPaymentModal = () => {
        setIsAddTeamPaymentModalOpen(false);
        setSelectedTeamForPayment(null);
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
            const response = await api.post('/memberships/grant-leave', { membership_id: membershipId, ...leaveData });
            if (response && response.data.status === 'success') {
                fetchMemberships();
                handleCloseLeaveModal();
                return { status: 'success' };
            } else if (response && response.data.status === 'conflict') {
                return response.data;
            }
        } catch (err) {
            console.error('ActiveMembershipsMgt: Caught error in handleGrantLeaveSubmit:', err);
            setModalError(err.response?.data?.message || 'Failed to grant leave.');
            throw err;
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
                fetchMemberships();
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to terminate ended membership.');
            } finally {
                setOpenMenuId(null);
            }
        }
    };

    const handleTerminateTeam = async (group) => {
        if (window.confirm(`Are you sure you want to terminate all ${group.members.length} active members in team ${group.team_name}? This action cannot be undone.`)) {
            try {
                await Promise.all(group.members.map(mem => api.delete(`/memberships/active/${mem.id}`)));
                fetchMemberships();
            } catch (err) {
                setError('Failed to terminate one or more memberships in the team.');
            }
        }
    };

    const handleTerminateEndedTeam = async (group) => {
        if (window.confirm(`Are you sure you want to terminate all ${group.members.length} ended members in team ${group.team_name}? This will move them to the terminated list.`)) {
            try {
                await Promise.all(group.members.map(mem => api.put(`/memberships/ended/${mem.id}/terminate`)));
                fetchMemberships();
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to terminate one or more ended memberships in the team.');
            }
        }
    };

    const handleOpenRenewTeamModal = (group) => {
        setSelectedGroupForRenew(group);
        setRenewTeamStartDate(new Date().toISOString().slice(0, 10));
        setRenewTeamPaymentAmount(0);
        setRenewTeamPaymentMode('Cash');
        setIsRenewTeamModalOpen(true);
        setOpenTeamMenuId(null);
    };

    const handleRenewWholeTeam = async () => {
        if (!selectedGroupForRenew) return;
        setRenewTeamSubmitting(true);
        try {
            await api.post(`/memberships/teams/${selectedGroupForRenew.team_id}/renew-all`, {
                start_date: renewTeamStartDate,
                initial_payment: {
                    amount: parseFloat(renewTeamPaymentAmount) || 0,
                    payment_mode: renewTeamPaymentMode,
                }
            });
            setIsRenewTeamModalOpen(false);
            setSelectedGroupForRenew(null);
            fetchMemberships();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to renew team.');
        } finally {
            setRenewTeamSubmitting(false);
        }
    };

    const toggleTeamExpand = (teamId) => {
        setExpandedTeams(prev => {
            const next = new Set(prev);
            if (next.has(teamId)) {
                next.delete(teamId);
            } else {
                next.add(teamId);
            }
            return next;
        });
    };

    const handleToggleMenu = (membershipId, event) => {
        event.stopPropagation();
        setOpenMenuId(openMenuId === membershipId ? null : membershipId);
        setOpenTeamMenuId(null);
    };

    const handleToggleTeamMenu = (teamId, event) => {
        event.stopPropagation();
        setOpenTeamMenuId(openTeamMenuId === teamId ? null : teamId);
        setOpenMenuId(null);
    };

    // Close menus when clicking outside
    useEffect(() => {
        const closeMenus = () => {
            setOpenMenuId(null);
            setOpenTeamMenuId(null);
        };
        document.addEventListener('click', closeMenus);
        return () => document.removeEventListener('click', closeMenus);
    }, []);

    const toggleColumn = (key) => {
        setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const groupedMemberships = useMemo(() => {
        const groups = {};
        memberships.forEach(mem => {
            // Guard against undefined/null rows from the API
            if (!mem || mem.id == null) return;

            const search = filterText.toLowerCase();
            const matchesSearch = (
                mem.id.toString().includes(search) ||
                mem.package_name?.toLowerCase().includes(search) ||
                mem.court_name?.toLowerCase().includes(search) ||
                mem.member_name?.toLowerCase().includes(search) ||
                mem.team_name?.toLowerCase().includes(search)
            );

            if (matchesSearch) {
                const teamId = mem.team_id || 'unassigned';
                if (!groups[teamId]) {
                    groups[teamId] = {
                        team_id: teamId,
                        team_name: mem.team_name || 'Individual / No Team',
                        court_name: mem.court_name,
                        time_slot: mem.time_slot,
                        created_by: mem.created_by,
                        status: mem.status,
                        members: []
                    };
                }
                groups[teamId].members.push(mem);
            }
        });
        return Object.values(groups).sort((a, b) => {
            if (a.team_id === 'unassigned') return 1;
            if (b.team_id === 'unassigned') return -1;
            return b.team_id - a.team_id;
        });
    }, [memberships, filterText]);

    const pageTitle = `${status.charAt(0).toUpperCase() + status.slice(1)} Memberships`;

    if (loading) {
        return <div className="loading-state">Loading {status} memberships...</div>;
    }

    return (
        <div className="package-mgt-container">
            {error && (
                <div className="error-message-inline">
                    {error}
                    <button onClick={() => setError(null)} className="close-error-btn">&times;</button>
                </div>
            )}
            <div className="package-mgt-header shared-header">
                <h3>{pageTitle}</h3>
                <div className="header-controls-right">
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
            
            {groupedMemberships.length > 0 ? (
                groupedMemberships.map(group => (
                    <div key={group.team_id} className="team-group-card" style={{ marginBottom: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
                        <div 
                            className="team-group-header" 
                            style={{ cursor: 'pointer', backgroundColor: '#f8f9fa', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: expandedTeams.has(group.team_id) ? '1px solid #eee' : 'none' }}
                            onClick={() => toggleTeamExpand(group.team_id)}
                        >
                            <div className="team-info-main" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span className="team-badge" style={{ backgroundColor: '#007bff', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>TEAM</span>
                                <h4 style={{ margin: 0 }}>{group.team_name}</h4>
                            </div>
                            <div className="team-location-details" style={{ display: 'flex', gap: '20px', alignItems: 'center', fontSize: '14px', color: '#555' }}>
                                <span><strong>Court:</strong> {group.court_name}</span>
                                <span><strong>Slot:</strong> {group.time_slot}</span>
                                <span className="member-count-badge" style={{ backgroundColor: '#e9ecef', padding: '4px 8px', borderRadius: '12px', fontSize: '12px' }}>{group.members.length} Members</span>
                                <span style={{ fontSize: '12px', color: '#888', marginRight: '10px' }}>{expandedTeams.has(group.team_id) ? '▲ Collapse' : '▼ Expand'}</span>
                                {/* Team Actions Menu */}
                                {status !== 'terminated' && (
                                    <div className="actions-menu-container" style={{ position: 'relative' }}>
                                        <button 
                                            className="three-dots-btn" 
                                            onClick={(e) => handleToggleTeamMenu(group.team_id, e)}
                                            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 5px' }}
                                        >
                                            &#8285;
                                        </button>
                                        {openTeamMenuId === group.team_id && (
                                            <div className="actions-dropdown" style={{ right: 0, left: 'auto', zIndex: 10 }}>
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenAddTeamPaymentModal(group); setOpenTeamMenuId(null); }}>Add Team Payment</button>
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenTeamReceiptModal(group); }}>Team Receipt</button>
                                                {status === 'active' && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleTerminateTeam(group); setOpenTeamMenuId(null); }}>Terminate Whole Team</button>
                                                )}
                                                {status === 'ended' && (
                                                    <>
                                                        <button onClick={(e) => { e.stopPropagation(); handleOpenRenewTeamModal(group); }}>Renew Whole Team</button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleTerminateEndedTeam(group); setOpenTeamMenuId(null); }}>Terminate Whole Team</button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {expandedTeams.has(group.team_id) && (
                            <div className="team-members-table-wrapper" style={{ padding: '0' }}>
                                <table className="dashboard-table membership-nested-table" style={{ margin: 0, borderTop: 'none' }}>
                                <thead>
                                    <tr>
                                        {visibleColumns.id && <th>ID</th>}
                                        {visibleColumns.member && <th>Member</th>}
                                        {visibleColumns.package && <th>Package</th>}
                                        {visibleColumns.start_date && <th>Start Date</th>}
                                        {visibleColumns.end_date && <th>End Date</th>}
                                        {visibleColumns.price && <th>Total Price</th>}
                                        {visibleColumns.paid && <th>Paid</th>}
                                        {visibleColumns.balance && <th>Balance</th>}
                                        {visibleColumns.payment_info && <th>Payment Info</th>}
                                        {visibleColumns.discount_details && <th>Discount Reason</th>}
                                        {visibleColumns.actions && <th>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {group.members.map(mem => (
                                        <tr key={mem.id}>
                                            {visibleColumns.id && <td>{mem.id}</td>}
                                            {visibleColumns.member && <td>{mem.member_name} <br/><small>{mem.member_contact || mem.phone_number || ''}</small></td>}
                                            {visibleColumns.package && <td>{mem.package_name}</td>}
                                            {visibleColumns.start_date && <td>{format(new Date(mem.start_date), 'dd/MM/yyyy')}</td>}
                                            {visibleColumns.end_date && <td>{format(new Date(mem.current_end_date), 'dd/MM/yyyy')}</td>}
                                            {visibleColumns.price && <td>Rs. {mem.final_price_calc || mem.package_price || '0'}</td>}
                                            {visibleColumns.paid && <td>Rs. {mem.amount_paid || '0'}</td>}
                                            {visibleColumns.balance && <td style={{ color: mem.balance_amount > 0 ? 'red' : 'green' }}>Rs. {mem.balance_amount || '0'}</td>}
                                            {visibleColumns.payment_info && <td className="small-text" title={mem.payment_info}>{mem.payment_info || '-'}</td>}
                                            {visibleColumns.discount_details && <td>{mem.discount_details || '-'}</td>}
                                            {visibleColumns.actions && (
                                                <td className="actions-cell">
                                                    <div className="actions-menu-container">
                                                        <button className="three-dots-btn" onClick={(e) => handleToggleMenu(mem.id, e)}>
                                                            &#8285;
                                                        </button>
                                                        {openMenuId === mem.id && (
                                                            <div className="actions-dropdown">
                                                                {status === 'active' && (
                                                                    <>
                                                                        <button className="btn btn-info btn-sm" onClick={() => handleOpenReceiptModal(mem)}>Receipt</button>
                                                                        {mem.balance_amount > 0 && <button className="btn btn-success btn-sm" onClick={() => handleOpenAddPaymentModal(mem)}>Add Payment</button>}
                                                                        <button className="btn btn-warning btn-sm" onClick={() => handleOpenLeaveModal(mem)}>Mark Leave</button>
                                                                        <button className="btn btn-danger btn-sm" onClick={() => handleTerminate(mem.id)}>Terminate</button>
                                                                    </>
                                                                )}
                                                                {status === 'ended' && (
                                                                    <>
                                                                        <button className="btn btn-info btn-sm" onClick={() => handleOpenReceiptModal(mem)}>Receipt</button>
                                                                        {mem.balance_amount > 0 && <button className="btn btn-success btn-sm" onClick={() => handleOpenAddPaymentModal(mem)}>Add Payment</button>}
                                                                        <button className="btn btn-primary btn-sm" onClick={() => handleOpenRenewModal(mem)}>Renew</button>
                                                                        <button className="btn btn-danger btn-sm" onClick={() => handleTerminateEnded(mem.id)}>Terminate</button>
                                                                    </>
                                                                )}
                                                                {status === 'terminated' && (
                                                                     <span>No actions</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        )}
                    </div>
                ))
            ) : (
                <div className="no-membership-message">No {pageTitle} found.</div>
            )}

            {isRenewModalOpen && (
                <RenewModal 
                    membership={selectedMembership}
                    onRenew={handleRenewSubmit}
                    onClose={handleCloseRenewModal}
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
            {isAddTeamPaymentModalOpen && selectedTeamForPayment && (
                <AddTeamPaymentModal
                    group={selectedTeamForPayment}
                    onPaymentAdded={() => fetchMemberships()}
                    onClose={handleCloseAddTeamPaymentModal}
                    error={modalError}
                />
            )}
            {isRenewalConfirmationModalOpen && renewedMembershipDetails && (
                <RenewalConfirmationModal
                    renewedMembership={renewedMembershipDetails}
                    onClose={handleCloseRenewalConfirmationModal}
                />
            )}

            {isReceiptModalOpen && (
                <MembershipReceiptModal
                    membership={selectedMembershipForReceipt}
                    onClose={handleCloseReceiptModal}
                    isTeam={isTeamReceipt}
                />
            )}

            {/* Renew Whole Team Inline Modal */}
            {isRenewTeamModalOpen && selectedGroupForRenew && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '480px' }}>
                        <div className="modal-header">
                            <h2>Renew Team: {selectedGroupForRenew.team_name}</h2>
                            <button onClick={() => setIsRenewTeamModalOpen(false)} className="close-button">&times;</button>
                        </div>
                        <div className="modal-form">
                            <p style={{ marginBottom: '1rem', color: '#555' }}>
                                Renewing <strong>{selectedGroupForRenew.members.length} member(s)</strong> — each keeps their own package duration.
                            </p>
                            <div className="form-group">
                                <label>New Start Date (for all)</label>
                                <input type="date" value={renewTeamStartDate} onChange={e => setRenewTeamStartDate(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label>Initial Payment per member (Rs.)</label>
                                <input type="number" value={renewTeamPaymentAmount} onChange={e => setRenewTeamPaymentAmount(e.target.value)} min="0" />
                            </div>
                            <div className="form-group">
                                <label>Payment Mode</label>
                                <select value={renewTeamPaymentMode} onChange={e => setRenewTeamPaymentMode(e.target.value)}>
                                    <option>Cash</option>
                                    <option>Online</option>
                                    <option>Cheque</option>
                                </select>
                            </div>
                            <div className="modal-footer" style={{ marginTop: '1.5rem' }}>
                                <button className="btn btn-secondary" onClick={() => setIsRenewTeamModalOpen(false)} disabled={renewTeamSubmitting}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleRenewWholeTeam} disabled={renewTeamSubmitting || !renewTeamStartDate}>
                                    {renewTeamSubmitting ? 'Renewing...' : `Renew ${selectedGroupForRenew.members.length} Member(s)`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActiveMembershipsMgt;