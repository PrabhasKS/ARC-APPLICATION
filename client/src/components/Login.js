// import React, { useState } from 'react';
// import api from '../api'; // Import the api instance

// const Login = ({ onLogin }) => {
//     const [username, setUsername] = useState('');
//     const [password, setPassword] = useState('');
//     const [error, setError] = useState('');

//     const handleLogin = async (e) => {
//         e.preventDefault();
//         try {
//             const res = await api.post('/login', { username, password });
//             if (res.data.success) {
//                 onLogin(res.data.token); // Pass the token to the handler
//             } else {
//                 setError('Invalid credentials');
//             }
//         } catch (err) {
//             setError(err.response?.data?.message || 'Invalid credentials');
//         }
//     };

//     return (
//         <div>
//             <h2>Staff Login</h2>
//             <form onSubmit={handleLogin}>
//                 <div>
//                     <label>Username</label>
//                     <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
//                 </div>
//                 <div>
//                     <label>Password</label>
//                     <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
//                 </div>
//                 <button type="submit">Login</button>
//                 {error && <p style={{ color: 'red' }}>{error}</p>}
//             </form>
//         </div>
//     );
// };

// export default Login;


import React, { useState } from 'react';
import api from '../api';
import './Login.css'; // Import the new CSS file
import logo from '../assets/logo.jpg'; // Import your logo

const Login = ({ onLogin }) => {
    // Your existing state and logic are unchanged
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/login', { username, password });
            if (res.data.success) {
                onLogin(res.data.token);
            } else {
                setError('Invalid credentials');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid credentials');
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <img src={logo} alt="ARC SportZone Logo" className="login-logo" />
                <h2>Staff Login</h2>
                <form onSubmit={handleLogin} className="login-form">
                    <div className="form-group">
                        <label>Username</label>
                        <input 
                            type="text" 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)} 
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                        />
                    </div>
                    <button type="submit" className="login-btn">Login</button>
                    {error && <p className="login-error">{error}</p>}
                </form>
            </div>
        </div>
    );
};

export default Login;
