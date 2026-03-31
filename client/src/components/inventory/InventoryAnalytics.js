import React, { useState, useCallback } from 'react';
import {
    getAnalyticsSummary, getStandaloneRevenue, getBookingRevenue,
    getRevenueByAccessory, getRentalVsSale, getStockAlerts
} from './inventoryApi';
import { useEffect } from 'react';

function StatCard({ label, value, sub, accentColor }) {
    return (
        <div className="inv-stat-card" style={{ '--accent-color': accentColor || 'var(--color-primary)' }}>
            <div className="inv-stat-label">{label}</div>
            <div className="inv-stat-value">{value}</div>
            {sub && <div className="inv-stat-sub">{sub}</div>}
        </div>
    );
}

export default function InventoryAnalytics() {
    const [summary, setSummary] = useState(null);
    const [standaloneRev, setStandaloneRev] = useState(null);
    const [bookingRev, setBookingRev] = useState(null);
    const [byAccessory, setByAccessory] = useState([]);
    const [rentalVsSale, setRentalVsSale] = useState([]);
    const [stockAlerts, setStockAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const params = {};
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        try {
            const [s, sr, br, ba, rvs, sa] = await Promise.all([
                getAnalyticsSummary(params),
                getStandaloneRevenue(params),
                getBookingRevenue(params),
                getRevenueByAccessory(params),
                getRentalVsSale(params),
                getStockAlerts(),
            ]);
            setSummary(s.data);
            setStandaloneRev(sr.data);
            setBookingRev(br.data);
            setByAccessory(Array.isArray(ba.data) ? ba.data : []);
            setRentalVsSale(Array.isArray(rvs.data) ? rvs.data : []);
            setStockAlerts(Array.isArray(sa.data) ? sa.data : []);
        } catch {}
        setLoading(false);
    }, [startDate, endDate]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    if (loading || !summary) return <div className="inv-empty"><div className="inv-empty-icon">⏳</div><div>Loading analytics...</div></div>;

    const totalRev = (standaloneRev?.total_revenue || 0) + (bookingRev?.total_revenue || 0);
    const totalDamage = (standaloneRev?.damage_revenue || 0) + (bookingRev?.damage_revenue || 0);
    const maxRevAcc = byAccessory.length > 0 ? Math.max(...byAccessory.map(a => parseFloat(a.revenue) || 0)) : 0;

    return (
        <>
            {/* Date filter */}
            <div className="inv-toolbar" style={{ marginBottom: 20 }}>
                <div className="inv-toolbar-left">
                    <label style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>From</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                        style={{ padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-base)', fontFamily: 'var(--font-family)', fontSize: 13 }} />
                    <label style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>To</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                        style={{ padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-base)', fontFamily: 'var(--font-family)', fontSize: 13 }} />
                    {(startDate || endDate) && (
                        <button className="btn btn-secondary btn-sm" onClick={() => { setStartDate(''); setEndDate(''); }}>Clear</button>
                    )}
                </div>
            </div>

            <h4 style={{ color: 'var(--color-primary)', borderBottom: '2px solid var(--color-primary)', paddingBottom: 6, marginBottom: 16 }}>📦 Stock Health</h4>
            <div className="inv-stats-grid" style={{ marginBottom: 28 }}>
                <StatCard label="Inventory Value" value={`₹${(summary?.inventory_value || 0).toLocaleString('en-IN')}`} sub="Available stock × price" accentColor="var(--color-primary)" />
                <StatCard label="Total Available Units" value={summary?.total_available ?? 0} sub="Ready to use/sell/rent" accentColor="var(--color-success)" />
                <StatCard label="Total Discarded" value={summary?.total_discarded ?? 0} sub="Worn out / damaged" accentColor="var(--color-danger)" />
                <StatCard label="Low / Out of Stock" value={`${summary?.low_stock_count ?? 0} / ${summary?.out_of_stock ?? 0}`} sub="Alert / Out of stock" accentColor="var(--color-warning)" />
            </div>

            <h4 style={{ color: 'var(--color-primary)', borderBottom: '2px solid var(--color-primary)', paddingBottom: 6, marginBottom: 16 }}>💰 Accessory Revenue</h4>
            <div className="inv-stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 28 }}>
                <StatCard label="Total Accessory Revenue" value={`₹${totalRev.toLocaleString('en-IN')}`} sub="Standalone + Booking combined" accentColor="var(--color-primary)" />
                <StatCard label="Standalone Sales Revenue" value={`₹${(standaloneRev?.total_revenue || 0).toLocaleString('en-IN')}`} sub={`${standaloneRev?.total_sales || 0} walk-in transactions`} accentColor="var(--color-success)" />
                <StatCard label="Booking Accessory Revenue" value={`₹${(bookingRev?.total_revenue || 0).toLocaleString('en-IN')}`} sub="From court bookings" accentColor="var(--color-info)" />
            </div>

            {totalDamage > 0 && (
                <div className="inv-alert inv-alert-warning" style={{ marginBottom: 20 }}>
                    🔧 Damage charges collected: <strong>₹{totalDamage.toLocaleString('en-IN')}</strong>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-lg)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
                    <h5 style={{ margin: '0 0 16px', color: 'var(--color-primary)', fontSize: 14 }}>Revenue by Accessory</h5>
                    {byAccessory.slice(0, 8).length === 0 ? <div className="inv-empty" style={{ padding: 20 }}>No data yet</div> : (
                        <div className="inv-bar-chart">
                            {byAccessory.slice(0, 8).map((item, i) => {
                                const val = parseFloat(item.revenue) || 0;
                                const pct = maxRevAcc > 0 ? (val / maxRevAcc) * 100 : 0;
                                return (
                                    <div key={i} className="inv-bar-row">
                                        <div className="inv-bar-meta">
                                            <span>{item.accessory_name}</span>
                                            <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>₹{val.toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="inv-bar-bg"><div className="inv-bar-fill" style={{ width: `${pct}%` }} /></div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-lg)', padding: 20, boxShadow: 'var(--shadow-sm)' }}>
                    <h5 style={{ margin: '0 0 16px', color: 'var(--color-primary)', fontSize: 14 }}>Rental vs Sale Split</h5>
                    {rentalVsSale.length === 0 ? <div className="inv-empty" style={{ padding: 20 }}>No standalone sales yet</div> : (() => {
                        const total = rentalVsSale.reduce((s, r) => s + parseFloat(r.revenue || 0), 0);
                        return rentalVsSale.map(row => {
                            const rev = parseFloat(row.revenue || 0);
                            const pct = total > 0 ? ((rev / total) * 100).toFixed(1) : 0;
                            const color = row.type === 'rental' ? 'var(--color-info)' : 'var(--color-success)';
                            return (
                                <div key={row.type} style={{ marginBottom: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                                        <span style={{ fontWeight: 600 }}>{row.type === 'rental' ? '🔄 Rentals' : '🏷 Sales'}</span>
                                        <span style={{ fontWeight: 700, color }}>₹{rev.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="inv-bar-bg">
                                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 'var(--radius-full)', transition: 'width 0.5s' }} />
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{pct}% · {row.transactions} transactions</div>
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>

            {stockAlerts.length > 0 && (
                <>
                    <h4 style={{ color: 'var(--color-danger)', borderBottom: '2px solid var(--color-danger)', paddingBottom: 6, marginBottom: 16 }}>🚨 Stock Alerts</h4>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr><th>Accessory</th><th>Type</th><th>Available</th><th>Threshold</th><th>Total</th><th>Discarded</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                {stockAlerts.map(a => (
                                    <tr key={a.id}>
                                        <td style={{ fontWeight: 600 }}>{a.name}</td>
                                        <td><span className={`inv-badge inv-badge-${a.type === 'for_sale' ? 'sale' : a.type === 'for_rental' ? 'rental' : 'both'}`}>{a.type?.replace('_', ' ')}</span></td>
                                        <td style={{ color: a.available_quantity === 0 ? 'var(--color-danger-text)' : 'var(--color-warning-text)', fontWeight: 700 }}>{a.available_quantity}</td>
                                        <td style={{ color: 'var(--color-text-muted)' }}>{a.reorder_threshold}</td>
                                        <td>{a.stock_quantity}</td>
                                        <td style={{ color: 'var(--color-danger-text)' }}>{a.discarded_quantity}</td>
                                        <td>{a.available_quantity === 0
                                            ? <span className="inv-badge inv-badge-out">Out of Stock</span>
                                            : <span className="inv-badge inv-badge-low">Low Stock</span>}
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
}
