import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { getStandaloneSale } from './inventoryApi';
import '../ReceiptModal.css';

export default function StandaloneReceiptModal({ saleId, onClose }) {
    const [sale, setSale] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSale = async () => {
            setLoading(true);
            try {
                const res = await getStandaloneSale(saleId);
                setSale(res.data);
            } catch (err) {
                console.error("Error fetching sale:", err);
            }
            setLoading(false);
        };
        if (saleId) fetchSale();
    }, [saleId]);

    if (loading) {
        return (
            <div className="receipt-overlay">
                <div className="receipt-modal" style={{ textAlign: 'center' }}>
                    <p>Loading receipt...</p>
                    <button onClick={onClose} style={{ marginTop: 20 }}>Close</button>
                </div>
            </div>
        );
    }

    if (!sale) {
        return (
            <div className="receipt-overlay">
                <div className="receipt-modal" style={{ textAlign: 'center', color: 'red' }}>
                    <p>Failed to load receipt.</p>
                    <button onClick={onClose} style={{ marginTop: 20 }}>Close</button>
                </div>
            </div>
        );
    }

    const publicServerUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    const receiptPdfUrl = `${publicServerUrl}/inventory/standalone-sales/${sale.id}/receipt.pdf`;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="receipt-overlay">
            <div className="receipt-modal">
                <div id="receipt-content-to-print">
                    <div className="receipt-header">
                        <h1>Inventory Receipt</h1>
                        <p>ARC SportsZone</p>
                    </div>
                    
                    <div className="receipt-body">
                        <div className="receipt-section">
                            <h2>Sale ID: {sale.id}</h2>
                            <p><strong>Customer:</strong> {sale.customer_name}</p>
                            <p><strong>Contact:</strong> {sale.customer_contact}</p>
                            <p><strong>Date:</strong> {sale.sale_date}</p>
                        </div>
                        
                        <div className="receipt-section">
                            <h3>Items</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                                        <th style={{ textAlign: 'left', paddingBottom: '4px' }}>Item</th>
                                        <th style={{ textAlign: 'center', paddingBottom: '4px' }}>Type</th>
                                        <th style={{ textAlign: 'center', paddingBottom: '4px' }}>Qty</th>
                                        <th style={{ textAlign: 'right', paddingBottom: '4px' }}>Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(sale.items || []).map(item => (
                                        <tr key={item.id} style={{ borderBottom: '1px dashed #eee' }}>
                                            <td style={{ paddingTop: '4px', paddingBottom: '4px' }}>{item.accessory_name}</td>
                                            <td style={{ textAlign: 'center', fontSize: '0.8rem', textTransform: 'capitalize' }}>{item.transaction_type}</td>
                                            <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                                            <td style={{ textAlign: 'right' }}>₹{(parseFloat(item.price_at_sale) * item.quantity).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="receipt-section">
                            <h3>Payment Details</h3>
                            <p><strong>Total Amount:</strong> ₹{parseFloat(sale.total_amount).toFixed(2)}</p>
                            <p><strong>Amount Paid:</strong> ₹{parseFloat(sale.amount_paid).toFixed(2)}</p>
                            <p><strong>Balance:</strong> ₹{parseFloat(sale.balance_amount).toFixed(2)}</p>
                            <p><strong>Payment Status:</strong> <span className={`status ${sale.payment_status}`}>{sale.payment_status}</span></p>
                            
                            {(sale.payments || []).length > 0 && (
                                <div style={{ marginTop: '15px' }}>
                                    <h4>Payment History:</h4>
                                    <ul>
                                        {sale.payments.map(payment => (
                                            <li key={payment.id}>
                                                ₹{parseFloat(payment.amount).toFixed(2)} via {payment.payment_mode} on {new Date(payment.payment_date).toLocaleDateString()}
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
                                <p>Scan for PDF</p>
                            </div>
                            <div className="booking-info">
                                <p><strong>Processed By:</strong> {sale.created_by || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="modal-actions">
                    <button onClick={handlePrint} className="btn-print">Print</button>
                    <button onClick={onClose} className="btn-close">Close</button>
                </div>
            </div>
        </div>
    );
}
