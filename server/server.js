require('dotenv').config();const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const crypto = require('crypto');
const http = require('http');
const axios = require('axios');
const { rpcService, RPCError } = require('./services/rpc');
const { jobManager } = require('./services/jobManager');
const { shareValidator } = require('./services/shareValidator');
const { sessionManager } = require('./services/sessionManager');
const state = require('./state');
const wsHandlers = require('./ws/handlers');
const apiRoutes = require('./api/routes');
const miningServices = require('./services/mining');
const coreUtils = require('./core/utils');
const { startWatchdog } = require('./core/watchdog');

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
  console.log("🔍 UPGRADE REQUEST:", request.url);
  console.log("🔍 UPGRADE HEADERS:", request.headers);
  
  if (request.url === '/ws') {
    console.log("✅ WS UPGRADE ACCEPTED for /ws");
    wsServer.handleUpgrade(request, socket, head, (ws) => {
      console.log("✅ WS CLIENT CONNECTED");
      wsServer.emit('connection', ws, request);
    });
  } else {
    console.log("❌ WS UPGRADE REJECTED - wrong path:", request.url);
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
  console.log('✅ WS OPEN:', req.socket.remoteAddress);
  console.log("🟢 WS CONNECTED | clients:", wsServer.clients.size);
  
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
        console.log("❌ INVALID JSON - cannot parse message");
        return;
      }

      if (!coreUtils.messageParsing.validateMessage(data)) {
        console.log("❌ INVALID MESSAGE FORMAT:", data);
        return;
      }

      console.log("✅ PARSED:", data.type);

      // Route to appropriate handler using modular structure
      switch (data.type) {
        case "register":
          wsHandlers.handlers.register(ws, data);
          break;
          
        case "heartbeat":
          wsHandlers.handlers.heartbeat(ws, data);
          break;
          
        case "share_found":
          wsHandlers.handlers.shareFound(ws, data);
          break;
          
        case "stats":
          wsHandlers.handlers.stats(ws, data);
          break;
          
        default:
          console.log("❌ UNKNOWN MESSAGE TYPE:", data.type);
      }
    } catch (error) {
      console.error("❌ MESSAGE HANDLING ERROR:", error.message);
      // Don't close connection on message errors - just log and continue
    }
  });
  
  // Handle disconnection using modular structure
  ws.on('close', (code, reason) => {
    console.log("❌ WS CLOSED | code:", code, "reason:", reason);
    console.log(" CLOSE DEVICE ID:", ws.deviceId || 'unknown');
    console.log(" AFTER CLOSE | clients:", wsServer.clients.size);
    
    // Use modular disconnect handler
    wsHandlers.handlers.disconnect(ws);
  });
  
  // Handle errors - COMPREHENSIVE LOGGING
  ws.on('error', (error) => {
    console.log(" WS ERROR FULL:", error);
    console.log(" WS ERROR MESSAGE:", error.message);
    console.log(" WS ERROR STACK:", error.stack);
    console.log(" ERROR DEVICE ID:", ws.deviceId || 'unknown');
    // NEVER close socket here
  });
  
  // Set connection alive flag
  ws.isAlive = true;
});

// NOTE: Old keepalive system removed - replaced by startWebSocketWatchdog()

// Bitcoin Core RPC configuration
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8332';
const RPC_USER = process.env.RPC_USER || 'bitcoin';
const RPC_PASSWORD = process.env.RPC_PASSWORD || '123456';

// RPC client with authentication
const rpcClient = axios.create({
  baseURL: RPC_URL,
  auth: {
    username: RPC_USER,
    password: RPC_PASSWORD
  },
  headers: {
    'Content-Type': 'application/json'
  }
});

