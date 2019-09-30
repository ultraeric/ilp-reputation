/**
 * Blockchain Reader for ILP Reputation System
 * Author: Minxing C. 
 **/
const safemath = require('safemath');
const weiToEther = 1000000000000000000;
const apikey = 'NSWRJMID63ZH3DDXY73P3X6PY69A28EJEH';
var api = require('etherscan-api').init(apikey);
const hash_test = "0x5335c4bb2d3fb22c8d4cec45551a28066a7db95763f20907363d92df7486ab7d";
const address_test = "0x8fD00f170FDf3772C5ebdCD90bF257316c69BA45";
const start_date_test = 1565854237;
const end_date_test = 1565854345;
//const api = 'http://api.etherscan.io/api?module=account&action=tokentx&address=0x4e83362442b8d1bec281594cea3050c8eb01311c&startblock=0&endblock=999999999&sort=asc&apikey=NSWRJMID63ZH3DDXY73P3X6PY69A28EJEH'

/*var request = new XMLHttpRequest();
request.open('GET', api, true);
request.onload = function(){
  var data = this.response;
  console.log(data);

}
request.send();
fetch(api)
  .then(function(response) {
    return response.json();
  })
  .then(function(myJson) {
    console.log(JSON.stringify(myJson));
  });
  */


async function getTxbyHash(hash){
  var tx = await api.proxy.eth_getTransactionByHash(hash);
  console.log(tx);
  return tx;
}

async function getTxlistbyAddress(address){
    var txlist = await api.account.txlist(address, 1, 'latest', 1, 100, 'asc');
    console.log(txlist);
    return txlist;
  
}

async function getBalanceSumbyAddress(address, start_date, end_date){
  var txlist = await api.account.txlist(address, 1, 'latest', 1, 100, 'asc');
  sum = 0;
  for (var item of txlist['result']){
    if(item['timeStamp'] >= start_date && item['timeStamp'] <= end_date ){
      sum += safemath.safeDiv(item['value'],weiToEther);
    }
  }
  console.log(sum);
  return sum;

}

async function _helper(address){
  var res = await api.proxy.eth_getTransactionCount(address, 'latest');
      return res.result;
}

async function monitor(address){
  var count = await _helper(address);
  var tmp;
  setInterval(async ()=>{
    tmp = await _helper(address);
    if(count != tmp){
      count = tmp;
      console.log(count);
      getTxlistbyAddress(address);
    };
  },1000);
}   


//APIs, Tests
//getTxbyHash(hash_test);
//getTxlistbyAddress(address_test);
getBalanceSumbyAddress(address_test,start_date_test, end_date_test);
//monitor(address_test);



