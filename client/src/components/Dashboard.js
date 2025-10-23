// import React, { useState, useEffect, useCallback, useMemo } from 'react';
// import api from '../api';
// import BookingForm from './BookingForm';
// import BookingList from './BookingList';
// import ActiveBookings from './ActiveBookings';
// import EditBookingModal from './EditBookingModal';
// import ReceiptModal from './ReceiptModal';
// import { useActiveBookings } from '../hooks/useActiveBookings';
// import AvailabilityHeatmap from './AvailabilityHeatmap';
// import CourtActions from './CourtActions';


// const Dashboard = ({ user }) => {
//     const [bookings, setBookings] = useState([]);
//     const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
//     const [startTime, setStartTime] = useState('09:00');
//     const [endTime, setEndTime] = useState('10:00');
//     const [availability, setAvailability] = useState([]);
//     const [heatmapData, setHeatmapData] = useState([]);
//     const [isHeatmapVisible, setIsHeatmapVisible] = useState(true);
//     const { bookings: activeBookings, removeBooking: handleRemoveEndedBooking } = useActiveBookings();

//     const [isEditModalOpen, setIsEditModalOpen] = useState(false);
//     const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
//     const [selectedBooking, setSelectedBooking] = useState(null);
//     const [filters, setFilters] = useState({ sport: '', customer: '' });

//     const handleFilterChange = (e) => {
//         setFilters({ ...filters, [e.target.name]: e.target.value });
//     };

//     const [sortOrder, setSortOrder] = useState('desc'); // 'desc' for newest first

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

//     const fetchAvailability = useCallback(async () => {
//         if (selectedDate && startTime && endTime) {
//             try {
//                 const res = await api.get(`/courts/availability`, { 
//                     params: { 
//                         date: selectedDate, 
//                         startTime: startTime, 
//                         endTime: endTime 
//                     } 
//                 });
//                 console.log('Availability response:', res.data);
//                 setAvailability(Array.isArray(res.data) ? res.data : []);
//             } catch (error) {
//                 console.error("Error fetching availability:", error);
//                 setAvailability([]);
//             }
//         }
//     }, [selectedDate, startTime, endTime]);

//     const fetchBookingsForDate = useCallback(async () => {
//         try {
//             const res = await api.get(`/bookings/all`, { params: { date: selectedDate, ...filters } });
//             setBookings(res.data);
//         } catch (err) {
//             console.error("Error fetching bookings for date:", err);
//         }
//     }, [selectedDate, filters]);

//     const fetchHeatmapData = useCallback(async () => {
//         try {
//             const res = await api.get(`/availability/heatmap`, { params: { date: selectedDate } });
//             setHeatmapData(res.data);
//         } catch (err) {
//             console.error("Error fetching heatmap data:", err);
//         }
//     }, [selectedDate]);

//     const handleSlotSelect = (court, time, minute) => {
//         const [hour] = time.split(':').map(Number);
//         const newDate = new Date();
//         newDate.setHours(hour, minute);
//         const start = `${String(newDate.getHours()).padStart(2, '0')}:${String(newDate.getMinutes()).padStart(2, '0')}`;
//         newDate.setMinutes(newDate.getMinutes() + 30);
//         const end = `${String(newDate.getHours()).padStart(2, '0')}:${String(newDate.getMinutes()).padStart(2, '0')}`;

//         setStartTime(start);
//         setEndTime(end);
//         // Optionally, you can also pre-select the court in the booking form if the form supports it.
//     };

//     useEffect(() => {
//         const fetchData = () => {
//             fetchAvailability();
//             fetchBookingsForDate();
//             fetchHeatmapData();
//         };

//         fetchData();
//         window.addEventListener('focus', fetchData);

//         return () => {
//             window.removeEventListener('focus', fetchData);
//         };
//     }, [fetchAvailability, fetchBookingsForDate, fetchHeatmapData]);

//     const handleBookingSuccess = () => {
//         fetchAvailability();
//         fetchBookingsForDate();
//     }

