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

class Connector {

}

const publicKeyInfrastructure = {}; // Maps IP addresses to verifying public key
const reputationTable = {};
const supportedReputationCalculators = new Set();
const pendingDebtorPaymentAgreements = {};
const acceptedCreditorPaymentAgreements = {};
const disputes = {};
const disputeHashes = {};

const masterKeyPair = jsrsasign.KEYUTIL.generateKeypair("RSA", 2048); // TODO: This will be generated on ILP instead
const masterKeyPair2 = jsrsasign.KEYUTIL.generateKeypair("RSA", 2048);

let activationTSThreshold = 1;

function compareExpiration(expirationAndPaymentAgreementHashPair1, expirationAndPaymentAgreementHashPair2) {
    return expirationAndPaymentAgreementHashPair1[0] - expirationAndPaymentAgreementHashPair2[0]
}

function getNextConnector() {
    // Gets the next connector in the payment path
}

function identifyPacket(packet, signingConfig) {
    if (packet.substring(0, 4) == '0000') {
        console.log('paymentAgreement');
        return ReceivePaymentAgreementProposal(packet.substring(4), signingConfig);
    } else if (packet.substring(0, 4) == '0003') {
        console.log('broadcastedDispute');
        return receiveBroadcastDispute(packet.substring(4), signingConfig);
    }
}

function isAcceptablePaymentAgreementProposal(paymentAgreement, serializedPaymentAgreement, signature, signingConfig) {
    const publicKey = publicKeyInfrastructure[paymentAgreement.debtorAddress];
    const publicKeyObj = jsrsasign.KEYUTIL.getKey(publicKey);
    if (supportedReputationCalculators.has(paymentAgreement.reputationCalculatorID) &&
        //paymentAgreement.activationTS > Date.now() + activationTSThreshold &&
        verifyingAlgorithm(publicKeyObj, serializedPaymentAgreement, signature, signingConfig.algorithm)) {
        return true;
    }
    // If payment agreement matches criteria and debtor's reputation is sufficient, return true
    return false;
}

function ReceivePaymentAgreementProposal(serializedPaymentAgreementCertificate, signingConfig) {
    /*
        -signingConfig JSON:
        signatureLength, algorithm
     */
    if (serializedPaymentAgreementCertificate.length > signingConfig.signatureLength) {
        const signature = serializedPaymentAgreementCertificate.substring(
            serializedPaymentAgreementCertificate.length - signingConfig.signatureLength);
        const serializedPaymentAgreement = serializedPaymentAgreementCertificate.substring(0,
            serializedPaymentAgreementCertificate.length - signingConfig.signatureLength);
        const paymentAgreement = JSON.parse(serializedPaymentAgreement);
        if (isAcceptablePaymentAgreementProposal(paymentAgreement, serializedPaymentAgreement, signature, signingConfig)) {
            console.log('signature valid');
            const paymentAgreementHash = hashingAlgorithm(serializedPaymentAgreement, "sha1",
                "cryptojs");
            if (!(paymentAgreementHash in acceptedCreditorPaymentAgreements)) {
                acceptedCreditorPaymentAgreements[paymentAgreementHash] = [paymentAgreement, signature];
                // Proceeds to send another payment agreement to the next connector in the path and then wait for its
                // response before sending back a signed payment agreement back to the previous connector
                return paymentAgreementHash;
            }
            else {
                console.log('repeat paymentagreement packet');
            }
        } else {
            console.log('unacceptable agreement');
            // Send ILP reject packet
        }
    }
}

function sendPaymentAgreementProposal(paymentAgreement, passcode, signingConfig) {
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
        const privateKeyObj = jsrsasign.KEYUTIL.getKey(jsrsasign.KEYUTIL.getPEM(masterKeyPair.prvKeyObj, "PKCS8PRV",
            passcode), passcode);
        const signature = signingAlgorithm(privateKeyObj, serializedPaymentAgreement, signingConfig.algorithm);
        pendingDebtorPaymentAgreements[paymentAgreementHash] = paymentAgreement;
        // Send '0000' + serializedPaymentAgreement + signature
        return '0000' + serializedPaymentAgreement + signature;
    }
}

async function detectPayments(paymentAgreementHash, passcode, signingConfig) {
    const paymentAgreementAndSignature = acceptedCreditorPaymentAgreements[paymentAgreementHash];
    // Loop through payments starting from activation timestamp and see if payments added up
    // If not all payments add up, dispute remaining amount automatically
    let missingPayments = 10;
    console.log(paymentAgreementAndSignature);
    return broadcastDispute(createDisputePacket(paymentAgreementAndSignature[0], paymentAgreementAndSignature[1],
        missingPayments), passcode, signingConfig);
    //Exits and does no broadcast if missingPayments reaches 0
}

function createDisputePacket(paymentAgreement, debtorSignature, missingPayments) {
    return {
        paymentAgreement: paymentAgreement,
        debtorSignature: debtorSignature,
        missingPayments: missingPayments
    }
}

