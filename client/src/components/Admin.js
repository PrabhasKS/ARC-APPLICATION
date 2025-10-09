import React, { useState, useEffect } from 'react';
import api from '../api'; // Import the api instance
import { useNavigate } from 'react-router-dom';
import CourtStatusControl from './CourtStatusControl';

const Admin = () => {
    const [sports, setSports] = useState([]);
    const [courts, setCourts] = useState([]);
    const [newSportName, setNewSportName] = useState('');
    const [newSportPrice, setNewSportPrice] = useState('');
    const [newCourtName, setNewCourtName] = useState('');
    const [selectedSportId, setSelectedSportId] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    // State for new user form
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('staff');

    useEffect(() => {
        fetchSports();
        fetchCourts();
    }, []);

    const fetchSports = async () => {
        const res = await api.get('/sports');
        setSports(res.data);
    };

    const fetchCourts = async () => {
        const res = await api.get('/courts');
        setCourts(res.data);
    };

    const handleAddSport = async (e) => {
        e.preventDefault();
        try {
            await api.post('/sports', { name: newSportName, price: newSportPrice });
            setNewSportName('');
            setNewSportPrice('');
            fetchSports();
            setMessage('Sport added successfully!');
        } catch (err) {
            setMessage(err.response?.data?.message || 'Error adding sport');
        }
    };

    const handleAddCourt = async (e) => {
        e.preventDefault();
        try {
            await api.post('/courts', { name: newCourtName, sport_id: selectedSportId });
            setNewCourtName('');
            setSelectedSportId('');
            fetchCourts(); // Refresh court list
            setMessage('Court added successfully!');
        } catch (err) {
            setMessage(err.response?.data?.message || 'Error adding court');
        }
    };

    const handlePriceChange = (e, sportId) => {
        const updatedSports = sports.map(sport =>
            sport.id === sportId ? { ...sport, price: e.target.value } : sport
        );
        setSports(updatedSports);
    };

    const handleUpdatePrice = async (sportId) => {
        const sportToUpdate = sports.find(s => s.id === sportId);
        try {
            await api.put(`/sports/${sportId}`, { price: sportToUpdate.price });
            setMessage(`Price for ${sportToUpdate.name} updated successfully!`);
        } catch (err) {
            setMessage(err.response?.data?.message || 'Error updating price');
        }
    };

    const handleDeleteSport = async (sportId) => {
        if (window.confirm('Are you sure? Deleting a sport will also delete all of its courts.')) {
            try {
                await api.delete(`/sports/${sportId}`);
                fetchSports();
                fetchCourts();
                setMessage('Sport deleted successfully!');
            } catch (err) {
                setMessage(err.response ? err.response.data.message : err.message || 'Error deleting sport');
            }
        }
    };

    const handleDeleteCourt = async (courtId) => {
        if (window.confirm('Are you sure you want to delete this court?')) {
            try {
                await api.delete(`/courts/${courtId}`);
                fetchCourts();
                setMessage('Court deleted successfully!');
            } catch (err) {
                setMessage(err.response ? err.response.data.message : err.message || 'Error deleting court');
            }
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/users', { username: newUsername, password: newPassword, role: newRole });
            setNewUsername('');
            setNewPassword('');
            setNewRole('staff');
            setMessage('User added successfully!');
        } catch (err) {
            setMessage(err.response?.data?.message || 'Error adding user');
        }
    };

    const handleCourtStatusChange = (courtId, newStatus) => {
        const updatedCourts = courts.map(court =>
            court.id === courtId ? { ...court, status: newStatus } : court
        );
        setCourts(updatedCourts);
        setMessage(`Court status updated to ${newStatus}`)
    };

    return (
        <div>
            <h2>Admin Panel</h2>
            {message && <p>{message}</p>}

            <div style={{ marginBottom: '20px' }}>
                <button onClick={() => navigate('/analytics')}>View Analytics</button>
            </div>

            {/* User Creation Form */}
            <div style={{ marginBottom: '40px' }}>
                 <h3>Add a New User</h3>
                    <form onSubmit={handleAddUser}>
                        <div>
                            <label>Username</label>
                            <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required />
                        </div>
                        <div>
                            <label>Password</label>
                            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                        </div>
                        <div>
                            <label>Role</label>
                            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} required>
                                <option value="staff">Staff</option>
                                <option value="desk">Desk</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <button type="submit">Add User</button>
                    </form>
            </div>

            <div style={{ display: 'flex', gap: '40px', marginBottom: '40px' }}>
                <div style={{ flex: 1 }}>
                    <h3>Add a New Sport</h3>
                    <form onSubmit={handleAddSport}>
                        <div>
                            <label>Sport Name</label>
                            <input type="text" value={newSportName} onChange={(e) => setNewSportName(e.target.value)} required />
                        </div>
                        <div>
                            <label>Price</label>
                            <input type="number" value={newSportPrice} onChange={(e) => setNewSportPrice(e.target.value)} required />
                        </div>
                        <button type="submit">Add Sport</button>
                    </form>
                </div>
                <div style={{ flex: 1 }}>
                    <h3>Add a New Court</h3>
                    <form onSubmit={handleAddCourt}>
                        <div>
                            <label>Sport</label>
                            <select value={selectedSportId} onChange={(e) => setSelectedSportId(e.target.value)} required>
                                <option value="">Select a Sport</option>
                                {sports.map(sport => (
                                    <option key={sport.id} value={sport.id}>{sport.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label>Court Name</label>
                            <input type="text" value={newCourtName} onChange={(e) => setNewCourtName(e.target.value)} required />
                        </div>
                        <button type="submit">Add Court</button>
                    </form>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '40px' }}>
                <div style={{ flex: 1 }}>
                    <h3>Manage Sports</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Sport</th>
                                <th>Price</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sports.map(sport => (
                                <tr key={sport.id}>
                                    <td>{sport.name}</td>
                                    <td><input type="number" value={sport.price} onChange={(e) => handlePriceChange(e, sport.id)} /></td>
                                    <td>
                                        <button onClick={() => handleUpdatePrice(sport.id)}>Update Price</button>
                                        <button onClick={() => handleDeleteSport(sport.id)}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div style={{ flex: 1 }}>
                    <h3>Manage Courts</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Court</th>
                                <th>Sport</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {courts.map(court => (
                                <tr key={court.id}>
                                    <td>{court.name}</td>
                                    <td>{court.sport_name}</td>
                                    <td>
                                        <CourtStatusControl court={court} onStatusChange={handleCourtStatusChange} />
                                    </td>
                                    <td>
                                        <button onClick={() => handleDeleteCourt(court.id)}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Admin;