// const SHA256 = require('crypto-js').SHA256;
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

const generatePrivateKey = () => {
  const keyPair = EC.genKeyPair();
  const privateKey = keyPair.getPrivate();
  return privateKey.toString(16);
};

const initWallet = () => {
  // let's not override existing private keys
  if (existsSync(privateKeyLocation)) {
    return;
  }
  const newPrivateKey = generatePrivateKey();

  fs.writeFileSync(privateKeyLocation, newPrivateKey);
  console.log('new wallet with private key created');
};

const getBalance = (address, unspentTxOuts) => {
  const balance = unspentTxOuts.reduce((sum, uTxO) => {
    if (uTxO.address === address) {
      sum += uTxO.amount;
    }
    return sum;
  }, 0);
  return balance;
};

const findTxOutsForAmount = (amount, myUnspentTxOuts) => {
  let currentAmount = 0;
  const includedUnspentTxOuts = [];
  for (const myUnspentTxOut of myUnspentTxOuts) {
    includedUnspentTxOuts.push(myUnspentTxOut);
    currentAmount += myUnspentTxOut.amount;
    if (currentAmount >= amount) {
      const leftOverAmount = currentAmount - amount;
      return { includedUnspentTxOuts, leftOverAmount };
    }
  }
  throw Error('not enough coins to send transaction');
};

const createTxOuts = (receiverAddress, myAddress, amount, leftOverAmount) => {
  const txOut1 = new TxOut(receiverAddress, amount);
  if (leftOverAmount === 0) {
    return [txOut1];
  } else {
    const leftOverTx = new TxOut(myAddress, leftOverAmount);
    return [txOut1, leftOverTx];
  }
};

const createTransaction = (receiverAddress, amount,
  privateKey, unspentTxOuts) => {

  const myAddress = getPublicKey(privateKey);
  const myUnspentTxOuts = unspentTxOuts.filter((uTxO) => uTxO.address === myAddress);

  const { includedUnspentTxOuts, leftOverAmount } = findTxOutsForAmount(amount, myUnspentTxOuts);

  const unsignedTxIns = includedUnspentTxOuts.map(unspentTxOut => {
    return new TxIn(unspentTxOut.txOutId, unspentTxOut.txOutIndex);
  });

  const txOuts = createTxOuts(receiverAddress, myAddress, amount, leftOverAmount);
  const tx = new Transaction("", unsignedTxIns, txOuts);
  tx.id = getTransactionId(tx);

  tx.txIns = tx.txIns.map((txIn, index) => {
    txIn.signature = signTxIn(tx, index, privateKey, unspentTxOuts);
    return txIn;
  });

  return tx;
};

module.exports = {
  createTransaction, getPublicFromWallet,
  getPrivateFromWallet, getBalance, generatePrivateKey, initWallet
};