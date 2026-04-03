import React, { useState, useEffect } from 'react';
import { getStandaloneSale, addSalePayment, getSaleReceiptUrl } from './inventoryApi';
import StandaloneReceiptModal from './StandaloneReceiptModal';

export default function StandaloneSaleDetailModal({ saleId, onClose }) {
    const [sale, setSale] = useState(null);
    const [loading, setLoading] = useState(true);
    const [payForm, setPayForm] = useState({ amount: '', payment_mode: 'cash' });
    const [paying, setPaying] = useState(false);
    const [payError, setPayError] = useState('');
    const [showPayForm, setShowPayForm] = useState(false);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);

    const fetchSale = async () => {
        setLoading(true);
        try {
            const res = await getStandaloneSale(saleId);
            setSale(res.data);
        } catch {}
        setLoading(false);
    };

    useEffect(() => { fetchSale(); }, [saleId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handlePayment = async (e) => {
        e.preventDefault();
        setPaying(true); setPayError('');
        try {
            await addSalePayment(saleId, payForm);
            setShowPayForm(false);
            setPayForm({ amount: '', payment_mode: 'cash' });
            fetchSale();
        } catch (err) {
            setPayError(err.response?.data?.message || 'Payment failed.');
        }
        setPaying(false);
    };

    if (loading || !sale) {
        return (
            <div className="modal-overlay">
                <div className="modal-content" style={{ maxWidth: 700 }}>
                    <div className="inv-empty"><div className="inv-empty-icon">⏳</div></div>
                </div>
            </div>
        );
    }

    const isPaid = sale.payment_status === 'Completed';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Sale #{sale.id} — {sale.customer_name}</h2>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setIsReceiptOpen(true)}>🖨 Receipt</button>
                        <button className="close-button" onClick={onClose}>×</button>
                    </div>
                </div>

                <div className="summary-card">
                    <p><strong>Date:</strong> {sale.sale_date} &nbsp;&nbsp; <strong>Contact:</strong> {sale.customer_contact}</p>
                    <p style={{ margin: 0 }}><strong>Created By:</strong> {sale.created_by || '—'} &nbsp;&nbsp;
                        <strong>Status:</strong> <span className={`payment-status-text payment-status-${sale.payment_status.toLowerCase()}`}>{sale.payment_status}</span>
                    </p>
                </div>

                <h4 style={{ color: 'var(--color-primary)', marginBottom: 10 }}>Items</h4>
                <div className="table-container" style={{ marginBottom: 20 }}>
                    <table>
                        <thead>
                            <tr><th>Accessory</th><th>Type</th><th>Qty</th><th>Hrs</th><th>Unit Price</th><th>Line Total</th></tr>
                        </thead>
                        <tbody>
                            {(sale.items || []).map(item => (
                                <tr key={item.id}>
                                    <td style={{ fontWeight: 600 }}>{item.accessory_name}</td>
                                    <td><span className={`inv-badge ${item.transaction_type === 'rental' ? 'inv-badge-rental' : 'inv-badge-sale'}`}>{item.transaction_type}</span></td>
                                    <td>{item.quantity}</td>
                                    <td style={{ color: 'var(--color-text-muted)' }}>{item.rental_hours || '—'}</td>
                                    <td>₹{parseFloat(item.price_at_sale).toFixed(2)}</td>
                                    <td style={{ fontWeight: 700 }}>₹{(parseFloat(item.price_at_sale) * item.quantity).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                    {[
                        ['Total', `₹${parseFloat(sale.total_amount).toFixed(2)}`, 'var(--color-text)'],
                        ['Paid', `₹${parseFloat(sale.amount_paid).toFixed(2)}`, 'var(--color-success-text)'],
                        ['Balance', `₹${parseFloat(sale.balance_amount).toFixed(2)}`, parseFloat(sale.balance_amount) > 0 ? 'var(--color-warning-text)' : 'var(--color-text-muted)'],
                    ].map(([l, v, c]) => (
                        <div key={l} style={{ background: '#F8F9FA', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--color-border-light)' }}>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{l}</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
                        </div>
                    ))}
                </div>

                {(sale.payments || []).length > 0 && (
                    <>
                        <h4 style={{ color: 'var(--color-primary)', marginBottom: 10 }}>Payment History</h4>
                        <div className="table-container" style={{ marginBottom: 20 }}>
                            <table>
                                <thead><tr><th>Amount</th><th>Mode</th><th>Date</th><th>By</th></tr></thead>
                                <tbody>
                                    {sale.payments.map(p => (
                                        <tr key={p.id}>
                                            <td style={{ color: 'var(--color-success-text)', fontWeight: 700 }}>₹{parseFloat(p.amount).toFixed(2)}</td>
                                            <td>{p.payment_mode}</td>
                                            <td>{new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
                                            <td style={{ color: 'var(--color-text-muted)' }}>{p.username || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {!isPaid && (
                    !showPayForm ? (
                        <button className="btn btn-success btn-sm" onClick={() => setShowPayForm(true)}>+ Record Payment</button>
                    ) : (
                        <form onSubmit={handlePayment} style={{ background: '#F8F9FA', borderRadius: 8, padding: 16, border: '1px solid var(--color-border-light)' }}>
                            <h4 style={{ margin: '0 0 12px', color: 'var(--color-primary)', fontSize: 14 }}>Record Payment</h4>
                            {payError && <div className="error-message">{payError}</div>}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label>Amount *</label>
                                    <input type="number" min="0.01" step="0.01" max={sale.balance_amount} required
                                        value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label>Mode *</label>
                                    <select value={payForm.payment_mode} onChange={e => setPayForm(p => ({ ...p, payment_mode: e.target.value }))}>
                                        <option value="cash">Cash</option>
                                        <option value="online">Online / UPI</option>
                                        <option value="card">Card</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPayForm(false)}>Cancel</button>
                                <button type="submit" className="btn btn-success btn-sm" disabled={paying}>{paying ? 'Saving…' : 'Save Payment'}</button>
                            </div>
                        </form>
                    )
                )}
            </div>
            {isReceiptOpen && <StandaloneReceiptModal saleId={saleId} onClose={() => setIsReceiptOpen(false)} />}
        </div>
    );
}
