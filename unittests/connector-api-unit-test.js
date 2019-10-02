const con = require('../connector-api');
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


        debtor = new con.Connector(masterKeyPair1, activationTSThreshold, '12345');
        creditor = new con.Connector(masterKeyPair2, activationTSThreshold, '54321');
        thirdNode = new con.Connector(masterKeyPair3, activationTSThreshold, '55555');

        const publicKeyInfrastructure = {};
        publicKeyInfrastructure['12345'] = jsrsasign.KEYUTIL.getPEM(debtor.masterKeyPair.pubKeyObj);
        publicKeyInfrastructure['54321'] = jsrsasign.KEYUTIL.getPEM(creditor.masterKeyPair.pubKeyObj);
        publicKeyInfrastructure['55555'] = jsrsasign.KEYUTIL.getPEM(thirdNode.masterKeyPair.pubKeyObj);

        debtor.publicKeyInfrastructure = publicKeyInfrastructure;
        creditor.publicKeyInfrastructure = publicKeyInfrastructure;
        thirdNode.publicKeyInfrastructure = publicKeyInfrastructure;
    });

    it('Valid signature on proposal', function() {
        const proposal = debtor.sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: Date.now() + 200,
            paymentTL: 8, disputeTL: 10, debtorAddress: '12345', creditorAddress: '54321',
            expirationTS: Date.now() + 100});
        const paymentAgreementHash = creditor.identifyPacket(proposal);
        assert(paymentAgreementHash != false);
    });

    it('Invalid creditor on proposal', function() {
        const proposal = debtor.sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: Date.now() + 200,
            paymentTL: 8, disputeTL: 10, debtorAddress: '12345', creditorAddress: '55',
            expirationTS: Date.now() + 100});
        const paymentAgreementHash = creditor.identifyPacket(proposal);
        assert.equal(paymentAgreementHash, false);
    });

    it('Invalid signature on proposal', function() {
        const proposal = debtor.sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: Date.now() + 200,
            paymentTL: 8, disputeTL: 10, debtorAddress: '54321', creditorAddress: '54321',
            expirationTS: Date.now() + 100});
        const paymentAgreementHash = creditor.identifyPacket(proposal);
        assert.equal(paymentAgreementHash, false);
    });

    it('detect proposal acceptance', function() {
        const proposal = debtor.sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: Date.now() + 200,
            paymentTL: 8, disputeTL: 10, debtorAddress: '54321', creditorAddress: '54321',
            expirationTS: Date.now() + 100});
        const paymentAgreementHash = creditor.identifyPacket(proposal);
        const acceptancePacket = creditor.decidePaymentAgreementProposal(paymentAgreementHash, true);
        assert(acceptancePacket);
    });

    it('detect proposal refusal', function() {
        const proposal = debtor.sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: Date.now() + 200,
            paymentTL: 8, disputeTL: 10, debtorAddress: '54321', creditorAddress: '54321',
            expirationTS: Date.now() + 100});
        const paymentAgreementHash = creditor.identifyPacket(proposal);
        const acceptancePacket = creditor.decidePaymentAgreementProposal(paymentAgreementHash, false);
        assert.equal(acceptancePacket, false);
    });

    it('payment detection and broadcastDisputeNoError', function() {
        const proposal = debtor.sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: Date.now() + 200,
            paymentTL: 8, disputeTL: 10, debtorAddress: '12345', creditorAddress: '54321',
            expirationTS: Date.now() + 100});
        let paymentAgreementHash = creditor.identifyPacket(proposal);
        debtor.receivePaymentAgreementProposalAcceptance(creditor.decidePaymentAgreementProposal(paymentAgreementHash, true));

        creditor.detectPayments(paymentAgreementHash, "passcode").then((packet) => {
            console.log(packet);
        });
    });

    it('receiveBroadcastDispute invalid signature on payment agreement', function () {
        let proposal = debtor.sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: Date.now() + 200,
            paymentTL: 8, disputeTL: 10, debtorAddress: '12345', creditorAddress: '54321',
            expirationTS: Date.now() + 100});
        let paymentAgreementHash = creditor.identifyPacket(proposal);
        debtor.receivePaymentAgreementProposalAcceptance(creditor.decidePaymentAgreementProposal(paymentAgreementHash, true));
        let proposalFake = creditor.sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: Date.now() + 200,
            paymentTL: 8, disputeTL: 10, debtorAddress: '54321', creditorAddress: '54321',
            expirationTS: Date.now() + 100});
        let paymentAgreementHashFake = creditor.identifyPacket(proposalFake);
        debtor.receivePaymentAgreementProposalAcceptance(creditor.decidePaymentAgreementProposal(paymentAgreementHashFake, true));
        const dispute = creditor.createDisputePacket(
            creditor.acceptedCreditorPaymentAgreements[paymentAgreementHash][0],
            creditor.acceptedCreditorPaymentAgreements[paymentAgreementHashFake][1],
            { ts: Date.now() }, 2);
        const broadcastedDisputePacket = creditor.broadcastDispute(dispute);
        const disputeHash = thirdNode.identifyPacket(broadcastedDisputePacket);
        assert.equal(disputeHash, false);
    });

    it('receiveBroadcastDispute valid dispute', function(done) {
        currentTime = Date.now()-1000;
        let proposal = debtor.sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: currentTime + 200,
            paymentTL: 1, disputeTL: 10000, debtorAddress: '12345', creditorAddress: '54321',
            expirationTS: currentTime + 500}, "passcode", signingConfig);
        let paymentAgreementHash = creditor.identifyPacket(proposal, signingConfig);
        debtor.receivePaymentAgreementProposalAcceptance(creditor.decidePaymentAgreementProposal(paymentAgreementHash, true));

        const dispute = creditor.createDisputePacket(
            creditor.acceptedCreditorPaymentAgreements[paymentAgreementHash][0],
            creditor.acceptedCreditorPaymentAgreements[paymentAgreementHash][1],
            { ts: currentTime + 201, amount: 2 }, 2);
        const broadcastedDisputePacket = creditor.broadcastDispute(dispute,
            "passcode", signingConfig);
        const disputeHash = thirdNode.identifyPacket(broadcastedDisputePacket, signingConfig);
        assert(disputeHash != false);
        done();
    });

    it('correctly detect valid counter-dispute', function(done) {
        const address_test = "0x8fD00f170FDf3772C5ebdCD90bF257316c69BA45";
        const sender_address_test = "0x8fd00f170fdf3772c5ebdcd90bf257316c69ba45";
        const start_date_test = 1565754237;
        const end_date_test = 1565854345;
        let proposal = debtor.sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: start_date_test,
            paymentTL: end_date_test - start_date_test, disputeTL: Date.now(), counterDisputeTL: 500, debtorAddress: '12345', creditorAddress: '54321',
            expirationTS: end_date_test, ledgerDebtorAddress: sender_address_test, ledgerCreditorAddress: address_test}, "passcode", signingConfig);
        console.log('identifying packet...');
        let paymentAgreementHash = creditor.identifyPacket(proposal, signingConfig);
        debtor.receivePaymentAgreementProposalAcceptance(creditor.decidePaymentAgreementProposal(paymentAgreementHash, true));

        console.log('identified ');
        console.log('settimeout');
        const dispute = creditor.createDisputePacket(
            creditor.acceptedCreditorPaymentAgreements[paymentAgreementHash][0],
            creditor.acceptedCreditorPaymentAgreements[paymentAgreementHash][1],
            { ts: start_date_test, amount:2500 });
        const broadcastedDisputePacket = creditor.broadcastDispute(dispute,
            "passcode", signingConfig);
        const disputeHash = thirdNode.identifyPacket(broadcastedDisputePacket, signingConfig);
        //assert(disputeHash != false);
        thirdNode.detectCounterDispute(disputeHash).then((ret) => {
            assert(ret);
            console.log(ret);
            done();
        });
    });

    it('verify counter dispute', function (done) {
        const address_test = "0x8fd00f170fdf3772c5ebdcd90bf257316c69ba45";
        const sender_address_test = "0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4c";
        const start_date_test = 1565754237;
        const end_date_test = 1565854345;
        let proposal = debtor.sendPaymentAgreementProposal({reputationCalculatorID: 0, activationTS: start_date_test,
            paymentTL: end_date_test - start_date_test, disputeTL: Date.now(), counterDisputeTL: 500, debtorAddress: '12345', creditorAddress: '54321',
            expirationTS: end_date_test, ledgerDebtorAddress: sender_address_test, ledgerCreditorAddress: address_test}, "passcode", signingConfig);
        console.log('identifying packet...');
        let paymentAgreementHash = creditor.identifyPacket(proposal, signingConfig);
        debtor.receivePaymentAgreementProposalAcceptance(creditor.decidePaymentAgreementProposal(paymentAgreementHash, true));

        console.log('identified ');
        console.log('settimeout');
        const dispute = creditor.createDisputePacket(
            creditor.acceptedCreditorPaymentAgreements[paymentAgreementHash][0],
            creditor.acceptedCreditorPaymentAgreements[paymentAgreementHash][1],
            { ts: start_date_test, amount:500 });
        const broadcastedDisputePacket = creditor.broadcastDispute(dispute,
            "passcode", signingConfig);
        const disputeHash = thirdNode.identifyPacket(broadcastedDisputePacket, signingConfig);
        //assert(disputeHash != false);
        thirdNode.detectCounterDispute(disputeHash).then((ret) => {
            thirdNode.identifyPacket(ret).then((packet) => {
                assert(packet);
                console.log(packet);
                done();
            });
        });

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