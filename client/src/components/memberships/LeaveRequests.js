import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import './LeaveRequests.css';

const LeaveRequests = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchLeaveRequests = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/memberships/leave-requests');
            setRequests(response.data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch leave requests.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLeaveRequests();
    }, [fetchLeaveRequests]);

    if (loading) {
        return <div>Loading leave requests...</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="leave-requests-container">
            <h3>Membership Leave Records</h3>
            <table className="dashboard-table">
                <thead>
                    <tr>
                        <th>Team ID</th>
                        <th>Package</th>
                        <th>Team</th>
                        <th>Leave Period</th>
                        <th>Days</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Approved By</th>
                    </tr>
                </thead>
                <tbody>
                    {requests.length > 0 ? (
                        requests.map(req => (
                            <tr key={req.id}>
                                <td>{req.membership_id}</td>
                                <td>{req.package_name}</td>
                                <td className="team-cell">{req.team_members}</td>
                                <td>
                                    {req.start_date && req.end_date ? 
                                        `${new Date(req.start_date).toLocaleDateString()} - ${new Date(req.end_date).toLocaleDateString()}` : 
                                        'N/A'}
                                </td>
                                <td>{req.leave_days}</td>
                                <td>{req.reason || '-'}</td>
                                <td>
                                    <span className={`status-badge status-${req.status.toLowerCase()}`}>
                                        {req.status}
                                    </span>
                                </td>
                                <td>{req.approved_by || '-'}</td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="8">No leave records found.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default LeaveRequests;
