const express = require('express');
const router = express.Router();
const sse = require('../../sse');

router.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();

    const clientId = Date.now();
    const newClient = {
        id: clientId,
        res
    };
    sse.addClient(newClient);

    req.on('close', () => {
        sse.removeClient(clientId);
    });
});

module.exports = router;
