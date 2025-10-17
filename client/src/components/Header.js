import React from 'react';
import { Link } from 'react-router-dom';

const Header = ({ user, onLogout }) => {
    return (
        <header>
            <h1>ARC SportZone Booking</h1>
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
