const WebSocket = require('ws');

let socket;


function SetWebSocket(url) {
    socket = new WebSocket(url);
    socket.onopen = function () {
        console.log('Connection Opened');
    };

    socket.onerror = function (error) {
        console.error('Webscket Error: ' + error);
    };

    socket.onmessage = function (msg) {
        console.log(msg.data);
    }
}

// TODO: Remove test functions
function testSend(str) {
    socket.send(str);
}

module.exports = {
    SetWebSocket: SetWebSocket,
    testSend
};