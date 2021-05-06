const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const cors = require('cors');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.json({
    message: "Hello from Sakila API"
  });
})

app.use('/api/blocks', require('./route/block.route'));

app.use((req, res, next) => {
  res.status(404).json({
    error_message: 'Endpoint not found'
  })
})

app.use((err, req, res, next) => {
  if (err) {
    res.status(400).json({
      error_message: err.message
    });
  }
});

// app.get('/blocks', (req, res) => {
//   res.json(getBlockChain());
// });

// app.get('/blocks/:hash', (req, res) => {

// });

// app.get('/transaction/:id', (req, res) => {
//   const id = req.params.id;

//   const transaction = getBlockChain().map(block => block.data)
//     .flat().find(tx => tx.id === id);

//   if (!transaction) {
//     return res.status(204).end();
//   }
//   res.json(transaction);
// });

// app.get('/address/:address', (req, res) => {
//   const address = req.params.address;
//   const unspentTxOuts = getUnspentTxOuts().filter(uTxO => uTxO.address === address);

//   res.json(unspentTxOuts);
// });

// app.get('/unspentTransactionOutputs', (req, res) => {
//   res.json(getUnspentTxOuts());
// });

// app.get('/myUnspentTransactionOutputs', (req, res) => {
//   res.json(getMyUnspentTransactionOutputs());
// });

// app.post('/mineRawBlock', (req, res) => {
//   const data = req.body.data;

//   if (!data) {
//     return res.status(400).json("Data to mine not found");
//   }
//   const newBlock = generateRawNextBlock(data);
//   if (newBlock === null) {
//     res.status(400).json('Could not generate block');
//   } else {
//     res.json(newBlock);
//   }
// });

// app.post('/mineBlock', (req, res) => {
//   const newBlock = generateNextBlock();
//   if (newBlock === null) {
//     res.status(400).json('Could not generate block');
//   } else {
//     res.json(newBlock);
//   }
// });

// app.get('/balance', (req, res) => {
//   const balance = getAccountBalance();
//   res.json(balance);
// });

// app.get('/address', (req, res) => {
//   const address = getPublicFromWallet();
//   res.json(address);
// })

// app.post('/sendTransaction', (req, res) => {
//   try {
//     const address = req.body.address;
//     const amount = req.body.amount;
//     if (!address || !amount) {
//       throw Error('Invalid address of amount');
//     }
//     const resp = sendTransaction(address, amount);
//     res.json(resp);
//   } catch (error) {
//     console.log(error.message);
//     res.status(400).json(e.message);
//   }
// })

// app.get('/transactionPool', (req, res) => {
//   res.json(getTransactionPool());
// })

// app.get('/peers', (req, res) => {
//   res.send(getSockets().map((s) => s._socket.remoteAddress + ':' + s._socket.remotePort));
// });

// app.post('/addPeer', (req, res) => {
//   const peer = req.body.peer;
//   connectToPeer(req.body.peer);
//   res.send();
// });



const httpPort = parseInt(process.env.HTTP_PORT) || 3000;
// const p2pPort = parseInt(process.env.P2P_PORT) || 6001;

app.listen(httpPort, () => {
  console.log(`FoxCoin API is running at http://localhost:${httpPort}`);
});