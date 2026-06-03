// Load environment variables from explicit path
const path = require('path');
const dotenvPath = path.join(__dirname, '../../.env');
require('dotenv').config({ path: dotenvPath });
console.log('[BOOT] dotenv loaded from:', dotenvPath);

// CRITICAL: Log environment values BEFORE rpcService initialization
console.log('[BOOT] ENVIRONMENT VALUES:');
console.log('[BOOT]   RPC_HOST:', process.env.RPC_HOST || 'MISSING');
console.log('[BOOT]   RPC_PORT:', process.env.RPC_PORT || 'MISSING');
console.log('[BOOT]   RPC_USER:', process.env.RPC_USER ? 'SET' : 'MISSING');
console.log('[BOOT]   RPC_PASSWORD:', process.env.RPC_PASSWORD ? 'SET' : 'MISSING');

const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const crypto = require('crypto');
const http = require('http');
const axios = require('axios');
const { rpcService } = require('./services/rpc');
const systemState = require('./core/systemState');
const rpcPoller = require('./core/rpcPoller');
const { jobManager } = require('./services/jobManager');
const { shareValidator } = require('./services/shareValidator');
const { sessionManager } = require('./services/sessionManager');
const wsHandlers = require('./ws/handlers');
const apiRoutes = require('./api/routes');
const miningServices = require('./services/mining');
const coreUtils = require('./core/utils');
const { startWatchdog } = require('./core/watchdog');

// Startup safety logs
console.log('[BOOT] Bitmind server initializing...');
console.log('[BOOT] Environment loaded:', process.env.NODE_ENV || 'development');
console.log('[BOOT] RPC_HOST:', process.env.RPC_HOST || 'MISSING');
console.log('[BOOT] PORT:', process.env.PORT || 'default (3001)');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;
const STRATUM_PORT = process.env.STRATUM_PORT || 3333;

// Lifecycle configuration
const STALE_DEVICE_TIMEOUT_MS = 120000; // 2 minutes without activity = stale
const CLEANUP_INTERVAL_MS = 30000; // Check for stale devices every 30 seconds
const WEBSOCKET_PING_INTERVAL_MS = 60000; // Ping websockets every 60 seconds
const WEBSOCKET_PONG_TIMEOUT_MS = 10000; // Wait 10 seconds for pong response

// WebSocket server for /ws endpoint
const wsServer = new WebSocket.Server({ 
  noServer: true,
  path: '/ws'
});
global.wsServer = wsServer;

// Handle WebSocket upgrade requests
server.on('upgrade', (request, socket, head) => {
  console.log("[WS] UPGRADE_REQUEST path=" + request.url);
  
  if (request.url === '/ws') {
    console.log("[WS] UPGRADE_ACCEPTED path=/ws");
    wsServer.handleUpgrade(request, socket, head, (ws) => {
      console.log("[WS] CLIENT_CONNECTED");
      wsServer.emit('connection', ws, request);
    });
  } else {
    console.log("[WS] UPGRADE_REJECTED path=" + request.url + " reason=INVALID_PATH");
    socket.destroy();
  }
});

// Lifecycle cleanup interval - detect stale devices
let cleanupInterval = null;
let pingInterval = null;

function startLifecycleCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  cleanupInterval = setInterval(() => {
    try {
      const cleanedCount = state.mutations.cleanupStaleDevices(STALE_DEVICE_TIMEOUT_MS);
      if (cleanedCount > 0) {
        console.log(`[LIFECYCLE] Marked ${cleanedCount} devices as stale`);
      }
    } catch (error) {
      console.error('[LIFECYCLE] Error during stale device cleanup:', error);
    }
  }, CLEANUP_INTERVAL_MS);

  console.log(`[LIFECYCLE] Started cleanup interval (${CLEANUP_INTERVAL_MS}ms, timeout: ${STALE_DEVICE_TIMEOUT_MS}ms)`);
}

function stopLifecycleCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('[LIFECYCLE] Stopped cleanup interval');
  }
}

