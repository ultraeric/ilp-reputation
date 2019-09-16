const mongoose = require('mongoose');

// TODO: Remove and replace with public key infrastructure
const IPPublicKeyPairSchema = new mongoose.Schema({
    ipAddress: String,
    publicKey: String,
});



module.exports = { IPPublicKeyPairSchema };