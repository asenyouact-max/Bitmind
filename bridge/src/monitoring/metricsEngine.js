/**
 * Metrics Engine for Bitmind v6
 * Real-time metrics collection and aggregation
 */

// Metrics storage
let metrics = {
  // Request metrics
  requests: {
    total: 0,
    perEndpoint: {},
    errors: 0
  },
  
  // Mining metrics
  mining: {
    jobsRequested: 0,
    jobsFromCache: 0,
    jobsFromRpc: 0,
    sharesAccepted: 0,
    sharesRejected: 0,
    shareValidationLatency: [],
    averageShareLatency: 0
  },
  
  // Bitcoin Core metrics
  bitcoin: {
    rpcCallsCount: 0,
    rpcLatency: [],
    averageRpcLatency: 0,
    lastRpcSuccess: null,
    lastRpcError: null
  },
  
  // WebSocket metrics
  websocket: {
    connections: 0,
    totalConnections: 0,
    disconnections: 0,
    messagesBroadcast: 0,
    activeConnections: 0
  },
  
  // Device metrics
  devices: {
    activeDevicesCount: 0,
    totalDevicesRegistered: 0,
    deviceRegistrations: 0
  },
  
  // System metrics
  system: {
    uptime: 0,
    startTime: Date.now(),
    memoryUsage: {},
    lastReset: Date.now()
  },
  
  // EventStore metrics
  eventStore: {
    eventsStored: 0,
    eventsRecovered: 0,
    writeOperations: 0,
    writeLatency: [],
    averageWriteLatency: 0
  },
  
  // JobBroadcaster metrics
  jobBroadcaster: {
    jobUpdatesCount: 0,
    blockTriggeredUpdates: 0,
    timeTriggeredUpdates: 0,
    subscribersCount: 0,
    cacheHits: 0,
    cacheMisses: 0
  }
};

// Performance tracking
let performanceTimers = new Map();

/**
 * Increment a metric counter
 * @param {string} category - Metric category (e.g., 'requests', 'mining')
 * @param {string} metric - Metric name (e.g., 'total', 'sharesAccepted')
 * @param {number} value - Value to increment (default: 1)
 * @param {Object} metadata - Optional metadata
 */
function increment(category, metric, value = 1, metadata = {}) {
  try {
    if (!metrics[category]) {
      metrics[category] = {};
    }
    
    if (!metrics[category][metric]) {
      metrics[category][metric] = 0;
    }
    
    metrics[category][metric] += value;
    
    // Special handling for endpoint tracking
    if (category === 'requests' && metadata.endpoint) {
      if (!metrics.requests.perEndpoint[metadata.endpoint]) {
        metrics.requests.perEndpoint[metadata.endpoint] = 0;
      }
      metrics.requests.perEndpoint[metadata.endpoint] += value;
    }
    
    // Special handling for latency tracking
    if (metric.includes('Latency') && Array.isArray(metrics[category][metric])) {
      // Latency arrays are handled separately
    }
    
  } catch (error) {
    console.error('[MetricsEngine] Failed to increment metric:', error.message);
  }
}

/**
 * Record a latency measurement
 * @param {string} category - Metric category
 * @param {string} metric - Latency metric name
 * @param {number} latency - Latency in milliseconds
 */
function recordLatency(category, metric, latency) {
  try {
    if (!metrics[category]) {
      metrics[category] = {};
    }
    
    if (!metrics[category][metric]) {
      metrics[category][metric] = [];
    }
    
    // Add latency measurement
    metrics[category][metric].push(latency);
    
    // Keep only last 100 measurements to prevent memory growth
    if (metrics[category][metric].length > 100) {
      metrics[category][metric] = metrics[category][metric].slice(-100);
    }
    
    // Update average
    const avgMetric = metric.replace('Latency', 'AverageLatency');
    if (metrics[category][metric].length > 0) {
      const sum = metrics[category][metric].reduce((a, b) => a + b, 0);
      metrics[category][avgMetric] = Math.round((sum / metrics[category][metric].length) * 100) / 100;
    }
    
  } catch (error) {
    console.error('[MetricsEngine] Failed to record latency:', error.message);
  }
}

/**
 * Start a performance timer
 * @param {string} name - Timer name
 * @returns {string} Timer ID
 */
function startTimer(name) {
  const timerId = `${name}-${Date.now()}-${Math.random()}`;
  performanceTimers.set(timerId, {
    name,
    startTime: process.hrtime.bigint()
  });
  return timerId;
}

/**
 * End a performance timer and record latency
 * @param {string} timerId - Timer ID
 * @param {string} category - Metric category
 * @param {string} metric - Latency metric name
 */
function endTimer(timerId, category, metric) {
  try {
    const timer = performanceTimers.get(timerId);
    if (!timer) {
      return;
    }
    
    const endTime = process.hrtime.bigint();
    const startTime = timer.startTime;
    const latencyNs = endTime - startTime;
    const latencyMs = Number(latencyNs) / 1000000; // Convert nanoseconds to milliseconds
    
    recordLatency(category, metric, latencyMs);
    performanceTimers.delete(timerId);
    
  } catch (error) {
    console.error('[MetricsEngine] Failed to end timer:', error.message);
  }
}

