import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import './HolidayMgt.css';
import { format } from 'date-fns';

const HolidayMgt = () => {
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // New holiday form state
    const [holidayDate, setHolidayDate] = useState('');
    const [reason, setReason] = useState('');

    const fetchHolidays = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/memberships/holidays');
            setHolidays(response.data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch holidays.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHolidays();
    }, [fetchHolidays]);

    const handleCreateHoliday = async (e) => {
        e.preventDefault();
        setError('');
        if (!holidayDate || !reason) {
            setError('Date and reason are required.');
            return;
        }
        try {
            await api.post('/memberships/holidays', { holiday_date: holidayDate, reason });
            setHolidayDate('');
            setReason('');
            fetchHolidays(); // Refresh the list
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create holiday.');
            console.error(err);
        }
    };

    const handleDelete = async (holidayId) => {
        if (window.confirm('Are you sure you want to delete this holiday? This will not shorten memberships that were already compensated.')) {
            try {
                await api.delete(`/memberships/holidays/${holidayId}`);
                fetchHolidays(); // Refresh the list
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to delete holiday.');
                console.error(err);
            }
        }
    };
    
    return (
        <div className="holiday-mgt-container">
            <div className="holiday-form-card">
                <h3>Declare New Facility Holiday</h3>
                {error && <p className="error-message">{error}</p>}
                <form onSubmit={handleCreateHoliday} className="holiday-form">
                    <div className="form-group">
                        <label>Holiday Date</label>
                        <input 
                            type="date" 
                            value={holidayDate} 
                            onChange={e => setHolidayDate(e.target.value)} 
                            min={new Date().toISOString().slice(0, 10)} 
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label>Reason</label>
                        <input 
                            type="text" 
                            placeholder="e.g., Court Maintenance"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary">Declare Holiday</button>
                </form>
            </div>

            <div className="holiday-list-card">
                <h3>Declared Holidays</h3>
                {loading ? <p>Loading...</p> : (
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Reason</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {holidays.length > 0 ? (
                                holidays.map(h => (
                                    <tr key={h.id}>
                                        <td>{format(new Date(h.holiday_date), 'dd/MM/yyyy')}</td>
                                        <td>{h.reason}</td>
                                        <td className="actions-cell">
                                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(h.id)}>Delete</button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="3">No holidays declared.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default HolidayMgt;
