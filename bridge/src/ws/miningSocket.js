const WebSocket = require('ws');
const { storeEvent } = require('../core/eventStore');
const { increment } = require('../monitoring/metricsEngine');

let wss = null;
let clients = new Set();
let heartbeatInterval = null;
let currentJob = null; // Cache for latest job
let lastJobId = null; // Track job ID to prevent duplicates
const broadcastedJobIds = new Set(); // Global emission guard using Set

/**
 * Check if job can be broadcast (global deduplication)
 * @param {string} jobId - Job ID to check
 * @returns {boolean} True if job can be broadcast
 */
function canBroadcast(jobId) {
  if (broadcastedJobIds.has(jobId)) {
    return false;
  }

  broadcastedJobIds.add(jobId);

  // Prevent memory leaks - clear Set when it gets too large
  if (broadcastedJobIds.size > 1000) {
    console.log('[MiningSocket] Clearing broadcasted job IDs cache (size > 1000)');
    broadcastedJobIds.clear();
  }

  return true;
}

/**
 * Initialize WebSocket server on HTTP server
 * @param {Object} server - HTTP server instance
 */
function initialize(server) {
  wss = new WebSocket.Server({ 
    server,
    path: '/ws/mining'
  });

  wss.on('connection', handleConnection);
  
  // Start heartbeat interval
  startHeartbeat();
  
  // Initialize job cache
  initializeJobCache();
  
  console.log('[MiningSocket] WebSocket server initialized on /ws/mining');
}

/**
 * Handle new WebSocket connection
 * @param {WebSocket} ws - WebSocket connection
 */
function handleConnection(ws) {
  clients.add(ws);
  const clientId = Date.now() + Math.random();
  ws.clientId = clientId;
  ws.isAlive = true;
  ws.lastPing = Date.now();
  
  console.log(`[MiningSocket] New connection [${clientId}]. Total clients: ${clients.size}`);
  
  // Log connection event
  storeEvent('websocket_connect', {
    client_id: clientId,
    total_clients: clients.size,
    user_agent: ws.upgradeReq?.headers?.['user-agent'] || 'unknown',
    ip: ws.upgradeReq?.socket?.remoteAddress || 'unknown'
  });
  
  // Track WebSocket metrics
  increment('websocket', 'totalConnections');
  increment('websocket', 'connections');
  
  // Send welcome message
  sendToClient(ws, {
    type: 'welcome',
    message: 'Connected to Bitmind mining WebSocket',
    timestamp: Date.now(),
    client_id: clientId
  });
  
  // Immediately send latest cached job if available, otherwise fetch one
  if (currentJob) {
    console.log(`[MiningSocket] Sending latest job to new client [${clientId}]: ${currentJob.job_id}`);
    const success = sendToClient(ws, {
      type: 'new_job',
      data: currentJob,
      timestamp: Date.now()
    });
    console.log(`[MiningSocket] Job delivery to client [${clientId}]: ${success ? 'SUCCESS' : 'FAILED'}`);
  } else {
    console.log(`[MiningSocket] No cached job available for client [${clientId}], fetching fallback job...`);
    // Try to get a job from the JobBroadcaster
    ensureJobForClient(ws, clientId);
  }
  
  // Handle messages from client
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      ws.lastPing = Date.now(); // Update activity timestamp
      
      // Log message event
      storeEvent('websocket_message', {
        client_id: ws.clientId,
        message_type: message.type,
        message_size: data.length
      });
      
      handleMessage(ws, message);
    } catch (error) {
      console.error('[MiningSocket] Invalid message format from client [${ws.clientId}]:', error.message);
      
      // Log error event
      storeEvent('websocket_error', {
        client_id: ws.clientId,
        error: 'Invalid message format',
        message_size: data.length
      });
      
      sendError(ws, 'Invalid message format');
    }
  });
  
  // Handle connection close
  ws.on('close', (code, reason) => {
    clients.delete(ws);
    console.log(`[MiningSocket] Client [${ws.clientId}] disconnected. Code: ${code}, Reason: ${reason || 'none'}. Total clients: ${clients.size}`);
    
    // Log disconnection event
    storeEvent('websocket_disconnect', {
      client_id: ws.clientId,
      total_clients: clients.size,
      connection_duration: Date.now() - ws.clientId,
      close_code: code,
      close_reason: reason || 'none'
    });
    
    // Track WebSocket metrics
    increment('websocket', 'disconnections');
  });
  
  // Handle connection error
  ws.on('error', (error) => {
    console.error(`[MiningSocket] WebSocket error for client [${ws.clientId}]:`, error.message);
    clients.delete(ws);
    
    // Log error event
    storeEvent('websocket_error', {
      client_id: ws.clientId,
      error: error.message,
      error_type: 'connection_error'
    });
  });
  
  // Handle pong responses for heartbeat
  ws.on('pong', () => {
    ws.isAlive = true;
    ws.lastPing = Date.now();
  });
}

