const SHA256 = require('crypto-js').SHA256;
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

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

const BLOCK_GENERATION_INTERVAL = 10;
const DIFFICULTY_ADJUSTMENT_INTERVAL = 10;

const genesisBlock = new Block(0,
  "816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7",
  null,
  new Date().getTime() / 1000,
  "Genesis Block!"
);
let blockchain = [genesisBlock];
let unspentTxOuts = [];

/*---------------------- Block function ---------------------*/
function calculateHash(index, previousHash, timestamp, data, difficulty, nonce) {
  return SHA256(index + previousHash + timestamp + JSON.stringify(data) + difficulty + nonce).toString();
}

function calculateHashForBlock(block) {
  return calculateHash(block.index, block.previousHash, block.timestamp, block.data);
}

function hashMatchsDifficulty(hash, difficulty) {
  const hashInBinary = parseInt(hash, 16).toString(2).padStart(8, "0");
  const requiredPrefix = '0'.repeat(difficulty);
  return hashInBinary.startsWith(requiredPrefix);
}

function findBlock(index, previousHash, timestamp, data, difficulty) {
  let nonce = 0;
  while (true) {
    const hash = calculateHash(index, previousHash, timestamp, data, difficulty, nonce);
    if (hashMatchsDifficulty(hash, difficulty)) {
      return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce);
    }
    nonce++;
  }
}

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

function getCurrentTimestamp() {
  return Math.round(new Date().getTime() / 1000);
}

function isValidTimestamp(newBlock, previousBlock) {
  return (previousBlock.timestamp - 60 < newBlock.timestamp)
    && (newBlock.timestamp - 60 < getCurrentTimestamp());
}

function generateNextBlock(blockData) {
  const previousBlock = getLatestBlock();
  const previousHash = previousBlock.hash;
  const index = previousBlock.index + 1;
  const timestamp = new Date().getTime() / 1000;
  // const hash = calculateHash(index, previousHash, timestamp, blockData);
  const difficulty = getDifficulty(getBlockChain());
  const newBlock = findBlock(index, previousHash, timestamp, blockData, difficulty);
  addBlock(newBlock);
  broadcastLatest();
  return newBlock;
}

function isValidBlock(newBlock, previousBlock) {
  if (!isValidBlockStructure(newBlock)) {
    console.log("Invalid structure");
    return false;
  }
  if (newBlock.index !== previousBlock.index + 1) {
    console.log("Invalid index");
    return false;
  } else if (newBlock.previousHash !== previousBlock.hash) {
    console.log("Invalid previous hash");
    return false;
  } else if (calculateHashForBlock(newBlock) !== newBlock.hash) {
    console.log('invalid hash: ' + calculateHashForBlock(newBlock) + ' ' + newBlock.hash);
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
  // && typeof block.data === 'string';
}

/*----------------------- Chain function ----------------------*/
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

  if (!isValidGenesis(blockchain[0])) return false;

  for (let i = 1; i < blockchain.length; i++) {
    if (!isValidBlock(blockchain[i], blockchain[i - 1]))
      return false;
  }
  return true;
}

function getAccumulatedDifficulty(chain) {
  return chain.reduce((sum, block) => {
    return sum + Math.pow(2, block.difficulty);
  }, 0)
}

function replaceChain(newChain) {
  if (isValidChain(newChain) && getAccumulatedDifficulty(newChain) > getAccumulatedDifficulty(getBlockChain())) {
    console.log("Received blockchain is valid. Replacing current blockchain with received blockchain");
    blockchain = newChain;
    broadcastLatest();
  } else {
    console.log("Received blockchain invalid!");
  }
}

const addBlockToChain = (newBlock) => {
  if (isValidBlock(newBlock, getLatestBlock())) {
    blockchain.push(newBlock);
    return true;
  }
  return false;
};

module.exports = {
  getLatestBlock,
  getBlockChain,
  isValidBlockStructure,
  addBlockToChain,
  replaceChain,
  generateNextBlock
}