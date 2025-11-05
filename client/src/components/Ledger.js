// import React, { useState, useEffect, useCallback, useMemo } from 'react';
// import api from '../api';
// import BookingList from './BookingList';
// import EditBookingModal from './EditBookingModal';
// import ReceiptModal from './ReceiptModal';

// const Ledger = ({ user }) => {
//     const [bookings, setBookings] = useState([]);
//     const [filters, setFilters] = useState({ date: '', sport: '', customer: '', startTime: '', endTime: '' });
//     const [sortOrder, setSortOrder] = useState('desc'); // 'desc' for newest first
//     const [isEditModalOpen, setIsEditModalOpen] = useState(false);
//     const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
//     const [selectedBooking, setSelectedBooking] = useState(null);
//     const [isPaymentIdVisible, setIsPaymentIdVisible] = useState(false); // State for collapsible column
//     const [isBookedByVisible, setIsBookedByVisible] = useState(false);
//     const [isDiscountReasonVisible, setIsDiscountReasonVisible] = useState(false);

//     const fetchFilteredBookings = useCallback(async () => {
//         try {
//             const res = await api.get('/bookings/all', {
//                 params: filters
//             });
//             setBookings(Array.isArray(res.data) ? res.data : []);
//         } catch (error) {
//             console.error("Error fetching bookings:", error);
//             setBookings([]);
//         }
//     }, [filters]);

//     useEffect(() => {
//         fetchFilteredBookings();
//     }, [fetchFilteredBookings]);

//     const handleFilterChange = (e) => {
//         setFilters({ ...filters, [e.target.name]: e.target.value });
//     }

//     const toggleSortOrder = () => {
//         setSortOrder(currentOrder => currentOrder === 'desc' ? 'asc' : 'desc');
//     };

//     const sortedBookings = useMemo(() => {
//         return [...bookings].sort((a, b) => {
//             if (sortOrder === 'desc') {
//                 return b.id - a.id; // Higher IDs are newer
//             } else {
//                 return a.id - b.id;
//             }
//         });
//     }, [bookings, sortOrder]);

//     const handleEditClick = (booking) => {
//         setSelectedBooking(booking);
//         setIsEditModalOpen(true);
//         setError(null);
//     };

//     const handleReceiptClick = (booking) => {
//         setSelectedBooking(booking);
//         setIsReceiptModalOpen(true);
//     };

//     const handleCloseModal = () => {
//         setIsEditModalOpen(false);
//         setIsReceiptModalOpen(false);
//         setSelectedBooking(null);
//         setError(null);
//     };

//     const [error, setError] = useState(null);

//     const handleSaveBooking = async (bookingId, bookingData) => {
//         try {
//             setError(null);
//             await api.put(`/bookings/${bookingId}`, bookingData);
//             handleCloseModal();
//             fetchFilteredBookings(); // Refresh data
//         } catch (error) {
//             if (error.response && error.response.status === 409) {
//                 setError(error.response.data.message);
//             } else {
//                 console.error("Error updating booking:", error);
//             }
//         }
//     };

//     const handleCancelClick = async (bookingId) => {
//         if (window.confirm('Are you sure you want to cancel this booking?')) {
//             try {
//                 await api.put(`/bookings/${bookingId}/cancel`);
//                 fetchFilteredBookings(); // Refresh data
//             } catch (error) {
//                 console.error("Error cancelling booking:", error);
//             }
//         }
//     };

//     return (
//         <div>
//             <h2>Booking Ledger</h2>
//             {/* Improved Filter Controls */}
//             <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
//                 <input type="date" name="date" value={filters.date} onChange={handleFilterChange} />
//                 <input type="text" name="sport" placeholder="Filter by sport" value={filters.sport} onChange={handleFilterChange} />
//                 <input type="text" name="customer" placeholder="Filter by customer" value={filters.customer} onChange={handleFilterChange} />
//                 <input type="time" name="startTime" value={filters.startTime} onChange={handleFilterChange} />
//                 <input type="time" name="endTime" value={filters.endTime} onChange={handleFilterChange} />
//                 <button onClick={toggleSortOrder}>
//                     Sort: {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
//                 </button>
//                 <div className="dropdown">
//                     <button className="dropbtn">Show/Hide Columns</button>
//                     <div className="dropdown-content">
//                         <label>
//                             <input type="checkbox" checked={isPaymentIdVisible} onChange={() => setIsPaymentIdVisible(!isPaymentIdVisible)} />
//                             Payment ID
//                         </label>
//                         <label>
//                             <input type="checkbox" checked={isBookedByVisible} onChange={() => setIsBookedByVisible(!isBookedByVisible)} />
//                             Booked By
//                         </label>
//                         <label>
//                             <input type="checkbox" checked={isDiscountReasonVisible} onChange={() => setIsDiscountReasonVisible(!isDiscountReasonVisible)} />
//                             Discount Reason
//                         </label>
//                     </div>
//                 </div>
//             </div>
//             <style>{`
//                 .dropdown {
//                   position: relative;
//                   display: inline-block;
//                 }

//                 .dropdown-content {
//                   display: none;
//                   position: absolute;
//                   background-color: #f9f9f9;
//                   min-width: 160px;
//                   box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
//                   z-index: 1;
//                 }

