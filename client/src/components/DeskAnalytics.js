import React, { useState, useEffect } from 'react';
import { getDeskSummary } from '../api';
import './DeskAnalytics.css';

const DeskAnalytics = ({ date }) => {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                setLoading(true);
                const { data } = await getDeskSummary(date);
                setSummary(data);
                setError(null);
            } catch (err) {
                setError('Failed to fetch summary data.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();
    }, [date]);

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
