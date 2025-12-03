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
        const eventSource = new EventSource('http://localhost:5000/api/events');

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
            <div className="summary-card">
                <h4>Total Bookings</h4>
                <p>{total_bookings}</p>
            </div>
            <div className="summary-card">
                <h4>Total Revenue</h4>
                <p>₹{Number(total_revenue).toFixed(2)}</p>
            </div>
            <div className="summary-card">
                <h4>Pending Amount</h4>
                <p>₹{Number(pending_amount).toFixed(2)}</p>
            </div>
            <div className="summary-card">
                <h4>Revenue by Mode</h4>
                {revenue_by_mode.length > 0 ? (
                    <ul>
                        {revenue_by_mode.map(mode => (
                            <li key={mode.payment_mode}>
                                {mode.payment_mode}: ₹{Number(mode.total).toFixed(2)}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No revenue data.</p>
                )}
            </div>
        </div>
    );
};

export default DeskAnalytics;
