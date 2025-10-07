import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api';
import BookingList from './BookingList';
import EditBookingModal from './EditBookingModal';
import ReceiptModal from './ReceiptModal';

const Ledger = ({ user }) => {
    const [bookings, setBookings] = useState([]);
    const [filters, setFilters] = useState({ date: '', sport: '', customer: '' });
    const [sortOrder, setSortOrder] = useState('desc'); // 'desc' for newest first
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [isPaymentIdVisible, setIsPaymentIdVisible] = useState(false); // State for collapsible column

    const fetchFilteredBookings = useCallback(async () => {
        const { date, sport, customer } = filters;
        try {
            const res = await api.get('/bookings/all', {
                params: { date, sport, customer }
            });
            setBookings(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Error fetching bookings:", error);
            setBookings([]);
        }
    }, [filters]);

    useEffect(() => {
        fetchFilteredBookings();
    }, [fetchFilteredBookings]);

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    }

    const toggleSortOrder = () => {
        setSortOrder(currentOrder => currentOrder === 'desc' ? 'asc' : 'desc');
    };

    const sortedBookings = useMemo(() => {
        return [...bookings].sort((a, b) => {
            if (sortOrder === 'desc') {
                return b.id - a.id; // Higher IDs are newer
            } else {
                return a.id - b.id;
            }
        });
    }, [bookings, sortOrder]);

    const handleEditClick = (booking) => {
        setSelectedBooking(booking);
        setIsEditModalOpen(true);
        setError(null);
    };

    const handleReceiptClick = (booking) => {
        setSelectedBooking(booking);
        setIsReceiptModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsEditModalOpen(false);
        setIsReceiptModalOpen(false);
        setSelectedBooking(null);
        setError(null);
    };

    const [error, setError] = useState(null);

    const handleSaveBooking = async (bookingId, bookingData) => {
        try {
            setError(null);
            await api.put(`/bookings/${bookingId}`, bookingData);
            handleCloseModal();
            fetchFilteredBookings(); // Refresh data
        } catch (error) {
            if (error.response && error.response.status === 409) {
                setError(error.response.data.message);
            } else {
                console.error("Error updating booking:", error);
            }
        }
    };

    const handleCancelClick = async (bookingId) => {
        if (window.confirm('Are you sure you want to cancel this booking?')) {
            try {
                await api.put(`/bookings/${bookingId}/cancel`);
                fetchFilteredBookings(); // Refresh data
            } catch (error) {
                console.error("Error cancelling booking:", error);
            }
        }
    };

    return (
        <div>
            <h2>Booking Ledger</h2>
            {/* Improved Filter Controls */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
                <input type="date" name="date" value={filters.date} onChange={handleFilterChange} />
                <input type="text" name="sport" placeholder="Filter by sport" value={filters.sport} onChange={handleFilterChange} />
                <input type="text" name="customer" placeholder="Filter by customer" value={filters.customer} onChange={handleFilterChange} />
                <button onClick={toggleSortOrder}>
                    Sort: {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                </button>
                <button onClick={() => setIsPaymentIdVisible(!isPaymentIdVisible)}>
                    {isPaymentIdVisible ? 'Hide' : 'Show'} Payment ID
                </button>
            </div>
            <BookingList 
                bookings={sortedBookings} 
                user={user}
                onEdit={handleEditClick} 
                onCancel={handleCancelClick} 
                onReceipt={handleReceiptClick}
                isPaymentIdVisible={isPaymentIdVisible} // Pass visibility state
            />
            {isEditModalOpen && (
                <EditBookingModal 
                    booking={selectedBooking}
                    onSave={handleSaveBooking}
                    onClose={handleCloseModal}
                    error={error}
                />
            )}
            {isReceiptModalOpen && (
                <ReceiptModal 
                    booking={selectedBooking}
                    onClose={handleCloseModal}
                />
            )}
        </div>
    );
};

export default Ledger;