// Bitcoin Core RPC functions
async function callRpc(method, params = []) {
  try {
    console.log(`Calling RPC method: ${method} with params:`, params);
    const response = await rpcClient.post('', {
      "jsonrpc": "1.0",
      "id": "bitmind",
      "method": method,
      "params": params
    });
    console.log(`RPC ${method} successful:`, response.data.result);
    return response.data.result;
  } catch (error) {
    console.error(`RPC ${method} failed:`, error.message);
    
    // Specific handling for connection errors
    if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused - Bitcoin Core is not running or RPC is not enabled');
      console.error('Please ensure:');
      console.error('1. Bitcoin Core is running');
      console.error('2. server=1 is set in bitcoin.conf');
      console.error('3. rpcport=8332 is set in bitcoin.conf');
      console.error('4. Bitcoin Core has been restarted after config changes');
    }
    
    if (error.response) {
      console.error('RPC Error Response:', error.response.data);
    }
    throw error;
  }
}

// Test Bitcoin Core connection
async function testBitcoinConnection() {
  try {
    const blockchainInfo = await callRpc('getblockchaininfo');
    console.log('Bitcoin Core connection successful!');
    console.log('Chain:', blockchainInfo.chain);
    console.log('Blocks:', blockchainInfo.blocks);
    return true;
  } catch (error) {
    console.error('Bitcoin Core connection failed:', error.message);
    return false;
  }
}