/**
 * Handle incoming WebSocket messages
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} message - Parsed message
 */
function handleMessage(ws, message) {
  switch (message.type) {
    case 'ping':
      ws.isAlive = true;
      ws.lastPing = Date.now();
      sendToClient(ws, {
        type: 'pong',
        timestamp: Date.now()
      });
      break;
      
    case 'pong':
      // Client responding to our ping
      ws.isAlive = true;
      ws.lastPing = Date.now();
      break;
      
    case 'subscribe':
      // Handle subscription requests (future feature)
      sendToClient(ws, {
        type: 'subscription_confirmed',
        timestamp: Date.now()
      });
      break;
      
    default:
      console.log(`[MiningSocket] Unknown message type [${message.type}] from client [${ws.clientId}]`);
  }
}

/**
 * Send message to specific client
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} data - Message data
 */
function sendToClient(ws, data) {
  // Safety checks
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }
  
  try {
    const message = JSON.stringify({
      ...data,
      timestamp: Date.now()
    });
    
    ws.send(message);
    return true;
  } catch (error) {
    console.error(`[MiningSocket] Error sending to client [${ws.clientId}]:`, error.message);
    
    // Clean up broken connection
    clients.delete(ws);
    
    // Log error event
    storeEvent('websocket_error', {
      client_id: ws.clientId,
      error: 'Send failed',
      error_message: error.message
    });
    
    return false;
  }
}

/**
 * Send error message to client
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} error - Error message
 */
function sendError(ws, error) {
  sendToClient(ws, {
    type: 'error',
    error: error,
    timestamp: Date.now()
  });
}

/**
 * Broadcast message to all connected clients
 * @param {Object} data - Message data to broadcast
 */
function broadcast(data) {
  if (clients.size === 0) {
    console.log('[MiningSocket] No clients to broadcast to');
    return;
  }
  
  // Job consistency: prevent duplicate new_job broadcasts
  if (data.type === 'new_job') {
    // Handle both job formats: {job: {...}} or direct job data
    const jobData = data.data?.job || data.data;
    const jobId = jobData?.job_id;
    
    if (!jobId) {
      console.warn('[MiningSocket] new_job broadcast missing job_id, skipping');
      return;
    }
    
    // Enforce global emission guard at final broadcast layer
    if (!canBroadcast(jobId)) {
      console.log(`[MiningSocket] DUPLICATE BLOCKED: ${jobId}`);
      return;
    }
    
    // Update job cache and track job ID
    currentJob = jobData;
    lastJobId = jobId;
    console.log(`[MiningSocket] Broadcasting new job [${jobId}] to ${clients.size} clients`);
    console.log(`[MiningSocket] Job data: height=${jobData.height}, target=${jobData.target?.substring(0, 8)}...`);
  } else {
    console.log(`[MiningSocket] Broadcasting ${data.type} to ${clients.size} clients`);
  }
  
  // Track WebSocket broadcast metrics
  increment('websocket', 'messagesBroadcast');
  
  let successCount = 0;
  let failureCount = 0;
  
  clients.forEach(ws => {
    if (sendToClient(ws, data)) {
      successCount++;
    } else {
      failureCount++;
    }
  });
  
  console.log(`[MiningSocket] Broadcast completed: ${successCount} success, ${failureCount} failures`);
}

/**
 * Initialize job cache on startup
 */
async function initializeJobCache() {
  try {
    console.log('[MiningSocket] Initializing job cache...');
    
    // Import JobBroadcaster dynamically to avoid circular dependency
    const { getCurrentJob } = require('../mining/jobBroadcaster');
    
    const job = await getCurrentJob();
    if (job) {
      currentJob = job;
      lastJobId = job.job_id;
      console.log(`[MiningSocket] Job cache initialized with job: ${job.job_id}`);
      console.log(`[MiningSocket] Job details: height=${job.height}, target=${job.target?.substring(0, 8)}...`);
    } else {
      console.log('[MiningSocket] No initial job available, will fetch on-demand');
    }
  } catch (error) {
    console.error('[MiningSocket] Failed to initialize job cache:', error.message);
    console.log('[MiningSocket] Will fetch jobs on-demand as clients connect');
  }
}

/**
 * Start heartbeat to detect dead connections
 */
