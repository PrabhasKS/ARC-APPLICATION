import React, { useState, useEffect } from 'react';
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
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
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
                    </div>
                    <div className="form-group">
                        <label>Sport</label>
                        <select name="sport_id" value={formData.sport_id} onChange={handleChange} required>
                            <option value="" disabled>Select a sport</option>
                            {sports.map(sport => (
                                <option key={sport.id} value={sport.id}>{sport.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Duration (in days)</label>
                        <input type="number" name="duration_days" value={formData.duration_days} onChange={handleChange} required min="1" />
                    </div>
                    <div className="form-group">
                        <label>Per Person Price (Rs.)</label>
                        <input type="number" name="per_person_price" value={formData.per_person_price} onChange={handleChange} required min="0" />
                    </div>
                    <div className="form-group">
                        <label>Max Team Size</label>
                        <input type="number" name="max_team_size" value={formData.max_team_size} onChange={handleChange} required min="1" />
                    </div>
                    <div className="form-group">
                        <label>Details / Description</label>
                        <textarea name="details" value={formData.details} onChange={handleChange}></textarea>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary">{pkg ? 'Save Changes' : 'Create Package'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PackageEditModal;
