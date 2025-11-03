import React, { useState } from 'react';
import api from '../api';

const DashboardCourtStatusToggle = ({ court, onStatusChange, user }) => {
    const [status, setStatus] = useState(court.status);
    const [isLoading, setIsLoading] = useState(false);

    const isEnabled = user && (user.role === 'admin' || user.role === 'desk');

    const handleStatusChange = async (e) => {
        const newStatus = e.target.value;
        setIsLoading(true);
        try {
            await api.put(`/courts/${court.id}/status`, { status: newStatus });
            setStatus(newStatus);
            onStatusChange(court.id, newStatus);
        } catch (error) {
            console.error('Failed to update court status', error);
            // Optionally, revert the status in the UI
        }
        setIsLoading(false);
    };

    return (
        <select value={status} onChange={handleStatusChange} disabled={isLoading || !isEnabled}>
            <option value="Available">Available</option>
            <option value="Under Maintenance">Maintenance</option>
            <option value="Membership">Membership</option>
            <option value="Coaching">Coaching</option>
        </select>
    );
};

export default DashboardCourtStatusToggle;