function startHeartbeat() {
  heartbeatInterval = setInterval(() => {
    const now = Date.now();
    const deadClients = [];
    
    clients.forEach(ws => {
      // Check if client is dead (no response to ping or too old)
      if (!ws.isAlive || (now - ws.lastPing) > 45000) { // 45 seconds timeout
        deadClients.push(ws);
        return;
      }
      
      // Send ping and mark as waiting for response
      ws.isAlive = false;
      try {
        ws.ping();
      } catch (error) {
        console.error(`[MiningSocket] Failed to ping client [${ws.clientId}]:`, error.message);
        deadClients.push(ws);
      }
    });
    
    // Clean up dead clients
    deadClients.forEach(ws => {
      console.log(`[MiningSocket] Removing dead client [${ws.clientId}] (last activity: ${now - ws.lastPing}ms ago)`);
      clients.delete(ws);
      
      try {
        ws.terminate();
      } catch (error) {
        // Ignore termination errors
      }
      
      // Track disconnection metrics
      increment('websocket', 'deadConnections');
      
      // Log dead connection event
      storeEvent('websocket_dead_connection', {
        client_id: ws.clientId,
        last_activity: ws.lastPing,
        idle_duration: now - ws.lastPing
      });
    });
    
    // Log heartbeat status if there are active clients
    if (clients.size > 0) {
      console.log(`[MiningSocket] Heartbeat: ${clients.size} active clients, ${deadClients.length} removed`);
    }
  }, 25000); // 25 seconds (between 20-30 seconds as requested)
}

/**
 * Stop heartbeat interval
 */
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Ensure job delivery to client (fallback mechanism)
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} clientId - Client identifier
 */
async function ensureJobForClient(ws, clientId) {
  try {
    // Import JobBroadcaster dynamically to avoid circular dependency
    const { getCurrentJob } = require('../mining/jobBroadcaster');
    
    console.log(`[MiningSocket] Fetching fallback job for client [${clientId}]...`);
    const job = await getCurrentJob();
    
    if (job) {
      console.log(`[MiningSocket] Fallback job fetched for client [${clientId}]: ${job.job_id}`);
      const success = sendToClient(ws, {
        type: 'new_job',
        data: job,
        timestamp: Date.now()
      });
      console.log(`[MiningSocket] Fallback job delivery to client [${clientId}]: ${success ? 'SUCCESS' : 'FAILED'}`);
    } else {
      console.log(`[MiningSocket] No fallback job available for client [${clientId}], creating default job...`);
      
      // Create a minimal fallback job
      const fallbackJob = {
        job_id: `fallback-${Date.now()}`,
        height: 0,
        previousblockhash: '0000000000000000000000000000000000000000000000000000000000000000',
        bits: '207fffff',
        curtime: Math.floor(Date.now() / 1000),
        target: '00000000ffff0000000000000000000000000000000000000000000000000000',
        timestamp: Date.now(),
        fallback: true
      };
      
      const success = sendToClient(ws, {
        type: 'new_job',
        data: fallbackJob,
        timestamp: Date.now()
      });
      console.log(`[MiningSocket] Default fallback job delivery to client [${clientId}]: ${success ? 'SUCCESS' : 'FAILED'}`);
    }
  } catch (error) {
    console.error(`[MiningSocket] Failed to ensure job for client [${clientId}]:`, error.message);
    
    // Last resort - create minimal job
    const emergencyJob = {
      job_id: `emergency-${Date.now()}`,
      height: 0,
      previousblockhash: '0000000000000000000000000000000000000000000000000000000000000000',
      bits: '207fffff',
      curtime: Math.floor(Date.now() / 1000),
      target: '00000000ffff0000000000000000000000000000000000000000000000000000',
      timestamp: Date.now(),
      emergency: true
    };
    
    sendToClient(ws, {
      type: 'new_job',
      data: emergencyJob,
      timestamp: Date.now()
    });
    console.log(`[MiningSocket] Emergency fallback job sent to client [${clientId}]`);
  }
}

/**
 * Update current job cache (for external systems)
 * @param {Object} job - Latest job data
 */
function updateCurrentJob(job) {
  if (!job || !job.job_id) {
    console.warn('[MiningSocket] Invalid job data provided to updateCurrentJob');
    return;
  }
  
  // Only update if job_id is different
  if (lastJobId !== job.job_id) {
    currentJob = job;
    lastJobId = job.job_id;
    console.log(`[MiningSocket] Job cache updated: ${job.job_id}`);
  }
}

/**
 * Get WebSocket server status
 * @returns {Object} Status information
 */
function getStatus() {
  return {
    server_active: !!wss,
    connected_clients: clients.size,
    heartbeat_active: !!heartbeatInterval,
    current_job_id: lastJobId,
    job_cached: !!currentJob
  };
}

/**
 * Shutdown WebSocket server
 */
function shutdown() {
  console.log('[MiningSocket] Shutting down WebSocket server...');
  
  stopHeartbeat();
  
  if (wss) {
    wss.close(() => {
      console.log('[MiningSocket] WebSocket server closed');
    });
  }
  
  clients.clear();
}

module.exports = {
  initialize,
  broadcast,
  sendToClient,
  getStatus,
  updateCurrentJob,
  shutdown
};
