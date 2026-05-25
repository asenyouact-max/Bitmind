const axios = require('axios');
const { getMetrics } = require('./metricsEngine');
const { getStatus } = require('../mining/jobBroadcaster');
const { getEventStats } = require('../core/eventStore');
const { getStatus: getWebSocketStatus } = require('../ws/miningSocket');

// Bitcoin Core RPC configuration
const RPC_URL = 'http://127.0.0.1:8332';
const RPC_USER = 'bitcoin';
const RPC_PASSWORD = '123456';

// Health check cache
let healthCache = {
  lastCheck: 0,
  cache: null,
  cacheDurationMs: 5000 // 5 seconds
};

/**
 * Check Bitcoin Core connectivity
 * @returns {Object} Bitcoin Core health status
 */
async function checkBitcoinCoreHealth() {
  const startTime = Date.now();
  
  try {
    const rpcClient = axios.create({
      baseURL: RPC_URL,
      auth: {
        username: RPC_USER,
        password: RPC_PASSWORD
      },
      timeout: 5000 // 5 second timeout
    });
    
    // Simple blockchain info request
    const response = await rpcClient.post('/', {
      jsonrpc: "2.0",
      id: "health-check",
      method: "getblockchaininfo",
      params: []
    });
    
    const latency = Date.now() - startTime;
    
    return {
      status: 'ok',
      connected: true,
      latency: latency,
      lastCheck: Date.now(),
      blockHeight: response.data.result?.blocks || null,
      chain: response.data.result?.chain || 'unknown',
      error: null
    };
    
  } catch (error) {
    return {
      status: 'error',
      connected: false,
      latency: null,
      lastCheck: Date.now(),
      blockHeight: null,
      chain: null,
      error: error.message
    };
  }
}

/**
 * Check WebSocket server health
 * @returns {Object} WebSocket server health status
 */
function checkWebSocketHealth() {
  try {
    const wsStatus = getWebSocketStatus();
    
    return {
      status: wsStatus.server_active ? 'ok' : 'error',
      serverActive: wsStatus.server_active,
      connectedClients: wsStatus.connected_clients || 0,
      heartbeatActive: wsStatus.heartbeat_active || false,
      lastCheck: Date.now(),
      error: wsStatus.server_active ? null : 'WebSocket server not active'
    };
    
  } catch (error) {
    return {
      status: 'error',
      serverActive: false,
      connectedClients: 0,
      heartbeatActive: false,
      lastCheck: Date.now(),
      error: error.message
    };
  }
}

/**
 * Check EventStore health
 * @returns {Object} EventStore health status
 */
function checkEventStoreHealth() {
  try {
    const eventStats = getEventStats();
    
    return {
      status: 'ok',
      totalEvents: eventStats.totalEvents || 0,
      recentEvents: eventStats.recentEvents || 0,
      eventTypes: Object.keys(eventStats.eventTypes || {}),
      lastCheck: Date.now(),
      error: null
    };
    
  } catch (error) {
    return {
      status: 'error',
      totalEvents: 0,
      recentEvents: 0,
      eventTypes: [],
      lastCheck: Date.now(),
      error: error.message
    };
  }
}

/**
 * Check JobBroadcaster health
 * @returns {Object} JobBroadcaster health status
 */
function checkJobBroadcasterHealth() {
  try {
    const broadcasterStatus = getStatus();
    
    return {
      status: broadcasterStatus.has_current_job ? 'ok' : 'degraded',
      hasCurrentJob: broadcasterStatus.has_current_job || false,
      jobId: broadcasterStatus.job_id || null,
      cacheValid: broadcasterStatus.cache_valid || false,
      cacheAge: broadcasterStatus.cache_age_ms || 0,
      subscribersCount: broadcasterStatus.subscribers_count || 0,
      isUpdating: broadcasterStatus.is_updating || false,
      blockHeight: broadcasterStatus.block_height || null,
      lastCheck: Date.now(),
      error: broadcasterStatus.has_current_job ? null : 'No current job available'
    };
    
  } catch (error) {
    return {
      status: 'error',
      hasCurrentJob: false,
      jobId: null,
      cacheValid: false,
      cacheAge: 0,
      subscribersCount: 0,
      isUpdating: false,
      blockHeight: null,
      lastCheck: Date.now(),
      error: error.message
    };
  }
}

/**
 * Check system resource health
 * @returns {Object} System resource health status
 */
function checkSystemHealth() {
  try {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Memory thresholds (in MB)
    const memoryThresholds = {
      warning: 500, // 500MB
      critical: 1000 // 1GB
    };
    
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    let memoryStatus = 'ok';
    
    if (heapUsedMB > memoryThresholds.critical) {
      memoryStatus = 'critical';
    } else if (heapUsedMB > memoryThresholds.warning) {
      memoryStatus = 'warning';
    }
    
    return {
      status: memoryStatus,
      uptime: uptime,
      memoryUsage: {
        heapUsed: Math.round(heapUsedMB * 100) / 100,
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100,
        rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100
      },
      cpuUsage: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      lastCheck: Date.now(),
      error: null
    };
    
  } catch (error) {
    return {
      status: 'error',
      uptime: 0,
      memoryUsage: {},
      cpuUsage: {},
      nodeVersion: process.version,
      platform: process.platform,
      lastCheck: Date.now(),
      error: error.message
    };
  }
}

