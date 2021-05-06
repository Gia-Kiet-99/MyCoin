const SHA256 = require('crypto-js').SHA256;
const _ = require('lodash');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

function calculateHash(index, previousHash, timestamp, data, difficulty, nonce) {
  return SHA256(index + previousHash + timestamp + JSON.stringify(data) + difficulty + nonce).toString();
}

// console.log(Math.round(Date.now()/1000));

// console.log(calculateHash(0, "", 1620142630, [{
//   'txIns': [{ 'signature': '', 'txOutId': '', 'txOutIndex': 0 }],
//   'txOuts': [{
//     'address': '04bfcab8722991ae774db48f934ca79cfb7dd991229153b9f732ba5334aafcd8e7266e47076996b55a14bf9913ee3145ce0cfc1372ada8ada74bd287450313534a',
//     'amount': 50
//   }],
//   'id': 'e655f6a5f26dc9b4cac6e46f52336428287759cf81ef5ff10854f69d68f43fa3'
// }], 0, 0));

function getTransactionId(transaction) {
  const txInContent = transaction.txIns.reduce((content, txIn) => {
    return content + txIn.txOutId + txIn.txOutIndex;
  }, "");
  const txOutContent = transaction.txOuts.reduce((content, txOut) => {
    return content + txOut.address + txOut.amount;
  }, "");

  return SHA256(txInContent + txOutContent).toString();
}

// console.log(getTransactionId({
//   'txIns': [{ 'signature': '', 'txOutId': '', 'txOutIndex': 0 }],
//   'txOuts': [{
//     'address': '049e95da2a3244a6989e2a153d11beecc02d42a70a27c498903d1e10c2add98ef612d267b52edd2474feb9e8ec560d1a541026b60d31cfaeee3cd3085a27cb3193',
//     'amount': 50
//   }],
//   'id': '230e3648aab43f05c3156593142b19e3cfb11e9fe02e906b8eba8e83fd720cd1'
// }) === "230e3648aab43f05c3156593142b19e3cfb11e9fe02e906b8eba8e83fd720cd1");

// const arr = [[1,2,[3]], 1, 4, [[[3]]]];
// const clone = _.cloneDeep(arr);

// arr[0][2][1] = 4;

// console.log(arr);
// console.log(clone);

// const key = ec.genKeyPair();
// console.log(key.getPublic('hex') === key.getPublic().encode('hex'));
