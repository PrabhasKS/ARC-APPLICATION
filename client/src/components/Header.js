import React from 'react';
import { NavLink } from 'react-router-dom'; // Using NavLink for active styles
import logo from '../assets/logo.jpg';
import './Header.css'; // Assuming you have a CSS file for header styles

const Header = ({ user, onLogout }) => {
    return (
        <header className="app-header">
            <div className="header-title">
                <img src={logo} alt="ARC SportZone Logo" className="header-logo" />
            </div>
            <nav className="header-nav">
                {user && (
                    <>
                        <NavLink to="/" end>Bookings</NavLink>
                        <NavLink to="/ledger">History</NavLink>
                        {(user.role === 'admin' || user.role === 'desk') && <NavLink to="/memberships">Memberships</NavLink>}
                        {user.role === 'admin' && <NavLink to="/admin">Management</NavLink>}
                        {user.role === 'admin' && <NavLink to="/analytics">Analytics</NavLink>}
                        <button onClick={onLogout} className="logout-btn">Logout</button>
                    </>
                )}
            </nav>
        </header>
    );
};

export default Header;
