// import React, { useState, useEffect } from 'react';
// import api from '../api'; // Import the api instance
// import { useNavigate } from 'react-router-dom';
// import CourtStatusControl from './CourtStatusControl';
// import './Admin.css';

// const Admin = () => {
//     const [sports, setSports] = useState([]);
//     const [courts, setCourts] = useState([]);
//     const [newSportName, setNewSportName] = useState('');
//     const [newSportPrice, setNewSportPrice] = useState('');
//     const [newCourtName, setNewCourtName] = useState('');
//     const [selectedSportId, setSelectedSportId] = useState('');
//     const [message, setMessage] = useState('');
//     const navigate = useNavigate();

//     // State for new user form
//     const [newUsername, setNewUsername] = useState('');
//     const [newPassword, setNewPassword] = useState('');
//     const [newRole, setNewRole] = useState('staff');

//     // State for accessories
//     const [accessories, setAccessories] = useState([]);
//     const [newAccessoryName, setNewAccessoryName] = useState('');
//     const [newAccessoryPrice, setNewAccessoryPrice] = useState('');

//     useEffect(() => {
//         fetchSports();
//         fetchCourts();
//         fetchAccessories();
//     }, []);

//     const fetchAccessories = async () => {
//         const res = await api.get('/accessories');
//         setAccessories(res.data);
//     };


//     const fetchSports = async () => {
//         const res = await api.get('/sports');
//         setSports(res.data);
//     };

//     const fetchCourts = async () => {
//         const res = await api.get('/courts');
//         setCourts(res.data);
//     };

//     const handleAddSport = async (e) => {
//         e.preventDefault();
//         try {
//             await api.post('/sports', { name: newSportName, price: newSportPrice });
//             setNewSportName('');
//             setNewSportPrice('');
//             fetchSports();
//             setMessage('Sport added successfully!');
//         } catch (err) {
//             setMessage(err.response?.data?.message || 'Error adding sport');
//         }
//     };

//     const handleAddCourt = async (e) => {
//         e.preventDefault();
//         try {
//             await api.post('/courts', { name: newCourtName, sport_id: selectedSportId });
//             setNewCourtName('');
//             setSelectedSportId('');
//             fetchCourts(); // Refresh court list
//             setMessage('Court added successfully!');
//         } catch (err) {
//             setMessage(err.response?.data?.message || 'Error adding court');
//         }
//     };

//     const handlePriceChange = (e, sportId) => {
//         const updatedSports = sports.map(sport =>
//             sport.id === sportId ? { ...sport, price: e.target.value } : sport
//         );
//         setSports(updatedSports);
//     };

//     const handleUpdatePrice = async (sportId) => {
//         const sportToUpdate = sports.find(s => s.id === sportId);
//         try {
//             await api.put(`/sports/${sportId}`, { price: sportToUpdate.price });
//             setMessage(`Price for ${sportToUpdate.name} updated successfully!`);
//         } catch (err) {
//             setMessage(err.response?.data?.message || 'Error updating price');
//         }
//     };

//     const handleDeleteSport = async (sportId) => {
//         if (window.confirm('Are you sure? Deleting a sport will also delete all of its courts.')) {
//             try {
//                 await api.delete(`/sports/${sportId}`);
//                 fetchSports();
//                 fetchCourts();
//                 setMessage('Sport deleted successfully!');
//             } catch (err) {
//                 setMessage(err.response ? err.response.data.message : err.message || 'Error deleting sport');
//             }
//         }
//     };

//     const handleDeleteCourt = async (courtId) => {
//         if (window.confirm('Are you sure you want to delete this court?')) {
//             try {
//                 await api.delete(`/courts/${courtId}`);
//                 fetchCourts();
//                 setMessage('Court deleted successfully!');
//             } catch (err) {
//                 setMessage(err.response ? err.response.data.message : err.message || 'Error deleting court');
//             }
//         }
//     };

//     const handleAddAccessory = async (e) => {
//         e.preventDefault();
//         try {
//             await api.post('/accessories', { name: newAccessoryName, price: newAccessoryPrice });
//             setNewAccessoryName('');
//             setNewAccessoryPrice('');
//             fetchAccessories();
//             setMessage('Accessory added successfully!');
//         } catch (err) {
//             setMessage(err.response?.data?.message || 'Error adding accessory');
//         }
//     };

//     const handleAccessoryPriceChange = (e, accessoryId) => {
//         const updatedAccessories = accessories.map(acc =>
//             acc.id === accessoryId ? { ...acc, price: e.target.value } : acc
//         );
//         setAccessories(updatedAccessories);
//     };