function broadcastDispute(dispute, passcode, signingConfig) {
    /*
        -JSON dispute contains:
        PaymentAgreement, debtorSignature, missingPayments
     */
    const serializedDispute = JSON.stringify(dispute);
    const privateKeyObj = jsrsasign.KEYUTIL.getKey(jsrsasign.KEYUTIL.getPEM(masterKeyPair.prvKeyObj, "PKCS8PRV",
        passcode), passcode);
    const signature = signingAlgorithm(privateKeyObj, serializedDispute, signingConfig.signingAlgorithm);
    // Send instead of return
    return '0003' + serializedDispute + signature;
}

function isAcceptableDispute(dispute, serializedDispute, disputeSignature,  paymentAgreement, serializedPaymentAgreement, paymentAgreementSignature, signingConfig) {
    const debtorPublicKey = publicKeyInfrastructure[paymentAgreement.debtorAddress];
    const debtorPublicKeyObj = jsrsasign.KEYUTIL.getKey(debtorPublicKey);
    const creditorPublicKey = publicKeyInfrastructure[paymentAgreement.creditorAddress];
    const creditorPublicKeyObj = jsrsasign.KEYUTIL.getKey(creditorPublicKey);
    if (supportedReputationCalculators.has(paymentAgreement.reputationCalculatorID) &&
        verifyingAlgorithm(debtorPublicKeyObj, serializedPaymentAgreement, paymentAgreementSignature, signingConfig.algorithm) &&
        verifyingAlgorithm(creditorPublicKeyObj, serializedDispute, disputeSignature, signingConfig.algorithm) &&
        dispute.debt.ts + paymentAgreement.paymentTL < Date.now() &&
        dispute.debt.ts + paymentAgreement.paymentTL + paymentAgreement.disputeTL > Date.now() &&
        dispute.debt.ts > paymentAgreement.activationTS &&
        dispute.debt.ts < paymentAgreement.expirationTS
    ) {
        return true;
    }
    return false;
}

function receiveBroadcastDispute(serializedDisputeCertificate, signingConfig) {
    if (serializedDisputeCertificate.length > signingConfig.signatureLength) {
        const disputeSignature = serializedDisputeCertificate.substring(
            serializedDisputeCertificate.length - signingConfig.signatureLength);
        const serializedDispute = serializedDisputeCertificate.substring(0,
            serializedDisputeCertificate.length - signingConfig.signatureLength);
        const dispute = JSON.parse(serializedDisputeCertificate);
        if (dispute.paymentAgreement.length > signingConfig.signatureLength) {
            const paymentAgreementSignature = dispute.paymentAgreement.substring(
                serializedDisputeCertificate.length - signingConfig.signatureLength);
            const serializedPaymentAgreement = dispute.paymentAgreement.substring(0,
                serializedDisputeCertificate.length - signingConfig.signatureLength);
            const paymentAgreement = JSON.parse(serializedPaymentAgreement);
            if (isAcceptableDispute(dispute, serializedDispute, disputeSignature, paymentAgreement, serializedPaymentAgreement, paymentAgreementSignature, signingConfig)) {
                console.log('agreement signature valid and dispute valid');
                const disputeHash = hashingAlgorithm(serializedDispute, "sha1",
                    "cryptojs");
                if (!(disputeHash in disputes)) {
                    disputes[disputeHash] = dispute;
                    return disputeHash;
                }
                else {
                    console.log('repeat dispute packet');
                }
            } else {
                console.log('unacceptable dispute');
                // Send ILP reject packet
            }
        }
    }
}

function signingAlgorithm(prvKey, str, algorithm) {
    const signingAlgorithm = new jsrsasign.KJUR.crypto.Signature({"alg": algorithm});
    signingAlgorithm.init(prvKey);
    signingAlgorithm.updateString(str);
    return signingAlgorithm.sign();
}

function verifyingAlgorithm(pubKey, str, signature, algorithm) {
    const signingAlgorithm = new jsrsasign.KJUR.crypto.Signature({"alg": algorithm});
    signingAlgorithm.init(pubKey);
    signingAlgorithm.updateString(str);
    return signingAlgorithm.verify(signature);
}

function hashingAlgorithm(str, algorithm, prov) {
    const md = new jsrsasign.KJUR.crypto.MessageDigest({alg: algorithm, prov: prov});
    md.updateString(str);
    return md.digest();
}

signingConfig = {
    signatureLength: 512,
    algorithm:"SHA256withRSA"
};
/*
publicKeyInfrastructure['12345'] = jsrsasign.KEYUTIL.getPEM(masterKeyPair.pubKeyObj);
publicKeyInfrastructure['54321'] = jsrsasign.KEYUTIL.getPEM(masterKeyPair2.pubKeyObj);

supportedReputationCalculators.add(0);
let proposal = sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: Date.now() + 200,
    paymentTL: 8, disputeTL: 10, debtorAddress: '12345', creditorAddress: '54321',
    expirationTS: Date.now() + 100}, "passcode", signingConfig);
let paymentAgreementHash = identifyPacket(proposal, signingConfig);
identifyPacket(proposal, signingConfig);

detectPayments(paymentAgreementHash, "passcode2", signingConfig).then((packet) => {
    console.log(packet);
});

const debt = {
    ts: Date.now()
};

const dispute = {
    paymentAgreement: JSON.stringify(acceptedCreditorPaymentAgreements[paymentAgreementHash][0]) + acceptedCreditorPaymentAgreements[paymentAgreementHash][1],
    debt: debt
};*/



