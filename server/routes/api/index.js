const express = require('express');
const router = express.Router();

// Import sub-routers
const authRoutes = require('./auth');
const sportsRoutes = require('./sports');
const courtsRoutes = require('./courts');
const accessoriesRoutes = require('./accessories');
const bookingsRoutes = require('./bookings');
const analyticsRoutes = require('./analytics');
const ledgerRoutes = require('./ledger');
const whatsappRoutes = require('./whatsapp');
const eventsRoutes = require('./events');

// Mount sub-routers
// Sports, Courts, and Accessories have their prefix stripped (e.g. router.get('/'))
// so they are mounted at their respective path prefixes.
router.use('/sports', sportsRoutes);
router.use('/courts', courtsRoutes);
router.use('/accessories', accessoriesRoutes);

// Auth, Bookings, Analytics, Ledger, WhatsApp, and Events still use their
// full path inside the file (e.g. router.get('/bookings', ...)) so they
// are mounted at '/' to preserve the /api/* paths.
router.use('/', eventsRoutes);
router.use('/', authRoutes);
router.use('/', bookingsRoutes);
router.use('/', analyticsRoutes);
router.use('/', ledgerRoutes);
router.use('/', whatsappRoutes);

module.exports = router;