//     const handleTimeSlotChange = (event) => {
//         const [start, end] = event.target.value.split('-');
//         setStartTime(start);
//         setEndTime(end);
//     }

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
//             fetchBookingsForDate(); // Refresh data
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
//                 fetchBookingsForDate(); // Refresh data
//             } catch (error) {
//                 console.error("Error cancelling booking:", error);
//             }
//         }
//     };

//     const handleCourtStatusChange = (courtId, newStatus) => {
//         const updatedAvailability = availability.map(court =>
//             court.id === courtId ? { ...court, status: newStatus, is_available: newStatus === 'Available' } : court
//         );
//         setAvailability(updatedAvailability);
//     };

//     const timeSlots = Array.from({ length: 16 }, (_, i) => {
//         const startHour = 6 + i;
//         const endHour = startHour + 1;
//         const startTimeValue = `${String(startHour).padStart(2, '0')}:00`;
//         const endTimeValue = `${String(endHour).padStart(2, '0')}:00`;
//         const timeLabel = `${startHour % 12 === 0 ? 12 : startHour % 12}:00 ${startHour < 12 ? 'AM' : 'PM'} - ${endHour % 12 === 0 ? 12 : endHour % 12}:00 ${endHour < 12 ? 'AM' : 'PM'}`;
//         return { value: `${startTimeValue}-${endTimeValue}`, label: timeLabel };
//     });

//     return (
//         <div>
//             <h2>Bookings</h2>

//             <button onClick={() => setIsHeatmapVisible(!isHeatmapVisible)} style={{ marginBottom: '10px' }}>
//                 {isHeatmapVisible ? 'Hide' : 'Show'} Availability Heatmap
//             </button>

//             {isHeatmapVisible && <AvailabilityHeatmap heatmapData={heatmapData} onSlotSelect={handleSlotSelect} />}

//             <div>
//                 <h3>Check Availability & Book</h3>
//                 <label>Date: </label>
//                 <input type="date" value={selectedDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setSelectedDate(e.target.value)} />
                
//                 <div>
//                     <label>Time Slot: </label>
//                     <select onChange={handleTimeSlotChange} value={`${startTime}-${endTime}`}>
//                         {timeSlots.map(slot => (
//                             <option key={slot.value} value={slot.value}>
//                                 {slot.label}
//                             </option>
//                         ))}
//                     </select>
//                 </div>

//                 <div style={{ marginTop: '10px' }}>
//                     <label>Start Time: </label>
//                     <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
//                     <label>End Time: </label>
//                     <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
//                 </div>
//             </div>

//             <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
//                 <div style={{ flex: 1 }}>
//                     <h4>Court Status at Selected Time</h4>
//                     <table>
//                         <thead>
//                             <tr>
//                                 <th>Court</th>
//                                 <th>Sport</th>
//                                 <th>Status</th>
//                                 <th>Actions</th>
//                             </tr>
//                         </thead>
//                         <tbody>
//                             {availability.map(court => (
//                                 <tr key={court.id}>
//                                     <td>{court.name}</td>
//                                     <td>{court.sport_name}</td>
//                                     <td style={{ color: court.is_available ? 'green' : 'red' }}>
//                                         {['Under Maintenance', 'Event', 'Tournament', 'Membership', 'Coaching'].includes(court.status)
//                                             ? court.status
//                                             : court.is_available
//                                                 ? court.capacity > 1
//                                                     ? `${court.available_slots} / ${court.capacity} slots available`
//                                                     : 'Available'
//                                                 : 'Engaged'}
//                                     </td>
//                                     <td>
//                                         <CourtActions court={court} onStatusChange={handleCourtStatusChange} />
//                                     </td>
//                                 </tr>
//                             ))}
//                         </tbody>
//                     </table>
//                 </div>
//                 <div style={{ flex: 1 }}>
//                      <h4>Book a Slot</h4>
//                      <BookingForm
//                         courts={availability.filter(c => c.is_available)}
//                         selectedDate={selectedDate}
//                         startTime={startTime}
//                         endTime={endTime}
//                         onBookingSuccess={handleBookingSuccess}
//                         user={user}
//                     />
//                 </div>
//                  <div style={{ flex: 1 }}>
//                     <ActiveBookings 
//                         bookings={activeBookings}
//                         onRemoveBooking={handleRemoveEndedBooking} 
//                     />
//                 </div>
//             </div>

