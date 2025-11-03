
// import React, { useState, useEffect } from 'react';
// import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
// import { jwtDecode } from 'jwt-decode';
// import Header from './components/Header';
// import Login from './components/Login';
// import Dashboard from './components/Dashboard';
// import Ledger from './components/Ledger';
// import Admin from './components/Admin';
// import Analytics from './components/Analytics';
// import './App.css';
// import logo from './assets/logo.jpg';

// const ProtectedRoute = ({ user, allowedRoles, children }) => {
//     if (!user) {
//         return <Navigate to="/login" />;
//     }

//     if (!allowedRoles.includes(user.role)) {
//         return <Navigate to="/" />;
//     }

//     return children;
// };

// function App() {
//     const [user, setUser] = useState(null);

//     useEffect(() => {
//         const token = localStorage.getItem('token');
//         if (token) {
//             try {
//                 const decodedUser = jwtDecode(token);
//                 // Check if token is expired
//                 const isExpired = decodedUser.exp * 1000 < Date.now();
//                 if (isExpired) {
//                     handleLogout();
//                 } else {
//                     setUser(decodedUser);
//                 }
//             } catch (error) {
//                 handleLogout();
//             }
//         }
//     }, []);

//     const handleLogin = (token) => {
//         localStorage.setItem('token', token);
//         try {
//             const decodedUser = jwtDecode(token);
//             setUser(decodedUser);
//         } catch (error) {
//             console.error("Invalid token");
//         }
//     };

//     const handleLogout = () => {
//         localStorage.removeItem('token');
//         setUser(null);
//     };

//     return (
//         <Router>
//             <div className="App">
//                 <Header user={user} onLogout={handleLogout} />
//                 <main>
//                     <Routes>
//                         <Route path="/login" element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} />
//                         <Route path="/" element={
//                             <ProtectedRoute user={user} allowedRoles={['admin', 'desk', 'staff']}>
//                                 <Dashboard user={user} />
//                             </ProtectedRoute>
//                         } />
//                         <Route path="/ledger" element={
//                             <ProtectedRoute user={user} allowedRoles={['admin', 'desk', 'staff']}>
//                                 <Ledger user={user} />
//                             </ProtectedRoute>
//                         } />
//                         <Route path="/admin" element={
//                             <ProtectedRoute user={user} allowedRoles={['admin']}>
//                                 <Admin user={user} />
//                             </ProtectedRoute>
//                         } />
//                         <Route path="/analytics" element={
//                             <ProtectedRoute user={user} allowedRoles={['admin']}>
//                                 <Analytics />
//                             </ProtectedRoute>
//                         } />
//                     </Routes>
//                 </main>
//             </div>
//         </Router>
//     );
// }

// export default App;


import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import Header from './components/Header';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Ledger from './components/Ledger';
import Admin from './components/Admin';
import Analytics from './components/Analytics';
import './App.css';

const ProtectedRoute = ({ user, allowedRoles, children }) => {
    if (!user) {
        return <Navigate to="/login" />;
    }

    if (!allowedRoles.includes(user.role)) {
        return <Navigate to="/" />;
    }

    return children;
};

// A new component to handle showing the header on the correct pages
const AppContent = () => {
    const [user, setUser] = useState(null);
    const location = useLocation(); // Hook to get the current URL path


    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decodedUser = jwtDecode(token);
                const isExpired = decodedUser.exp * 1000 < Date.now();
                if (isExpired) {
                    handleLogout();
                } else {
                    setUser(decodedUser);
                }
            } catch (error) {
                handleLogout();
            }
        }
    }, []);

    const handleLogin = (token) => {
        localStorage.setItem('token', token);
        try {
            const decodedUser = jwtDecode(token);
            setUser(decodedUser);
        } catch (error) {
            console.error("Invalid token");
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    return (
        <div className="App">
            {/* ✅ FIX: This line now conditionally renders the Header */}
            {location.pathname !== '/login' && <Header user={user} onLogout={handleLogout} />}



            <main>
                <Routes>
                    <Route path="/login" element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} />
                    <Route path="/" element={
                        <ProtectedRoute user={user} allowedRoles={['admin', 'desk']}>
                            <Dashboard user={user} />
                        </ProtectedRoute>
                    } />
                    <Route path="/ledger" element={
                        <ProtectedRoute user={user} allowedRoles={['admin', 'desk']}>
                            <Ledger user={user} />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin" element={
                        <ProtectedRoute user={user} allowedRoles={['admin']}>
                            <Admin user={user} />
                        </ProtectedRoute>
                    } />
                    <Route path="/analytics" element={
                        <ProtectedRoute user={user} allowedRoles={['admin']}>
                            <Analytics />
                        </ProtectedRoute>
                    } />
                </Routes>
            </main>
        </div>
    );
}

// The main App component now just sets up the Router
function App() {
    return (
        <Router>
            <AppContent />
        </Router>
    );
}

export default App;

