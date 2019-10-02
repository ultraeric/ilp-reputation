const jsrsasign = require('jsrsasign');
const SortedArray = require('sorted-array');
const blockchain_reader = require('./blockchain_reader/server');

class Connector {
    constructor(masterKeyPair, activationTSThreshold, address) {
        this.address = address;
        this.publicKeyInfrastructure = {}; // Maps IP addresses to verifying public key
        this.reputationTable = {};
        this.pendingDebtorPaymentAgreements = {};
        this.pendingCreditorPaymentAgreements = {};
        this.acceptedDebtorPaymentAgreements = {};
        this.acceptedCreditorPaymentAgreements = {};
        this.disputes = {};
        this.counterDisputes = {};

        this.masterKeyPair = masterKeyPair; // TODO: This will be generated on ILP instead

        this.activationTSThreshold = activationTSThreshold;

        this.signingConfig = {
            signatureLength: 512,
            algorithm:"SHA256withRSA"
        };


        // bind this
        this.compareExpiration.bind(this);
        this.getNextConnector.bind(this);
        this.identifyPacket.bind(this);
        this.isAcceptablePaymentAgreementProposal.bind(this);
        this.ReceivePaymentAgreementProposal.bind(this);
        this.sendPaymentAgreementProposal.bind(this);
        this.detectPayments.bind(this);
        this.createDisputePacket.bind(this);
        this.broadcastDispute.bind(this);
        this.isAcceptableDispute.bind(this);
        this.receiveBroadcastDispute.bind(this);
        this.signingAlgorithm.bind(this);
        this.verifyingAlgorithm.bind(this);
        this.hashingAlgorithm.bind(this);
        this.detectCounterDispute.bind(this);
        this.receivePaymentAgreementProposalAcceptance.bind(this);
        this.decidePaymentAgreementProposal.bind(this);
        this.getDebt.bind(this);
    }

    compareExpiration(expirationAndPaymentAgreementHashPair1, expirationAndPaymentAgreementHashPair2) {
        return expirationAndPaymentAgreementHashPair1[0] - expirationAndPaymentAgreementHashPair2[0]
    }

    getNextConnector() {
        // Gets the next connector in the payment path
    }

    identifyPacket(packet) {
        if (packet.substring(0, 4) == '0000') {
            console.log('paymentAgreement');
            return this.ReceivePaymentAgreementProposal(packet.substring(4));
        } else if (packet.substring(0, 4) == '0003') {
            console.log('broadcastedDispute');
            return this.receiveBroadcastDispute(packet.substring(4));
        } else if (packet.substring(0,4) == '0001') {
            return this.receivePaymentAgreementProposalAcceptance(packet.substring(4));
        } else if (packet.substring(0,4) =='0004') {
            return this.receiveCounterDispute(packet.substring(4));
        }
    }

    isAcceptablePaymentAgreementProposal() {
        if (//paymentAgreement.activationTS > Date.now() + activationTSThreshold &&
            true
        ) {
            return true;
        }
        // If payment agreement matches criteria and debtor's reputation is sufficient, return true
        return false;
    }

    ReceivePaymentAgreementProposal(serializedPaymentAgreementCertificate) {
        /*
            -signingConfig JSON:
            signatureLength, algorithm
         */
        if (serializedPaymentAgreementCertificate.length > this.signingConfig.signatureLength) {
            const signature = serializedPaymentAgreementCertificate.substring(
                serializedPaymentAgreementCertificate.length - this.signingConfig.signatureLength);
            const serializedPaymentAgreement = serializedPaymentAgreementCertificate.substring(0,
                serializedPaymentAgreementCertificate.length - this.signingConfig.signatureLength);
            const paymentAgreement = JSON.parse(serializedPaymentAgreement);
            const publicKey = this.publicKeyInfrastructure[paymentAgreement.debtorAddress];
            const publicKeyObj = jsrsasign.KEYUTIL.getKey(publicKey);
            if ( this.verifyingAlgorithm(publicKeyObj, serializedPaymentAgreement, signature, this.signingConfig.algorithm) &&
                this.address == paymentAgreement.creditorAddress &&
                this.isAcceptablePaymentAgreementProposal()) {
                console.log('signature valid for payment agreement');
                console.log('');
                const paymentAgreementHash = this.hashingAlgorithm(serializedPaymentAgreement, "sha1",
                    "cryptojs");
                console.log('hashed paymentagreement');
                console.log('');
                if (!(paymentAgreementHash in this.acceptedCreditorPaymentAgreements)) {
                    console.log('hash not already stored');
                    this.pendingCreditorPaymentAgreements[paymentAgreementHash] = [paymentAgreement, signature];
                    return paymentAgreementHash;
                } else {
                    console.log('repeat paymentagreement packet');
                    return false;
                }
            } else {
                console.log('unacceptable agreement');
                return false;
                // Send ILP reject packet
            }
        } else {
            return false;
        }
    }