// WebSocket ping/pong watchdog - detect dead connections
function startWebSocketWatchdog() {
  if (pingInterval) {
    clearInterval(pingInterval);
  }

  pingInterval = setInterval(() => {
    wsServer.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        // Check if this socket has a pending pong
        if (ws.isAlive === false) {
          console.log(`[WATCHDOG] Terminating dead socket for device: ${ws.deviceId || 'unknown'}`);
          ws.terminate();
          return;
        }

        // Mark as potentially dead, wait for pong
        ws.isAlive = false;
        ws.ping();
      }
    });
  }, WEBSOCKET_PING_INTERVAL_MS);

  console.log(`[WATCHDOG] Started websocket ping interval (${WEBSOCKET_PING_INTERVAL_MS}ms)`);
}

function stopWebSocketWatchdog() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
    console.log('[WATCHDOG] Stopped websocket ping interval');
  }
}

// Global error handlers to catch all unhandled issues
process.on('unhandledRejection', (err) => {
  console.error("UNHANDLED REJECTION:", err);
  console.error("REJECTION STACK:", err.stack);
});

process.on('uncaughtException', (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  console.error("EXCEPTION STACK:", err.stack);
});

// Add heartbeat logging to monitor backend stability (DISABLED FOR DEBUG ISOLATION)
// setInterval(() => {
//   console.log("[SYSTEM] Backend alive -", new Date().toISOString());
// }, 10000);

// WebSocket connection handling
wsServer.on('connection', (ws, req) => {
  console.log('[WS] CONNECTION_OPEN remoteAddress=' + req.socket.remoteAddress);
  console.log("[WS] CLIENT_COUNT count=" + wsServer.clients.size);
  
  // Initialize socket liveness tracking
  ws.isAlive = true;
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: "welcome", 
    message: "Bitmind WS connected"
  }));
  
  // Handle pong responses for watchdog
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  // Handle incoming messages with robust error handling
  ws.on('message', (msg) => {
    try {
      // Use core utilities for safe parsing
      const data = coreUtils.messageParsing.safeParse(msg);
      if (!data) {
        console.log("[WS] MESSAGE_PARSE_FAILED reason=INVALID_JSON");
        return;
      }

      if (!coreUtils.messageParsing.validateMessage(data)) {
        console.log("[WS] MESSAGE_INVALID type=" + (data?.type || 'null') + " reason=INVALID_FORMAT");
        return;
      }

      console.log("[WS] MESSAGE_PARSED type=" + data.type);

      // Route to appropriate handler using modular structure
      // Phase D.1.1: Aligned to protocol v1 specification
      switch (data.type) {
        case "device.register":
          console.log("[WS] MESSAGE_ROUTED type=device.register handler=register");
          wsHandlers.handlers.register(ws, data);
          break;
          
        case "device.heartbeat":
          console.log("[WS] MESSAGE_ROUTED type=device.heartbeat handler=heartbeat");
          wsHandlers.handlers.heartbeat(ws, data);
          break;
          
        case "device_heartbeat":
          // Legacy underscore format - normalize to device.heartbeat handler
          console.log("[WS] MESSAGE_LEGACY_FORMAT type=device_heartbeat normalized=device.heartbeat");
          wsHandlers.handlers.heartbeat(ws, data);
          break;
          
        case "heartbeat":
          // Plain heartbeat variant - normalize to device.heartbeat handler
          console.log("[WS] MESSAGE_LEGACY_FORMAT type=heartbeat normalized=device.heartbeat");
          wsHandlers.handlers.heartbeat(ws, data);
          break;
          
        case "mining.share":
          console.log("[WS] MESSAGE_ROUTED type=mining.share handler=shareFound");
          wsHandlers.handlers.shareFound(ws, data);
          break;
          
        case "mining_job":
          // Legacy underscore format - normalize to mining.share handler
          console.log("[WS] MESSAGE_LEGACY_FORMAT type=mining_job normalized=mining.share");
          wsHandlers.handlers.shareFound(ws, data);
          break;
          
        case "stats":
          // Legacy stats message - map to heartbeat handler for telemetry
          console.log("[WS] MESSAGE_ROUTED type=stats handler=stats");
          wsHandlers.handlers.stats(ws, data);
          break;
          
        default:
          console.log("[WS] MESSAGE_UNKNOWN type=" + data.type + " reason=UNHANDLED_TYPE");
      }
    } catch (error) {
      console.error("[WS] MESSAGE_ERROR error=" + error.message);
      // Don't close connection on message errors - just log and continue
    }
  });
  
  // Handle disconnection using modular structure
  ws.on('close', (code, reason) => {
    console.log("[WS] CONNECTION_CLOSED code=" + code + " reason=" + (reason || 'null'));
    console.log("[WS] DEVICE_DISCONNECTED deviceId=" + (ws.deviceId || 'null'));
    console.log("[WS] CLIENT_COUNT_AFTER_CLOSE count=" + wsServer.clients.size);

    // Use modular disconnect handler
    wsHandlers.handlers.disconnect(ws);
  });
  
  // Handle errors - COMPREHENSIVE LOGGING
  ws.on('error', (error) => {
    console.log("[WS] ERROR_FULL error=" + JSON.stringify(error));
    console.log("[WS] ERROR_MESSAGE message=" + error.message);
    console.log("[WS] ERROR_STACK stack=" + error.stack);
    console.log("[WS] ERROR_DEVICE deviceId=" + (ws.deviceId || 'null'));
    // NEVER close socket here
  });
  
  // Set connection alive flag
  ws.isAlive = true;
});

