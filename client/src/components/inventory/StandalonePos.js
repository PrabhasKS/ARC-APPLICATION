import React, { useState, useEffect, useCallback } from 'react';
import { getAccessories, createStandaloneSale, getStandaloneSales } from './inventoryApi';
import StandaloneSaleDetailModal from './StandaloneSaleDetailModal';
import StandaloneReceiptModal from './StandaloneReceiptModal';
/* ── Accessory card ──────────────────────────────────── */
function AccCard({ acc, onAdd }) {
    const isOut = (acc.available_quantity ?? 0) === 0;
    const icon = acc.type === 'for_rental' ? '🔄' : acc.type === 'both' ? '✨' : '🏷';
    const priceLabel = acc.type === 'for_rental' 
        ? (acc.rental_pricing_type === 'hourly' ? `₹${acc.rent_price}/hr` : `₹${parseFloat(acc.rent_price || 0).toFixed(2)}`)
        : `₹${parseFloat(acc.price || 0).toFixed(2)}`;

    return (
        <div className={`pos-acc-card${isOut ? ' out-of-stock' : ''}`} onClick={() => !isOut && onAdd(acc)}>
            <div className="pos-acc-icon">{icon}</div>
            <div className="pos-acc-name">{acc.name}</div>
            <div className="pos-acc-price">{priceLabel}</div>
            <div className="pos-acc-stock">{isOut ? 'Out of stock' : `${acc.available_quantity} available`}</div>
        </div>
    );
}