/**
 * Get current metrics
 * @param {Object} options - Options for metrics retrieval
 * @returns {Object} Current metrics
 */
function getMetrics(options = {}) {
  try {
    const now = Date.now();
    const uptime = now - metrics.system.startTime;
    
    // Update system metrics
    metrics.system.uptime = uptime;
    metrics.system.memoryUsage = process.memoryUsage();
    
    // Calculate active WebSocket connections
    metrics.websocket.activeConnections = metrics.websocket.totalConnections - metrics.websocket.disconnections;
    
    // Create a copy to avoid external modification
    const metricsCopy = JSON.parse(JSON.stringify(metrics));
    
    // Apply filters if provided
    if (options.category) {
      return {
        [options.category]: metricsCopy[options.category] || {}
      };
    }
    
    return metricsCopy;
    
  } catch (error) {
    console.error('[MetricsEngine] Failed to get metrics:', error.message);
    return {};
  }
}

/**
 * Reset metrics
 * @param {string} category - Optional category to reset (default: all)
 */
function resetMetrics(category = null) {
  try {
    if (category) {
      if (metrics[category]) {
        // Reset specific category but keep structure
        const categoryStructure = metrics[category];
        Object.keys(categoryStructure).forEach(key => {
          if (typeof categoryStructure[key] === 'number') {
            categoryStructure[key] = 0;
          } else if (Array.isArray(categoryStructure[key])) {
            categoryStructure[key] = [];
          } else if (typeof categoryStructure[key] === 'object') {
            Object.keys(categoryStructure[key]).forEach(subKey => {
              if (typeof categoryStructure[key][subKey] === 'number') {
                categoryStructure[key][subKey] = 0;
              }
            });
          }
        });
        
        // Reset special fields
        if (category === 'system') {
          metrics.system.startTime = Date.now();
          metrics.system.lastReset = Date.now();
        }
      }
    } else {
      // Reset all metrics
      Object.keys(metrics).forEach(cat => {
        resetMetrics(cat);
      });
    }
    
    console.log(`[MetricsEngine] Metrics reset${category ? ` for category: ${category}` : ''}`);
    
  } catch (error) {
    console.error('[MetricsEngine] Failed to reset metrics:', error.message);
  }
}

/**
 * Get metrics summary for quick overview
 * @returns {Object} Metrics summary
 */
function getMetricsSummary() {
  try {
    const currentMetrics = getMetrics();
    
    return {
      requests: {
        total: currentMetrics.requests?.total || 0,
        errors: currentMetrics.requests?.errors || 0,
        endpoints: Object.keys(currentMetrics.requests?.perEndpoint || {}).length
      },
      mining: {
        sharesAccepted: currentMetrics.mining?.sharesAccepted || 0,
        sharesRejected: currentMetrics.mining?.sharesRejected || 0,
        acceptanceRate: calculateAcceptanceRate(currentMetrics.mining),
        averageLatency: currentMetrics.mining?.averageShareLatency || 0
      },
      system: {
        uptime: currentMetrics.system?.uptime || 0,
        memoryMB: Math.round((currentMetrics.system?.memoryUsage?.heapUsed || 0) / 1024 / 1024)
      },
      websocket: {
        activeConnections: currentMetrics.websocket?.activeConnections || 0,
        totalConnections: currentMetrics.websocket?.totalConnections || 0
      },
      devices: {
        active: currentMetrics.devices?.activeDevicesCount || 0,
        total: currentMetrics.devices?.totalDevicesRegistered || 0
      }
    };
    
  } catch (error) {
    console.error('[MetricsEngine] Failed to get metrics summary:', error.message);
    return {};
  }
}

/**
 * Calculate acceptance rate
 * @param {Object} miningMetrics - Mining metrics object
 * @returns {number} Acceptance rate percentage
 */
function calculateAcceptanceRate(miningMetrics) {
  if (!miningMetrics) return 0;
  
  const total = (miningMetrics.sharesAccepted || 0) + (miningMetrics.sharesRejected || 0);
  if (total === 0) return 0;
  
  return Math.round(((miningMetrics.sharesAccepted || 0) / total) * 100 * 100) / 100;
}

/**
 * Clean up old performance timers
 */
function cleanupTimers() {
  const now = Date.now();
  const timeoutMs = 60000; // 1 minute timeout
  
  for (const [timerId, timer] of performanceTimers.entries()) {
    const age = now - Number(timer.startTime.toString().slice(0, -6)); // Approximate age check
    if (age > timeoutMs) {
      performanceTimers.delete(timerId);
    }
  }
}

// Periodic cleanup
setInterval(cleanupTimers, 30000); // Clean up every 30 seconds

module.exports = {
  increment,
  recordLatency,
  startTimer,
  endTimer,
  getMetrics,
  getMetricsSummary,
  resetMetrics
};
