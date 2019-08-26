# Building a Reputation System on top of ILP
### Author: Saharsh Agrawal, Berkeley EECS
## User --> Connector (Blockchain-enabled)
**High-level overview:**  
To send payment between two accounts (Alice and Bob), Alice will first preload funds into some payment channel, communicate with a connector to send these funds, and once the `fulfill` packet/ receipt is forwarded by connector C1 to the payment channel between Alice and C1, then the funds are disbursed from the payment channel escrow to C1.  

We shall outline an API for both the user and connector on either side of the payment channel between the two parties to interact with the ledger to perform the following tasks:  
	> User can preload funds
	> Collector can collect unclaimed debt (only when the `fulfill` packet was forwarded to the user (or some proxy on behalf the user before the `prepare` packet timeout)

The collector action has side-effects which impact the connector's various reputation metrics.

ILPv4 allows connectors to set up bilateral trust relations of arbitrary type (off-chain possibilities such as Paypal, Venmo, etc). Since there is no requirement for a ledger, escrow services are not guaranteed. How do we enforce a reputation system which depends on connector behavior?

-------------

As part of the reputation layer, we introduce a *proxy*. This proxy is responsible for providing a single interface with which both the user and connector can interact with. It will sit atop the ILP layer, and will take the place of the ledger layer which was present in ILPv1. This proxy is meant to be a lightweight intermediary which is highly configurable. It can be configured by passing in an ILP Ledger Plugin (interface specified [here](https://interledger.org/rfcs/0024-ledger-plugin-interface-2/#ledgerpluginsendmoney)).
## Flow
1. During initial discovery and communication between the user and connector, along with agreeing on a common payment channel, the two parties agree on a common ILP Plugin ruleset for that corresponding payment channel for use with the proxy.
2. The user creates a `new LedgerPlugin(opts, api)` using the agreed upon ruleset (most likely will use an existing implementation from some existing library). `opts` is a configuration object the shape of which is specific to each plugin. `api` is optional and is used to pass additional environment services to the plugin. 
	* Need to figure out best way for connector to verify that this plugin has been created using the same ruleset which was agreed upon)
3. User send this plugin to the proxy using the below API.
	* Note that the proxy contains all logic for how to manipulate the reputation scores of the connector. Sending this plugin to the proxy keeps the proxy lightweight and highly configurable.
4. Upon receiving some verification that the proxy has accepted the plugin, the user now has access to the `sendData()` and `sendMoney()` functions of the Ledger Plugin. 
5. The connector has access to a `withdraw()` method which was specified in the `api` parameter when a `new LedgerPlugin()` was first created.
## API
### User
1. Variables
	* `ILP_Plugin`: a `new LedgerPlugin(opts, api)` object
	* `ruleset_id`: string corresponding to ruleset ID retrieved from `getSupportedRulesets()`
	* `data`: arbitrary data buffer
	* `amount`: amount of money to preload
2. Methods
	* `sendData(data:Buffer)` ⇒ Promise.<undefined>
	* `sendMoney(amount:string)` ⇒ Promise.<undefined>
	* `configure(ILP_Plugin:Plugin)` ⇒ Promise.<undefined>
	* `configure(ruleset_id:string)` ⇒ Promise.<undefined> // configure is overloaded 
	* `getSupportedRulesets()` ⇒ Promise.<array> 

### Connector
1. Variables
	* `fulfill_packet`: data contained within the ILP Fulfill packet
2. Methods
	* `getBalance()` ⇒ Promise.<string>
	* `withdraw()` ⇒ Promise.<undefined>
	* `submitFulfillment(fulfill_packet:Buffer)` ⇒ Promise.<undefined>