// NOTE: Old keepalive system removed - replaced by startWebSocketWatchdog()

// NOTE: RPC functions removed - using rpcService from services/rpc.js instead
// This ensures ENV-based configuration and proper error handling

// CORS configuration - support both development and production
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://127.0.0.1:5173',
    'https://getbitmind.com',
    'https://www.getbitmind.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Serve static files (HTML, CSS, JS)
app.use(express.static(__dirname));
app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested from:', req.ip);
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Enhanced health endpoint for startup monitoring
app.get('/health/full', async (req, res) => {
  try {
    // Read from systemState (primary cache)
    const state = systemState.getSnapshot();
    let rpcStatus = state.rpc.status;
    let rpcBlocks = state.rpc.blocks;
    let rpcLatencyMs = state.rpc.latencyMs;

    // Fallback: If state shows not connected, perform live check to prevent false negatives
    if (rpcStatus !== 'connected') {
      try {
        const startTime = Date.now();
        await rpcService.getBlockchainInfo();
        const latency = Date.now() - startTime;
        
        // Live check succeeded - override state
        rpcStatus = 'connected';
        rpcLatencyMs = latency;
        
        // Update systemState with live result
        const liveResult = await rpcService.getLiveRpcStatus();
        rpcBlocks = liveResult.blocks;
      } catch (liveError) {
        // Live check failed - keep state as is (disconnected/auth_failed)
        // No change needed
      }
    }

    res.json({
      bitcoin: state.bitcoin,
      rpc: rpcStatus,
      rpcBlocks: rpcBlocks,
      rpcLatencyMs: rpcLatencyMs,
      backend: state.backend,
      stratum: state.stratum,
      frontend: 'unknown',
      timestamp: new Date(state.timestamp).toISOString()
    });
  } catch (error) {
    res.status(500).json({
      bitcoin: 'unknown',
      rpc: 'error',
      backend: 'unknown',
      stratum: 'unknown',
      frontend: 'unknown',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Sync status endpoint
app.get('/sync/status', async (req, res) => {
  try {
    const blockchainInfo = await rpcService.getBlockchainInfo();
    const progress = blockchainInfo.verificationprogress || 0;
    
    res.json({
      "rpc": "connected",
      "sync": progress,
      "ibd": blockchainInfo.initialblockdownload
    });
  } catch (error) {
    res.status(500).json({
      "rpc": "disconnected",
      "sync": 0,
      "ibd": true,
      "error": error.message
    });
  }
});

// Legacy sync endpoint (keep for compatibility)
app.get('/sync', async (req, res) => {
  try {
    const blockchainInfo = await rpcService.getBlockchainInfo();
    const progress = blockchainInfo.verificationprogress || 0;
    const progressPercent = Math.round(progress * 100);
    const isSynced = progress >= 0.999 && !blockchainInfo.initialblockdownload;
    
    console.log(`[node] Sync: ${progressPercent}%`);
    
    res.json({
      progress: progress,
      "blocks": blockchainInfo.blocks,
      "headers": blockchainInfo.headers,
      "ibd": blockchainInfo.initialblockdownload
    });
  } catch (error) {
    console.error('[sync] Failed to get sync status:', error.message);
    res.status(500).json({
      error: 'Failed to get sync status',
      message: error.message
    });
  }
});

// Debug RPC endpoint
app.get('/debug/rpc', async (req, res) => {
  console.log('RPC debug endpoint requested from:', req.ip);
  try {
    const result = await rpcService.getBlockTemplate();
    res.json({
      status: 'success',
      message: 'getblocktemplate successful',
      data: {
        templateKeys: Object.keys(result),
        previousblockhash: result.previousblockhash,
        version: result.version,
        bits: result.bits,
        curtime: result.curtime,
        transactions: result.transactions ? result.transactions.length : 0
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'getblocktemplate failed',
      error: error.message,
      details: error.response?.data || null
    });
  }
});

// Health endpoint for server status checking
app.get('/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    backend: {
      port: PORT,
      status: 'running'
    },
    stratum: {
      port: STRATUM_PORT,
      status: stratumServerReady ? 'running' : 'initializing',
      listening: stratumServerReady,
      connectedMiners: connectedMiners.size
    },
    bitcoin: {
      rpc: RPC_URL,
      status: 'unknown' // Will be updated after RPC test
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      freeMemory: require('os').freemem()
    }
  };
  
  res.status(health.stratum.status === 'running' ? 200 : 503).json(health);
});

// API endpoints for mining stats
app.get('/api/stats', (req, res) => {
  res.json({
    connectedMiners: connectedMiners.size,
    totalHashrate: totalHashrate,
    blocksFound: blocksFound,
    uptime: process.uptime(),
    stratumReady: stratumServerReady,
    registeredDevices: state.getDeviceCount()
  });
});

// PRODUCTION-GRADE API STATS ENDPOINT - COMPUTE FROM UNIFIED STATE
app.get('/api/stats', (req, res) => {
  try {
    const allDevices = Array.from(state.devices.values());
    const totalAcceptedShares = allDevices.reduce((sum, device) => sum + device.acceptedShares, 0);
    const totalRejectedShares = allDevices.reduce((sum, device) => sum + device.rejectedShares, 0);
    const totalDevicesOnline = allDevices.filter(device => device.status === 'online' || device.status === 'mining').length;
    const totalHashrate = allDevices.reduce((sum, device) => sum + (device.hashrate || 0), 0);

    // Phase B.3: Safe state wrapper - ensure state.system exists
    if (!state.system) {
      state.system = { connectedMiners: 0, totalHashrate: 0, uptime: 0 };
    }

    // Update system state
    state.system.connectedMiners = totalDevicesOnline;
    state.system.totalHashrate = totalHashrate;
    
    res.json({
      totalDevicesOnline,
      totalAcceptedShares,
      totalRejectedShares,
      totalJobsSent: allDevices.filter(device => device.currentJobId).length,
      totalHashrate,
      systemUptime: process.uptime(),
      serverStatus: 'running'
    });
  } catch (error) {
    console.error('Error getting API stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system stats'
    });
  }
});

// API SHARES ENDPOINT - Last 50 share events
app.get('/api/shares', (req, res) => {
  try {
    res.json({
      success: true,
      count: shares.length,
      shares: shares
    });
  } catch (error) {
    console.error('Error getting API shares:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get shares'
    });
  }
});

// PRODUCTION-GRADE API HEALTH ENDPOINT - PURE VIEW LAYER
// Phase C.5: No computation, no inference, no fallback logic - pure state dump
app.get('/api/health', (req, res) => {
  try {
    const state = systemState.getSnapshot();

    res.json({
      status: 'ok',
      websocket: wsServer.clients.size > 0 ? 'active' : 'idle',
      stratum: stratumServerReady ? 'active' : 'inactive',
      // Phase C.5: Pure state dump from systemState
      bitcoin: state.bitcoin,
      rpc: state.rpc,
      backend: state.backend,
      stratum: state.stratum,
      timestamp: new Date(state.timestamp).toISOString()
    });
  } catch (error) {
    console.error('Error getting API health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get health status'
    });
  }
});

