import React from 'react';
import QRCode from 'react-qr-code';
import './MembershipReceiptModal.css';

const MembershipReceiptModal = ({ membership, onClose }) => {
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    if (!membership) {
        return null;
    }

    const publicServerUrl = process.env.REACT_APP_RECIEPT_URL || 'http://localhost:5000';
    const receiptPdfUrl = `${publicServerUrl}/api/memberships/${membership.membership_id}/receipt.pdf`;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="membership-receipt-modal modal-overlay">
            <div className="modal-content">
                <div id="receipt-content-to-print">
                    <div className="receipt-header">
                        <h1>Membership Receipt</h1>
                        <p>ARC SportsZone</p>
                    </div>
                    <div className="receipt-body">
                        <div className="receipt-section">
                            <h2>Membership ID: {membership.membership_id}</h2>
                            <p><strong>Member Name:</strong> {membership.member_name}</p>
                            <p><strong>Contact:</strong> {membership.member_contact}</p>
                        </div>
                        <div className="receipt-section">
                            <h3>Package Details</h3>
                            <p><strong>Package:</strong> {membership.package_name}</p>
                            <p><strong>Duration:</strong> {membership.duration_months} months</p>
                            <p><strong>Start Date:</strong> {formatDate(membership.start_date)}</p>
                            <p><strong>End Date:</strong> {formatDate(membership.end_date)}</p>
                        </div>
                        <div className="receipt-section">
                            <h3>Payment Details</h3>
                            <p><strong>Actual Price:</strong> ₹{membership.base_price}</p>
                            <p><strong>Discount:</strong> ₹{membership.discount_amount}</p>
                            {/*membership.discount_details && <p><strong>Discount Details:</strong> {membership.discount_details}</p>*/}
                            <p><strong>Final Price:</strong> ₹{membership.price}</p>
                            <p><strong>Amount Paid:</strong> ₹{membership.amount_paid || 0}</p>
                            <p><strong>Balance:</strong> ₹{membership.balance_amount}</p>
                            <p><strong>Payment Status:</strong> <span className={`status ${membership.payment_status}`}>{membership.payment_status}</span></p>
                            {membership.payments && membership.payments.length > 0 && (
                                <div>
                                    <h4>Payment History:</h4>
                                    <ul>
                                        {membership.payments.map(payment => (
                                            <li key={payment.payment_id}>
                                                ₹{payment.amount} via {payment.payment_mode} on {formatDate(payment.payment_date)} by {payment.username || 'N/A'}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
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
                                <p><strong>Registered By:</strong> {membership.created_by_user || 'N/A'}</p>
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
