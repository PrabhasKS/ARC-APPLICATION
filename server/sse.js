let clients = [];

const addClient = (client) => {
    clients.push(client);
};

const removeClient = (clientId) => {
    clients = clients.filter(c => c.id !== clientId);
};

const sendEventsToAll = (data) => {
    clients.forEach(client => {
        if (!client.res.finished) {
            client.res.write(`data: ${JSON.stringify(data)}

`);
        }
    });
};

module.exports = {
    addClient,
    removeClient,
    sendEventsToAll
};

