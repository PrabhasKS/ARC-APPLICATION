import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import './DeskAnalytics.css';

const DeskAnalytics = ({ date }) => {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchSummary = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/analytics/desk-summary', { params: { date } });
            setSummary(data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch summary data.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [date]); // Dependency on date

    useEffect(() => {
        fetchSummary();

        // Set up SSE
const eventSource = new EventSource(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/events`); 
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.message === 'bookings_updated') {
                fetchSummary();
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE Error:', error);
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [fetchSummary]);

    if (loading) {
        return <div>Loading summary...</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    if (!summary) {
        return null;
    }

    const { 
        total_bookings = 0, 
        total_revenue = 0, 
        pending_amount = 0, 
        revenue_by_mode = [] 
    } = summary;

    return (
        <div className="desk-analytics-container">
            <div className="stat-item">
                <span className="stat-label">Total Bookings</span>
                <span className="stat-value">{total_bookings}</span>
            </div>
            <div className="stat-item">
                <span className="stat-label">Total Revenue</span>
                <span className="stat-value">₹{Number(total_revenue).toFixed(2)}</span>
            </div>
            <div className="stat-item">
                <span className="stat-label">Pending Amount</span>
                <span className="stat-value pending">₹{Number(pending_amount).toFixed(2)}</span>
            </div>
            <div className="stat-item mode-details">
                <span className="stat-label">Revenue by Mode</span>
                <div className="modes-wrapper">
                    {revenue_by_mode.length > 0 ? (
                        revenue_by_mode.map(mode => (
                            <span className="mode-item" key={mode.payment_mode}>
                                {mode.payment_mode}: <span className="mode-value">₹{Number(mode.total).toFixed(2)}</span>
                            </span>
                        ))
                    ) : (
                        <span className="no-data">No revenue data.</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DeskAnalytics;