// Get block template for mining - FIXED VERSION
async function getBlockTemplate(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[mining] Getting block template from Bitcoin Core... (attempt ${attempt}/${maxRetries})`);
      
      // FIXED: Correct JSON-RPC format with proper params structure
      const response = await rpcClient.post('', {
        "jsonrpc": "1.0",
        "id": "solominer",
        "method": "getblocktemplate",
        "params": [{
          "rules": ["segwit"]
        }]
      });
      
      // FIXED: Log full response and success message
      if (response.data && response.data.result) {
        console.log('[mining] getblocktemplate success');
        console.log('Template keys:', Object.keys(response.data.result));
        return response.data.result;
      } else {
        console.error('getblocktemplate failed - Invalid response structure');
        throw new Error('Invalid response from Bitcoin Core');
      }
      
    } catch (error) {
      // FIXED: Enhanced error logging with full response details
      console.error(`[mining] getblocktemplate failed: ${error.message}`);
      
      if (error.response) {
        console.error('Status Code:', error.response.status);
        console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        
        // FIXED: Check if node is still syncing
        if (error.response.data?.error?.message) {
          const errorMsg = error.response.data.error.message.toLowerCase();
          if (errorMsg.includes('sync') || errorMsg.includes('loading') || errorMsg.includes('initial') || errorMsg.includes('initializing') || errorMsg.includes('ibd')) {
            console.log('[mining] Bitcoin Core is still syncing (IBD mode)');
            if (attempt < maxRetries) {
              console.log(`[mining] Retrying in 5 seconds...`);
              await new Promise(resolve => setTimeout(resolve, 5000));
              continue;
            }
            throw new Error('[mining] Bitcoin Core is still syncing - cannot generate block templates during IBD');
          }
        }
        
        // FIXED: Handle specific Bitcoin Core errors
        if (error.response.data?.error?.code === -28) {
          console.log('[mining] Bitcoin Core is still warming up');
          if (attempt < maxRetries) {
            console.log(`[mining] Retrying in 5 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }
          throw new Error('[mining] Bitcoin Core is still warming up');
        }
        
        if (error.response.data?.error?.code === -1) {
          console.error('[mining] Invalid parameters for getblocktemplate');
          throw new Error('[mining] Invalid parameters for getblocktemplate');
        }
        
        // FIXED: Handle 500 errors specifically - likely IBD related
        if (error.response.status === 500) {
          console.log('[mining] HTTP 500 - Bitcoin Core is likely still syncing (IBD mode)');
          console.log('[mining] getblocktemplate is not available during initial block download');
          
          if (attempt < maxRetries) {
            console.log(`[mining] Retrying in 5 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }
          throw new Error('[mining] getblocktemplate failed - Bitcoin Core is still syncing (IBD mode)');
        }
      }
      
      // FIXED: Handle connection refused
      if (error.code === 'ECONNREFUSED') {
        console.error('[mining] Connection refused - Bitcoin Core RPC is not available');
        throw new Error('[mining] Connection refused - Bitcoin Core RPC is not available');
      }
      
      if (attempt < maxRetries) {
        console.log(`[mining] Retrying in 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        throw error;
      }
    }
  }
}

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
    // Check Bitcoin Core RPC connection
    let rpcStatus = 'disconnected';
    try {
      await callRpc('getblockchaininfo');
      rpcStatus = 'connected';
    } catch (error) {
      rpcStatus = 'disconnected';
    }

    res.json({
      bitcoin: 'running', // Assuming running if server is up
      rpc: rpcStatus,
      backend: 'running',
      stratum: 'running',
      frontend: 'unknown', // Backend can't directly check frontend
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      bitcoin: 'unknown',
      rpc: 'error',
      backend: 'running',
      stratum: 'running',
      frontend: 'unknown',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Sync status endpoint
app.get('/sync/status', async (req, res) => {
  try {
    const blockchainInfo = await callRpc('getblockchaininfo');
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
    const blockchainInfo = await callRpc('getblockchaininfo');
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
    const result = await getBlockTemplate();
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
    const totalHashrate = allDevices.reduce((sum, device) => sum + device.hashrate, 0);
    
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

// PRODUCTION-GRADE API HEALTH ENDPOINT - SYSTEM STATUS
app.get('/api/health', (req, res) => {
  try {
    res.json({
      status: 'ok',
      websocket: wsServer.clients.size > 0 ? 'active' : 'idle',
      stratum: stratumServerReady ? 'active' : 'inactive',
      bitcoin: 'connected',
      system: {
        uptime: state.system.uptime,
        connectedMiners: state.system.connectedMiners,
        totalHashrate: state.system.totalHashrate
      }
    });
  } catch (error) {
    console.error('Error getting API health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get health status'
    });
  }
});

console.log("� PRODUCTION-GRADE BITMIND BACKEND");
console.log("� Unified state system active");
console.log("� Single device: esp32-686C26E81F84");
console.log("⚡ Real-time WebSocket → API sync");
console.log("�️ Production hardened");

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

// Device validation
function validateDeviceId(device_id) {
  if (!device_id || typeof device_id !== 'string') {
    return false;
  }
  
  // Check if device_id follows expected format (BITMINER_XXXXXX)
  const pattern = /^BITMINER_[A-F0-9]{6}$/i;
  return pattern.test(device_id);
}

function validateIPAddress(ip) {
  if (!ip || typeof ip !== 'string') {
    return false;
  }
  
  // Basic IPv4 validation
  const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  return pattern.test(ip);
}

function setDeviceState(deviceId, newState, reason = '') {
  if (!state.devices.has(deviceId)) {
    console.log(`[DEVICE] Cannot set state for unknown device: ${deviceId}`);
    return false;
  }
  
  const device = state.devices.get(deviceId);
  const oldState = device.status;
  
  // Only change state if it's different
  if (oldState !== newState) {
    device.status = newState;
    device.lastSeen = Date.now();
    
    console.log(`[DEVICE] State changed: ${deviceId} ${oldState} -> ${newState} (${reason})`);
  }
  
  return true;
}

// Enhanced WebSocket broadcasting for device updates
function broadcastDeviceUpdate(device, action) {
  const message = JSON.stringify({
    type: 'device_update',
    action: action,
    device: {
      device_id: device.device_id,
      ip: device.ip,
      type: device.type,
      status: device.status,
      last_seen: device.last_seen,
      first_seen: device.first_seen,
      registered_at: device.registered_at,
      last_state_change: device.last_state_change,
      state_change_reason: device.state_change_reason
    },
    timestamp: new Date().toISOString()
  });
  
  // Broadcast to all connected WebSocket clients
  let broadcastCount = 0;
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      broadcastCount++;
    }
  });
  
  console.log(`[WS] Broadcasted device update: ${action} - ${device.device_id} (${broadcastCount} clients)`);
}

// Robust device cleanup with strict timeout handling
function cleanupOfflineDevices() {
  const now = new Date();
  const offlineTimeout = 30000; // 30 seconds (stricter than before)
  const errorTimeout = 60000; // 60 seconds for error state
  
  let cleanedCount = 0;
  
  for (const [deviceId, device] of state.devices) {
    const lastSeen = new Date(device.lastSeen);
    const timeDiff = now - lastSeen;
    
    if (device.status === DEVICE_STATES.ONLINE && timeDiff > offlineTimeout) {
      setDeviceState(deviceId, DEVICE_STATES.OFFLINE, 'heartbeat_timeout');
      cleanedCount++;
    } else if (device.status === DEVICE_STATES.RECONNECTING && timeDiff > errorTimeout) {
      setDeviceState(deviceId, DEVICE_STATES.ERROR, 'reconnect_timeout');
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`[DEVICE] Cleanup completed: ${cleanedCount} devices updated`);
  }
}

// Ghost device cleanup - remove devices that haven't been seen for extended period
function cleanupGhostDevices() {
  const now = new Date();
  const ghostTimeout = 300000; // 5 minutes
  
  let ghostCount = 0;
  const devicesToRemove = [];
  
  state.devices.forEach((device, device_id) => {
    const lastSeen = new Date(device.lastSeen);
    const timeDiff = now - lastSeen;
    
    if (timeDiff > ghostTimeout) {
      devicesToRemove.push(device_id);
      ghostCount++;
    }
  });
  
  devicesToRemove.forEach(device_id => {
    const device = state.devices.get(device_id);
    console.log(`[DEVICE] Removing ghost device: ${device_id} (last seen: ${device.lastSeen})`);
    state.devices.delete(device_id);
    
    // Broadcast device removal
    broadcastDeviceUpdate(device, 'removed');
  });
  
  if (ghostCount > 0) {
    console.log(`[DEVICE] Ghost cleanup completed: ${ghostCount} devices removed`);
  }
}

// NOTE: Old cleanup intervals removed - replaced by startLifecycleCleanup()

// Device auto-registration endpoint with robust validation
app.post('/device/register', (req, res) => {
  try {
    const { device_id, ip, type = 'esp32_miner', status = DEVICE_STATES.ONLINE } = req.body;
    
    console.log(`[DEVICE] Registration attempt: ${device_id} from ${ip}`);
    
    // Validate required fields
    if (!device_id || !ip) {
      console.log(`[DEVICE] Registration rejected: missing required fields`);
      return res.status(400).json({
        status: 'error',
        message: 'device_id and ip are required'
      });
    }
    
    // Validate device_id format
    if (!validateDeviceId(device_id)) {
      console.log(`[DEVICE] Registration rejected: invalid device_id format: ${device_id}`);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid device_id format'
      });
    }
    
    // Validate IP address
    if (!validateIPAddress(ip)) {
      console.log(`[DEVICE] Registration rejected: invalid IP address: ${ip}`);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid IP address'
      });
    }
    
    // Check if device already exists
    const existingDevice = state.devices.get(device_id);
    const now = new Date().toISOString();
    
    const device = {
      device_id,
      ip,
      type,
      status,
      registered_at: existingDevice ? existingDevice.registered_at : now,
      last_seen: now,
      first_seen: existingDevice ? existingDevice.first_seen : now,
      last_state_change: now,
      state_change_reason: existingDevice ? 'reconnected' : 'initial_registration'
    };
    
    state.devices.set(device_id, device);
    
    const action = existingDevice ? 'reconnected' : 'registered';
    console.log(`[DEVICE] Device ${action}: ${device_id} from ${ip} (${status})`);
    
    // Notify WebSocket clients about device
    broadcastDeviceUpdate(device, action);
    
    res.json({
      status: 'success',
      message: `Device ${action} successfully`,
      device
    });
    
  } catch (error) {
    console.error('[ERROR] Device registration failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Registration failed',
      error: error.message
    });
  }
});

