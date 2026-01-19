import React, { useState } from 'react';
import ActiveMembershipsMgt from './ActiveMembershipsMgt';
import './MembershipDashboard.css'; // Reuse styles for consistency

const MembershipView = () => {
    const [activeSubTab, setActiveSubTab] = useState('active');

    return (
        <div>
            <div className="tab-navigation">
                <button 
                    className={`tab-btn ${activeSubTab === 'active' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('active')}>
                    Active
                </button>
                <button 
                    className={`tab-btn ${activeSubTab === 'ended' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('ended')}>
                    Ended
                </button>
                <button 
                    className={`tab-btn ${activeSubTab === 'terminated' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('terminated')}>
                    Terminated
                </button>
            </div>
            <div className="tab-content-container">
                {activeSubTab === 'active' && <ActiveMembershipsMgt status="active" />}
                {activeSubTab === 'ended' && <ActiveMembershipsMgt status="ended" />}
                {activeSubTab === 'terminated' && <ActiveMembershipsMgt status="terminated" />}
            </div>
        </div>
    );
};

export default MembershipView;
