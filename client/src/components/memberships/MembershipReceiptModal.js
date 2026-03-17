import React from 'react';
import QRCode from 'react-qr-code';
import './MembershipReceiptModal.css';

const MembershipReceiptModal = ({ membership, onClose, isTeam = false }) => {
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    if (!membership) {
        return null;
    }

    const publicServerUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    const receiptPdfUrl = isTeam 
        ? `${publicServerUrl}/memberships/teams/${membership.team_id}/receipt.pdf`
        : `${publicServerUrl}/memberships/${membership.id}/receipt.pdf`;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="membership-receipt-modal modal-overlay">
            <div className="modal-content">
                <div id="receipt-content-to-print">
                    <div className="receipt-header">
                        <h1>{isTeam ? 'Team Membership Receipt' : 'Membership Receipt'}</h1>
                        <p>ARC SportsZone</p>
                    </div>
                    <div className="receipt-body">
                        {!isTeam ? (
                            <>
                                <div className="receipt-section">
                                    <h2>Membership ID: M-{membership.id}</h2>
                                    <p><strong>Member Name:</strong> {membership.member_name}</p>
                                    <p><strong>Contact:</strong> {membership.member_contact}</p>
                                </div>
                                <div className="receipt-section">
                                    <h3>Package Details</h3>
                                    <p><strong>Package:</strong> {membership.package_name}</p>
                                    <div className="court-slot-box">
                                        <p><strong>Court:</strong> {membership.court_name}</p>
                                        <p><strong>Slot:</strong> {membership.time_slot}</p>
                                    </div>
                                    <p><strong>Start Date:</strong> {formatDate(membership.start_date)}</p>
                                    <p><strong>End Date:</strong> {formatDate(membership.current_end_date)}</p>
                                </div>
                                <div className="receipt-section">
                                    <h3>Payment Details</h3>
                                    <p><strong>Actual Price:</strong> ₹{membership.package_price}</p>
                                    {membership.discount_amount > 0 && (
                                        <p><strong>Discount:</strong> ₹{membership.discount_amount} ({membership.discount_details})</p>
                                    )}
                                    <p><strong>Final Price:</strong> ₹{membership.final_price_calc}</p>
                                    <p><strong>Amount Paid:</strong> ₹{membership.amount_paid || 0}</p>
                                    <p><strong>Balance:</strong> ₹{membership.balance_amount}</p>
                                    <p><strong>Payment Status:</strong> <span className={`status ${membership.payment_status}`}>{membership.payment_status}</span></p>
                                </div>
                                {membership.payment_info && (
                                    <div className="receipt-section">
                                        <h3>Payment History</h3>
                                        <ul className="payment-history-list">
                                            {membership.payment_info.split('; ').map((p, idx) => (
                                                <li key={idx}>{p}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="receipt-section">
                                    <h2>Team: {membership.team_name}</h2>
                                    <div className="court-slot-box">
                                        <p><strong>Court:</strong> {membership.court_name}</p>
                                        <p><strong>Slot:</strong> {membership.time_slot}</p>
                                    </div>
                                </div>
                                <div className="receipt-section">
                                    <h3>Team Members</h3>
                                    <table className="receipt-table" style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid #ddd' }}>
                                                <th style={{ textAlign: 'left', padding: '5px' }}>Member</th>
                                                <th style={{ textAlign: 'left', padding: '5px' }}>Package</th>
                                                <th style={{ textAlign: 'right', padding: '5px' }}>Paid</th>
                                                <th style={{ textAlign: 'right', padding: '5px' }}>Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {membership.members.map(m => (
                                                <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: '5px' }}>{m.member_name}</td>
                                                    <td style={{ padding: '5px' }}>{m.package_name}</td>
                                                    <td style={{ padding: '5px', textAlign: 'right' }}>₹{m.amount_paid}</td>
                                                    <td style={{ padding: '5px', textAlign: 'right' }}>₹{m.balance_amount}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="receipt-section">
                                    <h3>Team Summary</h3>
                                    <p><strong>Total Paid:</strong> ₹{membership.members.reduce((acc, m) => acc + parseFloat(m.amount_paid), 0)}</p>
                                    <p><strong>Total Balance:</strong> ₹{membership.members.reduce((acc, m) => acc + parseFloat(m.balance_amount), 0)}</p>
                                </div>
                            </>
                        )}
                        
                        <div className="receipt-footer">
                            <div className="qr-code">
                                <div style={{ height: "auto", margin: "0 auto", maxWidth: 100, width: "100%" }}>
                                    <QRCode
                                        size={256}
                                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                        value={receiptPdfUrl}
                                        viewBox={`0 0 256 256`}
                                    />
                                </div>
                                <p>Scan to Download PDF</p>
                            </div>
                            <div className="booking-info">
                                <p><strong>Registered By:</strong> {membership.created_by || 'N/A'}</p>
                                <p><strong>Membership Status:</strong> <span className={`status ${membership.status}`} style={{ color: 'black' }}>{membership.status}</span></p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="modal-actions">
                    <button onClick={handlePrint}>Print</button>
                    <button onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default MembershipReceiptModal;
