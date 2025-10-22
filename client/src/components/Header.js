import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.jpg';

const Header = ({ user, onLogout }) => {
    return (
        <header>
            <div className="header-title">
                <img src={logo} alt="ARC SportZone Logo" className="header-logo" />
                {/* <h1>ARC SportZone</h1> */}
            </div>
            <nav>
                {user && (
                    <>
                        {(user.role === 'admin' || user.role === 'desk' || user.role === 'staff') && <Link to="/">Bookings</Link>}
                        {(user.role === 'admin' || user.role === 'desk' || user.role === 'staff') && <Link to="/ledger">History</Link>}
                        {user.role === 'admin' && <Link to="/admin">Management</Link>}
                        {user.role === 'admin' && <Link to="/analytics">Analytics</Link>}
                        <button onClick={onLogout}>Logout</button>
                    </>
                )}
            </nav>
        </header>
    );
};

export default Header;
