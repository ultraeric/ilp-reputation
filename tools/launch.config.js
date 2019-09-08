'use strict'

const path = require('path')

const parentConnector = {
  // This tells our connector that this is our main upstream link which will
  // automatically make it our default route and load our ILP address from it.
  relation: 'parent',
  assetScale: 6,
  assetCode: 'XRP',
  plugin: 'ilp-plugin-xrp-asym',
  options: {

  }
}

const connectorApp = {
  name: 'connector',
  env: {
    // The one-to-one backend will use an exchange rate of 1:1 for everything
    CONNECTOR_BACKEND: 'one-to-one',

    // We don't want to charge any fee
    CONNECTOR_SPREAD: '0',

    // Where is our database stored
    CONNECTOR_STORE_PATH: '/home/bob/connector',

    // Configure our plugins
    CONNECTOR_ACCOUNTS: JSON.stringify({
      // `up` is an arbitrary name we give to our parent connector
      up: parentConnector
    })
  },
  script: path.resolve(process.execPath, '../../lib/node_modules/ilp-connector/src/index.js')
}

module.exports = { apps: [ connectorApp ] }