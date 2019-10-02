const assert = require('assert'); // N.B: Assert module comes bundled with NodeJS.


const sendTransaction = (answers, additionalAnswers) => {
  console.log("Sending transaction...\n")
  console.log(JSON.stringify(answers) + "\n")
  console.log("Success!\n");

}

const submitLedgerRequest = (answers) => {
  if (answers.paymentAccount == "Ethereum") {
    // Get details from answers.githubUrl
    // Verify that it meets requirements to serve as a proxy
    // Make sure that connector also agrees with the contained logic
    console.log("Ledger request has been successfully submitted")
  } else {
    console.log("Sorry, only Ethereum accounts are currently supported :(")
  }
}

// Export all methods
module.exports = {   
  sendTransaction,
  submitLedgerRequest
};

