import React from 'react';
import './PackageEditModal.css'; // Re-use modal styles

const RenewalConfirmationModal = ({ renewedMembership, onClose }) => {
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Membership Renewed Successfully!</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                <div className="modal-body">
                    <p>Membership ID: <strong>{renewedMembership.id}</strong></p>
                    <p>Package: <strong>{renewedMembership.package_name}</strong></p>
                    <p>New End Date: <strong>{renewedMembership.current_end_date}</strong></p>
                    <p>Amount Paid: <strong>Rs. {renewedMembership.amount_paid}</strong></p>
                    <p>Balance Amount: <strong>Rs. {renewedMembership.balance_amount}</strong></p>
                </div>
                <div className="modal-footer">
                    <button onClick={onClose} className="btn btn-primary">Close</button>
                </div>
            </div>
        </div>
    );
};

export default RenewalConfirmationModal;
