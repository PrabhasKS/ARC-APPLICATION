import React, { useState } from 'react';
import './MembershipDashboard.css';
import PackageMgt from './PackageMgt';
import NewSubscription from './NewSubscription';
import LeaveRequests from './LeaveRequests';
import HolidayMgt from './HolidayMgt';
import ActiveMembershipsMgt from './ActiveMembershipsMgt';
import TeamAttendance from './TeamAttendance';

const MembershipDashboard = ({ user }) => {
    const [activeTab, setActiveTab] = useState('subscribe');

    const renderTabContent = () => {
        switch (activeTab) {
            case 'subscribe':
                return <NewSubscription />;
            case 'packages':
                return <PackageMgt />;
            case 'active':
                return <ActiveMembershipsMgt status="active" />;
            case 'ended':
                return <ActiveMembershipsMgt status="ended" />;
            case 'terminated':
                return <ActiveMembershipsMgt status="terminated" />;
            case 'attendance':
                return <TeamAttendance />;
            case 'leave':
                return <LeaveRequests />;
            case 'holidays':
                return <HolidayMgt />;
            default:
                return <NewSubscription />;
        }
    };

    return (
        <div className="membership-dashboard">
            <h2 className="membership-header">Membership Management</h2>
            <div className="tab-navigation">
                <button 
                    className={`tab-btn ${activeTab === 'subscribe' ? 'active' : ''}`}
                    onClick={() => setActiveTab('subscribe')}>
                    New Subscription
                </button>
                 <button 
                    className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
                    onClick={() => setActiveTab('active')}>
                    Active Memberships
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'ended' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ended')}>
                    Ended Memberships
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'terminated' ? 'active' : ''}`}
                    onClick={() => setActiveTab('terminated')}>
                    Terminated Memberships
                </button>
                 <button 
                    className={`tab-btn ${activeTab === 'attendance' ? 'active' : ''}`}
                    onClick={() => setActiveTab('attendance')}>
                    Team Attendance
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'packages' ? 'active' : ''}`}
                    onClick={() => setActiveTab('packages')}>
                    Manage Packages
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'leave' ? 'active' : ''}`}
                    onClick={() => setActiveTab('leave')}>
                    Leave Requests
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'holidays' ? 'active' : ''}`}
                    onClick={() => setActiveTab('holidays')}>
                    Manage Holidays
                </button>
            </div>
            <div className="tab-content-container">
                {renderTabContent()}
            </div>
        </div>
    );
};

export default MembershipDashboard;
