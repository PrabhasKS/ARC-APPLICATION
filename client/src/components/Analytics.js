import React, { useState, useEffect } from 'react';
import api from '../api';
import { Line, Pie, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Tooltip,
    Legend,
    Title,
} from 'chart.js';
import './Analytics.css'; // This now points to your new, enhanced CSS

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Tooltip,
    Legend,
    Title
);

// --- ALL YOUR LOGIC IS UNCHANGED ---
const Analytics = () => {
    const [summary, setSummary] = useState({});
    const [bookingsOverTime, setBookingsOverTime] = useState({});
    const [revenueBySport, setRevenueBySport] = useState({});
    const [dailyUtilization, setDailyUtilization] = useState({});
    const [bookingStatusData, setBookingStatusData] = useState({});
    const [revenueByPaymentModeData, setRevenueByPaymentModeData] = useState({});
    const [staffPerformanceData, setStaffPerformanceData] = useState({});
    const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
    const [activeFilter, setActiveFilter] = useState('today');

    useEffect(() => {
        setDatePreset('today');
    }, []);

    useEffect(() => {
        fetchAnalyticsData(dateRange);
    }, [dateRange]);

    const fetchAnalyticsData = async (dates) => {
        try {
            const params = { ...dates };

            // Summary Cards
            const summaryRes = await api.get('/analytics/summary', { params });
            setSummary(summaryRes.data);

            // Bookings Over Time
            const bookingsOverTimeRes = await api.get('/analytics/bookings-over-time', { params });
            setBookingsOverTime({
                labels: bookingsOverTimeRes.data.map(d => new Date(d.date).toLocaleDateString()),
                datasets: [{
                    label: 'Bookings',
                    data: bookingsOverTimeRes.data.map(d => d.count),
                    fill: false,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            });

            // Revenue by Sport
            const revenueBySportRes = await api.get('/analytics/revenue-by-sport', { params });
            setRevenueBySport({
                labels: revenueBySportRes.data.map(d => d.name),
                datasets: [{
                    label: 'Revenue',
                    data: revenueBySportRes.data.map(d => d.revenue),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.3)',
                        'rgba(54, 162, 235, 0.3)',
                        'rgba(255, 206, 86, 0.3)',
                        'rgba(75, 192, 192, 0.3)',
                        'rgba(153, 102, 255, 0.3)',
                        'rgba(255, 159, 64, 0.3)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }]
            });

            // NEW: Daily Court Utilization Percentage
            const utilizationRes = await api.get('/analytics/utilization-heatmap', { params });
            const courtsRes = await api.get('/courts');
            const totalCourts = courtsRes.data.length;
            const operatingHours = 16; // Assuming 6 AM to 10 PM
            const totalPossibleSlots = totalCourts * operatingHours;

            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const bookingsByDay = days.map(day => {
                const dayData = utilizationRes.data.filter(d => d.day_of_week === day);
                const totalBookings = dayData.reduce((sum, current) => sum + current.booking_count, 0);
                return totalBookings;
            });

            const utilizationPercentage = bookingsByDay.map(totalBookings => {
                if (totalPossibleSlots === 0) return 0;
                return (totalBookings / totalPossibleSlots) * 100;
            });

            setDailyUtilization({
                labels: days,
                datasets: [{
                    label: 'Court Utilization (%)',
                    data: utilizationPercentage,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            });

            // Booking Status Distribution
            const statusRes = await api.get('/analytics/booking-status-distribution', { params });
            setBookingStatusData({
                labels: statusRes.data.map(d => d.status),
                datasets: [{
                    label: 'Booking Status',
                    data: statusRes.data.map(d => d.count),
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.5)', // Confirmed
                        'rgba(54, 162, 235, 0.5)', // Completed
                        'rgba(255, 99, 132, 0.5)', // Cancelled
                        'rgba(255, 206, 86, 0.5)', // Pending
                    ],
                    borderColor: [
                        'rgba(75, 192, 192, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 99, 132, 1)',
                        'rgba(255, 206, 86, 1)',
                    ],
                    borderWidth: 1
                }]
            });

            // Revenue by Payment Mode
            const revenueByPaymentModeRes = await api.get('/analytics/revenue-by-payment-mode', { params });
            setRevenueByPaymentModeData({
                labels: revenueByPaymentModeRes.data.map(d => d.payment_mode),
                datasets: [{
                    label: 'Revenue',
                    data: revenueByPaymentModeRes.data.map(d => d.revenue),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.3)',
                        'rgba(54, 162, 235, 0.3)',
                        'rgba(255, 206, 86, 0.3)',
                        'rgba(75, 192, 192, 0.3)',
                        'rgba(153, 102, 255, 0.3)',
                        'rgba(255, 159, 64, 0.3)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }]
            });

            // Staff Performance
            const staffPerfRes = await api.get('/analytics/staff-performance', { params });
            setStaffPerformanceData({
                labels: staffPerfRes.data.map(d => d.username),
                datasets: [{
                    label: 'Bookings Created',
                    data: staffPerfRes.data.map(d => d.booking_count),
                    backgroundColor: 'rgba(255, 159, 64, 0.5)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1
                }]
            });

        } catch (error) {
            console.error("Error fetching analytics data:", error);
        }
    };

    const handleDateRangeChange = (e) => {
        setActiveFilter('custom');
        setDateRange({ ...dateRange, [e.target.name]: e.target.value });
    };

    const setDatePreset = (preset) => {
        const today = new Date();
        let startDate, endDate;
        setActiveFilter(preset);

        switch (preset) {
            case 'today':
                startDate = today.toISOString().slice(0, 10);
                endDate = startDate;
                break;
            case 'month':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
                break;
            case 'year':
                startDate = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
                endDate = new Date(today.getFullYear(), 11, 31).toISOString().slice(0, 10);
                break;
            default:
                startDate = '';
                endDate = '';
        }
        setDateRange({ startDate, endDate });
    };

    const handleDownloadLedger = async () => {
        try {
            const response = await api.get('/ledger/download', {
                responseType: 'blob', // Important
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'ledger.csv');
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (error) {
            console.error('Error downloading ledger:', error);
        }
    };

    // --- JSX (FRONTEND) ---
    // The logic above is identical to your original file.
    // The ONLY change is wrapping the h1 and .download-ledger in .analytics-header
    return (
        <div className="analytics-container">

            {/* --- THIS IS THE ONLY CHANGE --- */}
            <div className="analytics-header">
                <h1 className="analytics-title">Analytics Dashboard</h1>
                <div className="download-ledger">
                    <button onClick={handleDownloadLedger}>Download Full Ledger (CSV)</button>
                </div>
            </div>
            {/* --- END OF CHANGE --- */}


            {/* Filters (with new CSS classes) */}
            <div className="filters">
                <button className={`filter-btn ${activeFilter === 'today' ? 'active' : ''}`} onClick={() => setDatePreset('today')}>Today</button>
                <button className={`filter-btn ${activeFilter === 'month' ? 'active' : ''}`} onClick={() => setDatePreset('month')}>This Month</button>
                <button className={`filter-btn ${activeFilter === 'year' ? 'active' : ''}`} onClick={() => setDatePreset('year')}>This Year</button>
                <input type="date" name="startDate" value={dateRange.startDate} onChange={handleDateRangeChange} className="filter-input" />
                <input type="date" name="endDate" value={dateRange.endDate} onChange={handleDateRangeChange} className="filter-input" />
                <button className="filter-btn clear-btn" onClick={() => setDatePreset('clear')}>Clear</button>
            </div >

    {/* Stat Cards Grid (Replaces the slider) */ }
    < div className = "summary-cards" >

        {/* Total Bookings Card */ }
        < div className = "card" >
            <div className="stat-card-content">
                <div className="stat-icon-container" style={{ backgroundColor: 'rgba(54, 162, 235, 0.2)' }}>
                    <span>🧾</span>
                </div>
                <div className="stat-text">
                    <h4>Total Bookings</h4>
                    <p>{summary.total_bookings}</p>
                </div>
            </div>
                </div >

        {/* Total Amount Card */}
        <div className = "card" >
            <div className="stat-card-content">
                <div className="stat-icon-container" style={{ backgroundColor: 'rgba(75, 192, 192, 0.2)' }}>
                    <span>💰</span>
                </div>
                <div className="stat-text">
                    <h4>Total Amount</h4>
                    <p>₹{summary.total_amount}</p>
                </div>
            </div>
        </div>

        {/* Amount Received Card */}
        <div className = "card" >
            <div className="stat-card-content">
                <div className="stat-icon-container" style={{ backgroundColor: 'rgba(102, 255, 102, 0.2)' }}>
                    <span>💵</span>
                </div>
                <div className="stat-text">
                    <h4>Amount Received</h4>
                    <p>₹{summary.amount_received}</p>
                </div>
            </div>
        </div>

        {/* Amount Pending Card */}
        <div className = "card" >
            <div className="stat-card-content">
                <div className="stat-icon-container" style={{ backgroundColor: 'rgba(255, 159, 64, 0.2)' }}>
                    <span>⏳</span>
                </div>
                <div className="stat-text">
                    <h4>Amount Pending</h4>
                    <p>₹{summary.amount_pending}</p>
                </div>
            </div>
        </div>

    {/* Total Cancellations Card */ }
    < div className = "card" >
        <div className="stat-card-content">
            <div className="stat-icon-container" style={{ backgroundColor: 'rgba(255, 99, 132, 0.2)' }}>
                <span>🚫</span>
            </div>
            <div className="stat-text">
                <h4>Total Cancellations</h4>
                <p>{summary.total_cancellations}</p>
            </div>
        </div>
                </div >

    {/* Sports Offered Card */ }
    < div className = "card" >
        <div className="stat-card-content">
            <div className="stat-icon-container" style={{ backgroundColor: 'rgba(153, 102, 255, 0.2)' }}>
                <span>🏸</span>
            </div>
            <div className="stat-text">
                <h4>Sports Offered</h4>
                <p>{summary.total_sports}</p>
            </div>
        </div>
                </div >

    {/* Total Courts Card */ }
    < div className = "card" >
        <div className="stat-card-content">
            <div className="stat-icon-container" style={{ backgroundColor: 'rgba(255, 159, 64, 0.2)' }}>
                <span>🏟</span>
            </div>
            <div className="stat-text">
                <h4>Total Courts</h4>
                <p>{summary.total_courts}</p>
            </div>
        </div>
                </div >

    {/* Total Discount Card */ }
    < div className = "card" >
        <div className="stat-card-content">
            <div className="stat-icon-container" style={{ backgroundColor: 'rgba(255, 206, 86, 0.2)' }}>
                <span>🏷</span>
            </div>
            <div className="stat-text">
                <h4>Total Discount</h4>
                <p>₹{summary.total_discount}</p>
            </div>
        </div>
                </div >
            </div >

    {/* Download Button (This div is now inside .analytics-header) */ }
{/* <div className="download-ledger">
                <button onClick={handleDownloadLedger}>Download Full Ledger (CSV)</button>
            </div>
            */}

{/* Charts Grid (CSS applies styling) */ }
<div className="charts-grid">
    <div className="chart-card">
        <h3>Bookings Over Time</h3>
        {bookingsOverTime.labels && <Line data={bookingsOverTime} />}
    </div>
    <div className="chart-card">
        <h3>Revenue by Sport</h3>
        {revenueBySport.labels && <Pie data={revenueBySport} />}
    </div>

    <div className="chart-card">
        <h3>Booking Status</h3>
        {bookingStatusData.labels && <Pie data={bookingStatusData} options={{ plugins: { legend: { position: 'top' } } }} />}
    </div>
    <div className="chart-card">
        <h3>Revenue by Payment Mode</h3>
        {revenueByPaymentModeData.labels && <Pie data={revenueByPaymentModeData} />}
    </div>

    <div className="chart-card">
        <h3>Staff Performance</h3>
        {staffPerformanceData.labels && <Bar data={staffPerformanceData} options={{
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Bookings Created per Staff Member' }
            }
        }} />}
    </div>

    <div className="chart-card">
        <h3>Court Utilization by Day</h3>
        {dailyUtilization.labels && <Bar data={dailyUtilization} options={{
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Percentage of Court Time Booked Daily' }
            },
            scales: {
                y: {
                    max: 100,
                    ticks: {
                        callback: function (value) {
                            return value + '%'
                        }
                    }
                }
            }
        }} />}
    </div>
</div>
        </div >
    );
};

export default Analytics;