import React, { useState } from 'react';
import { processReturn } from './inventoryApi';

export default function ReturnModal({ returnInfo, onClose, onSaved }) {
    const { source_type, source_id, accessory_id, accessory_name, max_qty, customer_name } = returnInfo;
    const [form, setForm] = useState({
        quantity_returned: max_qty === 1 ? 1 : '',
        item_condition: 'good',
        damage_charge: '',
        damage_payment_mode: 'cash',
        notes: ''
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const showDamage = form.item_condition === 'damaged' || form.item_condition === 'discarded';

    const handleSubmit = async (e) => {
        e.preventDefault();
        const qty = parseInt(form.quantity_returned, 10);
        if (!qty || qty <= 0 || qty > max_qty) { setError(`Quantity must be between 1 and ${max_qty}`); return; }
        setSaving(true); setError('');
        try {
            await processReturn({
                source_type, source_id, accessory_id,
                quantity_returned: qty,
                item_condition: form.item_condition,
                damage_charge: showDamage ? parseFloat(form.damage_charge || 0) : 0,
                damage_payment_mode: form.damage_payment_mode,
                notes: form.notes
            });
            onSaved();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to process return.');
        }
        setSaving(false);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>↩ Process Return</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    {error && <div className="error-message">{error}</div>}
                    <div className="summary-card">
                        <p><strong>Accessory:</strong> {accessory_name}</p>
                        <p><strong>Customer:</strong> {customer_name}</p>
                        <p style={{ margin: 0 }}><strong>Source:</strong> {source_type === 'standalone' ? 'Walk-in Sale' : 'Court Booking'} #{source_id}</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group">
                            <label>Qty Returning (max {max_qty}) *</label>
                            <input type="number" min="1" max={max_qty} required
                                value={form.quantity_returned} onChange={e => set('quantity_returned', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Item Condition *</label>
                            <select value={form.item_condition} onChange={e => set('item_condition', e.target.value)}>
                                <option value="good">✅ Good — Back to stock</option>
                                <option value="damaged">⚠️ Damaged — Charge customer</option>
                                <option value="discarded">🗑 Discarded — Worn out</option>
                            </select>
                        </div>
                    </div>

                    {form.item_condition === 'good' && <div className="message success">✅ Item will be returned to available stock.</div>}
                    {form.item_condition === 'damaged' && <div className="message error">⚠️ Item will be marked discarded. A damage charge payment will be recorded.</div>}
                    {form.item_condition === 'discarded' && <div className="message error">🗑 Item is worn out and permanently removed from usable stock.</div>}

                    {showDamage && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div className="form-group">
                                <label>Damage Charge (₹)</label>
                                <input type="number" min="0" step="0.01"
                                    value={form.damage_charge} onChange={e => set('damage_charge', e.target.value)} placeholder="0.00" />
                                <small style={{ color: 'var(--color-text-muted)' }}>A separate payment record will be created.</small>
                            </div>
                            <div className="form-group">
                                <label>Payment Mode</label>
                                <select value={form.damage_payment_mode} onChange={e => set('damage_payment_mode', e.target.value)}>
                                    <option value="cash">Cash</option>
                                    <option value="online">Online</option>
                                    <option value="card">Card</option>
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label>Notes</label>
                        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                            placeholder="Any remarks about the return condition..." />
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                            {saving ? 'Processing…' : '↩ Confirm Return'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
