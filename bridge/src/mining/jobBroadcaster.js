const axios = require('axios');
const { storeEvent } = require('../core/eventStore');
const { increment, startTimer, endTimer } = require('../monitoring/metricsEngine');

// Bitcoin Core RPC configuration
const RPC_URL = 'http://127.0.0.1:8332';
const RPC_USER = 'bitcoin';
const RPC_PASSWORD = '123456';

// RPC client with authentication
const rpcClient = axios.create({
  baseURL: RPC_URL,
  auth: {
    username: RPC_USER,
    password: RPC_PASSWORD
  },
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000 // 10 second timeout
});

// Job broadcast state
let currentJob = null;
let lastJobUpdate = null;
let subscribers = [];
let isUpdating = false;
const JOB_CACHE_DURATION = 45000; // 45 seconds cache (reduced from 60 for more frequent updates)

// Block-height tracking
let lastBlockHeight = null;
let lastJobId = null;
let lastJobHash = null;
let lastJobBroadcast = null;
const JOB_UPDATE_DEBOUNCE = 2000; // 2 seconds debounce for rapid block updates

/**
 * Subscribe to job updates
 * @param {Function} callback - Function to call when job updates
 * @returns {number} Subscriber ID for unsubscribing
 */
function subscribe(callback) {
  const subscriberId = Date.now() + Math.random();
  subscribers.push({
    id: subscriberId,
    callback: callback
  });
  
  console.log(`[JobBroadcaster] New subscriber added (ID: ${subscriberId}). Total subscribers: ${subscribers.length}`);
  
  // Immediately send current job if available
  if (currentJob) {
    try {
      callback(currentJob);
    } catch (error) {
      console.error(`[JobBroadcaster] Error notifying new subscriber:`, error.message);
    }
  }
  
  return subscriberId;
}

/**
 * Unsubscribe from job updates
 * @param {number} subscriberId - Subscriber ID to remove
 */
function unsubscribe(subscriberId) {
  const initialLength = subscribers.length;
  subscribers = subscribers.filter(sub => sub.id !== subscriberId);
  
  if (subscribers.length < initialLength) {
    console.log(`[JobBroadcaster] Subscriber removed (ID: ${subscriberId}). Total subscribers: ${subscribers.length}`);
  }
}

/**
 * Notify all subscribers of job update
 * @param {Object} job - New job data
 */
function notifySubscribers(job) {
  console.log(`[JobBroadcaster] Broadcasting job update to ${subscribers.length} subscribers`);
  
  let notifiedCount = 0;
  subscribers.forEach(subscriber => {
    try {
      subscriber.callback(job);
      notifiedCount++;
    } catch (error) {
      console.error(`[JobBroadcaster] Error notifying subscriber ${subscriber.id}:`, error.message);
    }
  });
  
  console.log(`[JobBroadcaster] Successfully notified ${notifiedCount}/${subscribers.length} subscribers`);
}

/**
 * Fetch new block template from Bitcoin Core
 * @returns {Promise<Object>} Block template data
 */
async function fetchBlockTemplate() {
  const timerId = startTimer('bitcoin-rpc');
  
  try {
    console.log('[JobBroadcaster] Fetching block template from Bitcoin Core...');
    
    increment('bitcoin', 'rpcCallsCount');
    
    const response = await rpcClient.post('', {
      jsonrpc: '1.0',
      id: 'bitmind-job-broadcaster',
      method: 'getblocktemplate',
      params: [{ rules: ['segwit'] }]
    });

    console.log('[JobBroadcaster] Block template received successfully');
    
    // Track successful RPC call
    // Note: We'll track this in the health service instead
    
    return response.data.result;
    
  } catch (error) {
    console.error('[JobBroadcaster] Failed to fetch block template:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Bitcoin Core RPC connection refused - ensure Bitcoin Core is running');
    } else if (error.response && error.response.data && error.response.data.error) {
      throw new Error(`RPC Error: ${error.response.data.error.message}`);
    } else {
      throw new Error('Failed to fetch block template from Bitcoin Core');
    }
  } finally {
    endTimer(timerId, 'bitcoin', 'rpcLatency');
  }
}

/**
 * Update job from Bitcoin Core (with caching and block-height detection)
 * @param {boolean} force - Force update even if cache is valid
 * @returns {Promise<Object>} Updated job data
 */
