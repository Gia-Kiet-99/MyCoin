const WebSocket = require('ws');

const { getLatestBlock, getBlockChain, handleReceivedTransaction,
  isValidBlockStructure, addBlockToChain, replaceChain } = require('./blockchain');
const { transaction } = require('./transaction');
const { getTransactionPool } = require('./transaction-pool');

// const sockets = [];

const MessageType = {
  QUERY_LATEST: 0,
  QUERY_ALL: 1,
  RESPONSE_BLOCKCHAIN: 2,
  QUERY_TRANSACTION_POOL: 3,
  RESPONSE_TRANSACTION_POOL: 4
}

// class Message {
//   constructor(type, data) {
//     this.type = type;
//     this.data = data;
//   }
// }

let server;
function initP2PServer(port) {
  if (!server) {
    server = new WebSocket.Server({ port: port });
    server.on('connection', (ws) => {
      initConnection(ws);
    });
    console.log("Listening websocket p2p port on: " + port);
  }
}

function getSockets() {
  // return sockets;
  return [...server.clients];
}

function initConnection(ws) {
  // sockets.push(ws);
  initMessageHandler(ws);
  initErrorHandler(ws);
  write(ws, queryChainLengthMsg());

  // query transaction pool only some time after chain query
  setTimeout(() => {
    broadcast(queryTransactionPoolMsg());
  }, 500);
}

function initMessageHandler(ws) {
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      if (message === null) {
        console.log("Could not parse received JSON message: " + data);
        return;
      }
      console.log("Received message: " + JSON.stringify(message));
      switch (message.type) {
        case MessageType.QUERY_LATEST:
          write(ws, responseLatestMsg());
          break;
        case MessageType.QUERY_ALL:
          write(ws, responseChainMsg());
          break;
        case MessageType.RESPONSE_BLOCKCHAIN:
          const receivedBlocks = JSON.parse(message.data);
          if (receivedBlocks === null) {
            console.log("Invalid blocks received:");
            console.log(message.data);
            break;
          }
          handleBlockChainResponse(receivedBlocks);
          break;
        case MessageType.QUERY_TRANSACTION_POOL:
          write(ws, responseTransactionPoolMsg());
          break;
        case MessageType.RESPONSE_TRANSACTION_POOL:
          const receivedTransactionPool = JSON.parse(message.data);
          if (receivedTransactionPool === null) {
            console.log("Invalid transaction received: " + JSON.parse(message.data));
            break;
          }
          receivedTransactions.forEach(transaction => {
            try {
              handleReceivedTransaction(transaction);
              // if no error is thrown, transaction was indeed added to the pool
              // let's broadcast transaction pool
              broadcastTransactionPool();
            } catch (e) {
              console.log(e.message);
            }
          });
          break;
      }
    } catch (error) {
      console.log('error in function initMessageHandler!', error);
      // throw new Error()
    }
  });
}

function initErrorHandler(ws) {
  function closeConnection(websocket) {
    console.log("Connection fail to peer: " + websocket.url);
    // sockets.splice(sockets.indexOf(websocket), 1);
  };

  ws.on('close', () => closeConnection(ws));
  ws.on('error', () => closeConnection(ws));
}

/* ------------ Send message --------------*/
function write(ws, message) {
  ws.send(JSON.stringify(message));
}

function broadcast(message) {
  server.clients.forEach(socket => write(socket, message));
}

function broadcastLatest() {
  broadcast(responseLatestMsg());
}

function broadcastTransactionPool() {
  broadcast(responseTransactionPoolMsg());
}


/*------------- Query message -------------*/
function queryChainLengthMsg() {
  return { type: MessageType.QUERY_LATEST, data: null };
}

function queryAllMsg() {
  return { type: MessageType.QUERY_ALL, data: null };
}

function queryTransactionPoolMsg() {
  return { type: MessageType.QUERY_TRANSACTION_POOL, data: null };
}


/*------------  Response message -----------*/
function responseLatestMsg() {
  const latestBlock = getLatestBlock();
  return {
    type: MessageType.RESPONSE_BLOCKCHAIN,
    data: JSON.stringify([latestBlock])
  };
}

function responseChainMsg() {
  return {
    type: MessageType.RESPONSE_BLOCKCHAIN,
    data: JSON.stringify(getBlockChain())
  };
}

function responseTransactionPoolMsg() {
  return {
    type: MessageType.RESPONSE_TRANSACTION_POOL,
    data: JSON.stringify(getTransactionPool())
  };
}


/*-------------- Handle response message ------------*/
function handleBlockChainResponse(receivedBlocks) {
  if (receivedBlocks.length === 0) {
    console.log("Received block chain size of 0");
    return;
  }
  const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
  if (!isValidBlockStructure(latestBlockReceived)) {
    console.log("Block structure not valid");
    return;
  }
  const latestBlockHeld = getLatestBlock();
  if (latestBlockReceived.index > latestBlockHeld.index) {
    console.log('blockchain possibly behind. We got: '
      + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index);
    if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
      if (addBlockToChain(latestBlockReceived)) {
        broadcast(responseLatestMsg());
      }
    } else if (receivedBlocks.length === 1) {
      console.log("We have to query the chain from our peer");
      broadcast(queryAllMsg());
    } else {
      console.log("Received blockchain is longer than current blockchain");
      replaceChain(receivedBlocks);
    }
  } else {
    console.log("Received blockchain is not longer than received blockchain. Do nothing");
  }
}

/* -------------------- Connect to peer ------------------- */
function connectToPeer(newPeer) {
  const ws = new WebSocket(newPeer);
  ws.on('open', () => {
    initConnection(ws);
  });
  ws.on('error', () => {
    console.log('Connection failed');
  });
}

module.exports = {
  connectToPeer,
  broadcastLatest,
  initP2PServer,
  getSockets,
  broadcastTransactionPool
}