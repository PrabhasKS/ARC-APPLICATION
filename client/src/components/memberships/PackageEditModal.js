import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import api from '../../api';
import './PackageEditModal.css';

const PackageEditModal = ({ pkg, onSave, onClose, error }) => {
    const [formData, setFormData] = useState({
        name: '',
        sport_id: '',
        duration_days: 30,
        per_person_price: '',
        max_team_size: 1,
        details: ''
    });
    const [sports, setSports] = useState([]);
    const [errors, setErrors] = useState({}); // New errors state
    const [submitting, setSubmitting] = useState(false); // New submitting state

    useEffect(() => {
        // If a package is passed, we are in "edit" mode
        if (pkg) {
            setFormData({
                name: pkg.name || '',
                sport_id: pkg.sport_id || '',
                duration_days: pkg.duration_days || 30,
                per_person_price: pkg.per_person_price || '',
                max_team_size: pkg.max_team_size || 1,
                details: pkg.details || ''
            });
        }
    }, [pkg]);

    useEffect(() => {
        // Fetch all available sports for the dropdown
        const fetchSports = async () => {
            try {
                const response = await api.get('/sports');
                setSports(response.data);
            } catch (err) {
                console.error("Failed to fetch sports", err);
            }
        };
        fetchSports();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error for this field on change
        setErrors(prev => ({ ...prev, [name]: undefined }));
    };

    const validateForm = useCallback(() => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Package name is required.';
        }
        if (!formData.sport_id) {
            newErrors.sport_id = 'Sport is required.';
        }
        if (isNaN(formData.duration_days) || parseInt(formData.duration_days) <= 0) {
            newErrors.duration_days = 'Duration must be a positive number.';
        }
        if (isNaN(formData.per_person_price) || parseFloat(formData.per_person_price) < 0) {
            newErrors.per_person_price = 'Price must be a non-negative number.';
        }
        if (isNaN(formData.max_team_size) || parseInt(formData.max_team_size) <= 0) {
            newErrors.max_team_size = 'Max team size must be a positive number.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData]);

    const handleSubmit = (e) => {
        e.preventDefault();
        setErrors({}); // Clear previous errors
        if (!validateForm()) {
            return; // Stop submission if validation fails
        }
        setSubmitting(true);
        onSave(formData); // Call onSave from parent
        setSubmitting(false); // Reset submitting state after onSave completes (or handle in parent)
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>{pkg ? 'Edit Membership Package' : 'Create New Package'}</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="modal-form">
                    {error && <div className="error-message">{error}</div>}
                    <div className="form-group">
                        <label>Package Name</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} required />
                        {errors.name && <p style={{ color: 'red', fontSize: '12px' }}>{errors.name}</p>}
                    </div>
                    <div className="form-group">
                        <label>Sport</label>
                        <select name="sport_id" value={formData.sport_id} onChange={handleChange} required>
                            <option value="" disabled>Select a sport</option>
                            {sports.map(sport => (
                                <option key={sport.id} value={sport.id}>{sport.name}</option>
                            ))}
                        </select>
                        {errors.sport_id && <p style={{ color: 'red', fontSize: '12px' }}>{errors.sport_id}</p>}
                    </div>
                    <div className="form-group">
                        <label>Duration (in days)</label>
                        <input type="number" name="duration_days" value={formData.duration_days} onChange={handleChange} required min="1" />
                        {errors.duration_days && <p style={{ color: 'red', fontSize: '12px' }}>{errors.duration_days}</p>}
                    </div>
                    <div className="form-group">
                        <label>Per Person Price (Rs.)</label>
                        <input type="number" name="per_person_price" value={formData.per_person_price} onChange={handleChange} required min="0" />
                        {errors.per_person_price && <p style={{ color: 'red', fontSize: '12px' }}>{errors.per_person_price}</p>}
                    </div>
                    <div className="form-group">
                        <label>Max Team Size</label>
                        <input type="number" name="max_team_size" value={formData.max_team_size} onChange={handleChange} required min="1" />
                        {errors.max_team_size && <p style={{ color: 'red', fontSize: '12px' }}>{errors.max_team_size}</p>}
                    </div>
                    <div className="form-group">
                        <label>Details / Description</label>
                        <textarea name="details" value={formData.details} onChange={handleChange}></textarea>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>{pkg ? 'Save Changes' : 'Create Package'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PackageEditModal;