//             <div style={{marginTop: '20px'}}>
//                 <h3>Bookings for {selectedDate}</h3>
//                 <div style={{ marginBottom: '10px' }}>
//                     <input type="text" name="sport" placeholder="Filter by sport" value={filters.sport} onChange={handleFilterChange} style={{ marginLeft: '10px' }} />
//                     <input type="text" name="customer" placeholder="Filter by customer" value={filters.customer} onChange={handleFilterChange} style={{ marginLeft: '10px' }} />
//                     <button onClick={toggleSortOrder} style={{ marginLeft: '10px' }}>
//                         Sort: {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
//                     </button>
//                 </div>
//                 <BookingList 
//                     bookings={sortedBookings} 
//                     onEdit={handleEditClick} 
//                     onCancel={handleCancelClick} 
//                     onReceipt={handleReceiptClick}
//                 />
//             </div>
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

// export default Dashboard;





// import React, { useState, useEffect, useCallback, useMemo } from 'react';
// import api from '../api'; // ✅ Used in fetch functions and handlers
// import BookingForm from './BookingForm';
// import BookingList from './BookingList';
// import ActiveBookings from './ActiveBookings';
// import EditBookingModal from './EditBookingModal';
// import ReceiptModal from './ReceiptModal';
// import { useActiveBookings } from '../hooks/useActiveBookings';
// import AvailabilityHeatmap from './AvailabilityHeatmap';
// import CourtActions from './CourtActions';
// import './Dashboard.css'; // Import the dashboard CSS

// const Dashboard = ({ user }) => {
//     // --- State Variables ---
//     const [bookings, setBookings] = useState([]); // ✅ Used in sortedBookings
//     const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
//     const [startTime, setStartTime] = useState('09:00');
//     const [endTime, setEndTime] = useState('10:00');
//     const [availability, setAvailability] = useState([]); // ✅ Used in JSX and BookingForm props
//     const [heatmapData, setHeatmapData] = useState([]); // ✅ Used in Heatmap props
//     const [isHeatmapVisible, setIsHeatmapVisible] = useState(true);
//     const { bookings: activeBookings, removeBooking: handleRemoveEndedBooking } = useActiveBookings(); // ✅ Used in ActiveBookings props
//     const [isEditModalOpen, setIsEditModalOpen] = useState(false); // ✅ Used in JSX conditional rendering
//     const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false); // ✅ Used in JSX conditional rendering
//     const [selectedBooking, setSelectedBooking] = useState(null); // ✅ Used in Modal props
//     const [filters, setFilters] = useState({ sport: '', customer: '' });
//     const [sortOrder, setSortOrder] = useState('desc');
//     const [error, setError] = useState(null); // ✅ Used in Modal props

//     // --- Handlers ---
//     const handleFilterChange = (e) => { setFilters({ ...filters, [e.target.name]: e.target.value }); };
//     const toggleSortOrder = () => { setSortOrder(currentOrder => currentOrder === 'desc' ? 'asc' : 'desc'); };

//     // --- Callbacks and Memos ---
//     const fetchAvailability = useCallback(async () => {
//         if (selectedDate && startTime && endTime) {
//             try {
//                 const res = await api.get(`/courts/availability`, {
//                     params: { date: selectedDate, startTime: startTime, endTime: endTime }
//                 });
//                 setAvailability(Array.isArray(res.data) ? res.data : []);
//             } catch (error) {
//                 console.error("Error fetching availability:", error);
//                 setAvailability([]); // Set to empty array on error
//             }
//         }
//     }, [selectedDate, startTime, endTime]); // Correct dependencies

//     const fetchBookingsForDate = useCallback(async () => {
//         try {
//             const res = await api.get(`/bookings/all`, { params: { date: selectedDate, ...filters } });
//             setBookings(Array.isArray(res.data) ? res.data : []); // Ensure it's an array
//         } catch (err) {
//             console.error("Error fetching bookings for date:", err);
//             setBookings([]); // Set to empty array on error
//         }
//     }, [selectedDate, filters]); // Correct dependencies

