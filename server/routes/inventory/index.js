const express = require('express');
const router = express.Router();

const stockRoutes = require('./stock');
const standaloneRoutes = require('./standalone');
const returnsRoutes = require('./returns');
const analyticsRoutes = require('./analytics');

router.use('/accessories', stockRoutes);
router.use('/standalone-sales', standaloneRoutes);
router.use('/returns', returnsRoutes);
router.use('/', analyticsRoutes);

module.exports = router;
