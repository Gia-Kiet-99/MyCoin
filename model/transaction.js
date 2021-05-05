const SHA256 = require('crypto-js').SHA256;
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

const COINBASE_AMOUNT = 50;

class UnspentTxOut {
  /**
   * 
   * @param {txOutId} txOutId 
   * @param {txOutIndex} txOutIndex 
   * @param {address} address 
   * @param {amount} amount 
   */
  constructor(txOutId, txOutIndex, address, amount) {
    this.txOutId = txOutId;
    this.txOutIndex = txOutIndex;
    this.address = address;
    this.amount = amount;
  }
}

class TxIn {
  /**
   * 
   * @param {txOutId} txOutId 
   * @param {txOutIndex} txOutIndex 
   * @param {signature} signature 
   */
  constructor(txOutId, txOutIndex, signature = "") {
    this.txOutId = txOutId;
    this.txOutIndex = txOutIndex;
    this.signature = signature;
  }
}

class TxOut {
  /**
   * 
   * @param {address} address 
   * @param {amount} amount 
   */
  constructor(address, amount) {
    this.address = address;
    this.amount = amount;
  }
}

class Transaction {
  /**
   * 
   * @param {id} id The transaction id is calculated by taking a hash from the contents of the transaction
   * @param {txIns} txIns Array of transaction input
   * @param {txOuts} txOuts Array of transaction output
   */
  constructor(id, txIns, txOuts) {
    this.id = id;
    this.txIns = [...txIns];
    this.txOuts = [...txOuts];
  }
}

/*-------------------- Transation function-- ----------------*/
function getTransactionId(transaction) {
  const txInContent = transaction.txIns.reduce((content, txIn) => {
    return content + txIn.txOutId + txIn.txOutIndex;
  }, "");
  const txOutContent = transaction.txOuts.reduce((content, txOut) => {
    return content + txOut.address + txOut.amount;
  }, "");

  return SHA256(txInContent + txOutContent).toString();
}

const validateTransaction = (transaction, aUnspentTxOuts) => {
  if (!isValidTransactionStructure(transaction)) {
    return false;
  }
  if (getTransactionId(transaction) !== transaction.id) {
    console.log('invalid tx id: ' + transaction.id);
    return false;
  }
  const hasValidTxIns = transaction.txIns
    .map((txIn) => validateTxIn(txIn, transaction, aUnspentTxOuts))
    .reduce((a, b) => a && b, true);

  if (!hasValidTxIns) {
    console.log('some of the txIns are invalid in tx: ' + transaction.id);
    return false;
  }

  const totalTxInValues = transaction.txIns
    .map((txIn) => getTxInAmount(txIn, aUnspentTxOuts))
    .reduce((a, b) => (a + b), 0);

  const totalTxOutValues = transaction.txOuts
    .map((txOut) => txOut.amount)
    .reduce((a, b) => (a + b), 0);

  if (totalTxOutValues !== totalTxInValues) {
    console.log('totalTxOutValues !== totalTxInValues in tx: ' + transaction.id);
    return false;
  }

  return true;
};

const validateBlockTransactions = (aTransactions, aUnspentTxOuts, blockIndex) => {
  const coinbaseTx = aTransactions[0];
  if (!validateCoinbaseTx(coinbaseTx, blockIndex)) {
    console.log('invalid coinbase transaction: ' + JSON.stringify(coinbaseTx));
    return false;
  }

  //check for duplicate txIns. Each txIn can be included only once
  const txIns = aTransactions
    .map(tx => tx.txIns)
    .flat();

  if (hasDuplicates(txIns)) {
    return false;
  }

  // all but coinbase transactions
  const normalTransactions = aTransactions.slice(1);
  return normalTransactions.map((tx) => validateTransaction(tx, aUnspentTxOuts))
    .reduce((a, b) => (a && b), true);
};

const hasDuplicates = (txIns) => {
  const txOutIds = [];
  for (let i = 0; i < txIns.length; i++) {
    if (txOutIds.includes(txIns[i].txOutId + txIns[i].txOutIndex)) {
      console.log('duplicate txIn: ' + i);
      return true;
    }
    txOutIds.push(txIns[i].txOutId + txIns[i].txOutIndex);
  }
  return false;
};

const validateCoinbaseTx = (transaction, blockIndex) => {
  if (transaction == null) {
    console.log('the first transaction in the block must be coinbase transaction');
    return false;
  }
  if (getTransactionId(transaction) !== transaction.id) {
    console.log('invalid coinbase tx id: ' + transaction.id);
    return false;
  }
  if (transaction.txIns.length !== 1) {
    console.log('one txIn must be specified in the coinbase transaction');
    return false;
  }
  if (transaction.txIns[0].txOutIndex !== blockIndex) {
    console.log('the txIn signature in coinbase tx must be the block height');
    return false;
  }
  if (transaction.txOuts.length !== 1) {
    console.log('invalid number of txOuts in coinbase transaction');
    return false;
  }
  if (transaction.txOuts[0].amount != COINBASE_AMOUNT) {
    console.log('invalid coinbase amount in coinbase transaction');
    return false;
  }
  return true;
};

const validateTxIn = (txIn, transaction, aUnspentTxOuts) => {
  const referencedUTxOut =
    aUnspentTxOuts.find((uTxO) => uTxO.txOutId === txIn.txOutId && uTxO.txOutId === txIn.txOutId);
  if (referencedUTxOut == null) {
    console.log('referenced txOut not found: ' + JSON.stringify(txIn));
    return false;
  }
  const address = referencedUTxOut.address;

  const key = ec.keyFromPublic(address, 'hex');
  return key.verify(transaction.id, txIn.signature);
};

