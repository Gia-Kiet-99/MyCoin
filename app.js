const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const { getBlockChain, generateNextBlock, Transaction } = require('./model/blockchain');
const {connectToPeer, getSockets, initP2PServer} = require('./model/p2p');

const httpPort = parseInt(process.env.HTTP_PORT) || 3001;
const p2pPort = parseInt(process.env.P2P_PORT) || 6001;

// const trans = new Transaction();
// console.log(typeof httpPort);

function initHttpServer(httpPort) {
  const app = express();
  app.use(express.json());

  app.get('/blocks', (req, res) => {
    res.send(getBlockChain());
  })

  app.post('/mineBlock', (req, res) => {
    const newBlock = generateNextBlock(req.body.data);
    res.send(newBlock);
  });

  app.get('/peers', (req, res) => {
    res.send(getSockets().map((s) => s._socket.remoteAddress + ':' + s._socket.remotePort));
  });

  app.post('/addPeer', (req, res) => {
    connectToPeer(req.body.peer);
    res.send();
  });

  app.listen(httpPort, () => {
    console.log('Listening http on port: ' + httpPort);
  });
}

initHttpServer(httpPort);
initP2PServer(p2pPort);