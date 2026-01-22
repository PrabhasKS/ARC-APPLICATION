import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api';
import BookingList from './BookingList';
import EditBookingModal from './EditBookingModal';
import ReceiptModal from './ReceiptModal';
import DeskAnalytics from './DeskAnalytics';
import Pagination from './Pagination'; // Import the Pagination component
import './Ledger.css';

const Ledger = ({ user }) => {
    const [bookings, setBookings] = useState([]);
    const [filters, setFilters] = useState({ date: '', sport: '', search: '', startTime: '', endTime: '' });
    const [sortOrder, setSortOrder] = useState('desc');
    const [activeTab, setActiveTab] = useState('active');
    const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
    const [isTimeFilterDropdownOpen, setIsTimeFilterDropdownOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [error, setError] = useState(null);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const bookingsPerPage = 15;

    const [columnVisibility, setColumnVisibility] = useState({
        court: false,
        discount: false,
        discountReason: false,
        accessories: false,
        paymentId: false,
        bookedBy: false,
    });

    const toggleableColumns = {
        court: 'Court',
        discount: 'Discount',
        discountReason: 'Discount Reason',
        accessories: 'Accessories',
        paymentId: 'Payment ID',
        bookedBy: 'Booked By',
    };

    const fetchBookings = useCallback(async (page = 1) => {
        try {
            const params = {
                ...filters,
                page,
                limit: bookingsPerPage,
                status: activeTab
            };

            const res = await api.get('/bookings/all', { params });

            setBookings(Array.isArray(res.data.bookings) ? res.data.bookings : []);
            setTotalPages(res.data.totalPages || 0); // Always set total pages for pagination

        } catch (error) {
            console.error("Error fetching bookings:", error);
            setBookings([]);
            setTotalPages(0);
        }
    }, [filters, activeTab, bookingsPerPage]);

    // Effect for handling SSE and initial fetch
    useEffect(() => {
        fetchBookings(currentPage);

        const eventSource = new EventSource('http://localhost:5000/api/events');
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.message === 'bookings_updated') {
                fetchBookings(currentPage);
            }
        };
        eventSource.onerror = (error) => {
            console.error('SSE Error:', error);
            eventSource.close();
        };

        return () => eventSource.close();
    }, [fetchBookings, currentPage]);

    // Effect for handling deep-linking to edit a booking
    useEffect(() => {
        const { openBookingId } = location.state || {};
        if (openBookingId && bookings.length > 0) {
            const bookingToEdit = bookings.find(b => b.id === openBookingId);
            if (bookingToEdit) {
                handleEditClick(bookingToEdit);
                navigate(location.pathname, { replace: true, state: {} });
            }
        }
    }, [location.state, bookings, navigate, location.pathname]);

    // Reset to page 1 when filters or tab change
    useEffect(() => {
        setCurrentPage(1);
    }, [filters, activeTab]);

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const handleColumnToggle = (columnName) => {
        setColumnVisibility(prev => ({ ...prev, [columnName]: !prev[columnName] }));
    };

    const handlePageChange = (page) => {
        if (page > 0 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const filteredAndSortedBookings = useMemo(() => {
        // The backend now handles all filtering. We just sort the results.
        return [...bookings].sort((a, b) => (sortOrder === 'desc' ? b.id - a.id : a.id - b.id));
    }, [bookings, sortOrder]);

    const handleEditClick = (booking) => { setSelectedBooking(booking); setIsEditModalOpen(true); setError(null); };
    const handleReceiptClick = (booking) => { setSelectedBooking(booking); setIsReceiptModalOpen(true); };
    const handleCloseModal = () => { setIsEditModalOpen(false); setIsReceiptModalOpen(false); setSelectedBooking(null); setError(null); };

    const handleSaveBooking = async (bookingId, bookingData) => {
        try {
            setError(null);
            const res = await api.put(`/bookings/${bookingId}`, bookingData);
            const updatedBooking = res.data.booking;
            setSelectedBooking(updatedBooking);
            handleCloseModal();
            fetchBookings(currentPage); // Refresh data on the current page
        } catch (saveError) {
            if (saveError.response && saveError.response.status === 409) {
                setError(saveError.response.data.message);
            } else {
                console.error("Error updating booking:", saveError);
                setError("An unexpected error occurred while saving.");
            }
        }
    };

    const handleCancelClick = async (bookingId) => {
        if (window.confirm('Are you sure you want to cancel this booking?')) {
            try {
                await api.put(`/bookings/${bookingId}/cancel`);
                fetchBookings(currentPage);
            } catch (error) {
                console.error("Error cancelling booking:", error);
            }
        }
    };

    return (
        <div className="ledger-container">
            {/* <h2 style={{ color: 'red' }}>DEBUG: Version 2</h2> */}
            {user && (user.role === 'admin' || user.role === 'desk') && showAnalytics && (
                <DeskAnalytics date={filters.date} />
            )}
            <header className="page-header">
                <h1>Bookings History</h1>
            </header>
            <div className="controls-bar">
                <div className="button-group">
                    {user && (user.role === 'admin' || user.role === 'desk') && (
                        <button className="filter-button" onClick={() => setShowAnalytics(!showAnalytics)}>
                            {showAnalytics ? 'Hide' : 'Show'} Analytics
                        </button>
                    )}
                    <button className="filter-button" onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}>
                        Sort: {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
                    </button>
                    <div className="column-toggle">
                        <button className="column-toggle-button" onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}>
                            Show Columns
                        </button>
                        {isColumnDropdownOpen && (
                            <div className="column-toggle-dropdown">
                                {Object.entries(toggleableColumns).map(([key, label]) => (
                                    <label key={key}>
                                        <input
                                            type="checkbox"
                                            checked={columnVisibility[key]}
                                            onChange={() => handleColumnToggle(key)}
                                        />
                                        {label}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                    <input
                        type="date"
                        name="date"
                        value={filters.date}
                        onChange={handleFilterChange}
                        className="filter-input"
                    />
                    <div className="column-toggle">
                        <button className="column-toggle-button" onClick={() => setIsTimeFilterDropdownOpen(!isTimeFilterDropdownOpen)}>
                            Filter by Time
                        </button>
                        {isTimeFilterDropdownOpen && (
                            <div className="column-toggle-dropdown">
                                <input type="time" name="startTime" value={filters.startTime} onChange={handleFilterChange} />
                                <input type="time" name="endTime" value={filters.endTime} onChange={handleFilterChange} />
                            </div>
                        )}
                    </div>
                </div>
                <div className="primary-search-bar">
                    <input
                        type="text"
                        name="search"
                        placeholder="Search by name, sport, or ID..."
                        className="filter-input"
                        value={filters.search}
                        onChange={handleFilterChange}
                    />
                </div>
            </div>
            <div className="tabs-container">
                <button className={`tab-button ${activeTab === 'active' ? 'active' : ''}`} onClick={() => setActiveTab('active')}>Active Bookings</button>
                <button className={`tab-button ${activeTab === 'closed' ? 'active' : ''}`} onClick={() => setActiveTab('closed')}>Closed Bookings</button>
                <button className={`tab-button ${activeTab === 'cancelled' ? 'active' : ''}`} onClick={() => setActiveTab('cancelled')}>Cancelled Bookings</button>
            </div>
            <div className="table-wrapper">
                <BookingList
                    bookings={filteredAndSortedBookings}
                    user={user}
                    onEdit={handleEditClick}
                    onCancel={handleCancelClick}
                    onReceipt={handleReceiptClick}
                    columnVisibility={columnVisibility}
                />
            </div>
            {totalPages > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                />
            )}
            {isEditModalOpen && <EditBookingModal booking={selectedBooking} onSave={handleSaveBooking} onClose={handleCloseModal} error={error} onPaymentAdded={() => fetchBookings(currentPage)} />}
            {isReceiptModalOpen && <ReceiptModal booking={selectedBooking} onClose={handleCloseModal} />}
        </div>
    );
};

export default Ledger;

