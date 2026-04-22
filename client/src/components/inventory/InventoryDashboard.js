import React, { useState } from 'react';
import './InventoryDashboard.css';
import StockManagement from './StockManagement';
import StandalonePos from './StandalonePos';
import RentalReturns from './RentalReturns';
import ActivityLog from './ActivityLog';


const TABS = [
    { id: 'stock',     label: 'Stock Management', icon: '📦', adminOnly: true },
    { id: 'pos',       label: 'Standalone Sales',  icon: '🛒', adminOnly: false },
    { id: 'returns',   label: 'Rental Returns',    icon: '↩️', adminOnly: false },
    { id: 'activity', label: 'Activity Log', icon: '📋', adminOnly: true },
];

export default function InventoryDashboard({ user }) {
    const isAdmin = user?.role === 'admin';
    const defaultTab = isAdmin ? 'stock' : 'pos';
    const [activeTab, setActiveTab] = useState(defaultTab);

    const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);

    return (
        <div className="inventory-dashboard">
            <h2 className="inv-page-header">📦 Inventory Management</h2>

            {/* Tab Navigation */}
            <div className="inv-tab-nav">
                {visibleTabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`inv-tab-btn${activeTab === tab.id ? ' active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <span>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="inv-tab-content">
                {activeTab === 'stock'     && <StockManagement user={user} />}
                {activeTab === 'pos'       && <StandalonePos user={user} />}
                {activeTab === 'returns'   && <RentalReturns user={user} />}
                {activeTab === 'activity'  && <ActivityLog />}
            </div>
        </div>
    );
}