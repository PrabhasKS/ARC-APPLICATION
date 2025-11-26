const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // if there isn't any token

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("JWT Verification Error:", err.message);
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Requires admin privileges' });
    }
    next();
};

// Middleware to check for 'admin' or 'desk' roles
const isPrivilegedUser = (req, res, next) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'desk')) {
        return res.status(403).json({ message: 'Forbidden: Requires admin or desk privileges' });
    }
    next();
};

module.exports = {
    authenticateToken,
    isAdmin,
    isPrivilegedUser
};