//     const fetchHeatmapData = useCallback(async () => {
//         try {
//             const res = await api.get(`/availability/heatmap`, { params: { date: selectedDate } });
//             setHeatmapData(res.data);
//         } catch (err) {
//             console.error("Error fetching heatmap data:", err);
//             setHeatmapData([]); // Set to empty array on error
//         }
//     }, [selectedDate]); // Correct dependencies

//     const handleSlotSelect = (court, time, minute) => {
//         const [hour] = time.split(':').map(Number);
//         const newDate = new Date();
//         newDate.setHours(hour, minute);
//         const start = `${String(newDate.getHours()).padStart(2, '0')}:${String(newDate.getMinutes()).padStart(2, '0')}`;
//         newDate.setMinutes(newDate.getMinutes() + 30);
//         const end = `${String(newDate.getHours()).padStart(2, '0')}:${String(newDate.getMinutes()).padStart(2, '0')}`;
//         setStartTime(start);
//         setEndTime(end);
//     };

//     useEffect(() => {
//         const fetchData = () => {
//             fetchAvailability();
//             fetchBookingsForDate();
//             fetchHeatmapData();
//         };
//         fetchData();
//         // Add listener for window focus to refresh data
//         window.addEventListener('focus', fetchData);
//         return () => {
//             window.removeEventListener('focus', fetchData);
//         };
//     }, [fetchAvailability, fetchBookingsForDate, fetchHeatmapData]); // Correct dependencies

//     const handleBookingSuccess = () => {
//         fetchAvailability();
//         fetchBookingsForDate();
//     };

//     const handleTimeSlotChange = (event) => {
//         const [start, end] = event.target.value.split('-');
//         setStartTime(start);
//         setEndTime(end);
//     };

//     const handleEditClick = (booking) => { setSelectedBooking(booking); setIsEditModalOpen(true); setError(null); };
//     const handleReceiptClick = (booking) => { setSelectedBooking(booking); setIsReceiptModalOpen(true); };
//     const handleCloseModal = () => { setIsEditModalOpen(false); setIsReceiptModalOpen(false); setSelectedBooking(null); setError(null); };

//     const handleSaveBooking = async (bookingId, bookingData) => {
//         try {
//             setError(null);
//             await api.put(`/bookings/${bookingId}`, bookingData);
//             handleCloseModal();
//             fetchBookingsForDate(); // Refresh data
//         } catch (saveError) {
//             if (saveError.response && saveError.response.status === 409) {
//                 setError(saveError.response.data.message);
//             } else {
//                 console.error("Error updating booking:", saveError);
//                 setError("An unexpected error occurred while saving.");
//             }
//         }
//     };

//     const handleCancelClick = async (bookingId) => {
//         if (window.confirm('Are you sure you want to cancel this booking?')) {
//             try {
//                 await api.put(`/bookings/${bookingId}/cancel`);
//                 fetchBookingsForDate(); // Refresh data
//             } catch (cancelError) {
//                 console.error("Error cancelling booking:", cancelError);
//                 // Optionally set an error message: setError("Failed to cancel booking.")
//             }
//         }
//     };

//     const handleCourtStatusChange = async (courtId, newStatus) => {
//         // Optimistically update UI
//         const previousAvailability = availability;
//         const updatedAvailability = availability.map(court =>
//             court.id === courtId ? { ...court, status: newStatus, is_available: newStatus === 'Available' } : court
//         );
//         setAvailability(updatedAvailability);

//         // Send update to backend
//         try {
//             await api.put(`/courts/${courtId}/status`, { status: newStatus });
//             // Optionally show success message
//         } catch (statusError) {
//             console.error("Error updating court status:", statusError);
//             // Revert UI on error
//             setAvailability(previousAvailability);
//             // Optionally show error message
//         }
//     };

