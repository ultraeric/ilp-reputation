/*
    Notes
    -Abstract away events
    -Abstract away public key infrastructure
    -Abstract payment channel routing
    -Packets are temporarily replaced with JSON
    -Replace signature algorithm with ILP's signature algorithm
    -JSON.stringify puts "" around strings, leaving vulnerabilities for a receiver to have those quotes unparse
*/
const jsrsasign = require('jsrsasign');
const SortedArray = require('sorted-array');

const masterKeyPair = jsrsasign.KEYUTIL.generateKeypair("RSA", 2048); // TODO: This will be generated on ILP instead
const publicKeyInfrastructure = {}; // Maps IP addresses to verifying public key
const supportedReputationCalculators = new Set();
const pendingPaymentAgreements = {};
const expiringPendingPaymentAgreements = new SortedArray([], compareExpiration);
const disputeHashes = {};

let activationTSThreshold = 1;

function compareExpiration(expirationAndPaymentAgreementHashPair1, expirationAndPaymentAgreementHashPair2) {
    return expirationAndPaymentAgreementHashPair1[0] - expirationAndPaymentAgreementHashPair2[0]
}

function getNextConnector() {
    // Gets the next connector in the payment path
}

function identifyPacket(packet) {
    if (packet.substring(0, 4) == '0000') {
        console.log('paymentAgreement');
        ReceivePaymentAgreement(packet);
    }
}

function isAcceptablePaymentAgreement(paymentAgreement) {
    const publicKey = publicKeyInfrastructure[paymentAgreement.creditorAddress];
    const publicKeyObj = jsrsasign.KEYUTIL.getKey(publicKey);
    const signingAlgorithm = new jsrsasign.KJUR.crypto.Signature({"alg": "SHA256withRSA"});
    signingAlgorithm.init(publicKeyObj);
    signingAlgorithm.updateString(serializedPaymentAgreement);
    if (paymentAgreement.reputationCalculatorID in supportedReputationCalculators &&
        paymentAgreement.activationTS < Date.now() + activationTSThreshold &&
        signingAlgorithm.verify(signature)) {
        return true;
    }
    // If payment agreement matches criteria and debtor's reputation is sufficient, return true
    return false;
}

function isValidPaymentAgreement(serializedPaymentAgreement, paymentAgreement, signature) {


    if (signingAlgorithm.verify(signature) && ) {
        return true;
    }
}

function ReceivePaymentAgreement(serializedPaymentAgreementCertificate) {
    if (serializedPaymentAgreementCertificate.length > 512) {
        const signature = serializedPaymentAgreementCertificate.substring(
            serializedPaymentAgreementCertificate.length - 512);
        const serializedPaymentAgreement = serializedPaymentAgreementCertificate.substring(0,
            serializedPaymentAgreementCertificate.length - 512);
        const paymentAgreement = JSON.parse(serializedPaymentAgreement);
        if (isAcceptablePaymentAgreement(paymentAgreement) && isValidPaymentAgreement(serializedPaymentAgreement,
            paymentAgreement, signature)) {
            console.log('signature valid and agreement accepted');
        } else {
            console.log('invalid signature');
            // Send ILP reject packet
        }
    }
}

function sendPaymentAgreement(paymentAgreement, passcode) {
    /*
    -JSON paymentAgreement contains:
    UUID, creditorAddress, debtorAddress, sendorAddress, receiverAddress, ledgerID,
                              ledgerDebtorAddress, ledgerCreditorAddress, signingExpirationTS,
                              activationTS, intervalPayment, intervalDuration, intervalCount, disputeTL,
                              counterDisputeTL, ReputationCalculatorID
    */
    let serializedPaymentAgreement = JSON.stringify(paymentAgreement);
    const md = new KJUR.crypto.MessageDigest({alg: "sha1", prov: "cryptojs"});
    md.updateString(serializedPaymentAgreement);
    let paymentAgreementHash = md.digest();
    if (!(paymentAgreementHash in pendingPaymentAgreements)) {
        let privateKeyObj = jsrsasign.KEYUTIL.getKey(jsrsasign.KEYUTIL.getPEM(masterKeyPair.prvKeyObj, "PKCS8PRV",
            passcode), passcode);
        let signingAlgorithm = new jsrsasign.KJUR.crypto.Signature({"alg": "SHA256withRSA"});
        signingAlgorithm.init(privateKeyObj);
        signingAlgorithm.updateString(serializedPaymentAgreement);
        let signature = signingAlgorithm.sign();
        pendingPaymentAgreements[paymentAgreementHash] = paymentAgreement;
        expiringPendingPaymentAgreements.insert([paymentAgreement.signingExpirationTS, paymentAgreementHash]);
        // Send '0000' + serializedPaymentAgreement + signature
        return '0000' + serializedPaymentAgreement + signature;
    }
}



supportedReputationCalculators.add(0);
sendPaymentAgreement({reputationCalculatorID: 0, signingExpirationTS: Date.now() + 10, });