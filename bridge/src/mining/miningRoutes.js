const express = require('express');
const router = express.Router();
const { validateShare, getCurrentJob } = require('./miningService');
const { getCurrentJob: getBroadcasterJob, getStatus } = require('./jobBroadcaster');
const { registerDevice, getDeviceStats: getRegistryDeviceStats, getAllDevices } = require('./deviceRegistry');
const { getShareStats, getRecentShares } = require('./shareLedger');
const { getStatus: getWebSocketStatus } = require('../ws/miningSocket');
const { storeEvent, getEventStats } = require('../core/eventStore');
const { 
  getGlobalStats, 
  getDeviceStats: getAnalyticsDeviceStats, 
  getRecentActivity, 
  getPerformanceMetrics, 
  getSystemHealth 
} = require('./analyticsEngine');
const { increment, startTimer, endTimer } = require('../monitoring/metricsEngine');

// GET /mining/job - Get current mining job
router.get('/job', async (req, res) => {
  const timerId = startTimer('job-request');
  
  try {
    increment('mining', 'jobsRequested');
    
    const currentJob = await getBroadcasterJob();
    const broadcasterStatus = getStatus();
    
    // Track cache performance
    if (broadcasterStatus.cache_valid) {
      increment('mining', 'jobsFromCache');
      increment('jobBroadcaster', 'cacheHits');
    } else {
      increment('mining', 'jobsFromRpc');
      increment('jobBroadcaster', 'cacheMisses');
    }
    
    if (!currentJob) {
      return res.status(503).json({
        status: 'error',
        message: 'No mining job available'
      });
    }
    
    // Extract only the required fields for mining job
    const job = {
      job_id: currentJob.job_id,
      height: currentJob.height,
      previousblockhash: currentJob.previousblockhash,
      bits: currentJob.bits,
      curtime: currentJob.curtime,
      target: currentJob.target
    };

    res.json({
      status: 'ok',
      job: job
    });

  } catch (error) {
    console.error('[MiningRoutes] Error fetching mining job:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch mining job'
    });
  } finally {
    endTimer(timerId, 'mining', 'shareValidationLatency');
  }
});

// Helper function to validate 64-character hex string
function isValidHex64(str) {
  return typeof str === "string" && /^[a-fA-F0-9]{64}$/.test(str);
}

// POST /mining/share - Submit mining share from ESP32
router.post('/share', (req, res) => {
  const { device_id, job_id, nonce, hash } = req.body;
  const timerId = startTimer('share-validation');

  if (!device_id || !job_id || !nonce || !hash) {
    return res.status(400).json({
      status: "error",
      message: "Missing required fields: device_id, job_id, nonce, hash"
    });
  }

  // Validate device_id format (basic check)
  if (typeof device_id !== 'string' || device_id.length < 3) {
    return res.status(400).json({
      status: "rejected",
      valid: false,
      message: "Invalid device_id format"
    });
  }

  if (!isValidHex64(hash)) {
    return res.status(400).json({
      status: "rejected",
      valid: false,
      message: "Invalid hash format"
    });
  }

  try {
    // Register device if new
    registerDevice(device_id);
    
    // Create share object for validation
    const share = {
      device_id,
      job_id,
      nonce,
      hash: hash.toLowerCase()
    };
    
    // Validate share
    const result = validateShare(share);
    
    console.log(`[MiningRoutes] Share submission from ${device_id}: ${result.status}`);
    
    // Track share metrics
    if (result.valid) {
      increment('mining', 'sharesAccepted');
    } else {
      increment('mining', 'sharesRejected');
    }
    
    // Log share event
    storeEvent(`share_${result.status}`, {
      device_id,
      job_id,
      nonce,
      hash: share.hash,
      valid: result.valid,
      message: result.message,
      timestamp: Date.now()
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('[MiningRoutes] Error processing share:', error.message);
    res.status(500).json({
      status: 'rejected',
      valid: false,
      message: 'Internal server error'
    });
  } finally {
    endTimer(timerId, 'mining', 'shareValidationLatency');
  }
});

// POST /device/register - Register a new mining device
router.post('/register', async (req, res) => {
  try {
    increment('mining', 'deviceRegistrations');
    
    const { id, name, wallet, worker } = req.body;
    
    // Validate required fields
    if (!id || !name || !wallet) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: id, name, wallet'
      });
    }
    
    // Validate wallet address format (basic validation)
    if (!wallet.startsWith('bc1') && !wallet.startsWith('1') && !wallet.startsWith('3')) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid wallet address format'
      });
    }
    
    // Register the device
    const deviceData = {
      id,
      name,
      wallet,
      worker: worker || null,
      registered_at: new Date().toISOString(),
      online: false,
      last_seen: null,
      accepted_shares: 0,
      rejected_shares: 0,
      estimated_hashrate: '0 MH/s'
    };
    
    registerDevice(id, deviceData);
    
    // Store registration event
    storeEvent('device_registered', {
      device_id: id,
      name,
      wallet,
      worker,
      timestamp: deviceData.registered_at
    });
    
    console.log(`[MiningRoutes] Device registered: ${id} (${name})`);
    
    res.json({
      status: 'ok',
      message: 'Device registered successfully',
      device: deviceData
    });
    
  } catch (error) {
    console.error('[MiningRoutes] Error registering device:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to register device'
    });
  }
});

