/**
 * Inventory API helper — wraps the shared axios instance from api.js
 * This ensures inventory requests use the same base URL and auth interceptor
 * as the rest of the application.
 */
import api from '../../api';

// Accessories
export const getAccessories = () => api.get('/inventory/accessories');
export const createAccessory = (data) => api.post('/inventory/accessories', data);
export const updateAccessory = (id, data) => api.put(`/inventory/accessories/${id}`, data);
export const deleteAccessory = (id) => api.delete(`/inventory/accessories/${id}`);
export const restockAccessory = (id, data) => api.post(`/inventory/accessories/${id}/restock`, data);
export const discardAccessory = (id, data) => api.post(`/inventory/accessories/${id}/discard`, data);

// Standalone Sales
export const getStandaloneSales = (params) => api.get('/inventory/standalone-sales', { params });
export const getStandaloneSale = (id) => api.get(`/inventory/standalone-sales/${id}`);
export const createStandaloneSale = (data) => api.post('/inventory/standalone-sales', data);
export const addSalePayment = (id, data) => api.post(`/inventory/standalone-sales/${id}/payment`, data);
export const getSaleReceiptUrl = (id) => `${api.defaults.baseURL}/inventory/standalone-sales/${id}/receipt.pdf`;

// Returns
export const getPendingReturns = () => api.get('/inventory/returns/pending');
export const getReturns = (params) => api.get('/inventory/returns', { params });
export const processReturn = (data) => api.post('/inventory/returns', data);

// Analytics
export const getAnalyticsSummary = (params) => api.get('/inventory/analytics/summary', { params });
export const getStandaloneRevenue = (params) => api.get('/inventory/analytics/standalone-revenue', { params });
export const getBookingRevenue = (params) => api.get('/inventory/analytics/booking-accessory-revenue', { params });
export const getRevenueByAccessory = (params) => api.get('/inventory/analytics/revenue-by-accessory', { params });
export const getRentalVsSale = (params) => api.get('/inventory/analytics/rental-vs-sale', { params });
export const getStockAlerts = () => api.get('/inventory/analytics/stock-alerts');
