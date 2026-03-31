import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import {
    getAnalyticsSummary, getStandaloneRevenue, getBookingRevenue,
    getRevenueByAccessory, getRentalVsSale, getStockAlerts
} from './inventory/inventoryApi';
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
import './Analytics.css';

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

const Analytics = () => {
    // UI State
    const [analyticsTab, setAnalyticsTab] = useState('overall'); // 'overall', 'daily', 'membership', 'coaching', 'inventory'
    const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
    const [activeFilter, setActiveFilter] = useState('today');

    // Daily Bookings Data
    const [summary, setSummary] = useState({});
    const [bookingsOverTime, setBookingsOverTime] = useState({});
    const [revenueBySport, setRevenueBySport] = useState({});
    const [dailyUtilization, setDailyUtilization] = useState({});
    const [bookingStatusData, setBookingStatusData] = useState({});
    const [revenueByPaymentModeData, setRevenueByPaymentModeData] = useState({});
    const [staffPerformanceData, setStaffPerformanceData] = useState({});

    // Membership Data
    const [membershipSummary, setMembershipSummary] = useState({});
    const [membershipRevenueBySport, setMembershipRevenueBySport] = useState({});
    const [membershipRevenueByPaymentMode, setMembershipRevenueByPaymentMode] = useState({});

    // Overall Data
    const [overallSummary, setOverallSummary] = useState({});
    const [overallRevenueBySport, setOverallRevenueBySport] = useState({});
    const [overallRevenueByMode, setOverallRevenueByMode] = useState({});
    const [revenueDistribution, setRevenueDistribution] = useState({});

    // Inventory Data
    const [inventorySummary, setInventorySummary] = useState(null);
    const [standaloneRev, setStandaloneRev] = useState(null);
    const [bookingRev, setBookingRev] = useState(null);
    const [byAccessory, setByAccessory] = useState([]);
    const [rentalVsSale, setRentalVsSale] = useState([]);
    const [stockAlerts, setStockAlerts] = useState([]);
    const [inventoryLoading, setInventoryLoading] = useState(false);

    useEffect(() => {
        setDatePreset('today');
    }, []);

    const fetchAnalyticsData = useCallback(async (dates) => {
        try {
            const params = { ...dates };

            if (analyticsTab === 'overall') {
                const [
                    summaryRes,
                    sportRes,
                    modeRes,
                    distRes
                ] = await Promise.all([
                    api.get('/analytics/overall/summary', { params }),
                    api.get('/analytics/overall/revenue-by-sport', { params }),
                    api.get('/analytics/overall/revenue-by-payment-mode', { params }),
                    api.get('/analytics/overall/revenue-distribution', { params })
                ]);

                setOverallSummary(summaryRes.data);

                setOverallRevenueBySport({
                    labels: sportRes.data.map(d => d.sport_name),
                    datasets: [{
                        label: 'Revenue',
                        data: sportRes.data.map(d => d.revenue),
                        backgroundColor: ['rgba(255, 99, 132, 0.5)', 'rgba(54, 162, 235, 0.5)', 'rgba(255, 206, 86, 0.5)', 'rgba(75, 192, 192, 0.5)', 'rgba(153, 102, 255, 0.5)'],
                        borderWidth: 1
                    }]
                });

                setOverallRevenueByMode({
                    labels: modeRes.data.map(d => d.payment_mode),
                    datasets: [{
                        label: 'Revenue',
                        data: modeRes.data.map(d => d.revenue),
                        backgroundColor: ['rgba(255, 159, 64, 0.5)', 'rgba(75, 192, 192, 0.5)', 'rgba(153, 102, 255, 0.5)', 'rgba(255, 205, 86, 0.5)'],
                        borderWidth: 1
                    }]
                });

                setRevenueDistribution({
                    labels: distRes.data.map(d => d.source),
                    datasets: [{
                        label: 'Revenue Source',
                        data: distRes.data.map(d => d.revenue),
                        backgroundColor: distRes.data.map(d => {
                            if (d.source === 'Daily Bookings') return '#36A2EB';
                            if (d.source === 'Memberships') return '#FF6384';
                            if (d.source.includes('Terminated')) return '#999999';
                            return '#FFCE56';
                        }),
                        hoverBackgroundColor: distRes.data.map(d => {
                            if (d.source === 'Daily Bookings') return '#36A2EB';
                            if (d.source === 'Memberships') return '#FF6384';
                            if (d.source.includes('Terminated')) return '#999999';
                            return '#FFCE56';
                        })
                    }]
                });

            } else if (analyticsTab === 'daily') {
                // ... (Daily logic remains same)
                const [
                    summaryRes,
                    bookingsOverTimeRes,
                    revenueBySportRes,
                    utilizationRes,
                    statusRes,
                    revenueByPaymentModeRes,
                    staffPerfRes
                ] = await Promise.all([
                    api.get('/analytics/summary', { params }),
                    api.get('/analytics/bookings-over-time', { params }),
                    api.get('/analytics/revenue-by-sport', { params }),
                    api.get('/analytics/utilization-heatmap', { params }),
                    api.get('/analytics/booking-status-distribution', { params }),
                    api.get('/analytics/revenue-by-payment-mode', { params }),
                    api.get('/analytics/staff-performance', { params })
                ]);

                setSummary(summaryRes.data);

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

                setRevenueBySport({
                    labels: revenueBySportRes.data.map(d => d.name),
                    datasets: [{
                        label: 'Revenue',
                        data: revenueBySportRes.data.map(d => d.revenue),
                        backgroundColor: ['rgba(255, 99, 132, 0.5)', 'rgba(54, 162, 235, 0.5)', 'rgba(255, 206, 86, 0.5)', 'rgba(75, 192, 192, 0.5)', 'rgba(153, 102, 255, 0.5)', 'rgba(255, 159, 64, 0.5)'],
                        borderColor: ['rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)', 'rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)'],
                        borderWidth: 1
                    }]
                });

                // Utilization Logic
                const courtsRes = await api.get('/courts');
                const totalCourts = courtsRes.data.length;
                const totalPossibleSlots = totalCourts * 16; // 16 hours
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const bookingsByDay = days.map(day => {
                    const dayData = utilizationRes.data.filter(d => d.day_of_week === day);
                    return dayData.reduce((sum, current) => sum + current.booking_count, 0);
                });
                const utilizationPercentage = bookingsByDay.map(total => totalPossibleSlots > 0 ? (total / totalPossibleSlots) * 100 : 0);

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

                setBookingStatusData({
                    labels: statusRes.data.map(d => d.status),
                    datasets: [{
                        label: 'Booking Status',
                        data: statusRes.data.map(d => d.count),
                        backgroundColor: ['rgba(75, 192, 192, 0.5)', 'rgba(54, 162, 235, 0.5)', 'rgba(255, 99, 132, 0.5)', 'rgba(255, 206, 86, 0.5)'],
                        borderWidth: 1
                    }]
                });

                setRevenueByPaymentModeData({
                    labels: revenueByPaymentModeRes.data.map(d => d.payment_mode),
                    datasets: [{
                        label: 'Revenue',
                        data: revenueByPaymentModeRes.data.map(d => d.revenue),
                        backgroundColor: ['rgba(255, 159, 64, 0.5)', 'rgba(153, 102, 255, 0.5)', 'rgba(54, 162, 235, 0.5)'],
                        borderWidth: 1
                    }]
                });

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

            } else if (analyticsTab === 'membership') {
                // Fetch Membership Analytics
                const [
                    memSummaryRes,
                    memRevenueSportRes,
                    memRevenueModeRes
                ] = await Promise.all([
                    api.get('/analytics/membership/summary', { params }),
                    api.get('/analytics/membership/revenue-by-sport', { params }),
                    api.get('/analytics/membership/revenue-by-payment-mode', { params })
                ]);

                setMembershipSummary(memSummaryRes.data);

                setMembershipRevenueBySport({
                    labels: memRevenueSportRes.data.map(d => d.name),
                    datasets: [{
                        label: 'Revenue',
                        data: memRevenueSportRes.data.map(d => d.revenue),
                        backgroundColor: ['rgba(255, 99, 132, 0.5)', 'rgba(54, 162, 235, 0.5)', 'rgba(255, 206, 86, 0.5)', 'rgba(75, 192, 192, 0.5)'],
                        borderWidth: 1
                    }]
                });

                setMembershipRevenueByPaymentMode({
                    labels: memRevenueModeRes.data.map(d => d.payment_mode),
                    datasets: [{
                        label: 'Revenue',
                        data: memRevenueModeRes.data.map(d => d.revenue),
                        backgroundColor: ['rgba(153, 102, 255, 0.5)', 'rgba(255, 159, 64, 0.5)', 'rgba(54, 162, 235, 0.5)'],
                        borderWidth: 1
                    }]
                });
            } else if (analyticsTab === 'inventory') {
                setInventoryLoading(true);
                const [s, sr, br, ba, rvs, sa] = await Promise.all([
                    getAnalyticsSummary(params),
                    getStandaloneRevenue(params),
                    getBookingRevenue(params),
                    getRevenueByAccessory(params),
                    getRentalVsSale(params),
                    getStockAlerts(),
                ]);
                setInventorySummary(s.data);
                setStandaloneRev(sr.data);
                setBookingRev(br.data);
                setByAccessory(Array.isArray(ba.data) ? ba.data : []);
                setRentalVsSale(Array.isArray(rvs.data) ? rvs.data : []);
                setStockAlerts(Array.isArray(sa.data) ? sa.data : []);
                setInventoryLoading(false);
            }

        } catch (error) {
            console.error("Error fetching analytics data:", error);
            setInventoryLoading(false);
        }
    }, [analyticsTab]);

    useEffect(() => {
        if (dateRange.startDate && dateRange.endDate) {
            fetchAnalyticsData(dateRange);
        }
    }, [dateRange, analyticsTab, fetchAnalyticsData]);

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
            const response = await api.get('/ledger/download', { responseType: 'blob' });
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

    return (
        <div className="analytics-container">
            <div className="analytics-header">
                <h1 className="analytics-title">Analytics Dashboard</h1>
                {analyticsTab === 'daily' && (
                    <div className="download-ledger">
                        <button onClick={handleDownloadLedger}>Download Full Ledger (CSV)</button>
                    </div>
                )}
            </div>

            {/* --- Tabs --- */}
            <div className="tabs-container">
                <button 
                    className={`tab-button ${analyticsTab === 'overall' ? 'active' : ''}`} 
                    onClick={() => setAnalyticsTab('overall')}
                >
                    Overall
                </button>
                <button 
                    className={`tab-button ${analyticsTab === 'daily' ? 'active' : ''}`} 
                    onClick={() => setAnalyticsTab('daily')}
                >
                    Daily Bookings
                </button>
                <button 
                    className={`tab-button ${analyticsTab === 'membership' ? 'active' : ''}`} 
                    onClick={() => setAnalyticsTab('membership')}
                >
                    Membership
                </button>
                <button 
                    className={`tab-button ${analyticsTab === 'coaching' ? 'active' : ''}`} 
                    onClick={() => setAnalyticsTab('coaching')}
                >
                    Coaching
                </button>
                <button 
                    className={`tab-button ${analyticsTab === 'inventory' ? 'active' : ''}`} 
                    onClick={() => setAnalyticsTab('inventory')}
                >
                    Inventory
                </button>
            </div>

            {/* --- Filters --- */}
            <div className="filters">
                <button className={`filter-btn ${activeFilter === 'today' ? 'active' : ''}`} onClick={() => setDatePreset('today')}>Today</button>
                <button className={`filter-btn ${activeFilter === 'month' ? 'active' : ''}`} onClick={() => setDatePreset('month')}>This Month</button>
                <button className={`filter-btn ${activeFilter === 'year' ? 'active' : ''}`} onClick={() => setDatePreset('year')}>This Year</button>
                <input type="date" name="startDate" value={dateRange.startDate} onChange={handleDateRangeChange} className="filter-input" />
                <input type="date" name="endDate" value={dateRange.endDate} onChange={handleDateRangeChange} className="filter-input" />
                <button className="filter-btn clear-btn" onClick={() => setDatePreset('clear')}>Clear</button>
            </div>

            {/* --- Overall Content --- */}
            {analyticsTab === 'overall' && (
                <>
                    <div className="summary-cards">
                        <div className="card">
                            <div className="stat-card-content">
                                <div className="stat-icon-container" style={{ backgroundColor: 'rgba(75, 192, 192, 0.2)' }}><span>💰</span></div>
                                <div className="stat-text"><h4>Total Revenue</h4><p>₹{overallSummary.total_revenue || 0}</p></div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="stat-card-content">
                                <div className="stat-icon-container" style={{ backgroundColor: 'rgba(255, 206, 86, 0.2)' }}><span>🏷</span></div>
                                <div className="stat-text"><h4>Total Discounts</h4><p>₹{overallSummary.total_discount || 0}</p></div>
                            </div>
                        </div>
                    </div>

                    <div className="charts-grid">
                        <div className="chart-card">
                            <h3>Revenue Sources</h3>
                            {revenueDistribution.labels && revenueDistribution.labels.length > 0 ? (
                                <Pie data={revenueDistribution} />
                            ) : (
                                <p>No data available.</p>
                            )}
                        </div>
                        <div className="chart-card">
                            <h3>Total Revenue by Sport</h3>
                            {overallRevenueBySport.labels && overallRevenueBySport.labels.length > 0 ? (
                                <Pie data={overallRevenueBySport} />
                            ) : (
                                <p>No data available.</p>
                            )}
                        </div>
                        <div className="chart-card">
                            <h3>Total Revenue by Payment Mode</h3>
                            {overallRevenueByMode.labels && overallRevenueByMode.labels.length > 0 ? (
                                <Pie data={overallRevenueByMode} />
                            ) : (
                                <p>No data available.</p>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* --- Daily Bookings Content --- */}
            {analyticsTab === 'daily' && (
                <>
                    <div className="summary-cards">
                        <div className="card">
                            <div className="stat-card-content">
                                <div className="stat-icon-container" style={{ backgroundColor: 'rgba(54, 162, 235, 0.2)' }}><span>🧾</span></div>
                                <div className="stat-text"><h4>Total Bookings</h4><p>{summary.total_bookings}</p></div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="stat-card-content">
                                <div className="stat-icon-container" style={{ backgroundColor: 'rgba(75, 192, 192, 0.2)' }}><span>💰</span></div>
                                <div className="stat-text"><h4>Total Amount</h4><p>₹{summary.total_amount}</p></div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="stat-card-content">
                                <div className="stat-icon-container" style={{ backgroundColor: 'rgba(102, 255, 102, 0.2)' }}><span>💵</span></div>
                                <div className="stat-text"><h4>Amount Received</h4><p>₹{summary.amount_received}</p></div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="stat-card-content">
                                <div className="stat-icon-container" style={{ backgroundColor: 'rgba(255, 159, 64, 0.2)' }}><span>⏳</span></div>
                                <div className="stat-text"><h4>Amount Pending</h4><p>₹{summary.amount_pending}</p></div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="stat-card-content">
                                <div className="stat-icon-container" style={{ backgroundColor: 'rgba(255, 99, 132, 0.2)' }}><span>🚫</span></div>
                                <div className="stat-text"><h4>Total Cancellations</h4><p>{summary.total_cancellations}</p></div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="stat-card-content">
                                <div className="stat-icon-container" style={{ backgroundColor: 'rgba(153, 102, 255, 0.2)' }}><span>🏸</span></div>
                                <div className="stat-text"><h4>Sports Offered</h4><p>{summary.total_sports}</p></div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="stat-card-content">
                                <div className="stat-icon-container" style={{ backgroundColor: 'rgba(255, 159, 64, 0.2)' }}><span>🏟</span></div>
                                <div className="stat-text"><h4>Total Courts</h4><p>{summary.total_courts}</p></div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="stat-card-content">
                                <div className="stat-icon-container" style={{ backgroundColor: 'rgba(255, 206, 86, 0.2)' }}><span>🏷</span></div>
                                <div className="stat-text"><h4>Total Discount</h4><p>₹{summary.total_discount}</p></div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="stat-card-content">
                                <div className="stat-icon-container" style={{ backgroundColor: 'rgba(201, 203, 207, 0.2)' }}><span>💸</span></div>
                                <div className="stat-text"><h4>Cancelled Revenue</h4><p>₹{summary.cancelled_revenue}</p></div>
                            </div>
                        </div>
                    </div>

                    <div className="charts-grid">
                        <div className="chart-card"><h3>Bookings Over Time</h3>{bookingsOverTime.labels && <Line data={bookingsOverTime} />}</div>
                        <div className="chart-card"><h3>Revenue by Sport</h3>{revenueBySport.labels && <Pie data={revenueBySport} />}</div>
                        <div className="chart-card"><h3>Booking Status</h3>{bookingStatusData.labels && <Pie data={bookingStatusData} options={{ plugins: { legend: { position: 'top' } } }} />}</div>
                        <div className="chart-card"><h3>Revenue by Payment Mode</h3>{revenueByPaymentModeData.labels && <Pie data={revenueByPaymentModeData} />}</div>
                        <div className="chart-card"><h3>Staff Performance</h3>{staffPerformanceData.labels && <Bar data={staffPerformanceData} options={{ responsive: true, plugins: { legend: { display: false }, title: { display: true, text: 'Bookings Created per Staff Member' } } }} />}</div>
                        <div className="chart-card">
                            <h3>Court Utilization by Day</h3>
                            {dailyUtilization.labels && <Bar data={dailyUtilization} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { max: 100, ticks: { callback: function (value) { return value + '%' } } } } }} />}
                        </div>
                    </div>
                </>
            )}

            {/* --- Membership Content --- */}
            {analyticsTab === 'membership' && (
                <>
                    <div className="summary-cards">
                        <div className="card">
                            <div className="stat-card-content">
                                <div className="stat-icon-container" style={{ backgroundColor: 'rgba(54, 162, 235, 0.2)' }}><span>👥</span></div>
                                <div className="stat-text"><h4>Active Memberships</h4><p>{membershipSummary.total_active || 0}</p></div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="stat-card-content">
                                <div className="stat-icon-container" style={{ backgroundColor: 'rgba(75, 192, 192, 0.2)' }}><span>🆕</span></div>
                                <div className="stat-text"><h4>New Memberships</h4><p>{membershipSummary.new_memberships || 0}</p></div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="stat-card-content">
                                <div className="stat-icon-container" style={{ backgroundColor: 'rgba(102, 255, 102, 0.2)' }}><span>💰</span></div>
                                <div className="stat-text"><h4>Total Revenue</h4><p>₹{membershipSummary.total_revenue || 0}</p></div>
                            </div>
                        </div>
                    </div>

                    <div className="charts-grid">
                        <div className="chart-card">
                            <h3>Revenue by Sport</h3>
                            {membershipRevenueBySport.labels && membershipRevenueBySport.labels.length > 0 ? (
                                <Pie data={membershipRevenueBySport} />
                            ) : (
                                <p>No data available for this period.</p>
                            )}
                        </div>
                        <div className="chart-card">
                            <h3>Revenue by Payment Mode</h3>
                            {membershipRevenueByPaymentMode.labels && membershipRevenueByPaymentMode.labels.length > 0 ? (
                                <Pie data={membershipRevenueByPaymentMode} />
                            ) : (
                                <p>No data available for this period.</p>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* --- Coaching Content --- */}
            {analyticsTab === 'coaching' && (
                <div style={{ textAlign: 'center', padding: '50px', backgroundColor: 'white', borderRadius: '12px' }}>
                    <h2>Coaching Analytics</h2>
                    <p style={{ color: '#666', fontSize: '1.2rem', marginTop: '10px' }}>Coming Soon...</p>
                </div>
            )}

            {/* --- Inventory Analytics Content --- */}
            {analyticsTab === 'inventory' && (
                <div style={{ padding: '20px 0' }}>
                    {inventoryLoading || !inventorySummary ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                            <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
                            <div>Loading analytics...</div>
                        </div>
                    ) : (() => {
                        const totalRev = (standaloneRev?.total_revenue || 0) + (bookingRev?.total_revenue || 0);
                        const totalDamage = (standaloneRev?.damage_revenue || 0) + (bookingRev?.damage_revenue || 0);
                        const maxRevAcc = byAccessory.length > 0 ? Math.max(...byAccessory.map(a => parseFloat(a.revenue) || 0)) : 0;
                        return (
                            <>
                                <h4 style={{ color: '#005fbc', borderBottom: '2px solid #005fbc', paddingBottom: 6, marginBottom: 16 }}>📦 Stock Health</h4>
                                <div className="summary-cards" style={{ marginBottom: 28 }}>
                                    <div className="card">
                                        <div className="stat-card-content">
                                            <div className="stat-icon-container" style={{ backgroundColor: 'rgba(54, 162, 235, 0.2)' }}><span>📊</span></div>
                                            <div className="stat-text"><h4>Inventory Value</h4><p>₹{(inventorySummary?.inventory_value || 0).toLocaleString('en-IN')}</p></div>
                                        </div>
                                    </div>
                                    <div className="card">
                                        <div className="stat-card-content">
                                            <div className="stat-icon-container" style={{ backgroundColor: 'rgba(75, 192, 192, 0.2)' }}><span>✅</span></div>
                                            <div className="stat-text"><h4>Total Available Units</h4><p>{inventorySummary?.total_available ?? 0}</p></div>
                                        </div>
                                    </div>
                                    <div className="card">
                                        <div className="stat-card-content">
                                            <div className="stat-icon-container" style={{ backgroundColor: 'rgba(255, 99, 132, 0.2)' }}><span>🗑</span></div>
                                            <div className="stat-text"><h4>Total Discarded</h4><p>{inventorySummary?.total_discarded ?? 0}</p></div>
                                        </div>
                                    </div>
                                    <div className="card">
                                        <div className="stat-card-content">
                                            <div className="stat-icon-container" style={{ backgroundColor: 'rgba(255, 159, 64, 0.2)' }}><span>⚠️</span></div>
                                            <div className="stat-text"><h4>Low / Out of Stock</h4><p>{inventorySummary?.low_stock_count ?? 0} / {inventorySummary?.out_of_stock ?? 0}</p></div>
                                        </div>
                                    </div>
                                </div>

                                <h4 style={{ color: '#005fbc', borderBottom: '2px solid #005fbc', paddingBottom: 6, marginBottom: 16 }}>💰 Accessory Revenue</h4>
                                <div className="summary-cards" style={{ marginBottom: 28 }}>
                                    <div className="card">
                                        <div className="stat-card-content">
                                            <div className="stat-icon-container" style={{ backgroundColor: 'rgba(75, 192, 192, 0.2)' }}><span>💵</span></div>
                                            <div className="stat-text"><h4>Total Accessory Revenue</h4><p>₹{totalRev.toLocaleString('en-IN')}</p></div>
                                        </div>
                                    </div>
                                    <div className="card">
                                        <div className="stat-card-content">
                                            <div className="stat-icon-container" style={{ backgroundColor: 'rgba(54, 162, 235, 0.2)' }}><span>🛍</span></div>
                                            <div className="stat-text"><h4>Standalone Sales</h4><p>₹{(standaloneRev?.total_revenue || 0).toLocaleString('en-IN')}</p></div>
                                        </div>
                                    </div>
                                    <div className="card">
                                        <div className="stat-card-content">
                                            <div className="stat-icon-container" style={{ backgroundColor: 'rgba(153, 102, 255, 0.2)' }}><span>📅</span></div>
                                            <div className="stat-text"><h4>Booking Accessory</h4><p>₹{(bookingRev?.total_revenue || 0).toLocaleString('en-IN')}</p></div>
                                        </div>
                                    </div>
                                </div>

                                {totalDamage > 0 && (
                                    <div style={{ background: '#fff3cd', color: '#856404', padding: '12px 20px', borderRadius: '8px', marginBottom: 20, border: '1px solid #ffeeba' }}>
                                        🔧 Damage charges collected: <strong>₹{totalDamage.toLocaleString('en-IN')}</strong>
                                    </div>
                                )}

                                <div className="charts-grid" style={{ marginBottom: 28 }}>
                                    <div className="chart-card">
                                        <h3>Revenue by Accessory</h3>
                                        {byAccessory.slice(0, 8).length === 0 ? <p>No data yet</p> : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                                                {byAccessory.slice(0, 8).map((item, i) => {
                                                    const val = parseFloat(item.revenue) || 0;
                                                    const pct = maxRevAcc > 0 ? (val / maxRevAcc) * 100 : 0;
                                                    return (
                                                        <div key={i}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '14px' }}>
                                                                <span>{item.accessory_name}</span>
                                                                <span style={{ fontWeight: 'bold' }}>₹{val.toLocaleString('en-IN')}</span>
                                                            </div>
                                                            <div style={{ background: '#e9ecef', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                                                                <div style={{ background: '#005fbc', width: `${pct}%`, height: '100%' }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <div className="chart-card">
                                        <h3>Rental vs Sale Split</h3>
                                        {rentalVsSale.length === 0 ? <p>No standalone sales yet</p> : (() => {
                                            const total = rentalVsSale.reduce((s, r) => s + parseFloat(r.revenue || 0), 0);
                                            return rentalVsSale.map(row => {
                                                const rev = parseFloat(row.revenue || 0);
                                                const pct = total > 0 ? ((rev / total) * 100).toFixed(1) : 0;
                                                const color = row.type === 'rental' ? '#36A2EB' : '#4BC0C0';
                                                return (
                                                    <div key={row.type} style={{ marginBottom: 16 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 14 }}>
                                                            <span style={{ fontWeight: 600 }}>{row.type === 'rental' ? '🔄 Rentals' : '🏷 Sales'}</span>
                                                            <span style={{ fontWeight: 700, color }}>₹{rev.toLocaleString('en-IN')}</span>
                                                        </div>
                                                        <div style={{ background: '#e9ecef', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${pct}%`, background: color }} />
                                                        </div>
                                                        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{pct}% · {row.transactions} transactions</div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>

                                {stockAlerts.length > 0 && (
                                    <>
                                        <h4 style={{ color: '#dc3545', borderBottom: '2px solid #dc3545', paddingBottom: 6, marginBottom: 16 }}>🚨 Stock Alerts</h4>
                                        <div className="table-container">
                                            <table>
                                                <thead>
                                                    <tr><th>Accessory</th><th>Type</th><th>Available</th><th>Threshold</th><th>Total</th><th>Status</th></tr>
                                                </thead>
                                                <tbody>
                                                    {stockAlerts.map(a => (
                                                        <tr key={a.id}>
                                                            <td style={{ fontWeight: 600 }}>{a.name}</td>
                                                            <td>{a.type?.replace('_', ' ')}</td>
                                                            <td style={{ color: a.available_quantity === 0 ? '#dc3545' : '#ffc107', fontWeight: 700 }}>{a.available_quantity}</td>
                                                            <td style={{ color: '#666' }}>{a.reorder_threshold}</td>
                                                            <td>{a.stock_quantity}</td>
                                                            <td>{a.available_quantity === 0
                                                                ? <span style={{ background: '#ffebee', color: '#c62828', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>Out of Stock</span>
                                                                : <span style={{ background: '#fff8e1', color: '#f57f17', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>Low Stock</span>}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};

export default Analytics;
