const express = require('express');
const MiningController = require('../mining/miningController');
const DeviceManager = require('../devices/deviceManager');

const router = express.Router();
const miningController = new MiningController();
const deviceManager = new DeviceManager();

// POST /mining/start - Start the mining system
router.post('/start', async (req, res) => {
  try {
    const result = await miningController.start();
    res.json(result);
  } catch (error) {
    console.error('[Route] POST /mining/start error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// POST /mining/stop - Stop the mining system
router.post('/stop', async (req, res) => {
  try {
    const result = await miningController.stop();
    res.json(result);
  } catch (error) {
    console.error('[Route] POST /mining/stop error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /mining/job - Get current mining job
router.get('/job', async (req, res) => {
  try {
    const result = await miningController.getCurrentJob();
    res.json(result);
  } catch (error) {
    console.error('[Route] GET /mining/job error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// POST /mining/share - Submit a mining share
router.post('/share', async (req, res) => {
  try {
    const { deviceId, jobId, hash, nonce } = req.body;
    
    if (!deviceId || !jobId || !hash || !nonce) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['deviceId', 'jobId', 'hash', 'nonce']
      });
    }

    const result = await miningController.submitShare(deviceId, jobId, hash, nonce);
    res.json(result);
  } catch (error) {
    console.error('[Route] POST /mining/share error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /mining/shares - Get all shares or device-specific shares
router.get('/shares', async (req, res) => {
  try {
    const { deviceId } = req.query;
    const result = await miningController.getShares(deviceId);
    res.json(result);
  } catch (error) {
    console.error('[Route] GET /mining/shares error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /mining/stats - Get mining system statistics
router.get('/stats', async (req, res) => {
  try {
    const result = await miningController.getJobStats();
    res.json(result);
  } catch (error) {
    console.error('[Route] GET /mining/stats error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /mining/status - Get mining system status
router.get('/status', async (req, res) => {
  try {
    const result = await miningController.getSystemStatus();
    res.json(result);
  } catch (error) {
    console.error('[Route] GET /mining/status error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
