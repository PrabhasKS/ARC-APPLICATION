const express = require('express');
const cors = require('cors');
require('dotenv').config();
const bodyParser = require('body-parser');
const { helmet, globalLimiter, authLimiter } = require('./middleware/security');

const apiRoutes = require('./routes/api');
const membershipRoutes = require('./routes/memberships');

const app = express();
const PORT = process.env.PORT || 5000;

// If you are behind a proxy (Railway, Heroku, etc.), set this
app.set('trust proxy', 1);

// Security Middlewares
app.use(helmet);
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Rate Limiting
app.use('/api/login', authLimiter); // Stricter limit for login
app.use('/api/', globalLimiter);    // General limit for everything else

app.use('/api', apiRoutes);
app.use('/api/memberships', membershipRoutes);

console.log("About to start server...");
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
