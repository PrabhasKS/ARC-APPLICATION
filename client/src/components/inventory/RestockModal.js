import React, { useState } from 'react';
import { restockAccessory } from './inventoryApi';

export default function RestockModal({ accessory, onClose, onSaved }) {
    const [quantity, setQuantity] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const qty = parseInt(quantity) || 0;
    const newAvail = (accessory.available_quantity ?? 0) + qty;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!qty || qty <= 0) { setError('Enter a valid quantity.'); return; }
        setSaving(true); setError('');
        try {
            await restockAccessory(accessory.id, { quantity: qty, notes });
            onSaved(); onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to restock.');
        }
        setSaving(false);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📥 Restock: {accessory.name}</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    {error && <div className="error-message">{error}</div>}
                    <div className="summary-card">
                        <p><strong>Current Available:</strong> {accessory.available_quantity ?? 0} units</p>
                        <p style={{ margin: 0 }}><strong>Reorder Threshold:</strong> {accessory.reorder_threshold ?? 5} units</p>
                    </div>
                    <div className="form-group">
                        <label>Units to Add *</label>
                        <input type="number" min="1" required autoFocus
                            value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Enter quantity" />
                        {qty > 0 && (
                            <small style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                                New available stock will be: {newAvail}
                            </small>
                        )}
                    </div>
                    <div className="form-group">
                        <label>Notes (Invoice ref, supplier, etc.)</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional..." />
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-success btn-sm" disabled={saving}>
                            {saving ? 'Restocking…' : '📥 Add to Stock'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
