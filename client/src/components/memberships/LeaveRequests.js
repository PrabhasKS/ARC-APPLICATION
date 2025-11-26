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

    const handleUpdateRequest = async (id, status) => {
        try {
            await api.put(`/memberships/leave-requests/${id}`, { status });
            fetchLeaveRequests(); // Refresh the list
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update leave request.');
            console.error(err);
        }
    };

    if (loading) {
        return <div>Loading leave requests...</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="leave-requests-container">
            <h3>Membership Leave Requests</h3>
            <table className="dashboard-table">
                <thead>
                    <tr>
                        <th>Package Name</th>
                        <th>Team</th>
                        <th>Leave Days</th>
                        <th>Reason</th>
                        <th>Requested On</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {requests.length > 0 ? (
                        requests.map(req => (
                            <tr key={req.id}>
                                <td>{req.package_name}</td>
                                <td className="team-cell">{req.team_members}</td>
                                <td>{req.leave_days}</td>
                                <td>{req.reason || '-'}</td>
                                <td>{new Date(req.requested_at).toLocaleDateString()}</td>
                                <td>
                                    <span className={`status-badge status-${req.status.toLowerCase()}`}>
                                        {req.status}
                                    </span>
                                </td>
                                <td className="actions-cell">
                                    {req.status === 'PENDING' && (
                                        <>
                                            <button className="btn btn-success btn-sm" onClick={() => handleUpdateRequest(req.id, 'APPROVED')}>Approve</button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleUpdateRequest(req.id, 'REJECTED')}>Reject</button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="7">No leave requests found.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default LeaveRequests;