/**
 * Get overall system health
 * @param {Object} options - Health check options
 * @returns {Object} Overall system health
 */
async function getSystemHealth(options = {}) {
  const now = Date.now();
  
  // Check if we can use cached results
  if (!options.force && healthCache.cache && (now - healthCache.lastCheck) < healthCache.cacheDurationMs) {
    return healthCache.cache;
  }
  
  try {
    // Run all health checks in parallel
    const [
      bitcoinHealth,
      websocketHealth,
      eventStoreHealth,
      jobBroadcasterHealth,
      systemHealth
    ] = await Promise.all([
      checkBitcoinCoreHealth(),
      checkWebSocketHealth(),
      checkEventStoreHealth(),
      checkJobBroadcasterHealth(),
      Promise.resolve(checkSystemHealth())
    ]);
    
    // Get metrics for additional health information
    const metrics = getMetrics();
    
    // Determine overall system status
    const componentStatuses = [
      bitcoinHealth.status,
      websocketHealth.status,
      eventStoreHealth.status,
      jobBroadcasterHealth.status,
      systemHealth.status
    ];
    
    let overallStatus = 'ok';
    
    if (componentStatuses.includes('critical') || componentStatuses.includes('error')) {
      overallStatus = 'critical';
    } else if (componentStatuses.includes('degraded') || componentStatuses.includes('warning')) {
      overallStatus = 'degraded';
    }
    
    const healthResult = {
      status: overallStatus,
      timestamp: now,
      uptime: systemHealth.uptime,
      components: {
        bitcoinCore: bitcoinHealth,
        websocket: websocketHealth,
        eventStore: eventStoreHealth,
        jobBroadcaster: jobBroadcasterHealth,
        system: systemHealth
      },
      metrics: {
        requests: {
          total: metrics.requests?.total || 0,
          errors: metrics.requests?.errors || 0,
          errorRate: metrics.requests?.total > 0 ? 
            Math.round((metrics.requests.errors / metrics.requests.total) * 100 * 100) / 100 : 0
        },
        mining: {
          sharesAccepted: metrics.mining?.sharesAccepted || 0,
          sharesRejected: metrics.mining?.sharesRejected || 0,
          acceptanceRate: metrics.mining?.sharesAccepted && metrics.mining?.sharesRejected ?
            Math.round((metrics.mining.sharesAccepted / (metrics.mining.sharesAccepted + metrics.mining.sharesRejected)) * 100 * 100) / 100 : 0
        },
        websocket: {
          activeConnections: metrics.websocket?.activeConnections || 0,
          totalConnections: metrics.websocket?.totalConnections || 0
        },
        devices: {
          active: metrics.devices?.activeDevicesCount || 0,
          total: metrics.devices?.totalDevicesRegistered || 0
        }
      },
      summary: {
        criticalIssues: componentStatuses.filter(s => s === 'critical' || s === 'error').length,
        warnings: componentStatuses.filter(s => s === 'degraded' || s === 'warning').length,
        healthyComponents: componentStatuses.filter(s => s === 'ok').length
      }
    };
    
    // Cache the result
    healthCache = {
      lastCheck: now,
      cache: healthResult,
      cacheDurationMs: healthCache.cacheDurationMs
    };
    
    return healthResult;
    
  } catch (error) {
    console.error('[HealthService] Failed to get system health:', error.message);
    
    const errorHealth = {
      status: 'critical',
      timestamp: now,
      uptime: 0,
      components: {},
      metrics: {},
      summary: {
        criticalIssues: 1,
        warnings: 0,
        healthyComponents: 0
      },
      error: error.message
    };
    
    return errorHealth;
  }
}

/**
 * Get quick health status (for load balancers etc)
 * @returns {Object} Quick health status
 */
async function getQuickHealth() {
  try {
    const fullHealth = await getSystemHealth();
    
    return {
      status: fullHealth.status,
      timestamp: fullHealth.timestamp,
      uptime: fullHealth.uptime,
      healthy: fullHealth.status === 'ok'
    };
    
  } catch (error) {
    return {
      status: 'critical',
      timestamp: Date.now(),
      uptime: 0,
      healthy: false,
      error: error.message
    };
  }
}

/**
 * Force health cache refresh
 */
function refreshHealthCache() {
  healthCache.lastCheck = 0;
}

module.exports = {
  getSystemHealth,
  getQuickHealth,
  refreshHealthCache,
  checkBitcoinCoreHealth,
  checkWebSocketHealth,
  checkEventStoreHealth,
  checkJobBroadcasterHealth,
  checkSystemHealth
};
