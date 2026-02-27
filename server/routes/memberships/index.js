const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');

// Apply authentication middleware to all routes in this module
router.use(authenticateToken);

// Import sub-routers
const packagesRoutes = require('./packages');
const membersRoutes = require('./members');
const subscriptionsRoutes = require('./subscriptions');
const leavesRoutes = require('./leaves');
const holidaysRoutes = require('./holidays');
const attendanceRoutes = require('./attendance');

// Mount sub-routers
// All sub-routers keep their original path prefixes (e.g. router.get('/packages', ...))
// so they are mounted at '/' to preserve the /api/memberships/* paths.
router.use('/', packagesRoutes);
router.use('/', membersRoutes);
router.use('/', subscriptionsRoutes);
router.use('/', leavesRoutes);
router.use('/', holidaysRoutes);
router.use('/', attendanceRoutes);

// Test route
router.get('/test', (req, res) => {
    res.json({ message: 'Membership route is working!' });
});

module.exports = router;
