const express = require('express');
const NodeService = require('../services/nodeService');
const DeviceManager = require('../devices/deviceManager');

const router = express.Router();
const nodeService = new NodeService();
const deviceManager = new DeviceManager();

// GET /status - Get node and system status
router.get('/', async (req, res) => {
  try {
    // Check node status
    const nodeStatus = await nodeService.checkNodeStatus();
    
    // Get device stats
    const deviceStats = deviceManager.getDeviceStats();
    
    const response = {
      timestamp: new Date().toISOString(),
      node: {
        online: nodeStatus.online,
        lastChecked: nodeStatus.lastChecked,
        blockHeight: nodeStatus.online ? nodeStatus.blocks : 0,
        syncProgress: nodeStatus.online ? nodeStatus.verificationprogress : 0,
        chain: nodeStatus.online ? nodeStatus.chain : 'unknown'
      },
      devices: deviceStats,
      bridge: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0'
      }
    };

    if (nodeStatus.online) {
      res.json(response);
    } else {
      res.status(503).json({
        ...response,
        error: 'Bitcoin Core is offline'
      });
    }
  } catch (error) {
    console.error('[Route] GET /status error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
