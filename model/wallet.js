const SHA256 = require('crypto-js').SHA256;
const EC = require('elliptic').ec;
const fs = require('fs');

const { getPublicKey, getTransactionId, signTxIn, Transaction,
  TxIn, TxOut, UnspentTxOut } = require('./transaction');


const ec = new EC('secp256k1');
const privateKeyLocation = 'node/wallet/private_key';

const getPrivateFromWallet = () => {
  const buffer = fs.readFileSync(privateKeyLocation, 'utf8');
  return buffer.toString();
};

const getPublicFromWallet = () => {
  const privateKey = getPrivateFromWallet();
  const key = EC.keyFromPrivate(privateKey, 'hex');
  return key.getPublic().encode('hex');
};