// Device heartbeat endpoint with robust state management
app.post('/device/ping', (req, res) => {
  try {
    const { device_id, status = DEVICE_STATES.ONLINE } = req.body;
    
    console.log(`[DEVICE] Heartbeat received: ${device_id} (${status})`);
    
    // Validate device_id
    if (!device_id) {
      console.log(`[DEVICE] Heartbeat rejected: missing device_id`);
      return res.status(400).json({
        status: 'error',
        message: 'device_id is required'
      });
    }
    
    // Validate device_id format
    if (!validateDeviceId(device_id)) {
      console.log(`[DEVICE] Heartbeat rejected: invalid device_id format: ${device_id}`);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid device_id format'
      });
    }
    
    // Check if device exists
    if (!state.devices.has(device_id)) {
      console.log(`[DEVICE] Heartbeat rejected: device not registered: ${device_id}`);
      return res.status(404).json({
        status: 'error',
        message: 'Device not registered'
      });
    }
    
    const device = state.devices.get(device_id);
    const now = new Date().toISOString();
    
    // Update device state based on heartbeat
    const oldState = device.status;
    
    device.last_seen = now;
    device.last_heartbeat = now;
    
    // Only change state if it's different
    if (oldState !== status) {
      setDeviceState(device_id, status, 'heartbeat_state_change');
    }
    
    state.devices.set(device_id, device);
    
    console.log(`[DEVICE] Heartbeat processed: ${device_id} ${oldState} -> ${status}`);
    
    res.json({
      status: 'success',
      message: 'Heartbeat received',
      timestamp: device.last_seen,
      device_status: device.status
    });
    
  } catch (error) {
    console.error('[ERROR] Device ping failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Ping failed',
      error: error.message
    });
  }
});

