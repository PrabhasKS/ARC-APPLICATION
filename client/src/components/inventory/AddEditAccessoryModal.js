import React, { useState } from 'react';
import { createAccessory, updateAccessory } from './inventoryApi';

export default function AddEditAccessoryModal({ accessory, onClose, onSaved }) {
    const isEdit = !!accessory;
    const [form, setForm] = useState({
        name: accessory?.name || '',
        price: accessory?.price !== undefined ? accessory.price : '',
        type: accessory?.type || 'for_sale',
        rental_pricing_type: accessory?.rental_pricing_type || 'flat',
        rent_price: accessory?.rent_price || '',
        initial_stock: isEdit ? (accessory.available_quantity ?? '') : '',
        reorder_threshold: accessory?.reorder_threshold ?? 5,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const showSalePrice = form.type === 'for_sale' || form.type === 'both';
    const showRentPrice = form.type === 'for_rental' || form.type === 'both';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            const payload = {
                name: form.name,
                price: showSalePrice ? (parseFloat(form.price) || 0) : 0,
                type: form.type,
                rental_pricing_type: form.rental_pricing_type,
                rent_price: showRentPrice ? (parseFloat(form.rent_price) || 0) : null,
                initial_stock: parseInt(form.initial_stock) || 0,
                reorder_threshold: parseInt(form.reorder_threshold) || 5,
            };
            if (isEdit) {
                await updateAccessory(accessory.id, payload);
            } else {
                await createAccessory(payload);
            }
            onSaved();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Save failed');
        }
        setSaving(false);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{isEdit ? 'Edit Accessory' : 'Add New Accessory'}</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '75vh' }}>
                    {error && <div className="error-message">{error}</div>}

                    <div className="modal-body" style={{ overflowY: 'auto', paddingRight: '4px', flex: 1 }}>
                        <div className="form-group">
                            <label>Name *</label>
                            <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Badminton Racquet" />
                        </div>

                        <div className="form-group">
                            <label>Accessory Type *</label>
                            <div className="inv-toggle-group">
                                {[['for_sale', '🏷 For Sale'], ['for_rental', '🔄 For Rental'], ['both', '✨ Both']].map(([val, label]) => (
                                    <button key={val} type="button"
                                        className={`inv-toggle-btn${form.type === val ? ' active' : ''}`}
                                        onClick={() => set('type', val)}>{label}</button>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            {showSalePrice && (
                                <div className="form-group">
                                    <label>Sale Price (₹) *</label>
                                    <input type="number" min="0" step="0.01" required={showSalePrice}
                                        value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" />
                                </div>
                            )}
                            {showRentPrice && (
                                <div className="form-group">
                                    <label>
                                        Rent Price (₹) * 
                                        {form.rental_pricing_type === 'hourly' && <span style={{fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 4}}>(per hr)</span>}
                                    </label>
                                    <input type="number" min="0" step="0.01" required={showRentPrice}
                                        value={form.rent_price} onChange={e => set('rent_price', e.target.value)} placeholder="0.00" />
                                </div>
                            )}
                        </div>

                        {showRentPrice && (
                            <div className="form-group">
                                <label>Rental Calculation Mode</label>
                                <div className="inv-toggle-group">
                                    <button type="button"
                                        className={`inv-toggle-btn${form.rental_pricing_type === 'flat' ? ' active' : ''}`}
                                        onClick={() => set('rental_pricing_type', 'flat')}>💰 Flat (Per session)</button>
                                    <button type="button"
                                        className={`inv-toggle-btn${form.rental_pricing_type === 'hourly' ? ' active' : ''}`}
                                        onClick={() => set('rental_pricing_type', 'hourly')}>⏱ Hourly (Per slot)</button>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div className="form-group">
                                <label>Reorder Threshold</label>
                                <input type="number" min="0" value={form.reorder_threshold} onChange={e => set('reorder_threshold', e.target.value)} />
                                <small style={{ color: 'var(--color-text-muted)' }}>Alert when stock falls below this.</small>
                            </div>
                            {!isEdit && (
                                <div className="form-group">
                                    <label>Initial Stock *</label>
                                    <input type="number" min="0" required={!isEdit}
                                        value={form.initial_stock} onChange={e => set('initial_stock', e.target.value)} placeholder="0" />
                                </div>
                            )}
                        </div>

                        {isEdit && (
                            <div className="summary-card">
                                <p><strong>Current Available:</strong> {accessory.available_quantity ?? 0} units</p>
                                <p style={{ margin: 0, fontSize: 12 }}>Use Restock / Discard buttons to change stock quantities.</p>
                            </div>
                        )}
                    </div>

                    <div className="modal-footer" style={{ marginTop: 'var(--space-lg)', paddingTop: 'var(--space-base)', borderTop: '1px solid var(--color-border-light)' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Accessory'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