    decidePaymentAgreementProposal(paymentAgreementHash, accept) {
        if (accept) {
            this.acceptedCreditorPaymentAgreements[paymentAgreementHash] = this.pendingCreditorPaymentAgreements[paymentAgreementHash];
            delete this.pendingCreditorPaymentAgreements[paymentAgreementHash];
            // send back proposal acceptance
            const privateKeyObj = jsrsasign.KEYUTIL.getKey(jsrsasign.KEYUTIL.getPEM(this.masterKeyPair.prvKeyObj, "PKCS8PRV",
                "passcode"), "passcode");
            const signature = this.signingAlgorithm(privateKeyObj,  paymentAgreementHash, this.signingConfig.algorithm);
            return '0001' + paymentAgreementHash + signature;
        } else {
            delete this.pendingCreditorPaymentAgreements[paymentAgreementHash];
            return false;
        }
    }

    receivePaymentAgreementProposalAcceptance(serializedAcceptance) {
        const paymentAgreementHash = serializedAcceptance.substring(4, serializedAcceptance.length - this.signingConfig.signatureLength);
        if(paymentAgreementHash in this.pendingDebtorPaymentAgreements) {
            const paymentAgreement = this.pendingDebtorPaymentAgreements[paymentAgreementHash];
            const publicKey = this.publicKeyInfrastructure[paymentAgreement.debtorAddress];
            const publicKeyObj = jsrsasign.KEYUTIL.getKey(publicKey);
            const signature = serializedAcceptance.substring(serializedAcceptance.length - this.signingConfig.signatureLength);
            if (this.verifyingAlgorithm(publicKeyObj, paymentAgreementHash, signature, this.signingConfig.algorithm) &&
                paymentAgreementHash in this.pendingDebtorPaymentAgreements
            ) {
                this.acceptedDebtorPaymentAgreements[paymentAgreementHash] = this.pendingDebtorPaymentAgreements[paymentAgreementHash];
                delete this.pendingDebtorPaymentAgreements[paymentAgreementHash];
            } else {
                return false;
            }
        } else {
            return false;
        }

    }

    sendPaymentAgreementProposal(paymentAgreement) {
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
        if (!(paymentAgreementHash in this.pendingDebtorPaymentAgreements)) {
            const privateKeyObj = jsrsasign.KEYUTIL.getKey(jsrsasign.KEYUTIL.getPEM(this.masterKeyPair.prvKeyObj, "PKCS8PRV",
                "passcode"), "passcode");
            const signature = this.signingAlgorithm(privateKeyObj, serializedPaymentAgreement, this.signingConfig.algorithm);
            this.pendingDebtorPaymentAgreements[paymentAgreementHash] = paymentAgreement;
            // Send '0000' + serializedPaymentAgreement + signature
            return '0000' + serializedPaymentAgreement + signature;
        }
    }

    async detectPayments(paymentAgreementHash) {
        const paymentAgreementAndSignature = this.acceptedCreditorPaymentAgreements[paymentAgreementHash];
        // Loop through payments starting from activation timestamp and see if payments added up
        // If not all payments add up, dispute remaining amount automatically
        const debt = this.getDebt();
        const paymentAgreement = paymentAgreementAndSignature[0];
        blockchain_reader.getBalanceSumbyAddress(paymentAgreement.ledgerCreditorAddress, debt.ts, debt.ts + paymentAgreement.paymentTL, paymentAgreement.ledgerDebtorAddress);
        console.log(paymentAgreementAndSignature);
        return this.broadcastDispute(this.createDisputePacket(paymentAgreementAndSignature[0], paymentAgreementAndSignature[1], { ts: 'temp' }));
        //Exits and does no broadcast if missingPayments reaches 0
    }

    getDebt() {
        return { ts: Date.now(), amount: 100};
    }

    createDisputePacket(paymentAgreement, debtorSignature, debt) {
        return {
            paymentAgreement: paymentAgreement,
            debtorSignature: debtorSignature,
            debt: debt
        }
    }

    broadcastDispute(dispute) {
        const serializedDispute = JSON.stringify(dispute);
        const privateKeyObj = jsrsasign.KEYUTIL.getKey(jsrsasign.KEYUTIL.getPEM(this.masterKeyPair.prvKeyObj, "PKCS8PRV",
            "passcode"), "passcode");
        // TODO: fix bug here
        const signature = this.signingAlgorithm(privateKeyObj, serializedDispute, this.signingConfig.algorithm);
        // Send instead of return
        return '0003' + serializedDispute + signature;
    }

    isAcceptableDispute(dispute, serializedDispute, disputeSignature,  paymentAgreement, serializedPaymentAgreement, paymentAgreementSignature) {
        const debtorPublicKey = this.publicKeyInfrastructure[paymentAgreement.debtorAddress];
        const debtorPublicKeyObj = jsrsasign.KEYUTIL.getKey(debtorPublicKey);
        const creditorPublicKey = this.publicKeyInfrastructure[paymentAgreement.creditorAddress];
        const creditorPublicKeyObj = jsrsasign.KEYUTIL.getKey(creditorPublicKey);
        if (this.verifyingAlgorithm(debtorPublicKeyObj, serializedPaymentAgreement, paymentAgreementSignature, this.signingConfig.algorithm) &&
            this.verifyingAlgorithm(creditorPublicKeyObj, serializedDispute, disputeSignature, this.signingConfig.algorithm) &&
            dispute.debt.ts + paymentAgreement.paymentTL < Date.now() &&
            dispute.debt.ts + paymentAgreement.paymentTL + paymentAgreement.disputeTL > Date.now() &&
            dispute.debt.ts >= paymentAgreement.activationTS &&
            dispute.debt.ts < paymentAgreement.expirationTS
        ) {
            return true;
        }
        return false;
    }

