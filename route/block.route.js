const express = require('express');
const router = express.Router();

const blockModel = require('../model/blockchain');

router.get('/', (req, res) => {
  const blocks = blockModel.getBlockChain();
  res.json(blocks);
});

router.get('/:hash', (req, res) => {
  const hash = req.params.hash;
  // console.log("hash: " + hash);
  const block = blockModel.getBlockChain().find(block => block.hash === hash);

  if(block) {
    return res.json(block);
  }

  res.status(204).end();
});


module.exports = router;