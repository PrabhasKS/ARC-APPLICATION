const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// --- HELMET CONFIGURATION ---
// This secures the app by setting various HTTP headers
const helmetConfig = helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "data:", "https:"],
            "script-src": ["'self'", "'unsafe-inline'"],
        },
    },
});

// --- GLOBAL LIMITER (15 mins) ---
// Protects the general API (GET bookings, ledger, etc.)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 500,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        status: 429,
        message: "Too many requests to the system. Please try again in 15 minutes."
    }
});

// --- AUTH LIMITER (1 min) ---
// Stricter limit specifically for the login route to prevent brute-force
const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        status: 429,
        message: "Too many login attempts. Please wait 1 minute before trying again."
    }
});

module.exports = {
    helmet: helmetConfig,
    globalLimiter,
    authLimiter
};