// GET /mining/devices - Get all registered devices
router.get('/devices', (req, res) => {
  try {
    const devices = getAllDevices();
    res.json({
      status: 'ok',
      devices: devices,
      count: devices.length
    });
  } catch (error) {
    console.error('[MiningRoutes] Error fetching devices:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get devices'
    });
  }
});

// GET /mining/devices/:deviceId - Get specific device stats
router.get('/devices/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = getRegistryDeviceStats(deviceId);
    
    if (!device) {
      return res.status(404).json({
        status: 'error',
        message: 'Device not found'
      });
    }
    
    res.json({
      status: 'ok',
      device: device
    });
  } catch (error) {
    console.error('[MiningRoutes] Error fetching device stats:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch device stats'
    });
  }
});

// GET /mining/stats - Get overall mining statistics
router.get('/stats', (req, res) => {
  try {
    const shareStats = getShareStats();
    const devices = getAllDevices();
    const recentShares = getRecentShares(10);
    
    res.json({
      status: 'ok',
      stats: {
        shares: shareStats,
        devices: {
          total: devices.length,
          online: devices.filter(d => d.online).length,
          offline: devices.filter(d => !d.online).length
        },
        recent_activity: recentShares
      }
    });
  } catch (error) {
    console.error('[MiningRoutes] Error fetching stats:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch statistics'
    });
  }
});

// GET /mining/broadcaster/status - Get job broadcaster status
router.get('/broadcaster/status', (req, res) => {
  try {
    const status = getStatus();
    res.json({
      status: 'ok',
      broadcaster: status
    });
  } catch (error) {
    console.error('[MiningRoutes] Error fetching broadcaster status:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch broadcaster status'
    });
  }
});

// GET /mining/websocket/status - Get WebSocket server status
router.get('/websocket/status', (req, res) => {
  try {
    const status = getWebSocketStatus();
    res.json({
      status: 'ok',
      websocket: status
    });
  } catch (error) {
    console.error('[MiningRoutes] Error fetching WebSocket status:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch WebSocket status'
    });
  }
});

// GET /mining/analytics/global - Get global mining analytics
router.get('/analytics/global', (req, res) => {
  try {
    const stats = getGlobalStats();
    res.json({
      status: 'ok',
      analytics: stats
    });
  } catch (error) {
    console.error('[MiningRoutes] Error fetching global analytics:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch global analytics'
    });
  }
});

// GET /mining/analytics/device/:deviceId - Get device-specific analytics
router.get('/analytics/device/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const stats = getAnalyticsDeviceStats(deviceId);
    
    if (!stats || stats.error) {
      return res.status(404).json({
        status: 'error',
        message: 'Device not found or no data available'
      });
    }
    
    res.json({
      status: 'ok',
      analytics: stats
    });
  } catch (error) {
    console.error('[MiningRoutes] Error fetching device analytics:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch device analytics'
    });
  }
});

// GET /mining/analytics/activity - Get recent activity
router.get('/analytics/activity', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const timeRange = parseInt(req.query.timeRange) || 10 * 60 * 1000; // 10 minutes default
    
    const activity = getRecentActivity(limit, timeRange);
    res.json({
      status: 'ok',
      analytics: activity
    });
  } catch (error) {
    console.error('[MiningRoutes] Error fetching recent activity:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch recent activity'
    });
  }
});

// GET /mining/analytics/performance - Get performance metrics
router.get('/analytics/performance', (req, res) => {
  try {
    const timeRange = parseInt(req.query.timeRange) || 60 * 60 * 1000; // 1 hour default
    
    const metrics = getPerformanceMetrics(timeRange);
    res.json({
      status: 'ok',
      analytics: metrics
    });
  } catch (error) {
    console.error('[MiningRoutes] Error fetching performance metrics:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch performance metrics'
    });
  }
});

// GET /mining/analytics/health - Get system health
router.get('/analytics/health', (req, res) => {
  try {
    const health = getSystemHealth();
    res.json({
      status: 'ok',
      analytics: health
    });
  } catch (error) {
    console.error('[MiningRoutes] Error fetching system health:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch system health'
    });
  }
});

// GET /mining/analytics/events - Get event statistics
router.get('/analytics/events', (req, res) => {
  try {
    const stats = getEventStats();
    res.json({
      status: 'ok',
      analytics: stats
    });
  } catch (error) {
    console.error('[MiningRoutes] Error fetching event stats:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch event statistics'
    });
  }
});

module.exports = router;
