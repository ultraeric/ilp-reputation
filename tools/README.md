## Tools

### setup installs npm packages for connector and pm2 (production software manager for ilsp configuration for mainnet)

### start runs a testnet connector

### config command
pm2 start launch.config.js

### All of this will correct the configuration files for Moneyd. Now run the moneyd command to start the connector.
moneyd xrp:start -t

### Now run the ilp-spsp-server to handle requests.
ilp-spsp-server

### After running the above command, a localtunnel url will be outputted. Use this url as a receiver for payments. Now when someone wants to pay you, they will run this command
ilp-spsp send --amount 15 --receiver https://yoururl.localtunnel.me