//     const handleUpdateAccessory = async (accessoryId) => {
//         const accessoryToUpdate = accessories.find(a => a.id === accessoryId);
//         try {
//             await api.put(`/accessories/${accessoryId}`, { name: accessoryToUpdate.name, price: accessoryToUpdate.price });
//             setMessage(`Price for ${accessoryToUpdate.name} updated successfully!`);
//         } catch (err) {
//             setMessage(err.response?.data?.message || 'Error updating accessory price');
//         }
//     };

//     const handleDeleteAccessory = async (accessoryId) => {
//         if (window.confirm('Are you sure you want to delete this accessory?')) {
//             try {
//                 await api.delete(`/accessories/${accessoryId}`);
//                 fetchAccessories();
//                 setMessage('Accessory deleted successfully!');
//             } catch (err) {
//                 setMessage(err.response ? err.response.data.message : err.message || 'Error deleting accessory');
//             }
//         }
//     };

//     const handleAddUser = async (e) => {
//         e.preventDefault();
//         try {
//             await api.post('/admin/users', { username: newUsername, password: newPassword, role: newRole });
//             setNewUsername('');
//             setNewPassword('');
//             setNewRole('staff');
//             setMessage('User added successfully!');
//         } catch (err) {
//             setMessage(err.response?.data?.message || 'Error adding user');
//         }
//     };

//     const handleCourtStatusChange = (courtId, newStatus) => {
//         const updatedCourts = courts.map(court =>
//             court.id === courtId ? { ...court, status: newStatus } : court
//         );
//         setCourts(updatedCourts);
//         setMessage(`Court status updated to ${newStatus}`)
//     };

//     return (
//         <div>
//             <h2>Admin Panel</h2>
//             {message && <p>{message}</p>}

//             <div style={{ marginBottom: '20px' }}>
//                 <button onClick={() => navigate('/analytics')}>View Analytics</button>
//             </div>

//             {/* User Creation Form */}
//             <div style={{ marginBottom: '40px' }}>
//                  <h3>Add a New User</h3>
//                     <form onSubmit={handleAddUser}>
//                         <div>
//                             <label>Username</label>
//                             <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required />
//                         </div>
//                         <div>
//                             <label>Password</label>
//                             <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
//                         </div>
//                         <div>
//                             <label>Role</label>
//                             <select value={newRole} onChange={(e) => setNewRole(e.target.value)} required>
//                                 <option value="staff">Staff</option>
//                                 <option value="desk">Desk</option>
//                                 <option value="admin">Admin</option>
//                             </select>
//                         </div>
//                         <button type="submit">Add User</button>
//                     </form>
//             </div>

//             <div style={{ display: 'flex', gap: '40px', marginBottom: '40px' }}>
//                 <div style={{ flex: 1 }}>
//                     <h3>Add a New Sport</h3>
//                     <form onSubmit={handleAddSport}>
//                         <div>
//                             <label>Sport Name</label>
//                             <input type="text" value={newSportName} onChange={(e) => setNewSportName(e.target.value)} required />
//                         </div>
//                         <div>
//                             <label>Price</label>
//                             <input type="number" value={newSportPrice} onChange={(e) => setNewSportPrice(e.target.value)} required />
//                         </div>
//                         <button type="submit">Add Sport</button>
//                     </form>
//                 </div>
//                 <div style={{ flex: 1 }}>
//                     <h3>Add a New Court</h3>
//                     <form onSubmit={handleAddCourt}>
//                         <div>
//                             <label>Sport</label>
//                             <select value={selectedSportId} onChange={(e) => setSelectedSportId(e.target.value)} required>
//                                 <option value="">Select a Sport</option>
//                                 {sports.map(sport => (
//                                     <option key={sport.id} value={sport.id}>{sport.name}</option>
//                                 ))}
//                             </select>
//                         </div>
//                         <div>
//                             <label>Court Name</label>
//                             <input type="text" value={newCourtName} onChange={(e) => setNewCourtName(e.target.value)} required />
//                         </div>
//                         <button type="submit">Add Court</button>
//                     </form>
//                 </div>
//             </div>

