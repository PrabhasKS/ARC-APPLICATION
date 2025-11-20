import axios from 'axios';

const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
});

// Add a request interceptor to include the token in all requests
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, error => {
    return Promise.reject(error);
});

// Add a response interceptor to handle 401/403 errors
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            localStorage.removeItem('token');
            // window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export const login = (credentials) => api.post('/login', credentials);
export const getSports = () => api.get('/sports');
export const getCourts = () => api.get('/courts');
export const getCourtAvailability = (params) => api.get('/courts/availability', { params });
export const getBookings = (date) => api.get('/bookings', { params: { date } });
export const getAllBookings = (params) => api.get('/bookings/all', { params });
export const createBooking = (data) => api.post('/bookings', data);
export const updateBooking = (id, data) => api.put(`/bookings/${id}`, data);
export const cancelBooking = (id) => api.put(`/bookings/${id}/cancel`);
export const updateCourtStatus = (id, status) => api.put(`/courts/${id}/status`, { status });
export const addSport = (data) => api.post('/sports', data);
export const updateSport = (id, data) => api.put(`/sports/${id}`, data);
export const addCourt = (data) => api.post('/courts', data);
export const deleteCourt = (id) => api.delete(`/courts/${id}`);
export const deleteSport = (id) => api.delete(`/sports/${id}`);
export const getActiveBookings = () => api.get('/bookings/active');
export const extendBooking = (id, duration) => api.post(`/bookings/${id}/extend`, { extend_duration: duration });
export const updatePayment = (id, data) => api.put(`/bookings/${id}/payment`, data);
export const getAvailabilityHeatmap = (date) => api.get('/availability/heatmap', { params: { date } });
export const checkClash = (data) => api.post('/bookings/check-clash', data);
export const calculatePrice = (data) => api.post('/bookings/calculate-price', data);
export const addPayment = (id, data) => api.post(`/bookings/${id}/payments`, data);

// Admin
export const getUsers = () => api.get('/admin/users');
export const createUser = (data) => api.post('/admin/users', data);
export const deleteUser = (id) => api.delete(`/admin/users/${id}`);

// Accessories
export const getAccessories = () => api.get('/accessories');
export const createAccessory = (data) => api.post('/accessories', data);
export const updateAccessory = (id, data) => api.put(`/accessories/${id}`, data);
export const deleteAccessory = (id) => api.delete(`/accessories/${id}`);

// Analytics
export const getAnalyticsSummary = (startDate, endDate) => api.get('/analytics/summary', { params: { startDate, endDate } });
export const getDeskSummary = (date) => api.get('/analytics/desk-summary', { params: { date } });
export const getBookingsOverTime = (startDate, endDate) => api.get('/analytics/bookings-over-time', { params: { startDate, endDate } });
export const getRevenueBySport = (startDate, endDate) => api.get('/analytics/revenue-by-sport', { params: { startDate, endDate } });
export const getUtilizationHeatmap = (startDate, endDate) => api.get('/analytics/utilization-heatmap', { params: { startDate, endDate } });
export const getBookingStatusDistribution = (startDate, endDate) => api.get('/analytics/booking-status-distribution', { params: { startDate, endDate } });
export const getRevenueByPaymentMode = (startDate, endDate) => api.get('/analytics/revenue-by-payment-mode', { params: { startDate, endDate } });
export const getStaffPerformance = (startDate, endDate) => api.get('/analytics/staff-performance', { params: { startDate, endDate } });


export default api;