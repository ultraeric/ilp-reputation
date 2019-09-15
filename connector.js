const jsrsasign = require('jsrsasign');
const WebSocket = require('ws');

/*(const mongoose = require('mongoose');
const url = 'mongodb://127.0.0.1:27017/network-reputation';
mongoose.connect(url, { useNewUrlParser: true });
const db = mongoose.connection;
db.once('open', _ => {
    console.log('Database connected:', url)
});

db.on('error', err => {
    console.error('connection error:', err)
});

Use Database when building application. For now, use memory

*/

/*
    Notes
    -Abstract away events
    -Abstract away public key infrastructure
    -Abstract payment channel routing
    -JSON.stringify puts "" around strings, leaving vulnerabilities for a receiver to have those quotes unparse
 */

let socket;
const masterKeyPair = jsrsasign.KEYUTIL.generateKeypair("RSA", 2048); // This will be generated on ILP instead

function BroadcastSignedPaymentAgreement() {}

function ReceivePaymentAgreement(serializedPaymentAgreementCertificate) {
    if (serializedPaymentAgreementCertificate.length > 512) {
        let signatureString = serializedPaymentAgreementCertificate.substring(
            serializedPaymentAgreementCertificate.length - 512);
        let serializedPaymentAgreement = serializedPaymentAgreementCertificate.substring(0,
            serializedPaymentAgreementCertificate.length - 512);
    }
}

function SendPaymentAgreement(paymentAgreement, passcode) {
    /*
    -JSON paymentAgreement contains:
    packetID, creditorAddress, debtorAddress, sendorAddress, receiverAddress, ledgerID,
                              ledgerDebtorAddress, ledgerCreditorAddress, signingExpirationTS,
                              activationTS, intervalPayment, intervalDuration, intervalCount, disputeTL,
                              counterDisputeTL, ReputationCalculatorID, originalTS
    */
    let privateKeyObj = jsrsasign.KEYUTIL.getKey(jsrsasign.KEYUTIL.getPEM(masterKeyPair.prvKeyObj, "PKCS8PRV",
        passcode), passcode);
    let signingAlgorithm = new jsrsasign.KJUR.crypto.Signature({"alg":"SHA256withRSA"});
    signingAlgorithm.init(privateKeyObj);
    let serializedPaymentAgreement = JSON.stringify(paymentAgreement);
    signingAlgorithm.updateString(serializedPaymentAgreement);
    let signature = signingAlgorithm.sign(); // All signatures are 512 bytes
    socket.send(serializedPaymentAgreement + signature.toString());
}

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

// TODO: Remove test function
function testSend(str) {
    socket.send(str);
}

module.exports = {
    BroadcastSignedPaymentAgreement: BroadcastSignedPaymentAgreement,
    ReceivePaymentAgreement, ReceivePaymentAgreement,
    SendPaymentAgreement: SendPaymentAgreement,
    SetWebSocket: SetWebSocket,
    testSend: testSend
};