//             <div style={{ display: 'flex', gap: '40px', marginBottom: '40px' }}>
//                 <div style={{ flex: 1 }}>
//                     <h3>Add a New Accessory</h3>
//                     <form onSubmit={handleAddAccessory}>
//                         <div>
//                             <label>Accessory Name</label>
//                             <input type="text" value={newAccessoryName} onChange={(e) => setNewAccessoryName(e.target.value)} required />
//                         </div>
//                         <div>
//                             <label>Price</label>
//                             <input type="number" value={newAccessoryPrice} onChange={(e) => setNewAccessoryPrice(e.target.value)} required />
//                         </div>
//                         <button type="submit">Add Accessory</button>
//                     </form>
//                 </div>
//                 <div style={{ flex: 1 }}>
//                     <h3>Manage Accessories</h3>
//                     <table>
//                         <thead>
//                             <tr>
//                                 <th>Accessory</th>
//                                 <th>Price</th>
//                                 <th>Actions</th>
//                             </tr>
//                         </thead>
//                         <tbody>
//                             {accessories.map(acc => (
//                                 <tr key={acc.id}>
//                                     <td>{acc.name}</td>
//                                     <td><input type="number" value={acc.price} onChange={(e) => handleAccessoryPriceChange(e, acc.id)} /></td>
//                                     <td>
//                                         <button onClick={() => handleUpdateAccessory(acc.id)}>Update Price</button>
//                                         <button onClick={() => handleDeleteAccessory(acc.id)}>Delete</button>
//                                     </td>
//                                 </tr>
//                             ))}
//                         </tbody>
//                     </table>
//                 </div>
//             </div>

//             <div style={{ display: 'flex', gap: '40px' }}>
//                 <div style={{ flex: 1 }}>
//                     <h3>Manage Sports</h3>
//                     <table>
//                         <thead>
//                             <tr>
//                                 <th>Sport</th>
//                                 <th>Price</th>
//                                 <th>Actions</th>
//                             </tr>
//                         </thead>
//                         <tbody>
//                             {sports.map(sport => (
//                                 <tr key={sport.id}>
//                                     <td>{sport.name}</td>
//                                     <td><input type="number" value={sport.price} onChange={(e) => handlePriceChange(e, sport.id)} /></td>
//                                     <td>
//                                         <button onClick={() => handleUpdatePrice(sport.id)}>Update Price</button>
//                                         <button onClick={() => handleDeleteSport(sport.id)}>Delete</button>
//                                     </td>
//                                 </tr>
//                             ))}
//                         </tbody>
//                     </table>
//                 </div>
//                 <div style={{ flex: 1 }}>
//                     <h3>Manage Courts</h3>
//                     <table>
//                         <thead>
//                             <tr>
//                                 <th>Court</th>
//                                 <th>Sport</th>
//                                 <th>Status</th>
//                                 <th>Action</th>
//                             </tr>
//                         </thead>
//                         <tbody>
//                             {courts.map(court => (
//                                 <tr key={court.id}>
//                                     <td>{court.name}</td>
//                                     <td>{court.sport_name}</td>
//                                     <td>
//                                         <CourtStatusControl court={court} onStatusChange={handleCourtStatusChange} />
//                                     </td>
//                                     <td>
//                                         <button onClick={() => handleDeleteCourt(court.id)}>Delete</button>
//                                     </td>
//                                 </tr>
//                             ))}
//                         </tbody>
//                     </table>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default Admin;

import React, { useState, useEffect } from 'react';
import api from '../api';
import CourtStatusControl from './CourtStatusControl';
import './Admin.css';


