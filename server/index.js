const getNode = require('../connector');
let node;
(async function () {
    node = await getNode;
    console.log('Database Activated');
})();

let Server = require('ws').Server;
let port = process.env.PORT || 9030;
let ws = new Server({port: port});

ws.on('connection', function (w) {
    w.on('message', function (packet) {
        console.log('Packet from client: ' + packet);
        let packetID = packet[0];
        packet = packet.substring(1);
        if(packetID == '0') {
            node.ReceivePaymentAgreement(packet);
        }
    });

    w.on('error', function (err) {
        console.error(err);
    });

    w.on('close', function () {
        console.log('closing connection');
    });

});

module.exports = {
    node: node
};