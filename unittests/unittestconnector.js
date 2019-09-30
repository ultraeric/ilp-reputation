const con = require('../connector');
const jsrsasign = require('jsrsasign');
const SortedArray = require('sorted-array');

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


signingConfig = {
    signatureLength: 512,
    algorithm:"SHA256withRSA"
};

publicKeyInfrastructure['12345'] = jsrsasign.KEYUTIL.getPEM(masterKeyPair.pubKeyObj);
publicKeyInfrastructure['54321'] = jsrsasign.KEYUTIL.getPEM(masterKeyPair2.pubKeyObj);
supportedReputationCalculators.add(0);
let proposal = con.sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: Date.now() + 200,
    paymentTL: 8, disputeTL: 10, debtorAddress: '12345', creditorAddress: '54321',
    expirationTS: Date.now() + 100}, "passcode", signingConfig);
let paymentAgreementHash = identifyPacket(proposal, signingConfig);
con.identifyPacket(proposal, signingConfig);

con.detectPayments(paymentAgreementHash, "passcode2", signingConfig).then((packet) => {
    console.log(packet);
});

const debt = {
    ts: Date.now()
};

const dispute = {
    paymentAgreement: JSON.stringify(acceptedCreditorPaymentAgreements[paymentAgreementHash][0]) + acceptedCreditorPaymentAgreements[paymentAgreementHash][1],
    debt: debt
};