const Admin = ({ user }) => {
  const [sports, setSports] = useState([]);
  const [courts, setCourts] = useState([]);
  const [accessories, setAccessories] = useState([]);
  const [newSportName, setNewSportName] = useState('');
  const [newSportPrice, setNewSportPrice] = useState('');
  const [newSportCapacity, setNewSportCapacity] = useState(1);
  const [newCourtName, setNewCourtName] = useState('');
  const [selectedSportId, setSelectedSportId] = useState('');
  const [newAccessoryName, setNewAccessoryName] = useState('');
  const [newAccessoryPrice, setNewAccessoryPrice] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('desk');
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('users');

  const [users, setUsers] = useState([]);

  const [notification, setNotification] = useState({ text: '', type: '' });
  const [errors, setErrors] = useState({});

  // --- Effects ---
  useEffect(() => {
    fetchSports();
    fetchCourts();
    fetchAccessories();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (notification.text) {
      const timer = setTimeout(() => {
        setNotification({ text: '', type: '' }); // Clear notification
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // --- Fetch Functions ---
  const fetchSports = async () => {
    const res = await api.get('/sports');
    setSports(res.data || []);
  };
  const fetchCourts = async () => {
    const res = await api.get('/courts');
    setCourts(res.data || []);
  };
  const fetchAccessories = async () => {
    const res = await api.get('/accessories');
    setAccessories(res.data || []);
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  // --- Validation Function ---
  const validateForm = (formType) => {
    const newErrors = {};
    let isValid = true;
    const alphanumericRegex = /^[a-z0-9 ]+$/i;

    if (formType === 'sport') {
      if (!newSportName.trim()) {
        newErrors.sportName = 'Sport name is required.';
        isValid = false;
      } else if (!alphanumericRegex.test(newSportName)) { // ✅ UPDATED Check
        newErrors.sportName = 'Sport name can only contain letters, numbers, and spaces.';
        isValid = false;
      }
      if (!newSportPrice || parseFloat(newSportPrice) <= 0) {
        newErrors.sportPrice = 'Price must be a positive number.';
        isValid = false;
      }
      if (!newSportCapacity || parseInt(newSportCapacity, 10) <= 0) {
        newErrors.sportCapacity = 'Capacity must be a positive number.';
        isValid = false;
      }
    }
    if (formType === 'court') {
      if (!newCourtName.trim()) { newErrors.courtName = 'Court name is required.'; isValid = false; }
      if (!selectedSportId) { newErrors.courtSport = 'Please select a sport.'; isValid = false; }
    }
    if (formType === 'accessory') {
      if (!newAccessoryName.trim()) { newErrors.accessoryName = 'Accessory name is required.'; isValid = false; }
      if (!newAccessoryPrice || parseFloat(newAccessoryPrice) <= 0) { newErrors.accessoryPrice = 'Price must be a positive number.'; isValid = false; }
    }
    if (formType === 'user') {
      if (!newUsername.trim()) { newErrors.username = 'Username is required.'; isValid = false; }
      if (!newPassword || newPassword.length < 6) { newErrors.password = 'Password must be at least 6 characters.'; isValid = false; }
    }

    setErrors(newErrors);

    if (!isValid) {
      setNotification({ text: 'Please fix the errors in the form.', type: 'error' });
    }

    return isValid;
  };

  // --- Handler Functions ---
  const handleAddSport = async (e) => {
    e.preventDefault();
    if (!validateForm('sport')) return;
    try {
      await api.post('/sports', { name: newSportName, price: newSportPrice, capacity: newSportCapacity });
      setNewSportName(''); setNewSportPrice(''); setNewSportCapacity(1); fetchSports();
      setNotification({ text: 'Sport added successfully!', type: 'success' });
    } catch (err) {
      setNotification({ text: err.response?.data?.message || 'Error adding sport', type: 'error' });
    }
  };

  const handleAddCourt = async (e) => {
    e.preventDefault();
    if (!validateForm('court')) return;
    try {
      await api.post('/courts', { name: newCourtName, sport_id: selectedSportId });
      setNewCourtName(''); setSelectedSportId(''); fetchCourts();
      setNotification({ text: 'Court added successfully!', type: 'success' });
    } catch (err) {
      setNotification({ text: err.response?.data?.message || 'Error adding court', type: 'error' });
    }
  };

  const handleAddAccessory = async (e) => {
    e.preventDefault();
    if (!validateForm('accessory')) return;
    try {
      await api.post('/accessories', { name: newAccessoryName, price: newAccessoryPrice });
      setNewAccessoryName(''); setNewAccessoryPrice(''); fetchAccessories();
      setNotification({ text: 'Accessory added successfully!', type: 'success' });
    } catch (err) {
      setNotification({ text: err.response?.data?.message || 'Error adding accessory', type: 'error' });
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!validateForm('user')) return;
    try {
      await api.post('/admin/users', { username: newUsername, password: newPassword, role: newRole });
      setNewUsername(''); setNewPassword(''); setNewRole('staff');
      setNotification({ text: 'User added successfully!', type: 'success' });
    } catch (err) {
      setNotification({ text: err.response?.data?.message || 'Error adding user', type: 'error' });
    }
  };

  const handleSportChange = (e, sportId, field) => {
    const updated = sports.map((s) => s.id === sportId ? { ...s, [field]: e.target.value } : s);
    setSports(updated);
  };

  const handleUpdateSport = async (sportId) => {
    const sport = sports.find((s) => s.id === sportId);
    try {
      await api.put(`/sports/${sportId}`, { price: sport.price, capacity: sport.capacity });
      setNotification({ text: `${sport.name} updated!`, type: 'success' });
    } catch {
      setNotification({ text: 'Error updating sport', type: 'error' });
    }
  };

  const handleAccessoryPriceChange = (e, accessoryId) => {
    const updated = accessories.map((a) => a.id === accessoryId ? { ...a, price: e.target.value } : a);
    setAccessories(updated);
  };

  const handleUpdateAccessory = async (accessoryId) => {
    const acc = accessories.find((a) => a.id === accessoryId);
    try {
      await api.put(`/accessories/${accessoryId}`, { name: acc.name, price: acc.price });
      setNotification({ text: `Price for ${acc.name} updated!`, type: 'success' });
    } catch {
      setNotification({ text: 'Error updating accessory price', type: 'error' });
    }
  };

  const handleDelete = async (url, refreshFn, messageText) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await api.delete(url);
        refreshFn();
        setNotification({ text: messageText, type: 'success' });
      } catch {
        setNotification({ text: 'Error deleting item', type: 'error' });
      }
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await api.delete(`/admin/users/${userId}`);
        fetchUsers();
        setNotification({ text: 'User deleted successfully!', type: 'success' });
      } catch (err) {
        setNotification({ text: err.response?.data?.message || 'Error deleting user', type: 'error' });
      }
    }
  };

  const handleCourtStatusChange = (courtId, newStatus) => {
    const updatedCourts = courts.map((c) => c.id === courtId ? { ...c, status: newStatus } : c);
    setCourts(updatedCourts);
    setNotification({ text: `Court status updated to ${newStatus}`, type: 'success' });
  };

  return (
    <div className="admin-container">
      {notification.text && (
        <div className={`notification-popup ${notification.type}`}>
          {notification.text}
        </div>
      )}

      <div className="admin-header">
        <h1>Admin Panel</h1>
        <div className="admin-tabs">
          <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>User Management</button>
          <button className={activeTab === 'sports' ? 'active' : ''} onClick={() => setActiveTab('sports')}>Sport & Court Management</button>
          <button className={activeTab === 'accessories' ? 'active' : ''} onClick={() => setActiveTab('accessories')}>Accessory Management</button>
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="admin-grid">
          {/* --- Add User Card --- */}
          <div className="admin-card">
            <h2>Add a New User</h2>
            <form onSubmit={handleAddUser}>
              <div className="form-group">
                <label>Username</label>
                <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required />
                {errors.username && <p className="form-error">{errors.username}</p>}
              </div>
              <div className="form-group password-group">
                <label>Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button type="button" className="toggle-password-btn" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a18.01 18.01 0 0 1 7.07-5.07M10.1 5.07A10.07 10.07 0 0 1 12 4c7 0 10 7 10 7a18.01 18.01 0 0 1-2.66 4.09"></path>
                                          <path d="M12 12v.01"></path>
                                          <path d="M4.93 4.93l14.14 14.14"></path>
                                      </svg>
                                  ) : (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                                          <circle cx="12" cy="12" r="3"></circle>
                                      </svg>
                                  )}
                  </button>
                </div>
                {errors.password && <p className="form-error">{errors.password}</p>}
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} required>
                  <option value="desk">Desk</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button type="submit" className="btn-primary">Add User</button>
            </form>
          </div>

          {/* --- Manage Users Card --- */}
          <div className="admin-card" style={{ gridColumn: '1 / -1' }}>
            <h2>Manage Users</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((userToDelete) => (
                  <tr key={userToDelete.id}>
                    <td>{userToDelete.username}</td>
                    <td>{userToDelete.role}</td>
                    <td className="actions-group">
                      {user && user.role === 'admin' && (
                        <button className="btn-delete" onClick={() => handleDeleteUser(userToDelete.id)}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'sports' && (
        <div className="admin-grid">
          {/* --- Add Sport Card --- */}
          <div className="admin-card">
            <h2>Add a New Sport</h2>
            <form onSubmit={handleAddSport}>
              <div className="form-group">
                <label>Sport Name</label>
                <input type="text" value={newSportName} onChange={(e) => setNewSportName(e.target.value)} required />
                {errors.sportName && <p className="form-error">{errors.sportName}</p>}
              </div>
              <div className="form-group">
                <label>Price</label>
                <input type="number" value={newSportPrice} onChange={(e) => setNewSportPrice(e.target.value)} required />
                {errors.sportPrice && <p className="form-error">{errors.sportPrice}</p>}
              </div>
              <div className="form-group">
                <label>Capacity</label>
                <input type="number" value={newSportCapacity} onChange={(e) => setNewSportCapacity(e.target.value)} required />
                {errors.sportCapacity && <p className="form-error">{errors.sportCapacity}</p>}
              </div>
              <button type="submit" className="btn-primary">Add Sport</button>
            </form>
          </div>

          {/* --- Add Court Card --- */}
          <div className="admin-card">
            <h2>Add a New Court</h2>
            <form onSubmit={handleAddCourt}>
              <div className="form-group">
                <label>Sport</label>
                <select value={selectedSportId} onChange={(e) => setSelectedSportId(e.target.value)} required>
                  <option value="">Select a Sport</option>
                  {sports.map((sport) => (
                    <option key={sport.id} value={sport.id}>{sport.name}</option>
                  ))}
                </select>
                {errors.courtSport && <p className="form-error">{errors.courtSport}</p>}
              </div>
              <div className="form-group">
                <label>Court Name</label>
                <input type="text" value={newCourtName} onChange={(e) => setNewCourtName(e.target.value)} required />
                {errors.courtName && <p className="form-error">{errors.courtName}</p>}
              </div>
              <button type="submit" className="btn-primary">Add Court</button>
            </form>
          </div>

          {/* --- Manage Sections --- */}
          <div className="admin-card" style={{ gridColumn: '1 / -1' }}>
            <h2>Manage Sports</h2>
            <table className="admin-table">
              <thead><tr><th>Sport</th><th>Price</th><th>Capacity</th><th>Actions</th></tr></thead>
              <tbody>
                {sports.map((sport) => (
                  <tr key={sport.id}>
                    <td>{sport.name}</td>
                    <td><input type="number" value={sport.price} onChange={(e) => handleSportChange(e, sport.id, 'price')} /></td>
                    <td><input type="number" value={sport.capacity} onChange={(e) => handleSportChange(e, sport.id, 'capacity')} /></td>
                    <td className="actions-group">
                      <button className="btn-update" onClick={() => handleUpdateSport(sport.id)}>Update</button>
                      <button className="btn-delete" onClick={() => handleDelete(`/sports/${sport.id}`, fetchSports, 'Sport deleted successfully!')}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-card" style={{ gridColumn: '1 / -1' }}>
            <h2>Manage Courts</h2>
            <table className="admin-table">
              <thead><tr><th>Court</th><th>Sport</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {courts.map((court) => (
                  <tr key={court.id}>
                    <td>{court.name}</td>
                    <td>{court.sport_name}</td>
                    <td><CourtStatusControl court={court} onStatusChange={handleCourtStatusChange} /></td>
                    <td className="actions-group">
                      <button className="btn-delete" onClick={() => handleDelete(`/courts/${court.id}`, fetchCourts, 'Court deleted successfully!')}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'accessories' && (
        <div className="admin-grid">
          {/* --- Add Accessory Card --- */}
          <div className="admin-card">
            <h2>Add a New Accessory</h2>
            <form onSubmit={handleAddAccessory}>
              <div className="form-group">
                <label>Accessory Name</label>
                <input type="text" value={newAccessoryName} onChange={(e) => setNewAccessoryName(e.target.value)} required />
                {errors.accessoryName && <p className="form-error">{errors.accessoryName}</p>}
              </div>
              <div className="form-group">
                <label>Price</label>
                <input type="number" value={newAccessoryPrice} onChange={(e) => setNewAccessoryPrice(e.target.value)} required />
                {errors.accessoryPrice && <p className="form-error">{errors.accessoryPrice}</p>}
              </div>
              <button type="submit" className="btn-primary">Add Accessory</button>
            </form>
          </div>

          {/* --- Manage Sections --- */}
          <div className="admin-card" style={{ gridColumn: '1 / -1' }}>
            <h2>Manage Accessories</h2>
            <table className="admin-table">
              <thead><tr><th>Accessory</th><th>Price</th><th>Actions</th></tr></thead>
              <tbody>
                {accessories.map((acc) => (
                  <tr key={acc.id}>
                    <td>{acc.name}</td>
                    <td><input type="number" value={acc.price} onChange={(e) => handleAccessoryPriceChange(e, acc.id)} /></td>
                    <td className="actions-group">
                      <button className="btn-update" onClick={() => handleUpdateAccessory(acc.id)}>Update</button>
                      <button className="btn-delete" onClick={() => handleDelete(`/accessories/${acc.id}`, fetchAccessories, 'Accessory deleted successfully!')}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
