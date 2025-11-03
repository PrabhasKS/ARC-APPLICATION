import React, { useState, useRef, useEffect } from 'react';
import DashboardCourtStatusToggle from './DashboardCourtStatusToggle';

const CourtActions = ({ court, onStatusChange, user }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const toggleDropdown = () => setIsOpen(!isOpen);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button onClick={toggleDropdown} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>
                &#x22EE; {/* Vertical ellipsis */}
            </button>
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    backgroundColor: 'white',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                    zIndex: 10,
                    padding: '10px'
                }}>
                    <DashboardCourtStatusToggle court={court} onStatusChange={onStatusChange} user={user} />
                </div>
            )}
        </div>
    );
};

export default CourtActions;