//                 .dropdown-content label {
//                   color: black;
//                   padding: 12px 16px;
//                   text-decoration: none;
//                   display: block;
//                 }

//                 .dropdown:hover .dropdown-content {
//                   display: block;
//                 }
//             `}</style>
//             <BookingList 
//                 bookings={sortedBookings} 
//                 user={user}
//                 onEdit={handleEditClick} 
//                 onCancel={handleCancelClick} 
//                 onReceipt={handleReceiptClick}
//                 isPaymentIdVisible={isPaymentIdVisible}
//                 isBookedByVisible={isBookedByVisible}
//                 isDiscountReasonVisible={isDiscountReasonVisible}
//             />
//             {isEditModalOpen && (
//                 <EditBookingModal 
//                     booking={selectedBooking}
//                     onSave={handleSaveBooking}
//                     onClose={handleCloseModal}
//                     error={error}
//                 />
//             )}
//             {isReceiptModalOpen && (
//                 <ReceiptModal 
//                     booking={selectedBooking}
//                     onClose={handleCloseModal}
//                 />
//             )}
//         </div>
//     );
// };

// export default Ledger;

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom'; // Import useLocation and useNavigate

import api from '../api';

import BookingList from './BookingList';

import EditBookingModal from './EditBookingModal';

import ReceiptModal from './ReceiptModal';

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

    

        const location = useLocation();

        const navigate = useNavigate();

    

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



    const fetchBookings = useCallback(async () => {

        try {

            const res = await api.get('/bookings/all', { params: filters }); 

            setBookings(Array.isArray(res.data) ? res.data : []);

        } catch (error) {

            console.error("Error fetching bookings:", error);

            setBookings([]);

        }

    }, [filters]);



    useEffect(() => {

        fetchBookings();

    }, [fetchBookings]);

    useEffect(() => {
        const { openBookingId } = location.state || {};
        if (openBookingId && bookings.length > 0) {
            const bookingToEdit = bookings.find(b => b.id === openBookingId);
            if (bookingToEdit) {
                handleEditClick(bookingToEdit);
                // Clear the state to prevent re-opening on refresh
                navigate(location.pathname, { replace: true, state: {} });
            }
        }
    }, [location.state, bookings, navigate, location.pathname]);



    const handleFilterChange = (e) => {

        setFilters({ ...filters, [e.target.name]: e.target.value });

    }



    const handleColumnToggle = (columnName) => {

        setColumnVisibility(prev => ({ ...prev, [columnName]: !prev[columnName] }));

    };



    const isBookingExpired = (booking) => {

        try {

            if (!booking.date || !booking.time_slot) return false; 

    

            const now = new Date();

            const timeSlotParts = booking.time_slot.split(' - ');

            if (timeSlotParts.length < 2) return false;

    

            const endTimeStr = timeSlotParts[1].trim();

            const timeParts = endTimeStr.split(' ');

            if (timeParts.length < 2) return false;

    

            const [time, modifier] = timeParts;

            const [hoursStr, minutesStr] = time.split(':');

            let hours = parseInt(hoursStr, 10);

            const minutes = parseInt(minutesStr, 10);

    

            if (isNaN(hours) || isNaN(minutes)) return false;

    

            if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;

            if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;

    

            const bookingEndDateTime = new Date(booking.date);

            bookingEndDateTime.setHours(hours, minutes, 0, 0);

            

            return now > bookingEndDateTime;

        } catch (error) {

            console.error("Error parsing booking time:", error);

            return false;

        }

    };



    const filteredAndSortedBookings = useMemo(() => {

        return bookings

            .filter(booking => {

                if (!booking || !booking.status) return false;



                const isExpired = isBookingExpired(booking);

                const isCompleted = (booking.payment_status || '').toLowerCase() === 'completed';

                const isCancelled = (booking.status || '').toLowerCase() === 'cancelled';



                if (activeTab === 'active') {

                    return !isCancelled && !(isExpired && isCompleted);

                }

                if (activeTab === 'closed') {

                    return !isCancelled && isExpired && isCompleted;

                }

                if (activeTab === 'cancelled') {

                    return isCancelled;

                }

                return true;

            })

            .sort((a, b) => (sortOrder === 'desc' ? b.id - a.id : a.id - b.id));

    }, [bookings, sortOrder, activeTab]);



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

            fetchBookings(); // Refresh data

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

                fetchBookings(); 

                fetchBookings(); // Refresh data

            } catch (error) {

                console.error("Error cancelling booking:", error);

            }

        }

    };



    return (

        <div className="ledger-container">

            <header className="page-header">

                <h1>Bookings History</h1>

            </header>



            <div className="controls-bar">

                <div className="button-group">

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

                  {/* <input type="date" name="date" value={filters.date} onChange={handleFilterChange} /> */}
                  <input
    type="date"
    name="date"
    value={filters.date}
    onChange={handleFilterChange}
    className="filter-input" // Make sure this class is present
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



            {isEditModalOpen && <EditBookingModal booking={selectedBooking} onSave={handleSaveBooking} onClose={handleCloseModal} error={error} onPaymentAdded={fetchBookings} />}

            {isReceiptModalOpen && <ReceiptModal booking={selectedBooking} onClose={handleCloseModal} />}

        </div>

    );

};



export default Ledger;

