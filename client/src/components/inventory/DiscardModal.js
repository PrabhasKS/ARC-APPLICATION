import React, { useState } from 'react';
import { discardAccessory } from './inventoryApi';

export default function DiscardModal({ accessory, onClose, onSaved }) {
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const available = accessory.available_quantity ?? 0;
    const qty = parseInt(quantity) || 0;
    const newAvail = available - qty;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!qty || qty <= 0) { setError('Enter a valid quantity.'); return; }
        if (!reason.trim()) { setError('Please provide a reason for discarding.'); return; }
        if (qty > available) { setError(`Only ${available} unit(s) available to discard.`); return; }
        setSaving(true); setError('');
        try {
            await discardAccessory(accessory.id, { quantity: qty, reason });
            onSaved(); onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to discard.');
        }
        setSaving(false);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>🗑 Discard Stock: {accessory.name}</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="message error" style={{ marginBottom: 12 }}>
                        ⚠️ Discarded items are permanently removed from available stock.
                    </div>
                    {error && <div className="error-message">{error}</div>}
                    <div className="summary-card">
                        <p><strong>Current Available:</strong> {available} units</p>
                        <p style={{ margin: 0 }}><strong>Already Discarded:</strong> {accessory.discarded_quantity ?? 0} units</p>
                    </div>
                    <div className="form-group">
                        <label>Units to Discard *</label>
                        <input type="number" min="1" max={available} required autoFocus
                            value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Enter quantity" />
                        {qty > 0 && (
                            <small style={{ color: newAvail < 0 ? 'var(--color-danger-text)' : 'var(--color-warning-text)', fontWeight: 600 }}>
                                {newAvail < 0 ? `⚠️ Cannot exceed available stock (${available})` : `Stock after discard: ${newAvail}`}
                            </small>
                        )}
                    </div>
                    <div className="form-group">
                        <label>Reason for Discarding *</label>
                        <textarea required value={reason} onChange={e => setReason(e.target.value)}
                            placeholder="e.g. Worn out after extensive use, damaged beyond repair..." />
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-danger btn-sm" disabled={saving || newAvail < 0}>
                            {saving ? 'Discarding…' : '🗑 Confirm Discard'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