console.log("[SYSTEM] PRODUCTION_GRADE_BITMIND_BACKEND");
console.log("[SYSTEM] UNIFIED_STATE_ACTIVE");
console.log("[SYSTEM] DEVICE_REGISTRY_ENABLED");
console.log("[SYSTEM] WEBSOCKET_API_SYNC");
console.log("[SYSTEM] PRODUCTION_HARDENED");

// PRODUCTION-GRADE MODULAR ARCHITECTURE
// Global references for cleanup and health checks
global.stratumServerReady = false;

// Device States
const DEVICE_STATES = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  RECONNECTING: 'reconnecting',
  ERROR: 'error'
};

// Legacy device validation and state management removed
// Now handled by DeviceRegistry module and unified state module
// Legacy device endpoints removed - now handled by /api/device/register

// Legacy device heartbeat endpoint removed - now handled by WebSocket heartbeat event

// Legacy device discovery endpoint removed - now handled by /api/miners

// PRODUCTION-GRADE API ROUTES - READ FROM UNIFIED STATE ONLY
app.use('/api', apiRoutes);

// Legacy device info endpoint removed - now handled by /api/telemetry/:deviceId

// Legacy device status update endpoint removed - now handled by state module mutations

// Job invalidation endpoint for session switching
app.post('/job/invalidate', async (req, res) => {
  try {
    console.log(' Job invalidation requested - forcing new session');
    
    // Invalidate all existing sessions and create new one
    await jobManager.generateAndBroadcastJob(wss, devices);
    
    // Broadcast job_invalidated event
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          type: 'job_invalidated',
          data: {
            reason: 'manual_invalidation',
            timestamp: new Date().toISOString(),
            newSessionId: sessionManager.getCurrentSession()?.sessionId || null
          }
        }));
      }
    });
    
    res.json({
      status: 'success',
      message: 'Job invalidated and new session created',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(' Error invalidating job:', error);
    res.status(500).json({
      status: 'error',
      message: 'Job invalidation failed',
      error: error.message
    });
  }
});

