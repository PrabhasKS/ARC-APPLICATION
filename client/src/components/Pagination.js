import React from 'react';
import './Pagination.css'; // Import the new CSS file

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    const handlePrevious = () => {
        onPageChange(currentPage - 1);
    };

    const handleNext = () => {
        onPageChange(currentPage + 1);
    };

    if (totalPages <= 1) {
        return null;
    }

    return (
        <div className="pagination-container">
            <button className="pagination-button" onClick={handlePrevious} disabled={currentPage === 1}>
                &laquo; Previous
            </button>
            <span className="pagination-text">
                Page {currentPage} of {totalPages}
            </span>
            <button className="pagination-button" onClick={handleNext} disabled={currentPage === totalPages}>
                Next &raquo;
            </button>
        </div>
    );
};

export default Pagination;
