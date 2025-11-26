const express = require('express');
const cors = require('cors');
require('dotenv').config();
const bodyParser = require('body-parser');

const apiRoutes = require('./routes/api');
const membershipRoutes = require('./routes/memberships');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/api', apiRoutes);
app.use('/api/memberships', membershipRoutes);

console.log("About to start server...");
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
