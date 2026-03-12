import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import AttendanceCalendarModal from './AttendanceCalendarModal';
import MarkLeaveModal from './MarkLeaveModal';
import './TeamAttendance.css';
import './PackageMgt.css';

const getTodayString = () => {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
};

const TeamAttendance = () => {
    const [date, setDate] = useState(getTodayString());
    const [memberships, setMemberships] = useState([]);
    const [attended, setAttended] = useState(new Set());
    const [onLeave, setOnLeave] = useState(new Set()); // New state for members on leave
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalError, setModalError] = useState(null);

    const [selectedMembership, setSelectedMembership] = useState(null);
    const [attendanceHistory, setAttendanceHistory] = useState([]);
    const [leaveHistory, setLeaveHistory] = useState([]);

    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
    const [selectedMembershipForLeave, setSelectedMembershipForLeave] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [openTeamMenuId, setOpenTeamMenuId] = useState(null);

    const [expandedTeams, setExpandedTeams] = useState(new Set()); // New state for collapsible teams

    const [filterText, setFilterText] = useState('');
    const [showColumnMenu, setShowColumnMenu] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState({
        id: true, // Added Team ID
        package: true,
        court: true,
        team: true,
        time_slot: true,
        status: true,
        created_by: false,
        payment_info: false,
        discount_details: false,
        action: true
    });

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [mems, atts, leaves] = await Promise.all([
                api.get(`/memberships/active?date=${date}`),
                api.get(`/memberships/team-attendance?date=${date}`),
                api.get(`/memberships/on-leave?date=${date}`) // Fetch memberships on leave
            ]);
            setMemberships(mems.data);
            setAttended(new Set(atts.data.map(a => a.membership_id)));
            setOnLeave(new Set(leaves.data)); // Set the new state
            setError(null);
        } catch (err) {
            setError('Failed to fetch data for the selected date.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [date]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const handleClickOutside = () => {
            setShowColumnMenu(false);
            setOpenMenuId(null);
            setOpenTeamMenuId(null);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const toggleColumn = (key) => {
        setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
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

    const handleMarkAttendance = async (membership_id) => {
        try {
            await api.post('/memberships/team-attendance', {
                membership_id,
                attendance_date: date
            });
            fetchData(); // Refresh list
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to mark attendance.');
        }
    };

    const handleViewCalendar = async (membership) => {
        try {
            const [attRes, leaveRes] = await Promise.all([
                api.get(`/memberships/active/${membership.id}/attendance-history`),
                api.get(`/memberships/active/${membership.id}/leave-history`)
            ]);
            setAttendanceHistory(attRes.data);
            setLeaveHistory(leaveRes.data);
            setSelectedMembership(membership);
            setOpenMenuId(null);
        } catch (err) {
            console.error(err);
            alert('Failed to fetch history.');
        }
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
            
            if (response.data.status === 'success') {
                fetchData();
                handleCloseLeaveModal();
                return { status: 'success' };
            } else if (response.data.status === 'conflict') {
                return response.data;
            }
        } catch (err) {
            setModalError(err.response?.data?.message || 'Failed to grant leave.');
            console.error(err);
            throw err;
        }
    };

    const handleMarkTeamAttendance = async (group) => {
        try {
            // Filter out members who are on leave or already marked present
            const membersToMark = group.members.filter(mem => !onLeave.has(mem.id) && !attended.has(mem.id));
            if (membersToMark.length === 0) {
                alert('All eligible members are already marked present or on leave.');
                return;
            }

            await Promise.all(membersToMark.map(mem => 
                api.post('/memberships/team-attendance', {
                    membership_id: mem.id,
                    attendance_date: date
                })
            ));
            fetchData();
        } catch (err) {
            setError('Failed to mark attendance for the whole team.');
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

    const filteredMemberships = memberships.filter(mem => {
        const search = filterText.toLowerCase();
        return (
            mem.id.toString().includes(search) ||
            mem.package_name?.toLowerCase().includes(search) ||
            mem.court_name?.toLowerCase().includes(search) ||
            mem.member_name?.toLowerCase().includes(search) ||
            mem.team_name?.toLowerCase().includes(search) ||
            mem.created_by?.toLowerCase().includes(search)
        );
    });

    // Group memberships by team
    const groupedMemberships = React.useMemo(() => {
        const groups = {};
        filteredMemberships.forEach(mem => {
            const teamId = mem.team_id || 'unassigned';
            if (!groups[teamId]) {
                groups[teamId] = {
                    team_id: teamId,
                    team_name: mem.team_name || 'Individual / No Team',
                    court_name: mem.court_name,
                    time_slot: mem.time_slot,
                    members: []
                };
            }
            groups[teamId].members.push(mem);
        });
        return Object.values(groups).sort((a, b) => {
            if (a.team_id === 'unassigned') return 1;
            if (b.team_id === 'unassigned') return -1;
            return b.team_id - a.team_id;
        });
    }, [filteredMemberships]);

    return (
        <div className="attendance-container">
            <h3>Mark Team Attendance</h3>
            <div className="package-mgt-header shared-header">
                <div className="form-group attendance-datepicker">
                    <label>Select Date</label>
                    <input 
                        type="date" 
                        value={date} 
                        onChange={e => setDate(e.target.value)}
                    />
                </div>
                <div className="header-controls-right">
                    <input 
                        type="text" 
                        placeholder="Search..." 
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

            {loading && !selectedMembership && !isLeaveModalOpen && <p>Loading...</p>}
            {error && <p className="error-message">{error}</p>}
            
            <div className="package-mgt-container" style={{ padding: 0 }}>
                {!loading && groupedMemberships.length > 0 ? (
                    groupedMemberships.map(group => (
                        <div key={group.team_id} className="team-group-card" style={{ marginBottom: '1rem', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
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
                                                <button onClick={(e) => { e.stopPropagation(); handleMarkTeamAttendance(group); setOpenTeamMenuId(null); }}>
                                                    Mark Present for Whole Team
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
    
                            {expandedTeams.has(group.team_id) && (
                                <div className="team-members-table-wrapper" style={{ padding: '0' }}>
                                    <table className="dashboard-table membership-nested-table" style={{ margin: 0, borderTop: 'none' }}>
                                        <thead>
                                            <tr>
                                                {visibleColumns.id && <th>ID</th>}
                                                {visibleColumns.package && <th>Package</th>}
                                                {visibleColumns.member && <th>Member</th>}
                                                {visibleColumns.status && <th>Status</th>}
                                                {visibleColumns.created_by && <th>Created By</th>}
                                                {visibleColumns.payment_info && <th>Payment Info</th>}
                                                {visibleColumns.discount_details && <th>Discount Reason</th>}
                                                {visibleColumns.action && <th>Action</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.members.map(mem => (
                                                <tr key={mem.id}>
                                                    {visibleColumns.id && <td>{mem.id}</td>}
                                                    {visibleColumns.package && <td>{mem.package_name}</td>}
                                                    {visibleColumns.member && <td>{mem.member_name} <br/><small>{mem.member_contact || mem.phone_number || ''}</small></td>}
                                                    {visibleColumns.status && (
                                                        <td>
                                                            {onLeave.has(mem.id) ? (
                                                                <button className="btn btn-warning btn-sm" disabled style={{ opacity: 1, cursor: 'default' }}>On Leave</button>
                                                            ) : attended.has(mem.id) ? (
                                                                <button className="btn btn-success btn-sm" disabled style={{ opacity: 0.7, cursor: 'default' }}>Marked Present</button>
                                                            ) : (
                                                                <button 
                                                                    className="btn btn-success btn-sm"
                                                                    onClick={() => handleMarkAttendance(mem.id)}
                                                                >
                                                                    Mark Present
                                                                </button>
                                                            )}
                                                        </td>
                                                    )}
                                                    {visibleColumns.created_by && <td>{mem.created_by || '-'}</td>}
                                                    {visibleColumns.payment_info && <td className="small-text" title={mem.payment_info}>{mem.payment_info || '-'}</td>}
                                                    {visibleColumns.discount_details && <td>{mem.discount_details || '-'}</td>}
                                                    {visibleColumns.action && (
                                                        <td className="actions-cell">
                                                            <div className="actions-menu-container">
                                                                <button className="three-dots-btn" onClick={(e) => handleToggleMenu(mem.id, e)}>
                                                                    &#8285;
                                                                </button>
                                                                {openMenuId === mem.id && (
                                                                    <div className="actions-dropdown">
                                                                        <button onClick={() => handleViewCalendar(mem)}>
                                                                            View Calendar
                                                                        </button>
                                                                        <button onClick={() => handleOpenLeaveModal(mem)}>
                                                                            Mark Leave
                                                                        </button>
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
                    !loading && (
                        <div className="no-membership-message">No active memberships for the selected date.</div>
                    )
                )}
            </div>

            {selectedMembership && (
                <AttendanceCalendarModal 
                    membership={selectedMembership}
                    attendanceHistory={attendanceHistory}
                    leaveHistory={leaveHistory}
                    onClose={() => setSelectedMembership(null)}
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

export default TeamAttendance;
