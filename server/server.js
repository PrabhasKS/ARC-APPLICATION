const express = require('express');
const cors = require('cors');
require('dotenv').config();
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require("socket.io");

const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Middleware to attach io to the request object
app.use((req, res, next) => {
    req.io = io;
    next();
});

app.use('/api', apiRoutes);

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

console.log("About to start server...");
server.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
