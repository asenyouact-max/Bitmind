const { getRecentEvents, getEventsInTimeRange, getEventsByType } = require('../core/eventStore');

/**
 * Get global mining statistics
 * @returns {Object} Global mining stats
 */
function getGlobalStats() {
  try {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const tenMinutesAgo = now - (10 * 60 * 1000);
    
    // Get all share events
    const acceptedShares = getEventsByType('share_accepted', 10000);
    const rejectedShares = getEventsByType('share_rejected', 10000);
    
    // Calculate basic stats
    const totalShares = acceptedShares.length + rejectedShares.length;
    const acceptedCount = acceptedShares.length;
    const rejectedCount = rejectedShares.length;
    const acceptanceRate = totalShares > 0 ? (acceptedCount / totalShares) * 100 : 0;
    
    // Calculate recent activity (last 10 minutes)
    const recentAccepted = acceptedShares.filter(event => event.timestamp >= tenMinutesAgo);
    const recentRejected = rejectedShares.filter(event => event.timestamp >= tenMinutesAgo);
    const recentTotal = recentAccepted.length + recentRejected.length;
    const recentAcceptanceRate = recentTotal > 0 ? (recentAccepted.length / recentTotal) * 100 : 0;
    
    // Get job statistics
    const jobEvents = getEventsByType('new_job', 1000);
    const currentJob = jobEvents.length > 0 ? jobEvents[0] : null;
    
    // Get block statistics
    const blockEvents = getEventsByType('block_update', 1000);
    const currentBlock = blockEvents.length > 0 ? blockEvents[0] : null;
    
    // Get device statistics
    const deviceRegisterEvents = getEventsByType('device_register', 1000);
    const uniqueDevices = new Set(
      [...deviceRegisterEvents, ...acceptedShares, ...rejectedShares]
        .map(event => event.data.device_id)
        .filter(Boolean)
    );
    
    return {
      shares: {
        total: totalShares,
        accepted: acceptedCount,
        rejected: rejectedCount,
        acceptance_rate: Math.round(acceptanceRate * 100) / 100,
        recent: {
          total: recentTotal,
          accepted: recentAccepted.length,
          rejected: recentRejected.length,
          acceptance_rate: Math.round(recentAcceptanceRate * 100) / 100
        }
      },
      jobs: {
        current: currentJob ? currentJob.data : null,
        total_jobs: jobEvents.length,
        last_job_time: currentJob ? currentJob.timestamp : null
      },
      blocks: {
        current: currentBlock ? currentBlock.data : null,
        total_blocks: blockEvents.length,
        last_block_time: currentBlock ? currentBlock.timestamp : null
      },
      devices: {
        total_registered: uniqueDevices.size,
        total_registrations: deviceRegisterEvents.length
      },
      time_range: {
        earliest: totalShares > 0 ? 
          Math.min(...acceptedShares.map(e => e.timestamp), ...rejectedShares.map(e => e.timestamp)) : null,
        latest: totalShares > 0 ? 
          Math.max(...acceptedShares.map(e => e.timestamp), ...rejectedShares.map(e => e.timestamp)) : null
      }
    };
    
  } catch (error) {
    console.error('[AnalyticsEngine] Failed to get global stats:', error.message);
    return {
      shares: { total: 0, accepted: 0, rejected: 0, acceptance_rate: 0 },
      jobs: { current: null, total_jobs: 0 },
      blocks: { current: null, total_blocks: 0 },
      devices: { total_registered: 0 },
      error: error.message
    };
  }
}

/**
 * Get device-specific statistics
 * @param {string} device_id - Device identifier
 * @returns {Object} Device statistics
 */
