const mongoose = require('mongoose');

const PaymentAgreementsSchema = new mongoose.Schema({
    PaymentAgreements: Set,
    BipartisanPaymentAgreements: {
        type: Set,
        required: [true, 'BipartisanPaymentAgreements is required.']
    },
    ReputationAccounts: {

    }
});



module.exports = {TransactionSchema, PaymentChannelSchema};