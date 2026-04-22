import React, { useState, useEffect, useCallback } from 'react';
import { getAccessories } from './inventoryApi';
import AddEditAccessoryModal from './AddEditAccessoryModal';
import RestockModal from './RestockModal';
import DiscardModal from './DiscardModal';
import { deleteAccessory } from './inventoryApi';

function StockBar({ available, total, threshold }) {
    if (!total || total === 0) return <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No stock</span>;
    const pct = Math.max(0, Math.min(100, (available / total) * 100));
    const cls = available === 0 ? 'out' : available <= threshold ? 'low' : 'ok';
    return (
        <div className="stock-bar-wrap">
            <div className="stock-bar-bg">
                <div className={`stock-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
            </div>
            <span style={{ fontSize: 12, minWidth: 28, color: 'var(--color-text-secondary)' }}>{available}</span>
        </div>
    );
}

function TypeBadge({ type }) {
    const map = {
        for_sale: ['inv-badge-sale', 'For Sale'],
        for_rental: ['inv-badge-rental', 'For Rental'],
        both: ['inv-badge-both', 'Both'],
    };
    const [cls, label] = map[type] || ['inv-badge-ok', type || '—'];
    return <span className={`inv-badge ${cls}`}>{label}</span>;
}

function StockStatusBadge({ available, threshold }) {
    if (available === 0) return <span className="inv-badge inv-badge-out">Out of Stock</span>;
    if (available <= threshold) return <span className="inv-badge inv-badge-low">Low Stock</span>;
    return <span className="inv-badge inv-badge-ok">In Stock</span>;
}

export default function StockManagement() {
    const [accessories, setAccessories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState('active'); // 'active' or 'deleted'
    const [addEditModal, setAddEditModal] = useState({ open: false, accessory: null });
    const [restockModal, setRestockModal] = useState({ open: false, accessory: null });
    const [discardModal, setDiscardModal] = useState({ open: false, accessory: null });
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [apiError, setApiError] = useState('');

    const fetchAccessories = useCallback(async () => {
        setLoading(true);
        setApiError('');
        try {
            const res = await getAccessories({ include_deleted: true });
            setAccessories(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setApiError(err.response?.data?.error || err.message || 'Failed to load accessories.');
            setAccessories([]);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchAccessories(); }, [fetchAccessories]);

    const handleDelete = async (id) => {
        try {
            await deleteAccessory(id);
            fetchAccessories();
        } catch (err) {
            alert(err.response?.data?.message || 'Delete failed');
        }
        setDeleteConfirm(null);
    };

    const filtered = accessories.filter(a => {
            const isDel = Boolean(a.is_deleted);
            if (viewMode === 'active' && isDel) return false;
            if (viewMode === 'deleted' && !isDel) return false;
            return a.name.toLowerCase().includes(search.toLowerCase());
        });
    
        const activeItems = accessories.filter(a => !a.is_deleted);
        const lowStock = activeItems.filter(a => a.available_quantity > 0 && a.available_quantity <= a.reorder_threshold).length;
        const outOfStock = activeItems.filter(a => a.available_quantity === 0).length;
        const totalValue = activeItems.reduce((s, a) => s + (parseFloat(a.price || 0) * (a.available_quantity || 0)), 0);

    return (
        <>
            {apiError && (
                <div className="inv-alert inv-alert-danger" style={{ marginBottom: 20 }}>
                    ⚠️ <strong>Error:</strong> {apiError}
                </div>
            )}

            {/* Stats */}
            <div className="inv-stats-grid">
                <div className="inv-stat-card" style={{ '--accent-color': 'var(--color-primary)' }}>
                    <div className="inv-stat-label">Total Items</div>
                    <div className="inv-stat-value">{accessories.length}</div>
                    <div className="inv-stat-sub">Accessory types</div>
                </div>
                <div className="inv-stat-card" style={{ '--accent-color': 'var(--color-success)' }}>
                    <div className="inv-stat-label">Inventory Value</div>
                    <div className="inv-stat-value">₹{totalValue.toLocaleString('en-IN')}</div>
                    <div className="inv-stat-sub">Available stock × price</div>
                </div>
                <div className="inv-stat-card" style={{ '--accent-color': 'var(--color-warning)' }}>
                    <div className="inv-stat-label">Low Stock Alerts</div>
                    <div className="inv-stat-value">{lowStock}</div>
                    <div className="inv-stat-sub">Below reorder threshold</div>
                </div>
                <div className="inv-stat-card" style={{ '--accent-color': 'var(--color-danger)' }}>
                    <div className="inv-stat-label">Out of Stock</div>
                    <div className="inv-stat-value">{outOfStock}</div>
                    <div className="inv-stat-sub">Need immediate restock</div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="inv-toolbar">
                <div className="inv-toolbar-left">
                    <div className="inv-toggle-group" style={{ marginRight: 16 }}>
                        <button className={`inv-toggle-btn${viewMode === 'active' ? ' active' : ''}`} onClick={() => setViewMode('active')}>
                            📦 Active Stock
                        </button>
                        <button className={`inv-toggle-btn${viewMode === 'deleted' ? ' active' : ''}`} onClick={() => setViewMode('deleted')}>
                            🗑 Deleted Items
                        </button>
                    </div>
                    <input
                        style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-base)', fontFamily: 'var(--font-family)', fontSize: 14, minWidth: 220 }}
                        placeholder="🔍 Search accessories..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="inv-toolbar-right">
                    <button className="btn btn-primary" onClick={() => setAddEditModal({ open: true, accessory: null })}>
                        + Add Accessory
                    </button>
                </div>
            </div>

            {viewMode === 'active' && !loading && (lowStock > 0 || outOfStock > 0) && (
                <div className={`inv-alert ${outOfStock > 0 ? 'inv-alert-danger' : 'inv-alert-warning'}`}>
                    ⚠️ {outOfStock > 0 ? `${outOfStock} item(s) are out of stock. ` : ''}
                    {lowStock > 0 ? `${lowStock} item(s) are below their reorder threshold.` : ''} Please restock soon.
                </div>
            )}

            {loading ? (
                <div className="inv-empty"><div className="inv-empty-icon">⏳</div><div>Loading...</div></div>
            ) : filtered.length === 0 && !apiError ? (
                <div className="inv-empty">
                    <div className="inv-empty-icon">📦</div>
                    <div className="inv-empty-title">No accessories found</div>
                    <div className="inv-empty-sub">
                        {accessories.length === 0 ? 'Click "+ Add Accessory" to get started.' : 'No accessories match your filter.'}
                    </div>
                </div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Price / Rate</th>
                                <th>Initial Stock</th>
                                <th>Available Stock</th>
                                <th>Discarded</th>
                                <th>Threshold</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(acc => (
                                <tr key={acc.id}>
                                    <td style={{ fontWeight: 600 }}>{acc.name}</td>
                                    <td><TypeBadge type={acc.type} /></td>
                                    <td>
    {acc.type === 'for_sale' && (
        <span>₹{parseFloat(acc.price || 0).toFixed(2)}</span>
    )}

    {acc.type === 'for_rental' && (
        acc.rental_pricing_type === 'hourly'
            ? <span>₹{acc.rent_price}/hr</span>
            : <span>₹{acc.rent_price}</span>
    )}

    {acc.type === 'both' && (
        <span>
            ₹{parseFloat(acc.price || 0).toFixed(2)} | ₹{acc.rent_price}
            {acc.rental_pricing_type === 'hourly' ? '/hr' : ''}
        </span>
    )}
</td>
                                    <td>{acc.stock_quantity}</td>
                                    <td>
                                        <StockBar available={acc.available_quantity} total={acc.stock_quantity} threshold={acc.reorder_threshold ?? 5} />
                                    </td>
                                    <td style={{ color: acc.discarded_quantity > 0 ? 'var(--color-danger-text)' : 'var(--color-text-muted)' }}>
                                        {acc.discarded_quantity}
                                    </td>
                                    <td style={{ color: 'var(--color-text-muted)' }}>{acc.reorder_threshold}</td>
                                    <td><StockStatusBadge available={acc.available_quantity} threshold={acc.reorder_threshold ?? 5} /></td>
                                    <td>
                                        {viewMode === 'active' ? (
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button className="btn btn-secondary btn-sm" onClick={() => setAddEditModal({ open: true, accessory: acc })}>Edit</button>
                                                <button className="btn btn-success btn-sm" onClick={() => setRestockModal({ open: true, accessory: acc })}>+ Stock</button>
                                                <button className="btn btn-warning btn-sm" onClick={() => setDiscardModal({ open: true, accessory: acc })}>Discard</button>
                                                <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(acc)}>Delete</button>
                                            </div>
                                        ) : (
                                            <span style={{ color: 'var(--color-danger)', fontSize: 12, fontWeight: 600 }}>Archived</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {deleteConfirm && (
                <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="modal-content" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Delete Accessory</h2>
                            <button className="close-button" onClick={() => setDeleteConfirm(null)}>×</button>
                        </div>
                        <p>Are you sure you want to completely archive <strong>{deleteConfirm.name}</strong> from your active stock?</p>
                        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>This item will be moved to the "Deleted Items" list. Past bookings containing this item will remain unaffected.</p>
                        <div className="modal-footer">
                            <button className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(deleteConfirm.id)}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {addEditModal.open && (
                <AddEditAccessoryModal
                    accessory={addEditModal.accessory}
                    accessories={accessories.filter(a => !a.is_deleted)} // ✅ fix
                    onClose={() => setAddEditModal({ open: false, accessory: null })}
                    onSaved={fetchAccessories}
                />
            )}
            {restockModal.open && (
                <RestockModal accessory={restockModal.accessory}
                    onClose={() => setRestockModal({ open: false, accessory: null })}
                    onSaved={fetchAccessories} />
            )}
            {discardModal.open && (
                <DiscardModal accessory={discardModal.accessory}
                    onClose={() => setDiscardModal({ open: false, accessory: null })}
                    onSaved={fetchAccessories} />
            )}
        </>
    );
}
