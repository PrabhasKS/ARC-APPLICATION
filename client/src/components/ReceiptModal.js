// import React from 'react';
// import QRCode from 'react-qr-code';
// import './ReceiptModal.css';

// const ReceiptModal = ({ booking, onClose }) => {
//     const formatDate = (dateString) => {
//         const date = new Date(dateString);
//         const day = String(date.getDate()).padStart(2, '0');
//         const month = String(date.getMonth() + 1).padStart(2, '0');
//         const year = date.getFullYear();
//         return `${day}/${month}/${year}`;
//     };
//     if (!booking) {
//         return null;
//     }

//     // IMPORTANT: Replace with your actual public server URL in a real deployment
//     const publicServerUrl = process.env.REACT_APP_RECIEPT_URL || 'http://localhost:5000'; 
//     const receiptPdfUrl = `${publicServerUrl}/api/booking/${booking.id}/receipt.pdf`;

//     const handlePrint = () => {
//         const printContent = document.getElementById('receipt-content-to-print');
//         const windowUrl = 'Receipt';
//         const uniqueName = new Date().getTime();
//         const windowName = windowUrl + '_' + uniqueName;
//         const printWindow = window.open('', windowName, 'height=600,width=800');
//         printWindow.document.write(`<html><head><title>${windowUrl}</title>`);
//         printWindow.document.write('<link rel="stylesheet" href="ReceiptModal.css" type="text/css" />'); // Optional: link to your css
//         printWindow.document.write('</head><body>');
//         printWindow.document.write(printContent.innerHTML);
//         printWindow.document.write('</body></html>');
//         printWindow.document.close();
//         printWindow.focus();
//         setTimeout(() => {
//             printWindow.print();
//             printWindow.close();
//         }, 500);
//     };

//     return (
//         <div className="modal-overlay">
//             <div className="modal-content">
//                 <div id="receipt-content-to-print">
//                     <div className="receipt-header">
//                         <h1>Booking Receipt</h1>
//                         <p>ARC SportsZone</p>
//                     </div>
//                     <div className="receipt-body">
//                         <div className="receipt-section">
//                             <h2>Booking ID: {booking.id}</h2>
//                             <p><strong>Customer:</strong> {booking.customer_name}</p>
//                             <p><strong>Contact:</strong> {booking.customer_contact}</p>
//                         </div>
//                         <div className="receipt-section">
//                             <h3>Booking Details</h3>
//                             <p><strong>Sport:</strong> {booking.sport_name}</p>
//                             <p><strong>Court:</strong> {booking.court_name}</p>
//                             <p><strong>Date:</strong> {formatDate(booking.date)}</p>
//                             <p><strong>Time:</strong> {booking.time_slot}</p>
//                         </div>
//                         {booking.accessories && booking.accessories.length > 0 && (
//                             <div className="receipt-section">
//                                 <h3>Accessories</h3>
//                                 {booking.accessories.map((acc, index) => (
//                                     <p key={index}><strong>{acc.name} (x{acc.quantity}):</strong> ₹{acc.price * acc.quantity}</p>
//                                 ))}
//                             </div>
//                         )}
//                         <div className="receipt-section">
//                             <h3>Payment Details</h3>
//                             <p><strong>Total Amount:</strong> ₹{booking.total_price}</p>
//                             <p><strong>Discount:</strong> ₹{booking.discount_amount || 0}</p>
//                             <p><strong>Final Amount:</strong> ₹{booking.total_amount}</p>
//                             <p><strong>Amount Paid:</strong> ₹{booking.amount_paid}</p>
//                             <p><strong>Balance:</strong> ₹{booking.balance_amount}</p>
//                             <p><strong>Payment Status:</strong> <span className={`status ${booking.payment_status}`}>{booking.payment_status}</span></p>
//                         </div>
//                         <div className="receipt-footer">
//                              <div className="qr-code">
//                                 <div style={{ height: "auto", margin: "0 auto", maxWidth: 100, width: "100%" }}>
//                                     <QRCode
//                                         size={256}
//                                         style={{ height: "auto", maxWidth: "100%", width: "100%" }}
//                                         value={receiptPdfUrl}
//                                         viewBox={`0 0 256 256`}
//                                     />
//                                 </div>
//                                 <p>Scan to Download PDF</p>
//                             </div>
//                             <div className="booking-info">
//                                 <p><strong>Booked By:</strong> {booking.created_by_user || 'N/A'}</p>
//                                 <p><strong>Booking Status:</strong> <span className={`status ${booking.status}`}>{booking.status}</span></p>
//                             </div>
//                         </div>
//                     </div>
//                 </div>
//                 <div className="modal-actions">
//                     <button onClick={handlePrint}>Print</button>
//                     <button onClick={onClose}>Close</button>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default ReceiptModal;


