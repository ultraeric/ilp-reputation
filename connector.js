const dbSchema = require('./schema');
const jsrsasign = require('jsrsasign');
const mongoose = require('mongoose');
const WebSocket = require('ws');

/*
    Notes
    -Abstract away events
    -Abstract away public key infrastructure
    -Abstract payment channel routing
    -JSON.stringify puts "" around strings, leaving vulnerabilities for a receiver to have those quotes unparse
 */

let socket;
const masterKeyPair = jsrsasign.KEYUTIL.generateKeypair("RSA", 2048); // TODO: This will be generated on ILP instead
IPPublicKeyPair = mongoose.model('IPPublicKeyPair', dbSchema.IPPublicKeyPairSchema); // TODO: Replace


function BroadcastPaymentAgreementConsent() {
}

function ReceivePaymentAgreement(serializedPaymentAgreementCertificate, publicKey) {
    if (serializedPaymentAgreementCertificate.length > 512) {
        let signature = serializedPaymentAgreementCertificate.substring(
            serializedPaymentAgreementCertificate.length - 512);
        let serializedPaymentAgreement = serializedPaymentAgreementCertificate.substring(0,
            serializedPaymentAgreementCertificate.length - 512);
        let publicKeyObj = jsrsasign.KEYUTIL.getKey(publicKey);
        let signingAlgorithm = new jsrsasign.KJUR.crypto.Signature({"alg": "SHA256withRSA"});
        signingAlgorithm.init(publicKeyObj);
        signingAlgorithm.updateString(serializedPaymentAgreement);
        if (signingAlgorithm.verify(signature)) {
            console.log('signature valid');
        }
        else {
            console.log('invalid signature');
        }
    }
}

function SendPaymentAgreement(paymentAgreement, passcode) {
    /*
    -JSON paymentAgreement contains:
    creditorAddress, debtorAddress, sendorAddress, receiverAddress, ledgerID,
                              ledgerDebtorAddress, ledgerCreditorAddress, signingExpirationTS,
                              activationTS, intervalPayment, intervalDuration, intervalCount, disputeTL,
                              counterDisputeTL, ReputationCalculatorID, originalTS
    */
    let privateKeyObj = jsrsasign.KEYUTIL.getKey(jsrsasign.KEYUTIL.getPEM(masterKeyPair.prvKeyObj, "PKCS8PRV",
        passcode), passcode);
    let signingAlgorithm = new jsrsasign.KJUR.crypto.Signature({"alg": "SHA256withRSA"});
    signingAlgorithm.init(privateKeyObj);
    let serializedPaymentAgreement = JSON.stringify(paymentAgreement);
    signingAlgorithm.updateString(serializedPaymentAgreement);
    let signature = signingAlgorithm.sign(); // All signatures are 512 bytes
    socket.send('0000' + serializedPaymentAgreement + signature);
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

// TODO: Remove test functions

function broadcastPubKey() {
    // 9997
    console.log(jsrsasign.KEYUTIL.getPEM(masterKeyPair.pubKeyObj));
    socket.send('9999' + jsrsasign.KEYUTIL.getPEM(masterKeyPair.pubKeyObj));
}

function savePubKey(ipAddress, publicKey) {
    // 9999
    var IPPublicKeyPairRecord = new IPPublicKeyPair({
        ipAddress,
        publicKey
    });
    console.log(IPPublicKeyPairRecord);
    IPPublicKeyPairRecord.save((err) => {
        if (err) {
            console.log('publicKey save unsuccessful: ' + err);
        }
    });
}

module.exports = {
    BroadcastPaymentAgreementConsent,
    ReceivePaymentAgreement,
    SendPaymentAgreement,
    SetWebSocket,
    // TODO: Remove test functions
    broadcastPubKey,
    savePubKey,
    IPPublicKeyPair
};