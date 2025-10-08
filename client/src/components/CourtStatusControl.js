import React, { useState } from 'react';
import api from '../api';

const CourtStatusControl = ({ court, onStatusChange }) => {
    const [status, setStatus] = useState(court.status);
    const [isLoading, setIsLoading] = useState(false);

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
        <select value={status} onChange={handleStatusChange} disabled={isLoading}>
            <option value="Available">Available</option>
            <option value="Under Maintenance">Under Maintenance</option>
            <option value="Event">Event</option>
            <option value="Tournament">Tournament</option>
            <option value="Membership">Membership</option>
            <option value="Coaching">Coaching</option>
        </select>
    );
};

export default CourtStatusControl;
