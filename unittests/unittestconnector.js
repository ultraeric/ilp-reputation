const con = require('../connector');
const jsrsasign = require('jsrsasign');
const SortedArray = require('sorted-array');
var assert= require('assert');

describe('#paymentAgreements', function() {
    let debtor;
    let creditor;
    let thirdNode;
    let signingConfig;
    beforeEach(function() {
        const masterKeyPair1 = jsrsasign.KEYUTIL.generateKeypair("RSA", 2048);
        const masterKeyPair2 = jsrsasign.KEYUTIL.generateKeypair("RSA", 2048);
        const masterKeyPair3 = jsrsasign.KEYUTIL.generateKeypair("RSA", 2048);

        const activationTSThreshold = 1;
        signingConfig = {
            signatureLength: 512,
            algorithm:"SHA256withRSA"
        };

        debtor = new con.Connector(masterKeyPair1, signingConfig, activationTSThreshold, '12345');
        creditor = new con.Connector(masterKeyPair2, signingConfig, activationTSThreshold, '54321');
        thirdNode = new con.Connector(masterKeyPair3, signingConfig, activationTSThreshold, '55555');

        const publicKeyInfrastructure = {};
        publicKeyInfrastructure['12345'] = jsrsasign.KEYUTIL.getPEM(debtor.masterKeyPair.pubKeyObj);
        publicKeyInfrastructure['54321'] = jsrsasign.KEYUTIL.getPEM(creditor.masterKeyPair.pubKeyObj);
        publicKeyInfrastructure['55555'] = jsrsasign.KEYUTIL.getPEM(creditor.masterKeyPair.pubKeyObj);

        debtor.publicKeyInfrastructure = publicKeyInfrastructure;
        creditor.publicKeyInfrastructure = publicKeyInfrastructure;
        thirdNode.publicKeyInfrastructure = publicKeyInfrastructure;

        const supportedReputationCalculators = new Set();
        supportedReputationCalculators.add(0);

        debtor.supportedReputationCalculators = supportedReputationCalculators;
        creditor.supportedReputationCalculators = supportedReputationCalculators;
        thirdNode.supportedReputationCalculators = supportedReputationCalculators;
    });

    it('Valid signature on proposal', function() {
        const proposal = debtor.sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: Date.now() + 200,
            paymentTL: 8, disputeTL: 10, debtorAddress: '12345', creditorAddress: '54321',
            expirationTS: Date.now() + 100}, "passcode", signingConfig);
        const paymentAgreementHash = creditor.identifyPacket(proposal, signingConfig);
        assert(paymentAgreementHash != false);
    });

    it('Invalid creditor on proposal', function() {
        const proposal = debtor.sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: Date.now() + 200,
            paymentTL: 8, disputeTL: 10, debtorAddress: '12345', creditorAddress: '55',
            expirationTS: Date.now() + 100}, "passcode", signingConfig);
        const paymentAgreementHash = creditor.identifyPacket(proposal, signingConfig);
        assert.equal(paymentAgreementHash, false);
    });

    it('Invalid signature on proposal', function() {
        const proposal = debtor.sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: Date.now() + 200,
            paymentTL: 8, disputeTL: 10, debtorAddress: '54321', creditorAddress: '54321',
            expirationTS: Date.now() + 100}, "passcode", signingConfig);
        const paymentAgreementHash = creditor.identifyPacket(proposal, signingConfig);
        assert.equal(paymentAgreementHash, false);
    });

    it('payment detection and broadcastDisputeNoError', function() {
        const proposal = debtor.sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: Date.now() + 200,
            paymentTL: 8, disputeTL: 10, debtorAddress: '12345', creditorAddress: '54321',
            expirationTS: Date.now() + 100}, "passcode", signingConfig);
        const paymentAgreementHash = creditor.identifyPacket(proposal, signingConfig);
        creditor.detectPayments(paymentAgreementHash, "passcode", signingConfig).then((packet) => {
            console.log(packet);
        });
    });

    it('receiveBroadcastDispute invalid signature on payment agreement', function () {
        let proposal = debtor.sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: Date.now() + 200,
            paymentTL: 8, disputeTL: 10, debtorAddress: '12345', creditorAddress: '54321',
            expirationTS: Date.now() + 100}, "passcode", signingConfig);
        let paymentAgreementHash = creditor.identifyPacket(proposal, signingConfig);
        let proposalFake = creditor.sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: Date.now() + 200,
            paymentTL: 8, disputeTL: 10, debtorAddress: '54321', creditorAddress: '54321',
            expirationTS: Date.now() + 100}, "passcode", signingConfig);
        let paymentAgreementHashFake = creditor.identifyPacket(proposalFake, signingConfig);
        const dispute = creditor.createDisputePacket(
            creditor.acceptedCreditorPaymentAgreements[paymentAgreementHash][0],
            creditor.acceptedCreditorPaymentAgreements[paymentAgreementHashFake][1],
            2, { ts: Date.now() });
        const broadcastedDisputePacket = creditor.broadcastDispute(dispute,
            "passcode", signingConfig);
        const disputeHash = thirdNode.identifyPacket(broadcastedDisputePacket, signingConfig);
        assert.equal(disputeHash, false);
    });

    it('receiveBroadcastDispute valid dispute', function() {
        currentTime = Date.now();
        let proposal = debtor.sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: currentTime + 200,
            paymentTL: 1, disputeTL: 10, debtorAddress: '12345', creditorAddress: '54321',
            expirationTS: currentTime + 500}, "passcode", signingConfig);
        let paymentAgreementHash = creditor.identifyPacket(proposal, signingConfig);
        (async function() {
            await sleep(1);
            const dispute = creditor.createDisputePacket(
                creditor.acceptedCreditorPaymentAgreements[paymentAgreementHash][0],
                creditor.acceptedCreditorPaymentAgreements[paymentAgreementHash][1],
                2, { ts: currentTime + 201 });
            const broadcastedDisputePacket = creditor.broadcastDispute(dispute,
                "passcode", signingConfig);
            const disputeHash = thirdNode.identifyPacket(broadcastedDisputePacket, signingConfig);
            assert(disputeHash != false);
        })();
    });





});

/*
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
};*/