//     const timeSlots = useMemo(() => Array.from({ length: 16 }, (_, i) => {
//         const startHour = 6 + i;
//         const endHour = startHour + 1;
//         const startTimeValue = `${String(startHour).padStart(2, '0')}:00`;
//         const endTimeValue = `${String(endHour).padStart(2, '0')}:00`;
//         const timeLabel = `${startHour % 12 === 0 ? 12 : startHour % 12}:00 ${startHour < 12 ? 'AM' : 'PM'} - ${endHour % 12 === 0 ? 12 : endHour % 12}:00 ${endHour < 12 ? 'AM' : 'PM'}`;
//         // ✅ FIX: Added explicit return
//         return { value: `${startTimeValue}-${endTimeValue}`, label: timeLabel };
//     }), []); // Empty dependency array is correct here

//     // ✅ FIX: Restored full memoized calculation with correct dependencies
//     const sortedBookings = useMemo(() => {
//         if (!Array.isArray(bookings)) return []; 
//         return [...bookings].sort((a, b) => {
//             // Basic sort by ID, assuming higher ID is newer
//             if (!a || !b) return 0; // Safety check
//             return sortOrder === 'desc' ? (b.id || 0) - (a.id || 0) : (a.id || 0) - (b.id || 0);
//         });
//     }, [bookings, sortOrder]); // Correct dependencies


//     return (
//         <div className="dashboard-container">
//             <h2 className="dashboard-header">Bookings Dashboard</h2>

//             {/* Heatmap Section - Button Removed */}
//             <div className="dashboard-card heatmap-card">
//                  {isHeatmapVisible && <AvailabilityHeatmap heatmapData={heatmapData} onSlotSelect={handleSlotSelect} />}
//             </div>

//             {/* Main Grid for Core Actions */}
//             <div className="dashboard-main-grid">
//                 {/* Court Status Area */}
//                 <div className="dashboard-card court-status-card">
//                     <h3>Check Availability & Status</h3>
//                     {/* ✅ UPDATED: Back to the horizontal layout */}
//                     <div className="availability-form">
//                         <div className="form-group">
//                             <label>Date</label>
//                             <input type="date" value={selectedDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setSelectedDate(e.target.value)} />
//                         </div>
//                         <div className="form-group">
//                             <label>Time Slot</label>
//                             <select onChange={handleTimeSlotChange} value={`${startTime}-${endTime}`}>
//                                 {timeSlots.map(slot => <option key={slot.value} value={slot.value}>{slot.label}</option>)}
//                             </select>
//                         </div>
//                          <div className="form-group">
//                             <label>Start Time</label>
//                             <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
//                         </div>
//                         <div className="form-group">
//                             <label>End Time</label>
//                             <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
//                         </div>
//                     </div>
//                     <h4 style={{ marginTop: '20px' }}>Court Status</h4>
//                     <table className="dashboard-table">
//                         <thead><tr><th>Court</th><th>Sport</th><th>Status</th><th>Actions</th></tr></thead>
//                         <tbody>
//                             {availability.map(court => (
//                                 <tr key={court.id}>
//                                     <td>{court.name}</td>
//                                     <td>{court.sport_name}</td>
//                                     <td style={{ color: court.is_available ? 'green' : 'red', fontWeight: '500' }}>
//                                         {['Under Maintenance', 'Event', 'Tournament', 'Membership', 'Coaching'].includes(court.status) ? court.status : court.is_available ? (court.capacity > 1 ? `${court.available_slots} / ${court.capacity} available` : 'Available') : 'Engaged'}
//                                     </td>
//                                     <td><CourtActions court={court} onStatusChange={handleCourtStatusChange} /></td>
//                                 </tr>
//                             ))}
//                         </tbody>
//                     </table>
//                 </div>

//                 {/* Booking Form Area */}
//                 <div className="dashboard-card booking-form-card">
//                     <h4>Book a Slot</h4>
//                     <BookingForm courts={availability.filter(c => c.is_available)} selectedDate={selectedDate} startTime={startTime} endTime={endTime} onBookingSuccess={handleBookingSuccess} user={user} />
//                 </div>

//                 {/* Active Bookings Area */}
//                 <div className="dashboard-card active-bookings-card">
//                     <h4>Active Bookings Now</h4>
//                     <ActiveBookings bookings={activeBookings} onRemoveBooking={handleRemoveEndedBooking} />
//                 </div>

