const SHA256 = require('crypto-js').SHA256;
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');
const _ = require('lodash');

const { broadcastLatest, broadcastTransactionPool } = require('./p2p');
const { COINBASE_AMOUNT, processTransactions, getCoinbaseTransaction } = require('./transaction');
const { createTransaction, findUnspentTxOuts, getBalance, getPrivateFromWallet, getPublicFromWallet } = require('./wallet');
const { addToTransactionPool, getTransactionPool, updateTransactionPool } = require('./transaction-pool');

class Block {
  /**
   * 
   * @param {index} index 
   * @param {hash} hash 
   * @param {previousHash} previousHash 
   * @param {timestamp} timestamp 
   * @param {data} data 
   * @param {difficulty} difficulty 
   * @param {nonce} nonce 
   */
  constructor(index, hash, previousHash, timestamp, data, difficulty, nonce) {
    this.index = index;
    this.hash = hash;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.data = data;
    this.difficulty = difficulty;
    this.nonce = nonce;
  }
}

const BLOCK_GENERATION_INTERVAL = 60; // second
const DIFFICULTY_ADJUSTMENT_INTERVAL = 10; // block

const genesisTransaction = {
  'txIns': [{ 'signature': '', 'txOutId': '', 'txOutIndex': 0 }],
  'txOuts': [{
    'address': '049e95da2a3244a6989e2a153d11beecc02d42a70a27c498903d1e10c2add98ef612d267b52edd2474feb9e8ec560d1a541026b60d31cfaeee3cd3085a27cb3193',
    'amount': COINBASE_AMOUNT
  }],
  'id': '230e3648aab43f05c3156593142b19e3cfb11e9fe02e906b8eba8e83fd720cd1'
};
const genesisBlock = new Block(0,
  "c8f16271df1043e9d3ef1b7a425da2957e27a0afc7841a3f11b6c4a331f52b09",
  "", 1620142630, [genesisTransaction], 0, 0
);

let blockchain = [genesisBlock];
let unspentTxOuts = processTransactions(blockchain[0].data, [], 0);

function getUnspentTxOuts() {
  _.cloneDeep(unspentTxOuts);
}

// and txPool should be only updated at the same time
const setUnspentTxOuts = (newUnspentTxOut) => {
  console.log(`replacing unspentTxouts with: ${newUnspentTxOut}`);
  unspentTxOuts = newUnspentTxOut;
};

/*---------------------- Block function ---------------------*/
function calculateHash(index, previousHash, timestamp, data, difficulty, nonce) {
  return SHA256(index + previousHash + timestamp + JSON.stringify(data) + difficulty + nonce).toString();
}

function calculateHashForBlock(block) {
  return calculateHash(block.index, block.previousHash, block.timestamp, block.data,
    block.difficulty, block.nonce);
}

function hashMatchesDifficulty(hash, difficulty) {
  const hashInBinary = parseInt(hash, 16).toString(2).padStart(8, "0");
  const requiredPrefix = '0'.repeat(difficulty);
  return hashInBinary.startsWith(requiredPrefix);
}

function findBlock(index, previousHash, timestamp, data, difficulty) {
  let nonce = 0;
  let hash = "";
  while (true) {
    hash = calculateHash(index, previousHash, timestamp, data, difficulty, nonce);
    if (hashMatchesDifficulty(hash, difficulty)) {
      return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce);
    }
    nonce++;
  }
}

function getCurrentTimestamp() {
  return Math.round(new Date().getTime() / 1000);
}

function isValidTimestamp(newBlock, previousBlock) {
  return (previousBlock.timestamp - 60 < newBlock.timestamp)
    && (newBlock.timestamp - 60 < getCurrentTimestamp());
}

function hasValidHash(block) {
  if (calculateHashForBlock(block) !== block.hash) {
    console.log('invalid hash, got:' + block.hash);
    return false;
  }

  if (!hashMatchesDifficulty(block.hash, block.difficulty)) {
    console.log('block difficulty not satisfied. Expected: ' + block.difficulty + 'got: ' + block.hash);
  }
  return true;
}

function isValidBlock(newBlock, previousBlock) {
  if (!isValidBlockStructure(newBlock)) {
    console.log(`Invalid structure of block at index: ${newBlock.index}`);
    return false;
  }
  if (newBlock.index !== previousBlock.index + 1) {
    console.log("Invalid index");
    return false;
  } else if (newBlock.previousHash !== previousBlock.hash) {
    console.log("Invalid previous hash");
    return false;
  } else if (!hasValidHash(newBlock)) {
    console.log('invalid hash');
    return false;
  } else if (!isValidTimestamp(newBlock, previousBlock)) {
    console.log("Invalid timestamp");
    return false;
  }
  return true;
}

function isValidBlockStructure(block) {
  return typeof block.index === 'number'
    && typeof block.hash === 'string'
    && typeof block.previousHash === 'string'
    && typeof block.timestamp === 'number'
    && typeof block.data === 'object';
}

/*----------------------- Chain function ----------------------*/
function getDifficulty(chain) {
  const latestBlock = chain[chain.length - 1];
  if (latestBlock.index !== 0 && latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0) {
    return getAdjustedDifficulty(latestBlock, chain);
  }
  return latestBlock.difficulty;
}