function getDeviceStats(device_id) {
  try {
    // Get all events for this device
    const acceptedShares = getEventsByType('share_accepted', 10000)
      .filter(event => event.data.device_id === device_id);
    const rejectedShares = getEventsByType('share_rejected', 10000)
      .filter(event => event.data.device_id === device_id);
    const deviceShareEvents = getEventsByType('device_share', 1000)
      .filter(event => event.data.device_id === device_id);
    
    // Calculate basic stats
    const totalShares = acceptedShares.length + rejectedShares.length;
    const acceptedCount = acceptedShares.length;
    const rejectedCount = rejectedShares.length;
    const acceptanceRate = totalShares > 0 ? (acceptedCount / totalShares) * 100 : 0;
    
    // Calculate recent activity (last 10 minutes)
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    const recentAccepted = acceptedShares.filter(event => event.timestamp >= tenMinutesAgo);
    const recentRejected = rejectedShares.filter(event => event.timestamp >= tenMinutesAgo);
    const recentTotal = recentAccepted.length + recentRejected.length;
    const recentAcceptanceRate = recentTotal > 0 ? (recentAccepted.length / recentTotal) * 100 : 0;
    
    // Get device registration info
    const registrationEvents = getEventsByType('device_register', 1000)
      .filter(event => event.data.device_id === device_id);
    const firstRegistration = registrationEvents.length > 0 ? registrationEvents[registrationEvents.length - 1] : null;
    
    // Calculate basic hashrate (shares per minute in last hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const hourAccepted = acceptedShares.filter(event => event.timestamp >= oneHourAgo);
    const hashrate = hourAccepted.length / 60; // shares per minute
    
    // Get latest device state from device_share events
    const latestDeviceEvent = deviceShareEvents.length > 0 ? deviceShareEvents[0] : null;
    
    return {
      device_id,
      shares: {
        total: totalShares,
        accepted: acceptedCount,
        rejected: rejectedCount,
        acceptance_rate: Math.round(acceptanceRate * 100) / 100,
        recent: {
          total: recentTotal,
          accepted: recentAccepted.length,
          rejected: recentRejected.length,
          acceptance_rate: Math.round(recentAcceptanceRate * 100) / 100
        }
      },
      performance: {
        hashrate: Math.round(hashrate * 100) / 100, // shares per minute
        last_hour_accepted: hourAccepted.length
      },
      registration: {
        first_seen: firstRegistration ? firstRegistration.timestamp : null,
        registration_count: registrationEvents.length
      },
      latest_state: latestDeviceEvent ? latestDeviceEvent.data : null,
      time_range: {
        earliest: totalShares > 0 ? 
          Math.min(...acceptedShares.map(e => e.timestamp), ...rejectedShares.map(e => e.timestamp)) : null,
        latest: totalShares > 0 ? 
          Math.max(...acceptedShares.map(e => e.timestamp), ...rejectedShares.map(e => e.timestamp)) : null
      }
    };
    
  } catch (error) {
    console.error(`[AnalyticsEngine] Failed to get device stats for ${device_id}:`, error.message);
    return {
      device_id,
      shares: { total: 0, accepted: 0, rejected: 0, acceptance_rate: 0 },
      error: error.message
    };
  }
}

/**
 * Get recent activity summary
 * @param {number} limit - Maximum number of events to return
 * @param {number} timeRangeMs - Time range in milliseconds (default: 10 minutes)
 * @returns {Object} Recent activity summary
 */
function getRecentActivity(limit = 50, timeRangeMs = 10 * 60 * 1000) {
  try {
    const now = Date.now();
    const startTime = now - timeRangeMs;
    
    // Get all recent events
    const allRecentEvents = getEventsInTimeRange(startTime, now);
    
    // Sort by timestamp (newest first) and limit
    const limitedEvents = allRecentEvents
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
    
    // Categorize events
    const eventSummary = {
      total: limitedEvents.length,
      by_type: {},
      events: limitedEvents.map(event => ({
        type: event.type,
        timestamp: event.timestamp,
        data: event.data,
        time_ago: now - event.timestamp
      }))
    };
    
    // Count by type
    limitedEvents.forEach(event => {
      eventSummary.by_type[event.type] = (eventSummary.by_type[event.type] || 0) + 1;
    });
    
    return eventSummary;
    
  } catch (error) {
    console.error('[AnalyticsEngine] Failed to get recent activity:', error.message);
    return {
      total: 0,
      by_type: {},
      events: [],
      error: error.message
    };
  }
}

/**
 * Get mining performance metrics
 * @param {number} timeRangeMs - Time range in milliseconds (default: 1 hour)
 * @returns {Object} Performance metrics
 */
