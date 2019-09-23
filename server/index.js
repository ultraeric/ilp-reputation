const dbSchema = require('../schema');
const mongoose = require('mongoose');
const node = require('../test-connector');
const WebSocket = require('ws');

const mongoPort = process.env.MONGOPORT || 27017;
const url = 'mongodb://127.0.0.1:' + mongoPort + '/ilp-reputation';
mongoose.connect(url, { useNewUrlParser: true });
const db = mongoose.connection;
db.once('open', _ => {
    console.log('Database connected:', url);
});

db.on('error', err => {
    console.error('connection error:', err);
});


pubkeyinfra = {};

console.log("WS Engaging");

let port = process.env.PORT || 9030;
let wss = new WebSocket.Server({port: port});

wss.on('connection', function (ws, req) {
    ws.on('message', function (packet) {
        let packetID = packet.substring(0, 4);
        console.log('PacketID from client: ' + packetID);
        packet = packet.substring(4);
        console.log('Packet from client: ' + packet);
        if (packetID == '0000') {
            // TODO: Retrieve pubkey from pubkey infrastructure
            console.log('remoteaddr: ' + req.connection.remoteAddress);

            node.ReceivePaymentAgreement(packet, pubkeyinfra[req.connection.remoteAddress]);

        } else if (packetID == '9999') { // TODO: Remove and replace with pubkey infrastructure
            let temp = node.savePubKey(req.connection.remoteAddress, packet);
            pubkeyinfra[temp[0]] = temp[1];
        }

        // TODO: Remove command functions and replace with GUI
        else if (packetID == '9998') {
            node.SetWebSocket(packet);
        } else if (packetID == '9997') {
            node.broadcastPubKey();
        } else if (packetID == '9996') {
            node.SendPaymentAgreement(JSON.parse(packet), 'customPassword');
        }
    });

    ws.on('error', function (err) {
        console.error(err);
    });

    ws.on('close', function () {
        console.log('closing connection');
    });
});

module.exports = {
    node: node
};