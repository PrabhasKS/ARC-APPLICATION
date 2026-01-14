import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import AttendanceCalendarModal from './AttendanceCalendarModal';
import MarkLeaveModal from './MarkLeaveModal';
import './TeamAttendance.css';

const TeamAttendance = () => {
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [memberships, setMemberships] = useState([]);
    const [attended, setAttended] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalError, setModalError] = useState(null);

    const [selectedMembership, setSelectedMembership] = useState(null);
    const [attendanceHistory, setAttendanceHistory] = useState([]);
    const [leaveHistory, setLeaveHistory] = useState([]);

    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
    const [selectedMembershipForLeave, setSelectedMembershipForLeave] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [mems, atts] = await Promise.all([
                api.get(`/memberships/active?date=${date}`),
                api.get(`/memberships/team-attendance?date=${date}`)
            ]);
            setMemberships(mems.data);
            setAttended(new Set(atts.data.map(a => a.membership_id)));
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
            // Fetch both attendance and leave history
            const [attRes, leaveRes] = await Promise.all([
                api.get(`/memberships/active/${membership.id}/attendance-history`),
                api.get(`/memberships/active/${membership.id}/leave-history`)
            ]);
            setAttendanceHistory(attRes.data);
            setLeaveHistory(leaveRes.data);
            setSelectedMembership(membership);
        } catch (err) {
            console.error(err);
            alert('Failed to fetch history.');
        }
    };

    const handleOpenLeaveModal = (membership) => {
        setSelectedMembershipForLeave(membership);
        setIsLeaveModalOpen(true);
        setModalError(null);
    };

    const handleCloseLeaveModal = () => {
        setIsLeaveModalOpen(false);
        setSelectedMembershipForLeave(null);
        setModalError(null);
    };

    const handleGrantLeaveSubmit = async (membershipId, leaveData) => {
        try {
            await api.post('/memberships/grant-leave', { membership_id: membershipId, ...leaveData });
            fetchData(); // Refresh the list
            handleCloseLeaveModal();
        } catch (err) {
            setModalError(err.response?.data?.message || 'Failed to grant leave.');
            console.error(err);
        }
    };

    return (
        <div className="attendance-container">
            <h3>Mark Team Attendance</h3>
            <div className="form-group attendance-datepicker">
                <label>Select Date</label>
                <input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)}
                />
            </div>
            {loading && !selectedMembership && !isLeaveModalOpen && <p>Loading...</p>}
            {error && <p className="error-message">{error}</p>}
            
            <table className="dashboard-table">
                <thead>
                    <tr>
                        <th>Package</th>
                        <th>Court</th>
                        <th>Team</th>
                        <th>Time Slot</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {!loading && memberships.length > 0 ? (
                        memberships.map(mem => (
                            <tr key={mem.id}>
                                <td>{mem.package_name}</td>
                                <td>{mem.court_name}</td>
                                <td className="team-cell">{mem.team_members}</td>
                                <td>{mem.time_slot}</td>
                                <td>
                                    {attended.has(mem.id) ? (
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
                                <td>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <button 
                                            className="btn btn-info btn-sm"
                                            onClick={() => handleViewCalendar(mem)}
                                        >
                                            View Calendar
                                        </button>
                                        <button 
                                            className="btn btn-warning btn-sm"
                                            onClick={() => handleOpenLeaveModal(mem)}
                                        >
                                            Mark Leave
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : (
                        !loading && (
                            <tr>
                                <td colSpan="6">No active memberships for the selected date.</td>
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