const getTxInAmount = (txIn, aUnspentTxOuts) => {
  return findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts).amount;
};

const findUnspentTxOut = (transactionId, index, aUnspentTxOuts) => {
  return aUnspentTxOuts.find((uTxO) => uTxO.txOutId === transactionId && uTxO.txOutIndex === index);
};

const getCoinbaseTransaction = (address, blockIndex) => {
  const txIn = new TxIn("", blockIndex, "");
  const trans = new Transaction("", [txIn], [new TxOut(address, COINBASE_AMOUNT)]);
  trans.id = getTransactionId(trans);

  return trans;
};

const signTxIn = (transaction, txInIndex, privateKey, aUnspentTxOuts) => {
  const txIn = transaction.txIns[txInIndex];

  const dataToSign = transaction.id;
  const referencedUnspentTxOut = findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts);
  if (referencedUnspentTxOut == null) {
    console.log('could not find referenced txOut');
    throw Error();
  }
  const referencedAddress = referencedUnspentTxOut.address;

  if (getPublicKey(privateKey) !== referencedAddress) {
    console.log('trying to sign an input with private' +
      ' key that does not match the address that is referenced in txIn');
    throw Error();
  }
  const key = ec.keyFromPrivate(privateKey, 'hex');
  const signature = toHexString(key.sign(dataToSign).toDER());

  return signature;
};

//Updating unspent transaction outputs
const updateUnspentTxOuts = (newTransactions, aUnspentTxOuts) => {
  const newUnspentTxOuts = newTransactions
    .map((t) => {
      return t.txOuts.map((txOut, index) => new UnspentTxOut(t.id, index, txOut.address, txOut.amount));
    })
    .reduce((a, b) => a.concat(b), []);

  const consumedTxOuts = newTransactions
    .map((t) => t.txIns)
    .reduce((a, b) => a.concat(b), [])
    .map((txIn) => new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, '', 0));

  const resultingUnspentTxOuts = aUnspentTxOuts
    .filter(((uTxO) => !findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, consumedTxOuts)))
    .concat(newUnspentTxOuts);

  return resultingUnspentTxOuts;
};

const processTransactions = (aTransactions, aUnspentTxOuts, blockIndex) => {
  if (!isValidTransactionsStructure(aTransactions)) {
    return null;
  }
  if (!validateBlockTransactions(aTransactions, aUnspentTxOuts, blockIndex)) {
    console.log('invalid block transactions');
    return null;
  }
  return updateUnspentTxOuts(aTransactions, aUnspentTxOuts);
};

const toHexString = (byteArray) => {
  return Array.from(byteArray, (byte) => {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
};

const getPublicKey = (aPrivateKey) => {
  return ec.keyFromPrivate(aPrivateKey, 'hex').getPublic().encode('hex');
};

const isValidTxInStructure = (txIn) => {
  if (txIn == null) {
    console.log('txIn is null');
    return false;
  } else if (typeof txIn.signature !== 'string') {
    console.log('invalid signature type in txIn');
    return false;
  } else if (typeof txIn.txOutId !== 'string') {
    console.log('invalid txOutId type in txIn');
    return false;
  } else if (typeof txIn.txOutIndex !== 'number') {
    console.log('invalid txOutIndex type in txIn');
    return false;
  } else {
    return true;
  }
};

const isValidTxOutStructure = (txOut) => {
  if (txOut == null) {
    console.log('txOut is null');
    return false;
  } else if (typeof txOut.address !== 'string') {
    console.log('invalid address type in txOut');
    return false;
  } else if (!isValidAddress(txOut.address)) {
    console.log('invalid TxOut address');
    return false;
  } else if (typeof txOut.amount !== 'number') {
    console.log('invalid amount type in txOut');
    return false;
  } else {
    return true;
  }
};

const isValidTransactionsStructure = (transactions) => {
  return transactions
    .map(isValidTransactionStructure)
    .reduce((a, b) => (a && b), true);
};

const isValidTransactionStructure = (transaction) => {
  if (typeof transaction.id !== 'string') {
    console.log('transactionId missing');
    return false;
  }
  if (!(transaction.txIns instanceof Array)) {
    console.log('invalid txIns type in transaction');
    return false;
  }
  if (!transaction.txIns
    .map(isValidTxInStructure)
    .reduce((a, b) => (a && b), true)) {
    return false;
  }
  if (!(transaction.txOuts instanceof Array)) {
    console.log('invalid txIns type in transaction');
    return false;
  }
  if (!transaction.txOuts
    .map(isValidTxOutStructure)
    .reduce((a, b) => (a && b), true)) {
    return false;
  }
  return true;
};

//valid address is a valid ecdsa public key in the 04 + X-coordinate + Y-coordinate format
const isValidAddress = (address) => {
  if (address.length !== 130) {
    console.log('invalid public key length');
    return false;
  } else if (address.match('^[a-fA-F0-9]+$') === null) {
    console.log('public key must contain only hex characters');
    return false;
  } else if (!address.startsWith('04')) {
    console.log('public key must start with 04');
    return false;
  }
  return true;
};

module.exports = {
  processTransactions, signTxIn, getTransactionId,
  UnspentTxOut, TxIn, TxOut, getCoinbaseTransaction, getPublicKey,
  Transaction, validateTransaction, COINBASE_AMOUNT, isValidAddress, hasDuplicates
}