    receiveBroadcastDispute(serializedDisputeCertificate) {
        if (serializedDisputeCertificate.length > this.signingConfig.signatureLength) {
            const disputeSignature = serializedDisputeCertificate.substring(
                serializedDisputeCertificate.length - this.signingConfig.signatureLength);
            const serializedDispute = serializedDisputeCertificate.substring(0,
                serializedDisputeCertificate.length - this.signingConfig.signatureLength);
            const dispute = JSON.parse(serializedDispute);
            const serializedPaymentAgreement = JSON.stringify(dispute.paymentAgreement);
            if (this.isAcceptableDispute(dispute, serializedDispute, disputeSignature, dispute.paymentAgreement, serializedPaymentAgreement, dispute.debtorSignature)) {
                console.log('agreement signature valid and dispute valid');
                const disputeHash = this.hashingAlgorithm(serializedDispute, "sha1",
                    "cryptojs");
                if (!(disputeHash in this.disputes)) {
                    this.disputes[disputeHash] = dispute;
                    return disputeHash;
                }
                else {
                    console.log('repeat dispute packet');
                    return false;
                }
            } else {
                console.log('unacceptable dispute');
                return false;
                // Send ILP reject packet
            }
        } else {
            console.log('invalid serializedDisputeCertificate length');
        }
    }

    signingAlgorithm(prvKey, str, algorithm) {
        const signingAlgorithm = new jsrsasign.KJUR.crypto.Signature({"alg": algorithm});
        signingAlgorithm.init(prvKey);
        signingAlgorithm.updateString(str);
        return signingAlgorithm.sign();
    }

    verifyingAlgorithm(pubKey, str, signature, algorithm) {
        const signingAlgorithm = new jsrsasign.KJUR.crypto.Signature({"alg": algorithm});
        signingAlgorithm.init(pubKey);
        signingAlgorithm.updateString(str);
        return signingAlgorithm.verify(signature);
    }

    hashingAlgorithm(str, algorithm, prov) {
        const md = new jsrsasign.KJUR.crypto.MessageDigest({alg: algorithm, prov: prov});
        md.updateString(str);
        return md.digest();
    }

    async detectCounterDispute(disputeHash) {
        const dispute = this.disputes[disputeHash];
        console.log('here');
        const txs = await blockchain_reader.getBalanceSumbyAddress(dispute.paymentAgreement.ledgerCreditorAddress, dispute.debt.ts, dispute.debt.ts + dispute.paymentAgreement.paymentTL, dispute.paymentAgreement.ledgerDebtorAddress);
        const txSum = txs[0];
        const txList = txs[1];
        //proceed broadcast
        if (txSum >= dispute.debt.amount) {
            console.log('full payment detected');
            const serializedCounterDispute = JSON.stringify({
                txList: txList,
                disputeHash: disputeHash,
                counterDisputer: this.address
            });
            const privateKeyObj = jsrsasign.KEYUTIL.getKey(jsrsasign.KEYUTIL.getPEM(this.masterKeyPair.prvKeyObj, "PKCS8PRV",
                "passcode"), "passcode");
            // TODO: fix bug here
            const signature = this.signingAlgorithm(privateKeyObj, serializedCounterDispute, this.signingConfig.algorithm);
            // Send instead of return
            return '0004' + serializedCounterDispute + signature;
        } else {
            console.log('no payment detected in counter dispute');
            return false;
        }
    }

    async receiveCounterDispute(serializedCounterDisputeCertificate) {


        const serializedCounterDispute = serializedCounterDisputeCertificate.substring(0,serializedCounterDisputeCertificate.length - this.signingConfig.signatureLength);
        const counterDispute = JSON.parse(serializedCounterDispute);

        const signature = serializedCounterDisputeCertificate.substring(serializedCounterDisputeCertificate.length - this.signingConfig.signatureLength);

        const publicKey = this.publicKeyInfrastructure[counterDispute.counterDisputer];
        const publicKeyObj = jsrsasign.KEYUTIL.getKey(publicKey);
        if(this.verifyingAlgorithm(publicKeyObj, serializedCounterDispute, signature, this.signingConfig.algorithm)) {
            const txList = counterDispute.txList;
            const dispute = this.disputes[counterDispute.disputeHash];
            const txSum = await blockchain_reader.getTxSum(txList, dispute.paymentAgreement.ledgerDebtorAddress, dispute.debt.ts,
                dispute.debt.ts + dispute.paymentAgreement.paymentTL, dispute.paymentAgreement.ledgerCreditorAddress);
            return txSum >= dispute.debt.amount;
        } else {
            return false;
        }

    }
}

module.exports.Connector = Connector;

