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
const blockchain_reader = require('./blockchain_reader/server');

class Connector {
    constructor(masterKeyPair, signingConfig, activationTSThreshold, address) {
        this.address = address;
        this.publicKeyInfrastructure = {}; // Maps IP addresses to verifying public key
        this.reputationTable = {};
        this.supportedReputationCalculators = new Set();
        this.pendingDebtorPaymentAgreements = {};
        this.acceptedCreditorPaymentAgreements = {};
        this.disputes = {};

        this.masterKeyPair = masterKeyPair; // TODO: This will be generated on ILP instead

        this.activationTSThreshold = activationTSThreshold;

        this.signingConfig = signingConfig;

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
    }

    compareExpiration(expirationAndPaymentAgreementHashPair1, expirationAndPaymentAgreementHashPair2) {
        return expirationAndPaymentAgreementHashPair1[0] - expirationAndPaymentAgreementHashPair2[0]
    }

    getNextConnector() {
        // Gets the next connector in the payment path
    }

    identifyPacket(packet, signingConfig) {
        if (packet.substring(0, 4) == '0000') {
            console.log('paymentAgreement');
            return this.ReceivePaymentAgreementProposal(packet.substring(4), signingConfig);
        } else if (packet.substring(0, 4) == '0003') {
            console.log('broadcastedDispute');
            return this.receiveBroadcastDispute(packet.substring(4), signingConfig);
        }
    }

    isAcceptablePaymentAgreementProposal(paymentAgreement, serializedPaymentAgreement, signature, signingConfig) {
        const publicKey = this.publicKeyInfrastructure[paymentAgreement.debtorAddress];
        const publicKeyObj = jsrsasign.KEYUTIL.getKey(publicKey);
        if (this.supportedReputationCalculators.has(paymentAgreement.reputationCalculatorID) &&
            //paymentAgreement.activationTS > Date.now() + activationTSThreshold &&
            this.verifyingAlgorithm(publicKeyObj, serializedPaymentAgreement, signature, signingConfig.algorithm) &&
            this.address == paymentAgreement.creditorAddress
        ) {
            return true;
        }
        // If payment agreement matches criteria and debtor's reputation is sufficient, return true
        return false;
    }

    ReceivePaymentAgreementProposal(serializedPaymentAgreementCertificate, signingConfig) {
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
            if (this.isAcceptablePaymentAgreementProposal(paymentAgreement, serializedPaymentAgreement, signature,
                signingConfig)) {
                console.log('signature valid for payment agreement');
                console.log('');
                const paymentAgreementHash = this.hashingAlgorithm(serializedPaymentAgreement, "sha1",
                    "cryptojs");
                console.log('hashed paymentagreement');
                console.log('');
                if (!(paymentAgreementHash in this.acceptedCreditorPaymentAgreements)) {
                    console.log('hash not already stored');
                    this.acceptedCreditorPaymentAgreements[paymentAgreementHash] = [paymentAgreement, signature];
                    // Proceeds to send another payment agreement to the next connector in the path and then wait for its
                    // response before sending back a signed payment agreement back to the previous connector
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

    sendPaymentAgreementProposal(paymentAgreement, passcode, signingConfig) {
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
                passcode), passcode);
            const signature = this.signingAlgorithm(privateKeyObj, serializedPaymentAgreement, signingConfig.algorithm);
            this.pendingDebtorPaymentAgreements[paymentAgreementHash] = paymentAgreement;
            // Send '0000' + serializedPaymentAgreement + signature
            return '0000' + serializedPaymentAgreement + signature;
        }
    }

    async detectPayments(paymentAgreementHash, passcode, signingConfig) {
        const paymentAgreementAndSignature = this.acceptedCreditorPaymentAgreements[paymentAgreementHash];
        // Loop through payments starting from activation timestamp and see if payments added up
        // If not all payments add up, dispute remaining amount automatically
        let missingPayments = 10;
        console.log(paymentAgreementAndSignature);
        return this.broadcastDispute(this.createDisputePacket(paymentAgreementAndSignature[0], paymentAgreementAndSignature[1],
            missingPayments), passcode, signingConfig);
        //Exits and does no broadcast if missingPayments reaches 0
    }

    createDisputePacket(paymentAgreement, debtorSignature, missingPayments, debt) {
        return {
            paymentAgreement: paymentAgreement,
            debtorSignature: debtorSignature,
            missingPayments: missingPayments,
            debt: debt
        }
    }

    broadcastDispute(dispute, passcode, signingConfig) {
        /*
            -JSON dispute contains:
            PaymentAgreement, debtorSignature, missingPayments
         */
        const serializedDispute = JSON.stringify(dispute);
        const privateKeyObj = jsrsasign.KEYUTIL.getKey(jsrsasign.KEYUTIL.getPEM(this.masterKeyPair.prvKeyObj, "PKCS8PRV",
            passcode), passcode);
        // TODO: fix bug here
        const signature = this.signingAlgorithm(privateKeyObj, serializedDispute, signingConfig.algorithm);
        // Send instead of return
        return '0003' + serializedDispute + signature;
    }

    isAcceptableDispute(dispute, serializedDispute, disputeSignature,  paymentAgreement, serializedPaymentAgreement, paymentAgreementSignature, signingConfig) {
        const debtorPublicKey = this.publicKeyInfrastructure[paymentAgreement.debtorAddress];
        const debtorPublicKeyObj = jsrsasign.KEYUTIL.getKey(debtorPublicKey);
        const creditorPublicKey = this.publicKeyInfrastructure[paymentAgreement.creditorAddress];
        const creditorPublicKeyObj = jsrsasign.KEYUTIL.getKey(creditorPublicKey);
        if (this.supportedReputationCalculators.has(paymentAgreement.reputationCalculatorID) &&
            this.verifyingAlgorithm(debtorPublicKeyObj, serializedPaymentAgreement, paymentAgreementSignature, signingConfig.algorithm) &&
            this.verifyingAlgorithm(creditorPublicKeyObj, serializedDispute, disputeSignature, signingConfig.algorithm) &&
            dispute.debt.ts + paymentAgreement.paymentTL < Date.now() &&
            dispute.debt.ts + paymentAgreement.paymentTL + paymentAgreement.disputeTL > Date.now() &&
            dispute.debt.ts >= paymentAgreement.activationTS &&
            dispute.debt.ts < paymentAgreement.expirationTS
        ) {
            return true;
        }
        return false;
    }

    receiveBroadcastDispute(serializedDisputeCertificate, signingConfig) {
        if (serializedDisputeCertificate.length > signingConfig.signatureLength) {
            const disputeSignature = serializedDisputeCertificate.substring(
                serializedDisputeCertificate.length - signingConfig.signatureLength);
            const serializedDispute = serializedDisputeCertificate.substring(0,
                serializedDisputeCertificate.length - signingConfig.signatureLength);
            const dispute = JSON.parse(serializedDispute);
            const serializedPaymentAgreement = JSON.stringify(dispute.paymentAgreement);
            if (this.isAcceptableDispute(dispute, serializedDispute, disputeSignature, dispute.paymentAgreement, serializedPaymentAgreement, dispute.debtorSignature, signingConfig)) {
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
        const tx = await blockchain_reader.getBalanceSumbyAddress(dispute.paymentAgreement.ledgerCreditorAddress, dispute.debt.ts, dispute.debt.ts + dispute.paymentAgreement.paymentTL, dispute.paymentAgreement.ledgerDebtorAddress);
        const txSum = tx[0];
        const txList = tx[1];
        console.log(txSum);
        console.log(txList);
        return txSum;
    }
}

module.exports.Connector = Connector;