//                 {/* Daily Bookings Area */}
//                 <div className="dashboard-card daily-bookings-card">
//                      <h3>Bookings for {selectedDate}</h3>
//                      <div className="availability-form" style={{ marginBottom: '20px' }}>
//                         <div className="form-group">
//                             <input type="text" name="sport" placeholder="Filter by sport" value={filters.sport} onChange={handleFilterChange} />
//                         </div>
//                         <div className="form-group">
//                             <input type="text" name="customer" placeholder="Filter by customer" value={filters.customer} onChange={handleFilterChange} />
//                         </div>
//                         <button onClick={toggleSortOrder} className="btn btn-secondary">
//                             Sort: {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
//                         </button>
//                      </div>
//                      <BookingList bookings={sortedBookings} onEdit={handleEditClick} onCancel={handleCancelClick} onReceipt={handleReceiptClick} />
//                 </div>

//             </div> {/* End of dashboard-main-grid */}

//             {isEditModalOpen && <EditBookingModal booking={selectedBooking} onSave={handleSaveBooking} onClose={handleCloseModal} error={error} />}
//             {isReceiptModalOpen && <ReceiptModal booking={selectedBooking} onClose={handleCloseModal} />}
//         </div>
//     );
// };

// export default Dashboard;




import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api'; // ✅ Used in fetch functions and handlers
import BookingForm from './BookingForm';
import BookingList from './BookingList';
import ActiveBookings from './ActiveBookings';
import EditBookingModal from './EditBookingModal';
import ReceiptModal from './ReceiptModal';
import { useActiveBookings } from '../hooks/useActiveBookings';
import AvailabilityHeatmap from './AvailabilityHeatmap';
import CourtActions from './CourtActions';
import './Dashboard.css'; // Import the dashboard CSS
import socket from '../socket';

