const express = require('express');
const NodeService = require('../services/nodeService');

const router = express.Router();
const nodeService = new NodeService();

// GET /network - Get network information
router.get('/', async (req, res) => {
  try {
    const networkStatus = await nodeService.getNetworkStatus();
    
    if (!networkStatus.success) {
      return res.status(503).json({
        error: 'Bitcoin Core is offline',
        message: networkStatus.error
      });
    }

    const data = networkStatus.data;
    const response = {
      timestamp: new Date().toISOString(),
      bitcoin: {
        version: data.version,
        subversion: data.subversion,
        protocolVersion: data.protocolversion
      },
      network: {
        connections: data.connections,
        networks: data.networks,
        relayFee: data.relayfee,
        warnings: data.warnings
      },
      mining: {
        difficulty: data.difficulty,
        networkHashrate: data.networkhashps
      }
    };

    res.json(response);
  } catch (error) {
    console.error('[Route] GET /network error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
