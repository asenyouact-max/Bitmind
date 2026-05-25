const fs = require('fs').promises;
const path = require('path');

// Event store configuration
const EVENT_LOG_FILE = path.join(__dirname, '../../data/events.json');
const MAX_EVENTS_PER_FILE = 10000;
const MAX_MEMORY_EVENTS = 1000;

// In-memory event cache for fast access
let eventCache = [];
let eventBuffer = [];
let isWriting = false;
let writeInterval = null;

/**
 * Initialize event store
 */
async function initialize() {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(EVENT_LOG_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    // Load existing events
    await loadEvents();
    
    // Start periodic write buffer flush
    startWriteBuffer();
    
    console.log('[EventStore] Initialized with', eventCache.length, 'events in cache');
    
  } catch (error) {
    console.error('[EventStore] Failed to initialize:', error.message);
    // Continue without existing events
    eventCache = [];
  }
}

/**
 * Load events from disk
 */
async function loadEvents() {
  try {
    const data = await fs.readFile(EVENT_LOG_FILE, 'utf8');
    const events = JSON.parse(data);
    
    // Validate events array
    if (Array.isArray(events)) {
      // Sort by timestamp and keep only recent events
      eventCache = events
        .filter(event => event && event.type && event.timestamp)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_MEMORY_EVENTS);
      
      console.log(`[EventStore] Loaded ${eventCache.length} events from disk`);
    } else {
      console.warn('[EventStore] Invalid event file format, starting fresh');
      eventCache = [];
    }
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('[EventStore] No existing event file, starting fresh');
      eventCache = [];
    } else {
      console.error('[EventStore] Failed to load events:', error.message);
      eventCache = [];
    }
  }
}

/**
 * Store an event
 * @param {string} type - Event type
 * @param {Object} data - Event data
 * @param {Object} metadata - Optional metadata
 */
async function storeEvent(type, data, metadata = {}) {
  const event = {
    type,
    timestamp: Date.now(),
    data,
    metadata
  };
  
  // Add to memory cache
  eventCache.unshift(event);
  
  // Keep cache size limited
  if (eventCache.length > MAX_MEMORY_EVENTS) {
    eventCache = eventCache.slice(0, MAX_MEMORY_EVENTS);
  }
  
  // Add to write buffer for async persistence
  eventBuffer.push(event);
  
  // Log important events immediately
  if (['share_accepted', 'share_rejected', 'new_job', 'block_update'].includes(type)) {
    console.log(`[EventStore] ${type}:`, JSON.stringify(data).substring(0, 100));
  }
}

/**
 * Start periodic write buffer flush
 */
function startWriteBuffer() {
  writeInterval = setInterval(async () => {
    if (eventBuffer.length > 0 && !isWriting) {
      await flushWriteBuffer();
    }
  }, 5000); // Flush every 5 seconds
}

/**
 * Flush write buffer to disk
 */
async function flushWriteBuffer() {
  if (eventBuffer.length === 0 || isWriting) {
    return;
  }
  
  isWriting = true;
  
  try {
    const eventsToWrite = [...eventBuffer];
    eventBuffer = [];
    
    // Read existing events
    let existingEvents = [];
    try {
      const data = await fs.readFile(EVENT_LOG_FILE, 'utf8');
      existingEvents = JSON.parse(data);
      if (!Array.isArray(existingEvents)) {
        existingEvents = [];
      }
    } catch (error) {
      // File doesn't exist or is invalid
      existingEvents = [];
    }
    
    // Merge new events
    const allEvents = [...eventsToWrite, ...existingEvents];
    
    // Keep only recent events to prevent file growth
    const limitedEvents = allEvents
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_EVENTS_PER_FILE);
    
    // Write to disk
    await fs.writeFile(EVENT_LOG_FILE, JSON.stringify(limitedEvents, null, 2));
    
    console.log(`[EventStore] Flushed ${eventsToWrite.length} events to disk`);
    
  } catch (error) {
    console.error('[EventStore] Failed to flush write buffer:', error.message);
    // Put events back in buffer for retry
    eventBuffer.unshift(...eventsToWrite);
  } finally {
    isWriting = false;
  }
}

/**
 * Get events by type
 * @param {string} type - Event type
 * @param {number} limit - Maximum number of events
 * @returns {Array} Events
 */
function getEventsByType(type, limit = 100) {
  return eventCache
    .filter(event => event.type === type)
    .slice(0, limit);
}

/**
 * Get recent events
 * @param {number} limit - Maximum number of events
 * @param {string} eventType - Optional event type filter
 * @returns {Array} Events
 */
function getRecentEvents(limit = 100, eventType = null) {
  let events = eventCache;
  
  if (eventType) {
    events = events.filter(event => event.type === eventType);
  }
  
  return events.slice(0, limit);
}

/**
 * Get events in time range
 * @param {number} startTime - Start timestamp
 * @param {number} endTime - End timestamp
 * @param {string} eventType - Optional event type filter
 * @returns {Array} Events
 */
function getEventsInTimeRange(startTime, endTime, eventType = null) {
  return eventCache.filter(event => {
    const inTimeRange = event.timestamp >= startTime && event.timestamp <= endTime;
    const matchesType = !eventType || event.type === eventType;
    return inTimeRange && matchesType;
  });
}

/**
 * Get event statistics
 * @returns {Object} Statistics
 */
function getEventStats() {
  const stats = {
    totalEvents: eventCache.length,
    eventTypes: {},
    recentEvents: 0,
    oldestEvent: null,
    newestEvent: null
  };
  
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  eventCache.forEach(event => {
    // Count by type
    stats.eventTypes[event.type] = (stats.eventTypes[event.type] || 0) + 1;
    
    // Count recent events
    if (event.timestamp >= oneHourAgo) {
      stats.recentEvents++;
    }
    
    // Track oldest/newest
    if (!stats.oldestEvent || event.timestamp < stats.oldestEvent.timestamp) {
      stats.oldestEvent = event;
    }
    if (!stats.newestEvent || event.timestamp > stats.newestEvent.timestamp) {
      stats.newestEvent = event;
    }
  });
  
  return stats;
}

/**
 * Clear old events
 * @param {number} olderThanMs - Remove events older than this timestamp
 */
async function clearOldEvents(olderThanMs) {
  const cutoffTime = Date.now() - olderThanMs;
  const originalLength = eventCache.length;
  
  eventCache = eventCache.filter(event => event.timestamp > cutoffTime);
  
  // Also flush to disk to clean up
  await flushWriteBuffer();
  
  console.log(`[EventStore] Cleared ${originalLength - eventCache.length} old events`);
}

/**
 * Force immediate write of all buffered events
 */
async function forceFlush() {
  await flushWriteBuffer();
}

/**
 * Shutdown event store
 */
async function shutdown() {
  console.log('[EventStore] Shutting down...');
  
  // Clear write interval
  if (writeInterval) {
    clearInterval(writeInterval);
    writeInterval = null;
  }
  
  // Flush remaining events
  await forceFlush();
  
  console.log('[EventStore] Shutdown complete');
}

module.exports = {
  initialize,
  storeEvent,
  getEventsByType,
  getRecentEvents,
  getEventsInTimeRange,
  getEventStats,
  clearOldEvents,
  forceFlush,
  shutdown
};