const Dashboard = ({ user }) => {
    // --- State Variables ---
    const [bookings, setBookings] = useState([]); // ✅ Used in sortedBookings
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('10:00');
    const [availability, setAvailability] = useState([]); // ✅ Used in JSX and BookingForm props
    const [heatmapData, setHeatmapData] = useState([]); // ✅ Used in Heatmap props
    const [isHeatmapVisible] = useState(true); // ✅ FIX: Removed unused setIsHeatmapVisible
    const { bookings: activeBookings, removeBooking: handleRemoveEndedBooking } = useActiveBookings(); // ✅ Used in ActiveBookings props
    const [isEditModalOpen, setIsEditModalOpen] = useState(false); // ✅ Used in JSX conditional rendering
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false); // ✅ Used in JSX conditional rendering
    const [selectedBooking, setSelectedBooking] = useState(null); // ✅ Used in Modal props
    const [filters, setFilters] = useState({ sport: '', customer: '' });
    const [sortOrder, setSortOrder] = useState('desc');
    const [error, setError] = useState(null); // ✅ Used in Modal props

    // --- Handlers ---
    const handleFilterChange = (e) => { setFilters({ ...filters, [e.target.name]: e.target.value }); };
    const toggleSortOrder = () => { setSortOrder(currentOrder => currentOrder === 'desc' ? 'asc' : 'desc'); };

    // --- Callbacks and Memos ---
    const fetchAvailability = useCallback(async () => {
        if (selectedDate && startTime && endTime) {
            try {
                const res = await api.get(`/courts/availability`, {
                    params: { date: selectedDate, startTime: startTime, endTime: endTime }
                });
                setAvailability(Array.isArray(res.data) ? res.data : []);
            } catch (error) {
                console.error("Error fetching availability:", error);
                setAvailability([]); // Set to empty array on error
            }
        }
    }, [selectedDate, startTime, endTime]); // Correct dependencies

    const fetchBookingsForDate = useCallback(async () => {
        try {
            const res = await api.get(`/bookings/all`, { params: { date: selectedDate, ...filters } });
            setBookings(Array.isArray(res.data) ? res.data : []); // Ensure it's an array
        } catch (err) {
            console.error("Error fetching bookings for date:", err);
            setBookings([]); // Set to empty array on error
        }
    }, [selectedDate, filters]); // Correct dependencies

    const fetchHeatmapData = useCallback(async () => {
        try {
            const res = await api.get(`/availability/heatmap`, { params: { date: selectedDate } });
            setHeatmapData(res.data);
        } catch (err) {
            console.error("Error fetching heatmap data:", err);
            setHeatmapData([]); // Set to empty array on error
        }
    }, [selectedDate]); // Correct dependencies

    const handleSlotSelect = (court, time, minute) => {
        const [hour] = time.split(':').map(Number);
        const newDate = new Date();
        newDate.setHours(hour, minute);
        const start = `${String(newDate.getHours()).padStart(2, '0')}:${String(newDate.getMinutes()).padStart(2, '0')}`;
        newDate.setMinutes(newDate.getMinutes() + 30);
        const end = `${String(newDate.getHours()).padStart(2, '0')}:${String(newDate.getMinutes()).padStart(2, '0')}`;
        setStartTime(start);
        setEndTime(end);
    };

    useEffect(() => {
        fetchAvailability();
        fetchBookingsForDate();
        fetchHeatmapData();

        const handleBookingsUpdate = () => {
            fetchBookingsForDate();
            fetchHeatmapData();
        };

        socket.on('courts_updated', fetchAvailability);
        socket.on('bookings_updated', handleBookingsUpdate);

        return () => {
            socket.off('courts_updated', fetchAvailability);
            socket.off('bookings_updated', handleBookingsUpdate);
        };
    }, [fetchAvailability, fetchBookingsForDate, fetchHeatmapData]); // Correct dependencies

    const handleBookingSuccess = () => {
        fetchAvailability();
        fetchBookingsForDate();
    };

    const handleTimeSlotChange = (event) => {
        const [start, end] = event.target.value.split('-');
        setStartTime(start);
        setEndTime(end);
    };

    const handleEditClick = (booking) => { setSelectedBooking(booking); setIsEditModalOpen(true); setError(null); };
    const handleReceiptClick = (booking) => { setSelectedBooking(booking); setIsReceiptModalOpen(true); };
    const handleCloseModal = () => { setIsEditModalOpen(false); setIsReceiptModalOpen(false); setSelectedBooking(null); setError(null); };

    const handleSaveBooking = async (bookingId, bookingData) => {
        try {
            setError(null);
            await api.put(`/bookings/${bookingId}`, bookingData);
            handleCloseModal();
            fetchBookingsForDate(); // Refresh data
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
                fetchBookingsForDate(); // Refresh data
            } catch (cancelError) {
                console.error("Error cancelling booking:", cancelError);
                // Optionally set an error message: setError("Failed to cancel booking.")
            }
        }
    };

    const handleCourtStatusChange = async (courtId, newStatus) => {
        // Optimistically update UI
        const previousAvailability = availability;
        const updatedAvailability = availability.map(court =>
            court.id === courtId ? { ...court, status: newStatus, is_available: newStatus === 'Available' } : court
        );
        setAvailability(updatedAvailability);

        // Send update to backend
        try {
            await api.put(`/courts/${courtId}/status`, { status: newStatus });
            // Optionally show success message
        } catch (statusError) {
            console.error("Error updating court status:", statusError);
            // Revert UI on error
            setAvailability(previousAvailability);
            // Optionally show error message
        }
    };

    const timeSlots = useMemo(() => Array.from({ length: 16 }, (_, i) => {
        const startHour = 6 + i;
        const endHour = startHour + 1;
        const startTimeValue = `${String(startHour).padStart(2, '0')}:00`;
        const endTimeValue = `${String(endHour).padStart(2, '0')}:00`;
        const timeLabel = `${startHour % 12 === 0 ? 12 : startHour % 12}:00 ${startHour < 12 ? 'AM' : 'PM'} - ${endHour % 12 === 0 ? 12 : endHour % 12}:00 ${endHour < 12 ? 'AM' : 'PM'}`;
        // ✅ FIX: Added explicit return
        return { value: `${startTimeValue}-${endTimeValue}`, label: timeLabel };
    }), []); // Empty dependency array is correct here

    // ✅ FIX: Restored full memoized calculation with correct dependencies
    const sortedBookings = useMemo(() => {
        if (!Array.isArray(bookings)) return []; 
        return [...bookings].sort((a, b) => {
            // Basic sort by ID, assuming higher ID is newer
            if (!a || !b) return 0; // Safety check
            return sortOrder === 'desc' ? (b.id || 0) - (a.id || 0) : (a.id || 0) - (b.id || 0);
        });
    }, [bookings, sortOrder]); // Correct dependencies


    return (
        <div className="dashboard-container">
            <h2 className="dashboard-header">Bookings Dashboard</h2>

            {/* Heatmap Section - Button Removed */}
            <div className="dashboard-card heatmap-card">
                 
                 {isHeatmapVisible && <AvailabilityHeatmap heatmapData={heatmapData} onSlotSelect={handleSlotSelect} />}
            </div>

            {/* Main Grid for Core Actions */}
            <div className="dashboard-main-grid">
                {/* Court Status Area */}
                <div className="dashboard-card court-status-card">
                    <h3>Check Availability & Status</h3>
                    {/* ✅ UPDATED: Back to the horizontal layout */}
                    <div className="availability-form">
                        <div className="form-group">
                            <label>Date</label>
                            <input type="date" value={selectedDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setSelectedDate(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Time Slot</label>
                            <select onChange={handleTimeSlotChange} value={`${startTime}-${endTime}`}>
                                {timeSlots.map(slot => <option key={slot.value} value={slot.value}>{slot.label}</option>)}
                            </select>
                        </div>
                         <div className="form-group">
                            <label>Start Time</label>
                            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>End Time</label>
                            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                        </div>
                    </div>
                    <h4 style={{ marginTop: '20px' }}>Court Status</h4>
                    <table className="dashboard-table">
                        <thead><tr><th>Court</th><th>Sport</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            {availability.map(court => (
                                <tr key={court.id}>
                                    <td>{court.name}</td>
                                    <td>{court.sport_name}</td>
                                    <td style={{ color: court.is_available ? 'green' : 'red', fontWeight: '500' }}>
                                        {['Under Maintenance', 'Event', 'Tournament', 'Membership', 'Coaching'].includes(court.status) ? court.status : court.is_available ? (court.capacity > 1 ? `${court.available_slots} / ${court.capacity} available` : 'Available') : 'Engaged'}
                                    </td>
                                    <td><CourtActions court={court} onStatusChange={handleCourtStatusChange} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Booking Form Area */}
                <div className="dashboard-card booking-form-card">
                    <h4>Book a Slot</h4>
                    <BookingForm courts={availability.filter(c => c.is_available)} selectedDate={selectedDate} startTime={startTime} endTime={endTime} onBookingSuccess={handleBookingSuccess} user={user} />
                </div>

                {/* Active Bookings Area */}
                <div className="dashboard-card active-bookings-card">
                    <h4>Active Bookings Now</h4>
                    <ActiveBookings bookings={activeBookings} onRemoveBooking={handleRemoveEndedBooking} />
                </div>

                {/* Daily Bookings Area */}
                <div className="dashboard-card daily-bookings-card">
                     <h3>Bookings for {selectedDate}</h3>
                     <div className="availability-form" style={{ marginBottom: '20px' }}>
                        <div className="form-group">
                            <input type="text" name="sport" placeholder="Filter by sport" value={filters.sport} onChange={handleFilterChange} />
                        </div>
                        <div className="form-group">
                            <input type="text" name="customer" placeholder="Filter by customer" value={filters.customer} onChange={handleFilterChange} />
                        </div>
                        <button onClick={toggleSortOrder} className="btn btn-primary">
                            Sort: {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
                        </button>
                     </div>
                     <BookingList bookings={sortedBookings} onEdit={handleEditClick} onCancel={handleCancelClick} onReceipt={handleReceiptClick} />
                </div>

            </div> {/* End of dashboard-main-grid */}

            {isEditModalOpen && <EditBookingModal booking={selectedBooking} onSave={handleSaveBooking} onClose={handleCloseModal} error={error} />}
            {isReceiptModalOpen && <ReceiptModal booking={selectedBooking} onClose={handleCloseModal} />}
        </div>
    );
};

export default Dashboard;

