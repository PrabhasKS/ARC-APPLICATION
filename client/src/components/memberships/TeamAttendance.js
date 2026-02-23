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
            
            <table className="dashboard-table">
                <thead>
                    <tr>
                        {visibleColumns.id && <th>ID</th>}
                        {visibleColumns.package && <th>Package</th>}
                        {visibleColumns.court && <th>Court</th>}
                        {visibleColumns.team && <th>Team</th>}
                        {visibleColumns.time_slot && <th>Time Slot</th>}
                        {visibleColumns.status && <th>Status</th>}
                        {visibleColumns.created_by && <th>Created By</th>}
                        {visibleColumns.payment_info && <th>Payment Info</th>}
                        {visibleColumns.discount_details && <th>Discount Reason</th>}
                        {visibleColumns.action && <th>Action</th>}
                    </tr>
                </thead>
                <tbody>
                    {!loading && filteredMemberships.length > 0 ? (
                        filteredMemberships.map(mem => (
                            <tr key={mem.id}>
                                {visibleColumns.id && <td>{mem.id}</td>}
                                {visibleColumns.package && <td>{mem.package_name}</td>}
                                {visibleColumns.court && <td>{mem.court_name}</td>}
                                {visibleColumns.team && <td className="team-cell">{mem.team_members}</td>}
                                {visibleColumns.time_slot && <td>{mem.time_slot}</td>}
                                {visibleColumns.status && (
                                    <td>
                                        {onLeave.has(mem.id) ? (
                                            <span className="status-badge status-leave">ON LEAVE</span>
                                        ) : attended.has(mem.id) ? (
                                            <span className="status-badge status-present">PRESENT</span>
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
                        ))
                    ) : (
                        !loading && (
                            <tr>
                                <td colSpan={Object.values(visibleColumns).filter(Boolean).length}>No active memberships for the selected date.</td>
                            </tr>
                        )
                    )}
                </tbody>
            </table>

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