async function updateJob(force = false) {
  // Prevent concurrent updates
  if (isUpdating) {
    console.log('[JobBroadcaster] Update already in progress, waiting...');
    return currentJob;
  }
  
  const now = Date.now();
  const cacheValid = currentJob && lastJobUpdate && (now - lastJobUpdate < JOB_CACHE_DURATION);
  
  // Check for debounce (prevent rapid updates)
  const timeSinceLastBroadcast = lastJobBroadcast ? (now - lastJobBroadcast) : Infinity;
  const shouldDebounce = timeSinceLastBroadcast < JOB_UPDATE_DEBOUNCE;
  
  // Return cached job if valid and not forcing update
  if (cacheValid && !force && !shouldDebounce) {
    console.log('[JobBroadcaster] Using cached job (valid for ' + Math.floor((JOB_CACHE_DURATION - (now - lastJobUpdate)) / 1000) + ' seconds)');
    return currentJob;
  }
  
  if (force) {
    console.log('[JobBroadcaster] Force update requested, fetching new job...');
  } else if (shouldDebounce) {
    console.log('[JobBroadcaster] Update debounced, waiting...');
    return currentJob;
  } else {
    console.log('[JobBroadcaster] Cache expired or block height changed, fetching new job...');
  }
  
  isUpdating = true;
  
  try {
    const template = await fetchBlockTemplate();
    
    // Create job with new ID format
    const jobId = `${template.height}-${template.curtime}`;
    const newJob = {
      job_id: jobId,
      height: template.height,
      previousblockhash: template.previousblockhash,
      bits: template.bits,
      curtime: template.curtime,
      target: template.target,
      timestamp: Date.now()
    };
    
    // Check if this is a new block or just time-based update
    const isNewBlock = template.height !== lastBlockHeight;
    const isJobChanged = jobId !== lastJobId || template.previousblockhash !== lastJobHash;
    
    // Update tracking variables
    const previousHeight = lastBlockHeight;
    lastBlockHeight = template.height;
    lastJobId = jobId;
    lastJobHash = template.previousblockhash;
    
    // Update cache
    currentJob = newJob;
    lastJobUpdate = Date.now();
    lastJobBroadcast = Date.now();
    
    console.log(`[JobBroadcaster] Job updated: ${jobId} (height: ${template.height}, new_block: ${isNewBlock})`);
    
    // Track job update metrics
    increment('jobBroadcaster', 'jobUpdatesCount');
    if (isNewBlock) {
      increment('jobBroadcaster', 'blockTriggeredUpdates');
    } else {
      increment('jobBroadcaster', 'timeTriggeredUpdates');
    }
    
    // Update subscriber count
    increment('jobBroadcaster', 'subscribersCount', 0); // Will be updated below
    
    // Broadcast to all subscribers
    notifySubscribers(newJob);
    
    // Log events to event store
    if (isJobChanged) {
      storeEvent('new_job', { 
        job_id: jobId,
        height: template.height,
        previousblockhash: template.previousblockhash,
        bits: template.bits,
        curtime: template.curtime,
        target: template.target
      });
      
      broadcastWebSocketEvent('new_job', { job: newJob });
    }
    
    if (isNewBlock && previousHeight !== null) {
      storeEvent('block_update', { 
        height: template.height,
        previous_height: previousHeight,
        job_id: jobId,
        previousblockhash: template.previousblockhash
      });
      
      broadcastWebSocketEvent('block_update', { 
        height: template.height,
        previous_height: previousHeight,
        job_id: jobId
      });
    }
    
    return newJob;
    
  } catch (error) {
    console.error('[JobBroadcaster] Failed to update job:', error.message);
    
    // Return existing job if available, otherwise throw
    if (currentJob) {
      console.log('[JobBroadcaster] Returning existing job due to update failure');
      return currentJob;
    } else {
      throw error;
    }
  } finally {
    isUpdating = false;
  }
}

/**
 * Get current job (updates if needed)
 * @returns {Promise<Object|null>} Current job data
 */
async function getCurrentJob() {
  if (!currentJob) {
    console.log('[JobBroadcaster] No current job, fetching initial job...');
    return await updateJob();
  }
  
  return await updateJob();
}

/**
 * Get current job without forcing update
 * @returns {Object|null} Current job data
 */
function getCachedJob() {
  return currentJob;
}

/**
 * Check if job cache is valid
 * @returns {boolean} True if cache is valid
 */
function isCacheValid() {
  if (!currentJob || !lastJobUpdate) {
    return false;
  }
  
  const now = Date.now();
  return (now - lastJobUpdate < JOB_CACHE_DURATION);
}

/**
 * Broadcast WebSocket event
 * @param {string} eventType - Event type
 * @param {Object} data - Event data
 */
function broadcastWebSocketEvent(eventType, data) {
  try {
    // Import miningSocket dynamically to avoid circular dependency
    const { broadcast } = require('../ws/miningSocket');
    
    broadcast({
      type: eventType,
      data: data
    });
  } catch (error) {
    console.error('[JobBroadcaster] Failed to broadcast WebSocket event:', error.message);
  }
}

/**
 * Get job broadcaster status
 * @returns {Object} Status information
 */
function getStatus() {
  const now = Date.now();
  return {
    has_current_job: !!currentJob,
    job_id: currentJob ? currentJob.job_id : null,
    last_update: lastJobUpdate,
    cache_age_ms: lastJobUpdate ? (now - lastJobUpdate) : null,
    cache_valid: isCacheValid(),
    cache_duration_ms: JOB_CACHE_DURATION,
    subscribers_count: subscribers.length,
    is_updating: isUpdating,
    block_height: lastBlockHeight,
    last_job_hash: lastJobHash
  };
}

/**
 * Start automatic job updates (optional)
 * @param {number} intervalMs - Update interval in milliseconds
 */
function startAutoUpdate(intervalMs = JOB_CACHE_DURATION) {
  console.log(`[JobBroadcaster] Starting auto-update every ${intervalMs}ms`);
  
  setInterval(async () => {
    try {
      await updateJob();
    } catch (error) {
      console.error('[JobBroadcaster] Auto-update failed:', error.message);
    }
  }, intervalMs);
}

module.exports = {
  subscribe,
  unsubscribe,
  updateJob,
  getCurrentJob,
  getCachedJob,
  isCacheValid,
  getStatus,
  startAutoUpdate,
  broadcastWebSocketEvent
};