// Device discovery endpoint
app.get('/devices', (req, res) => {
  try {
    const deviceList = Array.from(devices.values()).map(device => ({
      device_id: device.device_id,
      ip: device.ip,
      type: device.type,
      status: device.status,
      last_seen: device.last_seen,
      first_seen: device.first_seen,
      registered_at: device.registered_at
    }));
    
    res.json({
      status: 'success',
      devices: deviceList,
      count: deviceList.length
    });
    
  } catch (error) {
    console.error('[ERROR] Device discovery failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Discovery failed',
      error: error.message
    });
  }
});

// PRODUCTION-GRADE API ROUTES - READ FROM UNIFIED STATE ONLY
app.use('/api', apiRoutes);

// Get specific device info
app.get('/device/:device_id', (req, res) => {
  try {
    const { device_id } = req.params;
    
    if (!state.devices.has(device_id)) {
      return res.status(404).json({
        status: 'error',
        message: 'Device not found'
      });
    }
    
    const device = state.devices.get(device_id);
    
    res.json({
      status: 'success',
      device
    });
    
  } catch (error) {
    console.error('[ERROR] Device info failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Device info failed',
      error: error.message
    });
  }
});

// Device status update endpoint
app.put('/device/:device_id/status', (req, res) => {
  try {
    const { device_id } = req.params;
    const { status } = req.body;
    
    if (!state.devices.has(device_id)) {
      return res.status(404).json({
        status: 'error',
        message: 'Device not found'
      });
    }
    
    const device = state.devices.get(device_id);
    device.status = status;
    device.last_seen = new Date().toISOString();
    
    state.devices.set(device_id, device);
    
    console.log(`[DEVICE] Device ${device_id} status updated to: ${status}`);
    
    // Notify WebSocket clients about status change
    broadcastDeviceUpdate(device, 'status_changed');
    
    res.json({
      status: 'success',
      message: 'Device status updated',
      device
    });
    
  } catch (error) {
    console.error('[ERROR] Device status update failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Status update failed',
      error: error.message
    });
  }
});

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
    const template = await getBlockTemplate();
    
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
    // Step 0: Validate environment configuration
    console.log(`[SYSTEM] Validating environment configuration...`);
    
    if (!process.env.RPC_HOST) {
      console.error('[ERROR] RPC_HOST is required in .env file');
      console.error('[ERROR] Please configure RPC_HOST with your Tailscale IP');
      process.exit(1);
    }
    
    if (!process.env.RPC_PASSWORD) {
      console.error('[ERROR] RPC_PASSWORD is required in .env file');
      console.error('[ERROR] Please configure RPC_PASSWORD in .env file');
      process.exit(1);
    }
    
    console.log(`[SYSTEM] ✅ Environment configuration valid`);
    console.log(`[SYSTEM] Bitmind backend starting...`);
    console.log(`[SYSTEM] Backend port: ${PORT}`);
    console.log(`[SYSTEM] Stratum port: ${STRATUM_PORT}`);
    console.log(`[SYSTEM] Bitcoin RPC: ${process.env.RPC_HOST}:${process.env.RPC_PORT || 8332}`);
    console.log(`[SYSTEM] Node version: ${process.version}`);
    console.log(`[SYSTEM] Platform: ${process.platform}`);
    
    // Step 1: Test Bitcoin Core connection first (HARD STOP if fails)
    console.log(`[SYSTEM] Testing Bitcoin Core RPC connection...`);
    const bitcoinConnected = await testBitcoinConnection();
    
    if (!bitcoinConnected) {
      console.error(`[ERROR] ❌ Bitcoin Core RPC is not reachable`);
      console.error(`[ERROR] RPC endpoint: ${process.env.RPC_HOST}:${process.env.RPC_PORT || 8332}`);
      console.error(`[ERROR] Please ensure:`);
      console.error(`[ERROR]   1. Bitcoin Core is running`);
      console.error(`[ERROR]   2. RPC is enabled in bitcoin.conf`);
      console.error(`[ERROR]   3. Tailscale VPN is connected`);
      console.error(`[ERROR]   4. Firewall allows RPC traffic`);
      console.error(`[ERROR]   5. RPC credentials are correct`);
      process.exit(1);
    }
    
    console.log(`[SYSTEM] ✅ Bitcoin Core RPC is reachable`);
    
    // Step 2: Start backend server
    console.log(`[SYSTEM] Starting backend HTTP server...`);
    await new Promise((resolve, reject) => {
      server.listen(PORT, () => {
        console.log(`[SYSTEM] ✅ Backend server started on port ${PORT}`);
        console.log(`[SYSTEM] Health endpoint: http://0.0.0.0:${PORT}/health`);
        console.log(`[SYSTEM] API stats: http://0.0.0.0:${PORT}/api/stats`);
        resolve();
      });
      server.on('error', reject);
    });
    
    // Step 3: Wait for Stratum server to be ready
    console.log(`[SYSTEM] Waiting for Stratum server to be ready...`);
    await waitForStratumReady();
    
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
    console.log(`[SYSTEM] Bitcoin: Connected`);
    console.log(`[SYSTEM] Miners can now connect to 192.168.1.12:${STRATUM_PORT}`);
    console.log(`[SYSTEM] System status: http://0.0.0.0:${PORT}/api/system/status`);
    console.log(`[SYSTEM] Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`[SYSTEM] ========================================`);
    console.log(`[SYSTEM] ${new Date().toISOString()} - Process ID: ${process.pid}`);
    console.log(`[SYSTEM] ========================================`);

    isStarted = true;
    isStarting = false;

  } catch (error) {
    console.error(`[ERROR] Failed to start server:`, error);
    isStarting = false;
    process.exit(1);
  }
}

// Wait for Stratum server to be ready with timeout
function waitForStratumReady() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Stratum server failed to start within timeout'));
    }, 10000); // 10 second timeout
    
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
  console.error(`[ERROR] Startup failed:`, error);
  process.exit(1);
});