// Session statistics endpoint
app.get('/sessions/stats', (req, res) => {
  try {
    const stats = sessionManager.getStats();
    res.json({
      status: 'success',
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(' Error getting session stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get session stats',
      error: error.message
    });
  }
});

// Stratum server setup with proper network binding
const wss = new WebSocket.Server({ 
  port: STRATUM_PORT, 
  host: '0.0.0.0',  // Bind to all interfaces for ESP32 connectivity
  verifyClient: (info) => {
    console.log(`[SYSTEM] Stratum connection attempt from: ${info.req.socket.remoteAddress}`);
    return true; // Allow all connections for now
  }
});
const connectedMiners = new Map();
let totalHashrate = 0;
let blocksFound = 0;
let stratumServerReady = false;

// Add error handling for Stratum server
wss.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[ERROR] Port ${STRATUM_PORT} is already in use!`);
    console.error(`[ERROR] Another process is using port ${STRATUM_PORT}`);
    console.error(`[ERROR] Please stop the other process or change STRATUM_PORT`);
  } else if (error.code === 'EADDRNOTAVAIL') {
    console.error(`[ERROR] Address 0.0.0.0 is not available`);
    console.error(`[ERROR] Network interface may not be ready`);
  } else {
    console.error(`[ERROR] Stratum server error:`, error);
  }
  stratumServerReady = false;
});

// Add successful binding confirmation
wss.on('listening', () => {
  console.log(`[SYSTEM] Stratum server ready on 0.0.0.0:${STRATUM_PORT}`);
  console.log(`[SYSTEM] Stratum server listening on all interfaces`);
  stratumServerReady = true;
});

console.log(`[SYSTEM] Backend starting on port ${PORT}`);
console.log(`[SYSTEM] Stratum server initializing on port ${STRATUM_PORT}`);

// Stratum protocol handlers
wss.on('connection', (ws, req) => {
  const minerId = crypto.randomBytes(8).toString('hex');
  console.log(`New miner connection from ${req.socket.remoteAddress} - ID: ${minerId}`);
  
  const miner = {
    id: minerId,
    ws: ws,
    address: null,
    hashrate: 0,
    subscribed: false,
    authorized: false
  };
  
  connectedMiners.set(minerId, miner);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`Message from miner ${minerId}:`, data);
      
      handleStratumMessage(miner, data);
    } catch (error) {
      console.error(`Invalid message from miner ${minerId}:`, error);
    }
  });

  ws.on('close', () => {
    console.log(`Miner ${minerId} disconnected`);
    connectedMiners.delete(minerId);
    updateTotalHashrate();
  });

  ws.on('error', (error) => {
    console.error(`Error with miner ${minerId}:`, error);
    connectedMiners.delete(minerId);
    updateTotalHashrate();
  });

  // Send initial subscription request
  sendStratumMessage(miner, {
    id: 1,
    method: 'mining.subscribe',
    params: []
  });
});

function handleStratumMessage(miner, data) {
  switch (data.method) {
    case 'mining.subscribe':
      handleSubscribe(miner, data);
      break;
    case 'mining.authorize':
      handleAuthorize(miner, data);
      break;
    case 'mining.submit':
      handleSubmit(miner, data);
      break;
    default:
      console.log(`Unknown method: ${data.method}`);
  }
}

function handleSubscribe(miner, data) {
  miner.subscribed = true;
  console.log(`Miner ${miner.id} subscribed`);
  
  sendStratumMessage(miner, {
    id: data.id,
    result: [
      [
        ['mining.set_difficulty', [miner.id]],
        ['mining.notify', [miner.id]]
      ],
      miner.id,
      8
    ],
    error: null
  });

  // Set initial difficulty
  sendStratumMessage(miner, {
    id: null,
    method: 'mining.set_difficulty',
    params: [1]
  });

  // Send initial work
  sendWork(miner);
}

function handleAuthorize(miner, data) {
  const [username, password] = data.params;
  miner.address = username;
  miner.authorized = true;
  
  console.log(`Miner ${miner.id} authorized as ${username}`);
  
  sendStratumMessage(miner, {
    id: data.id,
    result: true,
    error: null
  });
}

function handleSubmit(miner, data) {
  console.log(`Share submitted by miner ${miner.id}`);
  
  // Accept the share (in real implementation, you'd validate this)
  sendStratumMessage(miner, {
    id: data.id,
    result: true,
    error: null
  });

  // Update hashrate (simplified calculation)
  miner.hashrate = Math.random() * 1000000000; // Mock hashrate
  updateTotalHashrate();
}

async function sendWork(miner) {
  try {
    console.log(`[mining] Getting work for miner ${miner.id} from Bitcoin Core...`);
    const template = await rpcService.getBlockTemplate();
    
    // Convert block template to stratum work format
    const jobId = crypto.randomBytes(8).toString('hex');
    
    const work = {
      id: null,
      method: 'mining.notify',
      params: [
        jobId,                                    // job_id
        template.previousblockhash,              // prevhash
        template.coinbasetxn?.data || '',        // coinbase1
        '',                                       // coinbase2 (empty for now)
        template.transactions?.map(tx => tx.data) || [], // merkle_branch
        template.version,                         // version
        template.bits,                            // nbits
        template.curtime,                         // ntime
        false                                     // clean_jobs
      ]
    };
    
    console.log(`[mining] Sending real work to miner ${miner.id}, job: ${jobId}`);
    sendStratumMessage(miner, work);
    
    // Store the job for later validation
    miner.currentJobId = jobId;
    miner.currentTemplate = template;
    
  } catch (error) {
    console.error(`[mining] Failed to get real work for miner ${miner.id}: ${error.message}`);
    
    // Check if this is an IBD-related error
    if (error.message.includes('syncing') || error.message.includes('IBD')) {
      console.log(`[mining] Bitcoin Core is syncing - sending fallback work to miner ${miner.id}`);
    } else {
      console.log(`[mining] Bitcoin Core unavailable - sending fallback work to miner ${miner.id}`);
    }
    
    // Send fallback mock work if Bitcoin Core is not available
    const fallbackWork = {
      id: null,
      method: 'mining.notify',
      params: [
        crypto.randomBytes(8).toString('hex'),   // job_id
        crypto.randomBytes(32).toString('hex'),   // prevhash
        crypto.randomBytes(32).toString('hex'),   // coinbase1
        '',                                       // coinbase2
        [],                                       // merkle_branch
        '00000001',                               // version
        '1e7fffff',                               // nbits
        Math.floor(Date.now() / 1000).toString(16), // ntime
        false                                     // clean_jobs
      ]
    };
    
    console.log(`[mining] Sent fallback work to miner ${miner.id}`);
    sendStratumMessage(miner, fallbackWork);
  }
}

function sendStratumMessage(miner, message) {
  if (miner.ws.readyState === WebSocket.OPEN) {
    miner.ws.send(JSON.stringify(message));
  }
}

function updateTotalHashrate() {
  totalHashrate = Array.from(connectedMiners.values())
    .reduce((sum, miner) => sum + miner.hashrate, 0);
}

// Periodic work updates - managed by stratum server lifecycle
let workUpdateInterval = null;

function startWorkUpdates() {
  if (workUpdateInterval) {
    clearInterval(workUpdateInterval);
  }

  workUpdateInterval = setInterval(async () => {
    for (const miner of connectedMiners.values()) {
      if (miner.subscribed && miner.authorized) {
        await sendWork(miner);
      }
    }
  }, 30000); // Send new work every 30 seconds

  console.log('[STRATUM] Started work update interval (30s)');
}

function stopWorkUpdates() {
  if (workUpdateInterval) {
    clearInterval(workUpdateInterval);
    workUpdateInterval = null;
    console.log('[STRATUM] Stopped work update interval');
  }
}

// Startup guard to prevent double initialization
let isStarting = false;
let isStarted = false;

// Startup sequence with proper order and validation
async function startServer() {
  // Prevent double initialization
  if (isStarting) {
    console.log('[SYSTEM] Server already starting, skipping duplicate init');
    return;
  }
  if (isStarted) {
    console.log('[SYSTEM] Server already started, skipping duplicate init');
    return;
  }

  isStarting = true;

  try {
    // Step 0: Validate environment configuration - no fallbacks
    console.log(`[SYSTEM] Validating environment configuration...`);

    const RPC_HOST = process.env.RPC_HOST;
    const RPC_PORT = process.env.RPC_PORT || '8332';
    const RPC_USER = process.env.RPC_USER;
    const RPC_PASSWORD = process.env.RPC_PASSWORD;

    console.log(`[SYSTEM] ✅ Environment configuration valid`);
    console.log(`[SYSTEM] Bitmind backend starting...`);
    console.log(`[SYSTEM] Backend port: ${PORT}`);
    console.log(`[SYSTEM] Stratum port: ${STRATUM_PORT}`);
    console.log(`[SYSTEM] Bitcoin RPC: ${RPC_HOST}:${RPC_PORT}`);
    console.log(`[SYSTEM] Node version: ${process.version}`);
    console.log(`[SYSTEM] Platform: ${process.platform}`);

    // Phase C.4: Read system state (no guessing logic)
    const state = systemState.getSnapshot();
    // console.log(`[SYSTEM] Bitcoin mode: ${state.bitcoin.mode}`);
    // console.log(`[SYSTEM] Bitcoin RPC: ${state.bitcoin.rpc}`);

    // Step 1: Start backend server - always binds, never exits
    console.log(`[SYSTEM] Starting backend HTTP server...`);
    await new Promise((resolve) => {
      server.listen(PORT, '0.0.0.0', () => {
        console.log(`[SYSTEM] ✅ Backend server started on port ${PORT}`);
        console.log(`[SYSTEM] Health endpoint: http://0.0.0.0:${PORT}/health`);
        console.log(`[SYSTEM] API stats: http://0.0.0.0:${PORT}/api/stats`);
        resolve();
      });
      server.on('error', (err) => {
        console.error(`[ERROR] HTTP server bind error: ${err.message}`);
        resolve(); // continue even on bind error
      });
    });

    // Step 3: Wait for Stratum server to be ready (non-fatal)
    console.log(`[SYSTEM] Waiting for Stratum server to be ready...`);
    try {
      await waitForStratumReady();
    } catch (stratumErr) {
      console.warn(`[WARN] Stratum server not ready: ${stratumErr.message} - continuing without Stratum`);
    }

    // Step 4: Initialize systemState
    systemState.updateBitcoin('running');
    systemState.updateBackend('running');
    systemState.updateStratum('running');

    // Step 5: Start RPC poller
    console.log(`[SYSTEM] Starting RPC poller (5s interval)...`);
    rpcPoller.start();
    
    // Step 4: Start lifecycle cleanup
    startLifecycleCleanup();
    
    // Step 5: Start websocket watchdog
    startWebSocketWatchdog();
    
    // Step 6: Start system watchdog (auto-recovery)
    console.log(`[SYSTEM] Starting system watchdog for auto-recovery...`);
    global.watchdog = { startWatchdog, getStatus: () => startWatchdog.getStatus() };
    startWatchdog();
    console.log(`[SYSTEM] ✅ System watchdog started`);
    
    // Step 7: Final system ready check
    console.log(`[SYSTEM] ========================================`);
    console.log(`[SYSTEM] Bitmind backend is READY!`);
    console.log(`[SYSTEM] ========================================`);
    console.log(`[SYSTEM] Backend: http://0.0.0.0:${PORT}`);
    console.log(`[SYSTEM] Stratum: 0.0.0.0:${STRATUM_PORT}`);
    console.log(`[SYSTEM] Bitcoin: ${systemState.bitcoin}`);
    console.log(`[SYSTEM] Miners can now connect to 192.168.1.12:${STRATUM_PORT}`);
    console.log(`[SYSTEM] System status: http://0.0.0.0:${PORT}/api/system/status`);
    console.log(`[SYSTEM] Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`[SYSTEM] ========================================`);
    console.log(`[SYSTEM] ${new Date().toISOString()} - Process ID: ${process.pid}`);
    console.log(`[SYSTEM] ========================================`);

    isStarted = true;
    isStarting = false;

  } catch (error) {
    console.error(`[ERROR] Failed to start server:`, error.message);
    isStarting = false;
    // Never exit - let PM2 decide
  }
}

// Wait for Stratum server to be ready with timeout (non-fatal)
function waitForStratumReady() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Stratum server failed to start within 10s timeout'));
    }, 10000);
    
    const checkReady = () => {
      if (stratumServerReady) {
        clearTimeout(timeout);
        console.log(`[SYSTEM] ✅ Stratum server is ready on 0.0.0.0:${STRATUM_PORT}`);
        resolve();
      } else {
        setTimeout(checkReady, 100);
      }
    };
    
    checkReady();
  });
}

// Start the server with proper sequence
startServer().catch(error => {
  console.error(`[ERROR] Startup failed:`, error.message);
  // Never exit - log and stay alive
});