function getAdjustedDifficulty(latestBlock, chain) {
  const prevAdjustedDifficulty = chain[chain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
  const expectedTime = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
  const takenTime = latestBlock.timestamp - prevAdjustedDifficulty.timestamp;

  if (takenTime < expectedTime / 2) {
    return prevAdjustedDifficulty.difficulty + 1;
  } else if (takenTime > expectedTime * 2) {
    return prevAdjustedDifficulty.difficulty - 1;
  } else {
    return prevAdjustedDifficulty.difficulty;
  }
}

function generateRawNextBlock(blockData) {
  const previousBlock = getLatestBlock();
  const previousHash = previousBlock.hash;
  const index = previousBlock.index + 1;
  const timestamp = getCurrentTimestamp();
  // const hash = calculateHash(index, previousHash, timestamp, blockData);
  const difficulty = getDifficulty(getBlockChain());
  const newBlock = findBlock(index, previousHash, timestamp, blockData, difficulty);

  if (addBlockToChain(newBlock)) {
    broadcastLatest();
    return newBlock;
  }
  return null;
}

function generateNextBlock() {
  const myAddress = getPublicFromWallet();
  const newBlockIndex = getLatestBlock().index + 1;

  const coinbaseTx = getCoinbaseTransaction(myAddress, newBlockIndex);
  const blockData = [coinbaseTx].concat(getTransactionPool());

  return generateRawNextBlock(blockData);
}

// const generatenextBlockWithTransaction = (receiverAddress, amount) => {
//   if (!isValidAddress(receiverAddress)) {
//     throw Error('invalid address');
//   }
//   if (typeof amount !== 'number') {
//     throw Error('invalid amount');
//   }
//   const coinbaseTx = getCoinbaseTransaction(getPublicFromWallet(), getLatestBlock().index + 1);
//   const tx = createTransaction(receiverAddress, amount, getPrivateFromWallet(), getUnspentTxOuts(), getTransactionPool());
//   const blockData = [coinbaseTx, tx];
//   return generateRawNextBlock(blockData);
// };

function getMyUnspentTransactionOutputs() {
  const myAddress = getPublicFromWallet();
  return findUnspentTxOuts(myAddress, getUnspentTxOuts());
}

function getAccountBalance() {
  const myAddress = getPublicFromWallet();
  return getBalance(myAddress, getUnspentTxOuts());
}

function sendTransaction(receivedAddress, amount) {
  const tx = createTransaction(receivedAddress, amount, getPrivateFromWallet(), getUnspentTxOuts(), getTransactionPool());
  addToTransactionPool(tx, getUnspentTxOuts());
  broadcastTransactionPool();
  return tx;
}

function getBlockChain() {
  return blockchain;
}

function getLatestBlock() {
  return blockchain[blockchain.length - 1];
}

function addBlock(newBlock) {
  if (isValidBlock(newBlock, getLatestBlock())) {
    blockchain.push(newBlock);
  }
}

function isValidChain(blockchain) {
  const isValidGenesis = (block) => {
    return JSON.stringify(block) === JSON.stringify(genesisBlock)
  };

  if (!isValidGenesis(blockchain[0])) {
    return null;
  }

  let aUnspentTxOuts = [];
  for (let i = 1; i < blockchain.length; i++) {
    const currentBlock = blockchain[i];
    if (i !== 0 && !isValidBlock(blockchain[i], blockchain[i - 1])) {
      return null;
    }

    aUnspentTxOuts = processTransactions(currentBlock.data, aUnspentTxOuts, currentBlock.index);
    if (aUnspentTxOuts === null) {
      console.log("Invalid transaction in blockchain");
      return false;
    }
  }

  return aUnspentTxOuts;
}

function getAccumulatedDifficulty(chain) {
  return chain.reduce((sum, block) => {
    return sum + Math.pow(2, block.difficulty);
  }, 0);
}

const addBlockToChain = (newBlock) => {
  if (isValidBlock(newBlock, getLatestBlock())) {
    const retVal = processTransactions(newBlock.data, getUnspentTxOuts(), newBlock.index);
    if (retVal === null) {
      console.log("error in addBlockToChain(): Invalid transactions");
    } else {
      blockchain.push(newBlock);
      setUnspentTxOuts(retVal);
      updateTransactionPool(unspentTxOuts);
      return true;
    }
  }
  return false;
};

function replaceChain(newChain) {
  const aUnspentTxOuts = isValidChain(newChain);
  const validChain = aUnspentTxOuts !== null;
  if (validChain && getAccumulatedDifficulty(newChain) > getAccumulatedDifficulty(getBlockChain())) {
    console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');

    blockchain = newBlocks;

    setUnspentTxOuts(aUnspentTxOuts);
    updateTransactionPool(unspentTxOuts);
    broadcastLatest();
  } else {
    console.log('Received blockchain invalid');
  }
}

function handleReceivedTransaction(transaction) {
  addToTransactionPool(transaction, getUnspentTxOuts());
}

module.exports = {
  Block, getBlockChain, getUnspentTxOuts, getLatestBlock, sendTransaction,
  generateRawNextBlock, generateNextBlock, addBlockToChain,
  handleReceivedTransaction, getMyUnspentTransactionOutputs,
  getAccountBalance, isValidBlockStructure, replaceChain
}