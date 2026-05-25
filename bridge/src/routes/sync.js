const express = require('express');
const NodeService = require('../services/nodeService');

const router = express.Router();
const nodeService = new NodeService();

// GET /sync - Get blockchain synchronization status
router.get('/', async (req, res) => {
  try {
    const syncStatus = await nodeService.getSyncStatus();
    
    if (!syncStatus.success) {
      return res.status(503).json({
        error: 'Bitcoin Core is offline',
        message: syncStatus.error
      });
    }

    const data = syncStatus.data;
    const response = {
      timestamp: new Date().toISOString(),
      blockchain: {
        blocks: data.blocks,
        headers: data.headers,
        verificationProgress: Math.round(data.verificationprogress * 10000) / 100, // Round to 2 decimal places
        initialBlockDownload: data.initialblockdownload,
        chain: data.chain
      },
      network: {
        connections: data.connections
      },
      status: {
        isSynced: data.blocks === data.headers && !data.initialblockdownload,
        isInitialDownload: data.initialblockdownload,
        progressPercent: Math.round(data.verificationprogress * 100)
      }
    };

    res.json(response);
  } catch (error) {
    console.error('[Route] GET /sync error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
