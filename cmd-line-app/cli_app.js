#!/usr/bin/env node

const program = require('commander');
const { prompt } = require('inquirer');

const { 
  sendTransaction, 
  submitLedgerRequest
} = require('./logic'); 

const transactionQuestions = [
  {
    type : 'input',
    name : 'connectorAddress',
    message : 'Enter Connector Address: '
  },
  {
    type : 'number',
    name : 'depositAmount',
    message : 'Enter Deposit Amount: ',
    validate: function(input) {
      return !isNaN(Number(input))
    }
  },
  {
    type : 'list',
    name : 'proxyType',
    message : 'Choose Proxy Type: ',
    choices: [
      'Ethereum',
      'Other'
    ],
    default: "Ethereum"
  },
  {
    type : 'input',
    name : 'contractAddress',
    message : 'Enter Ethereum Contract Address: ',
    when: function(answers) {
        return answers.proxyType
    }
  },
  {
    type : 'input',
    name : 'recipient',
    message : 'Enter Recipient Address: '
  }
];

const ledgerRequestQuestions = [
  {
    type : 'list',
    name : 'paymentAccount',
    message : 'Which account would you like to send a payment from?',
    choices: [
      'Ethereum',
      'Other'
    ],
    default: "Ethereum"
  },
  {
    type : 'input',
    name : 'ethereumAddress',
    message : 'Address of an existing HTLC on Ethereum? ',
    when: function(answers) {
      return answers.paymentAccount === "Ethereum";
    }
  },
  {
    type : 'input',
    name : 'githubUrl',
    message : 'Enter a Github URL containing proxy setup logic: '
  }
]


program
  .version('0.0.1')
  .description('ILP User -> Connector CLI Tools')

program
  .command('sendTransaction')
  .alias("s")
  .description('Send payment via connector')
  .action(() => {
    prompt(transactionQuestions)
    .then((answers) => sendTransaction(answers))
  });

program
  .command('submitLedgerRequest')
  .alias('l')
  .description('Submit Ledger Request to Connector')
  .action(() => {
    prompt(ledgerRequestQuestions)
    .then((answers) => submitLedgerRequest(answers))
  });


// Assert that a VALID command is provided 
if (!process.argv.slice(2).length || !/[arudl]/.test(process.argv.slice(2))) {
  program.outputHelp();
  process.exit();
}
program.parse(process.argv)
    