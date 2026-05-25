const express = require('express');
const router = express.Router();
const { getMetrics, getMetricsSummary } = require('./metricsEngine');
const { getSystemHealth, getQuickHealth } = require('./healthService');
const { getGlobalStats } = require('../mining/analyticsEngine');
const { getAllDevices } = require('../mining/deviceRegistry');

// GET /metrics - Get live metrics
router.get('/metrics', (req, res) => {
  try {
    const category = req.query.category;
    const metrics = category ? getMetrics({ category }) : getMetrics();
    
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      metrics: metrics
    });
  } catch (error) {
    console.error('[MonitoringRoutes] Error fetching metrics:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch metrics'
    });
  }
});

// GET /metrics/summary - Get metrics summary
router.get('/metrics/summary', (req, res) => {
  try {
    const summary = getMetricsSummary();
    
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      summary: summary
    });
  } catch (error) {
    console.error('[MonitoringRoutes] Error fetching metrics summary:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch metrics summary'
    });
  }
});

// GET /health - Get system health
router.get('/health', async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const health = await getSystemHealth({ force });
    
    // Set HTTP status based on health status
    let httpStatus = 200;
    if (health.status === 'critical') {
      httpStatus = 503; // Service Unavailable
    } else if (health.status === 'degraded') {
      httpStatus = 200; // Still OK but degraded
    }
    
    res.status(httpStatus).json({
      status: 'ok',
      health: health
    });
  } catch (error) {
    console.error('[MonitoringRoutes] Error fetching health:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch system health'
    });
  }
});

// GET /health/quick - Get quick health status (for load balancers)
router.get('/health/quick', async (req, res) => {
  try {
    const health = await getQuickHealth();
    
    // Set HTTP status based on health status
    let httpStatus = 200;
    if (!health.healthy) {
      httpStatus = 503; // Service Unavailable
    }
    
    res.status(httpStatus).json(health);
  } catch (error) {
    console.error('[MonitoringRoutes] Error fetching quick health:', error.message);
    res.status(503).json({
      status: 'critical',
      healthy: false,
      error: error.message
    });
  }
});

// GET /stats/overview - Combined overview of all systems
router.get('/stats/overview', async (req, res) => {
  try {
    // Get data from all systems in parallel
    const [
      metricsSummary,
      health,
      analytics,
      devices
    ] = await Promise.all([
      Promise.resolve(getMetricsSummary()),
      getSystemHealth(),
      Promise.resolve(getGlobalStats()),
      Promise.resolve(getAllDevices())
    ]);
    
    const overview = {
      timestamp: Date.now(),
      system: {
        status: health.status,
        uptime: health.uptime,
        memoryUsage: health.components.system.memoryUsage
      },
      mining: {
        ...analytics.shares,
        currentJob: analytics.jobs.current ? {
          jobId: analytics.jobs.current.job_id,
          height: analytics.jobs.current.height
        } : null,
        currentBlock: analytics.blocks.current ? {
          height: analytics.blocks.current.height
        } : null
      },
      devices: {
        online: devices.filter(d => d.online).length,
        total: devices.length,
        list: devices.map(d => ({
          id: d.device_id,
          online: d.online,
          shares: d.total_shares,
          acceptanceRate: d.acceptance_rate
        }))
      },
      performance: {
        requests: metricsSummary.requests,
        averageLatency: metricsSummary.mining.averageLatency,
        websocketConnections: metricsSummary.websocket.activeConnections
      },
      components: {
        bitcoinCore: health.components.bitcoinCore.status,
        websocket: health.components.websocket.status,
        eventStore: health.components.eventStore.status,
        jobBroadcaster: health.components.jobBroadcaster.status
      }
    };
    
    res.json({
      status: 'ok',
      overview: overview
    });
  } catch (error) {
    console.error('[MonitoringRoutes] Error fetching overview:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch system overview'
    });
  }
});

// GET /metrics/reset - Reset metrics (admin only)
router.post('/metrics/reset', (req, res) => {
  try {
    const category = req.body.category;
    
    // Basic security check - in production, this should be protected
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== 'bitmind-admin-2024') {
      return res.status(403).json({
        status: 'error',
        message: 'Admin access required'
      });
    }
    
    const { resetMetrics } = require('./metricsEngine');
    resetMetrics(category);
    
    res.json({
      status: 'ok',
      message: `Metrics reset${category ? ` for category: ${category}` : ' completely'}`,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[MonitoringRoutes] Error resetting metrics:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reset metrics'
    });
  }
});

// GET /health/refresh - Force refresh health cache
router.post('/health/refresh', (req, res) => {
  try {
    const { refreshHealthCache } = require('./healthService');
    refreshHealthCache();
    
    res.json({
      status: 'ok',
      message: 'Health cache refreshed',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[MonitoringRoutes] Error refreshing health cache:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to refresh health cache'
    });
  }
});

module.exports = router;
