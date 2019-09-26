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

const publicKeyInfrastructure = {}; // Maps IP addresses to verifying public key
const supportedReputationCalculators = new Set();
const pendingDebtorPaymentAgreements = {};
const expiringPendingDebtorPaymentAgreements = new SortedArray([], compareExpiration);
const acceptedCreditorPaymentAgreements = {};
const expiringAcceptedCreditorPaymentAgreements = new SortedArray([], compareExpiration);
const disputeHashes = {};

const masterKeyPair = jsrsasign.KEYUTIL.generateKeypair("RSA", 2048); // TODO: This will be generated on ILP instead

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
        return ReceivePaymentAgreementProposal(packet.substring(4));
    }
}

function isAcceptablePaymentAgreementProposal(paymentAgreement, serializedPaymentAgreement, signature) {
    const publicKey = publicKeyInfrastructure[paymentAgreement.creditorAddress];
    const publicKeyObj = jsrsasign.KEYUTIL.getKey(publicKey);
    const signingAlgorithm = new jsrsasign.KJUR.crypto.Signature({"alg": "SHA256withRSA"});
    signingAlgorithm.init(publicKeyObj);
    signingAlgorithm.updateString(serializedPaymentAgreement);
    if (supportedReputationCalculators.has(paymentAgreement.reputationCalculatorID) &&
        paymentAgreement.activationTS < Date.now() + activationTSThreshold &&
        signingAlgorithm.verify(signature)) {
        return true;
    }
    // If payment agreement matches criteria and debtor's reputation is sufficient, return true
    return false;
}

function ReceivePaymentAgreementProposal(serializedPaymentAgreementCertificate) {
    if (serializedPaymentAgreementCertificate.length > 512) {
        const signature = serializedPaymentAgreementCertificate.substring(
            serializedPaymentAgreementCertificate.length - 512);
        const serializedPaymentAgreement = serializedPaymentAgreementCertificate.substring(0,
            serializedPaymentAgreementCertificate.length - 512);
        const paymentAgreement = JSON.parse(serializedPaymentAgreement);
        if (isAcceptablePaymentAgreementProposal(paymentAgreement, serializedPaymentAgreement, signature)) {
            console.log('signature valid and agreement accepted');
            const md = new jsrsasign.KJUR.crypto.MessageDigest({alg: "sha1", prov: "cryptojs"});
            md.updateString(serializedPaymentAgreement);
            const paymentAgreementHash = md.digest();
            if (!(paymentAgreementHash in acceptedCreditorPaymentAgreements)) {
                acceptedCreditorPaymentAgreements[paymentAgreementHash] = paymentAgreement;
                expiringAcceptedCreditorPaymentAgreements.insert([paymentAgreement.intervalDuration *
                paymentAgreement.intervalCount + paymentAgreement.disputeTL, paymentAgreementHash]);
                // Proceeds to send another payment agreement to the next connector in the path and then wait for its
                // response before sending back a signed payment agreement back to the previous connector
            }
            else {
                console.log('repeat packet');
            }
        } else {
            console.log('unacceptable agreement');
            // Send ILP reject packet
        }
    }
}

function sendPaymentAgreementProposal(paymentAgreement, passcode) {
    /*
    -JSON paymentAgreement contains:
    UUID, creditorAddress, debtorAddress, sendorAddress, receiverAddress, ledgerID,
                              ledgerDebtorAddress, ledgerCreditorAddress,
                              activationTS, intervalPayment, intervalDuration, intervalCount, disputeTL,
                              counterDisputeTL, ReputationCalculatorID
    */
    let serializedPaymentAgreement = JSON.stringify(paymentAgreement);
    const md = new jsrsasign.KJUR.crypto.MessageDigest({alg: "sha1", prov: "cryptojs"});
    md.updateString(serializedPaymentAgreement);
    const paymentAgreementHash = md.digest();
    if (!(paymentAgreementHash in pendingDebtorPaymentAgreements)) {
        let privateKeyObj = jsrsasign.KEYUTIL.getKey(jsrsasign.KEYUTIL.getPEM(masterKeyPair.prvKeyObj, "PKCS8PRV",
            passcode), passcode);
        let signingAlgorithm = new jsrsasign.KJUR.crypto.Signature({"alg": "SHA256withRSA"});
        signingAlgorithm.init(privateKeyObj);
        signingAlgorithm.updateString(serializedPaymentAgreement);
        let signature = signingAlgorithm.sign();
        pendingDebtorPaymentAgreements[paymentAgreementHash] = paymentAgreement;
        expiringPendingDebtorPaymentAgreements.insert([paymentAgreement.intervalDuration *
            paymentAgreement.intervalCount + paymentAgreement.disputeTL, paymentAgreementHash]);
        // Send '0000' + serializedPaymentAgreement + signature
        return '0000' + serializedPaymentAgreement + signature;
    }
}

publicKeyInfrastructure['12345'] = jsrsasign.KEYUTIL.getPEM(masterKeyPair.pubKeyObj);
supportedReputationCalculators.add(0);
let proposal = sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: Date.now() + 10,
    intervalDuration: 1, intervalCount: 3, disputeTL: 3, creditorAddress: '12345'});
identifyPacket(proposal);