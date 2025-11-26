import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import './TeamAttendance.css';

const TeamAttendance = () => {
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [memberships, setMemberships] = useState([]);
    const [attended, setAttended] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            // These endpoints need to be adapted on the backend to accept a date filter
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
            {loading && <p>Loading...</p>}
            {error && <p className="error-message">{error}</p>}
            
            <table className="dashboard-table">
                <thead>
                    <tr>
                        <th>Package</th>
                        <th>Court</th>
                        <th>Team</th>
                        <th>Time Slot</th>
                        <th>Status</th>
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
                            </tr>
                        ))
                    ) : (
                        !loading && (
                            <tr>
                                <td colSpan="5">No active memberships for the selected date.</td>
                            </tr>
                        )
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default TeamAttendance;