function getPerformanceMetrics(timeRangeMs = 60 * 60 * 1000) {
  try {
    const now = Date.now();
    const startTime = now - timeRangeMs;
    
    // Get share events in time range
    const acceptedShares = getEventsInTimeRange(startTime, now, 'share_accepted');
    const rejectedShares = getEventsInTimeRange(startTime, now, 'share_rejected');
    
    // Get device events in time range
    const deviceShareEvents = getEventsInTimeRange(startTime, now, 'device_share');
    
    // Calculate metrics
    const totalShares = acceptedShares.length + rejectedShares.length;
    const acceptanceRate = totalShares > 0 ? (acceptedShares.length / totalShares) * 100 : 0;
    
    // Calculate shares per minute
    const sharesPerMinute = totalShares / (timeRangeMs / (60 * 1000));
    
    // Get unique devices in time range
    const uniqueDevices = new Set(
      deviceShareEvents.map(event => event.data.device_id).filter(Boolean)
    );
    
    // Calculate time-based distribution
    const buckets = 12; // 5-minute buckets for 1 hour
    const bucketSize = timeRangeMs / buckets;
    const timeDistribution = [];
    
    for (let i = 0; i < buckets; i++) {
      const bucketStart = startTime + (i * bucketSize);
      const bucketEnd = bucketStart + bucketSize;
      
      const bucketAccepted = acceptedShares.filter(e => e.timestamp >= bucketStart && e.timestamp < bucketEnd);
      const bucketRejected = rejectedShares.filter(e => e.timestamp >= bucketStart && e.timestamp < bucketEnd);
      
      timeDistribution.push({
        time_start: bucketStart,
        time_end: bucketEnd,
        accepted: bucketAccepted.length,
        rejected: bucketRejected.length,
        total: bucketAccepted.length + bucketRejected.length
      });
    }
    
    return {
      time_range: {
        start: startTime,
        end: now,
        duration_ms: timeRangeMs
      },
      shares: {
        total: totalShares,
        accepted: acceptedShares.length,
        rejected: rejectedShares.length,
        acceptance_rate: Math.round(acceptanceRate * 100) / 100,
        shares_per_minute: Math.round(sharesPerMinute * 100) / 100
      },
      devices: {
        unique_active: uniqueDevices.size,
        device_events: deviceShareEvents.length
      },
      time_distribution: timeDistribution
    };
    
  } catch (error) {
    console.error('[AnalyticsEngine] Failed to get performance metrics:', error.message);
    return {
      error: error.message
    };
  }
}

/**
 * Get system health metrics
 * @returns {Object} System health information
 */
function getSystemHealth() {
  try {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    // Get recent events for health check
    const recentEvents = getEventsInTimeRange(fiveMinutesAgo, now);
    
    // Check for recent activity
    const hasRecentShares = recentEvents.some(e => e.type.includes('share'));
    const hasRecentJobs = recentEvents.some(e => e.type === 'new_job');
    const hasRecentBlocks = recentEvents.some(e => e.type === 'block_update');
    
    // Get WebSocket events
    const wsConnectEvents = getEventsByType('websocket_connect', 100);
    const wsDisconnectEvents = getEventsByType('websocket_disconnect', 100);
    
    // Calculate error rates
    const errorEvents = recentEvents.filter(e => e.type.includes('error') || e.type.includes('reject'));
    const errorRate = recentEvents.length > 0 ? (errorEvents.length / recentEvents.length) * 100 : 0;
    
    return {
      timestamp: now,
      activity: {
        has_recent_shares: hasRecentShares,
        has_recent_jobs: hasRecentJobs,
        has_recent_blocks: hasRecentBlocks,
        total_recent_events: recentEvents.length
      },
      websocket: {
        total_connections: wsConnectEvents.length,
        total_disconnections: wsDisconnectEvents.length,
        active_connections: wsConnectEvents.length - wsDisconnectEvents.length
      },
      health: {
        error_rate: Math.round(errorRate * 100) / 100,
        status: errorRate < 10 && hasRecentShares ? 'healthy' : 'warning'
      }
    };
    
  } catch (error) {
    console.error('[AnalyticsEngine] Failed to get system health:', error.message);
    return {
      timestamp: Date.now(),
      error: error.message,
      status: 'error'
    };
  }
}

module.exports = {
  getGlobalStats,
  getDeviceStats,
  getRecentActivity,
  getPerformanceMetrics,
  getSystemHealth
};