import React from 'react';
// Removed QRCode import
import './ReceiptModal.css'; // Ensure this contains the print styles

const ReceiptModal = ({ booking, onClose }) => {
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date)) return 'Invalid Date';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    if (!booking) {
        return null;
    }

    const publicServerUrl = process.env.REACT_APP_RECIEPT_URL || 'http://localhost:5000';
    const receiptPdfUrl = `${publicServerUrl}/api/booking/${booking.id}/receipt.pdf`;
    console.log("QR Code URL:", receiptPdfUrl);

    const handlePrint = () => {
        window.print(); // Uses @media print styles
    };

    const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;

    // QR Code Value
    const qrCodeValue = receiptPdfUrl; // Or other relevant data

    return (
        <div className="modal-overlay receipt-modal-overlay">
            <div className="modal-content receipt-modal-content">
                <div id="receipt-content-to-print">
                    {/* ... (Receipt Header and Body sections remain the same) ... */}
                     <div className="receipt-header">
                        <h1>Booking Receipt</h1>
                        <p>ARC SportsZone</p>
                    </div>
                    <div className="receipt-body">
                        {/* ... Sections for ID, Customer, Booking Details, Accessories, Payment ... */}
                         <div className="receipt-section">
                            <h2>Booking ID: {booking.id}</h2>
                            <p><strong>Customer:</strong> {booking.customer_name}</p>
                            <p><strong>Contact:</strong> {booking.customer_contact}</p>
                        </div>
                        <div className="receipt-section">
                            <h3>Booking Details</h3>
                            <p><strong>Sport:</strong> {booking.sport_name}</p>
                            <p><strong>Court:</strong> {booking.court_name}</p>
                            <p><strong>Date:</strong> {formatDate(booking.date)}</p>
                            <p><strong>Time:</strong> {booking.time_slot}</p>
                        </div>
                        {/* Accessories Check */}
                        {booking.accessories && booking.accessories.length > 0 && Array.isArray(booking.accessories) && (
                            <div className="receipt-section">
                                <h3>Accessories</h3>
                                {booking.accessories.map((acc, index) => (
                                    <p key={index}><strong>{acc.name} (x{acc.quantity}):</strong> {formatCurrency(acc.price * acc.quantity)}</p>
                                ))}
                            </div>
                        )}
                         <div className="receipt-section">
                            <h3>Payment Details</h3>
                            <p><strong>Total Amount:</strong> {formatCurrency(booking.total_price)}</p>
                            <p><strong>Discount:</strong> {formatCurrency(booking.discount_amount)}</p>
                            <p><strong>Final Amount:</strong> {formatCurrency(booking.total_amount)}</p>
                            <p><strong>Amount Paid:</strong> {formatCurrency(booking.amount_paid)}</p>
                            <p><strong>Balance:</strong> {formatCurrency(booking.balance_amount)}</p>
                            <p><strong>Payment Status:</strong> <span className={`status ${booking.payment_status}`}>{booking.payment_status}</span></p>
                        </div>

                    </div>


                    <div className="receipt-footer">
                         <div className="qr-code">
                             {/* ✅ Only using the img tag now */}
                             <img
                                 className="qr-code-img"
                                 src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrCodeValue)}`}
                                 alt="QR Code"
                                 width="100"
                                 height="100"
                             />
                             <p>Scan to Download PDF</p>
                         </div>
                         <div className="booking-info">
                              <p><strong>Booked By:</strong> {booking.created_by_user || 'N/A'}</p>
                              <p><strong>Booking Status:</strong> <span className={`status ${booking.status}`}>{booking.status}</span></p>
                         </div>
                    </div>
                </div>
                <div className="modal-actions receipt-actions">
                    <button onClick={handlePrint}>Print</button>
                    <button onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default ReceiptModal;