/* ── Cart item ───────────────────────────────────────── */
function CartItem({ item, onQty, onRemove }) {
    const hrs = item.rental_hours || 1;
    const lineTotal = item.rental_pricing_type === 'hourly' && item.transaction_type === 'rental'
        ? (item.unit_price * hrs * item.quantity).toFixed(2)
        : (item.unit_price * item.quantity).toFixed(2);

    return (
        <div className="cart-item">
            <div className="cart-item-name">
                {item.name}
                {item.transaction_type === 'rental' && <span style={{ fontSize: 11, marginLeft: 6, color: 'var(--color-text-muted)' }}>(Rental)</span>}
            </div>
            {item.rental_pricing_type === 'hourly' && item.transaction_type === 'rental' && (
                <div style={{ marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Hours: </label>
                    <input type="number" min="0.5" step="0.5" value={hrs}
                        onChange={e => onQty(item.tempId, item.quantity, parseFloat(e.target.value) || 1)}
                        style={{ width: 60, padding: '2px 6px', border: '1px solid var(--color-border)', borderRadius: 4, fontFamily: 'var(--font-family)', fontSize: 12 }} />
                </div>
            )}
            <div className="cart-item-controls">
                <button className="cart-qty-btn" onClick={() => onQty(item.tempId, item.quantity - 1, item.rental_hours)}>−</button>
                <span className="cart-qty">{item.quantity}</span>
                <button className="cart-qty-btn" onClick={() => onQty(item.tempId, item.quantity + 1, item.rental_hours)}>+</button>
                <span className="cart-item-price">₹{lineTotal}</span>
                <button className="cart-remove" onClick={() => onRemove(item.tempId)}>✕</button>
            </div>
        </div>
    );
}

/* ── Type selector modal for "both" accessories ──────── */
function RentalTypeModal({ acc, onSelect, onClose }) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Select Transaction Type</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>
                <p style={{ color: 'var(--color-text-secondary)' }}><strong>{acc.name}</strong> can be sold or rented. Which do you want?</p>
                <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onSelect('sale')}>
                        🏷 Sell — ₹{parseFloat(acc.price || 0).toFixed(2)}
                    </button>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => onSelect('rental')}>
                        🔄 Rent — {acc.rental_pricing_type === 'hourly' ? `₹${acc.rent_price}/hr` : `₹${parseFloat(acc.rent_price || 0).toFixed(2)}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ── Main POS ────────────────────────────────────────── */
export default function StandalonePos() {
    const [accessories, setAccessories] = useState([]);
    const [cart, setCart] = useState([]);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [typeModal, setTypeModal] = useState(null);
    const [customer, setCustomer] = useState({ name: '', contact: '' });
    const [paymentMode, setPaymentMode] = useState('cash');
    const [amountPaid, setAmountPaid] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successSale, setSuccessSale] = useState(null);
    const [showList, setShowList] = useState(false);
    const [sales, setSales] = useState([]);
    const [salesTotal, setSalesTotal] = useState(0);
    const [salesPage, setSalesPage] = useState(1);
    const [salesTotalPages, setSalesTotalPages] = useState(1);
    const [salesSearch, setSalesSearch] = useState('');
    const [salesDate, setSalesDate] = useState('');
    const [detailModal, setDetailModal] = useState(null);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);

    const fetchAccessories = useCallback(async () => {
        try {
            const res = await getAccessories();
            setAccessories(Array.isArray(res.data) ? res.data : []);
        } catch { setAccessories([]); }
    }, []);

    const fetchSales = useCallback(async () => {
        try {
            const params = { page: salesPage, limit: 12 };
            if (salesSearch) params.search = salesSearch;
            if (salesDate) params.date = salesDate;
            const res = await getStandaloneSales(params);
            setSales(res.data.sales || []);
            setSalesTotal(res.data.total || 0);
            setSalesTotalPages(res.data.totalPages || 1);
        } catch {}
    }, [salesPage, salesSearch, salesDate]);

    useEffect(() => { fetchAccessories(); }, [fetchAccessories]);
    useEffect(() => { if (showList) fetchSales(); }, [showList, fetchSales]);

    const addToCart = (acc, txType) => {
        const id = `${acc.id}_${txType}_${Date.now()}`;
        const unitPrice = txType === 'rental'
            ? parseFloat(acc.rent_price || 0)
            : parseFloat(acc.price || 0);
        setCart(c => [...c, { tempId: id, accessory_id: acc.id, name: acc.name, transaction_type: txType, quantity: 1, rental_hours: 1, unit_price: unitPrice, rental_pricing_type: acc.rental_pricing_type }]);
    };

    const handleAccClick = (acc) => {
        if (acc.type === 'both') { setTypeModal(acc); return; }
        addToCart(acc, acc.type === 'for_rental' ? 'rental' : 'sale');
    };

    const updateCartItem = (tempId, qty, hrs) => {
        if (qty <= 0) { setCart(c => c.filter(i => i.tempId !== tempId)); return; }
        setCart(c => c.map(i => i.tempId !== tempId ? i : { ...i, quantity: qty, rental_hours: hrs !== undefined ? hrs : i.rental_hours }));
    };

    const cartTotal = cart.reduce((s, i) => {
        const base = i.rental_pricing_type === 'hourly' && i.transaction_type === 'rental'
            ? i.unit_price * (i.rental_hours || 1) * i.quantity
            : i.unit_price * i.quantity;
        return s + base;
    }, 0);

    const balance = cartTotal - parseFloat(amountPaid || 0);

    const handleCheckout = async () => {
        if (!customer.name || !customer.contact) { setError('Customer name and contact are required.'); return; }
        if (cart.length === 0) { setError('Cart is empty.'); return; }
        const paid = parseFloat(amountPaid || 0);
        if (paid > cartTotal) { setError('Amount paid cannot exceed total.'); return; }
        setSaving(true); setError('');
        try {
            const res = await createStandaloneSale({
                customer_name: customer.name, customer_contact: customer.contact,
                sale_date: date,
                items: cart.map(i => ({ accessory_id: i.accessory_id, transaction_type: i.transaction_type, quantity: i.quantity, rental_hours: i.rental_hours })),
                payment_mode: paymentMode, amount_paid: paid, notes
            });
            setSuccessSale(res.data.saleId);
            setCart([]); setCustomer({ name: '', contact: '' }); setAmountPaid(''); setNotes('');
            fetchAccessories();
        } catch (err) {
            setError(err.response?.data?.message || 'Checkout failed.');
        }
        setSaving(false);
    };

    const filtered = accessories.filter(a => {
        const matchS = a.name.toLowerCase().includes(search.toLowerCase());
        const matchT = !filterType || a.type === filterType || a.type === 'both';
        return matchS && matchT;
    });

    return (
        <>
            <div className="inv-toolbar" style={{ marginBottom: 16 }}>
                <div className="inv-toggle-group" style={{ width: 300 }}>
                    <button className={`inv-toggle-btn${!showList ? ' active' : ''}`} onClick={() => setShowList(false)}>🛒 New Sale</button>
                    <button className={`inv-toggle-btn${showList ? ' active' : ''}`} onClick={() => setShowList(true)}>📋 Sales History</button>
                </div>
            </div>

            {!showList && (
                <>
                    {successSale && (
                        <div className="inv-alert inv-alert-success" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
                            <span>✅ Sale #{successSale} created!</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => { setDetailModal(successSale); setSuccessSale(null); }}>View Details</button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setIsReceiptOpen(true)}>🖨 Receipt</button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setSuccessSale(null)}>×</button>
                            </div>
                        </div>
                    )}
                    {isReceiptOpen && successSale && (
                        <StandaloneReceiptModal saleId={successSale} onClose={() => setIsReceiptOpen(false)} />
                    )}
                    {error && <div className="error-message">{error} <button style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }} onClick={() => setError('')}>×</button></div>}

                    <div className="pos-layout">
                        <div className="pos-left">
                            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                                <input style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-base)', fontFamily: 'var(--font-family)', fontSize: 14 }}
                                    placeholder="🔍 Search accessories..." value={search} onChange={e => setSearch(e.target.value)} />
                                <select style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-base)', background: '#F8F9FA', fontFamily: 'var(--font-family)', fontSize: 14 }}
                                    value={filterType} onChange={e => setFilterType(e.target.value)}>
                                    <option value="">All</option>
                                    <option value="for_sale">Sale Only</option>
                                    <option value="for_rental">Rental Only</option>
                                    <option value="both">Both</option>
                                </select>
                            </div>
                            <div className="pos-accessories-grid">
                                {filtered.map(acc => <AccCard key={acc.id} acc={acc} onAdd={handleAccClick} />)}
                                {filtered.length === 0 && (
                                    <div className="inv-empty" style={{ gridColumn: '1/-1' }}>
                                        <div className="inv-empty-icon">📦</div>
                                        <div className="inv-empty-sub">
                                            {accessories.length === 0 ? 'No accessories found. Add some in Stock Management first.' : 'No accessories match your filter.'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pos-right">
                            <div className="cart-header">🛒 Cart ({cart.length})</div>
                            <div className="cart-items">
                                {cart.length === 0 ? (
                                    <div className="inv-empty" style={{ padding: '30px 16px' }}>
                                        <div className="inv-empty-icon">🛒</div>
                                        <div className="inv-empty-sub">Click accessories to add them</div>
                                    </div>
                                ) : cart.map(item => <CartItem key={item.tempId} item={item} onQty={updateCartItem} onRemove={(id) => setCart(c => c.filter(i => i.tempId !== id))} />)}
                            </div>
                            <div className="cart-footer">
                                <div className="cart-form-group">
                                    <label className="cart-form-label">Customer Name *</label>
                                    <input className="cart-form-input" value={customer.name} onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))} placeholder="Walk-in customer name" />
                                </div>
                                <div className="cart-form-group">
                                    <label className="cart-form-label">Contact *</label>
                                    <input className="cart-form-input" value={customer.contact} onChange={e => setCustomer(c => ({ ...c, contact: e.target.value }))} placeholder="Phone number" />
                                </div>
                                <div className="cart-form-row">
                                    <div className="cart-form-group">
                                        <label className="cart-form-label">Date</label>
                                        <input type="date" className="cart-form-input" value={date} onChange={e => setDate(e.target.value)} />
                                    </div>
                                    <div className="cart-form-group">
                                        <label className="cart-form-label">Payment Mode</label>
                                        <select className="cart-form-select" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                                            <option value="cash">Cash</option>
                                            <option value="online">Online / UPI</option>
                                            <option value="card">Card</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="cart-total">
                                    <span className="cart-total-label">Total</span>
                                    <span className="cart-total-amount">₹{cartTotal.toFixed(2)}</span>
                                </div>
                                <div className="cart-form-group">
                                    <label className="cart-form-label">Amount Paid</label>
                                    <input className="cart-form-input" type="number" min="0" step="0.01" max={cartTotal}
                                        value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder={`0.00 – ${cartTotal.toFixed(2)}`} />
                                    {amountPaid !== '' && (
                                        <small style={{ fontWeight: 600, color: balance > 0 ? 'var(--color-warning-text)' : 'var(--color-success-text)' }}>
                                            {balance > 0 ? `Balance due: ₹${balance.toFixed(2)}` : '✅ Fully paid'}
                                        </small>
                                    )}
                                </div>
                                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                                    onClick={handleCheckout} disabled={saving || cart.length === 0}>
                                    {saving ? 'Processing…' : '✅ Complete Sale'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {showList && (
                <>
                    <div className="inv-toolbar">
                        <div className="inv-toolbar-left">
                            <input style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-base)', fontFamily: 'var(--font-family)', width: 220, fontSize: 14 }}
                                placeholder="🔍 Search customer..." value={salesSearch}
                                onChange={e => { setSalesSearch(e.target.value); setSalesPage(1); }} />
                            <input type="date" style={{ padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-base)', fontFamily: 'var(--font-family)', fontSize: 13 }}
                                value={salesDate} onChange={e => { setSalesDate(e.target.value); setSalesPage(1); }} />
                            {salesDate && <button className="btn btn-secondary btn-sm" onClick={() => setSalesDate('')}>Clear</button>}
                        </div>
                        <div className="inv-toolbar-right">
                            <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{salesTotal} sales</span>
                        </div>
                    </div>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr><th>#</th><th>Date</th><th>Customer</th><th>Contact</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {sales.map(s => (
                                    <tr key={s.id}>
                                        <td style={{ color: 'var(--color-text-muted)' }}>#{s.id}</td>
                                        <td>{s.sale_date}</td>
                                        <td style={{ fontWeight: 600 }}>{s.customer_name}</td>
                                        <td style={{ color: 'var(--color-text-muted)' }}>{s.customer_contact}</td>
                                        <td>₹{parseFloat(s.total_amount).toFixed(2)}</td>
                                        <td style={{ color: 'var(--color-success-text)', fontWeight: 600 }}>₹{parseFloat(s.amount_paid).toFixed(2)}</td>
                                        <td style={{ color: parseFloat(s.balance_amount) > 0 ? 'var(--color-warning-text)' : 'var(--color-text-muted)', fontWeight: parseFloat(s.balance_amount) > 0 ? 600 : 400 }}>
                                            ₹{parseFloat(s.balance_amount).toFixed(2)}
                                        </td>
                                        <td><span className={`payment-status-text payment-status-${s.payment_status.toLowerCase()}`}>{s.payment_status}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button className="btn btn-secondary btn-sm" onClick={() => setDetailModal(s.id)}>View</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {sales.length === 0 && (
                                    <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No sales found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {salesTotalPages > 1 && (
                        <div className="inv-pagination">
                            <button className="inv-page-btn" disabled={salesPage === 1} onClick={() => setSalesPage(p => p - 1)}>‹</button>
                            {Array.from({ length: salesTotalPages }, (_, i) => i + 1).map(p => (
                                <button key={p} className={`inv-page-btn${salesPage === p ? ' active' : ''}`} onClick={() => setSalesPage(p)}>{p}</button>
                            ))}
                            <button className="inv-page-btn" disabled={salesPage === salesTotalPages} onClick={() => setSalesPage(p => p + 1)}>›</button>
                        </div>
                    )}
                </>
            )}

            {typeModal && <RentalTypeModal acc={typeModal} onSelect={txType => { addToCart(typeModal, txType); setTypeModal(null); }} onClose={() => setTypeModal(null)} />}
            {detailModal && <StandaloneSaleDetailModal saleId={detailModal} onClose={() => { setDetailModal(null); fetchSales(); fetchAccessories(); }} />}
            {isReceiptOpen && detailModal && (
                <StandaloneReceiptModal saleId={detailModal} onClose={() => setIsReceiptOpen(false)} />
            )}
        </>
    );
}
