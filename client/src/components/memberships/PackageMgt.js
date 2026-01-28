import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import PackageEditModal from './PackageEditModal';
import './PackageMgt.css';

const PackageMgt = ({ user }) => {
    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalError, setModalError] = useState(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState(null);

    const isAdmin = user && user.role === 'admin';

    const fetchPackages = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/memberships/packages');
            setPackages(response.data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch membership packages.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPackages();
    }, [fetchPackages]);

    const handleOpenModal = (pkg = null) => {
        setSelectedPackage(pkg);
        setIsModalOpen(true);
        setModalError(null);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedPackage(null);
        setModalError(null);
    };

    const handleSave = async (packageData) => {
        try {
            if (selectedPackage) {
                // Update existing package
                await api.put(`/memberships/packages/${selectedPackage.id}`, packageData);
            } else {
                // Create new package
                await api.post('/memberships/packages', packageData);
            }
            fetchPackages(); // Refresh the list
            handleCloseModal();
        } catch (err) {
            console.error("Failed to save package:", err);
            setModalError(err.response?.data?.message || 'An error occurred while saving.');
        }
    };

    const handleDelete = async (packageId) => {
        if (window.confirm('Are you sure you want to delete this package? This action cannot be undone.')) {
            try {
                await api.delete(`/memberships/packages/${packageId}`);
                fetchPackages(); // Refresh the list
            } catch (err) {
                console.error("Failed to delete package:", err);
                setError(err.response?.data?.message || 'Failed to delete package.');
            }
        }
    };

    if (loading) {
        return <div>Loading packages...</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="package-mgt-container">
            <div className="package-mgt-header">
                <h3>Membership Packages</h3>
                {isAdmin && (
                    <button className="btn btn-primary" onClick={() => handleOpenModal()}>Add New Package</button>
                )}
            </div>
            <table className="dashboard-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Duration (Days)</th>
                        <th>Per Person Price (Rs.)</th>
                        <th>Max Team Size</th>
                        {isAdmin && <th>Actions</th>}
                    </tr>
                </thead>
                <tbody>
                    {packages.length > 0 ? (
                        packages.map(pkg => (
                            <tr key={pkg.id}>
                                <td>{pkg.name}</td>
                                <td>{pkg.duration_days}</td>
                                <td>{pkg.per_person_price}</td>
                                <td>{pkg.max_team_size}</td>
                                {isAdmin && (
                                    <td className="actions-cell">
                                        <button className="btn btn-secondary btn-sm" onClick={() => handleOpenModal(pkg)}>Edit</button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(pkg.id)}>Delete</button>
                                    </td>
                                )}
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={isAdmin ? "5" : "4"}>No membership packages found.</td>
                        </tr>
                    )}
                </tbody>
            </table>

            {isModalOpen && (
                <PackageEditModal
                    pkg={selectedPackage}
                    onSave={handleSave}
                    onClose={handleCloseModal}
                    error={modalError}
                />
            )}
        </div>
    );
};

export default PackageMgt;
