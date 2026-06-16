// API ROUTES MODULE
// Only reads from state module - no mutations allowed

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const state = require('../state');
const DeviceRegistry = require('../services/deviceRegistry');

/**
 * Join Device State - Combines identity (deviceRegistry) + runtime (state/index.js)
 * Preserves frontend contract by returning unified device objects
 * @param {string} deviceId - Device identifier
 * @returns {Object|null} Unified device object or null if not found
 */
function joinDeviceState(deviceId) {
  // Get identity from deviceRegistry
  const registration = DeviceRegistry.getRegistration(deviceId);
  // Get runtime from state/index.js
  const runtime = state.getDevice(deviceId);

  // If neither exists, return null
  if (!registration && !runtime) {
    return null;
  }

  // Merge identity + runtime into unified object
  // Identity fields (from deviceRegistry)
  const identity = registration ? {
    deviceId: registration.deviceId,
    workerName: registration.metadata.workerName || null,
    walletAddress: registration.metadata.walletAddress || null,
    deviceType: registration.metadata.deviceType || null,
    firmwareVersion: registration.metadata.firmwareVersion || null
  } : {
    deviceId: deviceId,
    workerName: null,
    walletAddress: null,
    deviceType: null,
    firmwareVersion: null
  };

  // Runtime fields (from state/index.js)
  const runtimeData = runtime ? {
    status: runtime.status,
    hashrate: runtime.hashrate,
    uptime: runtime.uptime,
    acceptedShares: runtime.acceptedShares,
    rejectedShares: runtime.rejectedShares,
    lastSeen: runtime.lastSeen,
    currentJobId: runtime.currentJobId,
    websocketState: runtime.websocketState,
    reconnectCount: runtime.reconnectCount,
    miningMode: runtime.miningMode,
    connected: runtime.connected,
    connectedAt: runtime.connectedAt,
    ipAddress: runtime.ipAddress,
    lastDisconnectReason: runtime.lastDisconnectReason
  } : {
    status: 'offline',
    hashrate: 0,
    uptime: 0,
    acceptedShares: 0,
    rejectedShares: 0,
    lastSeen: null,
    currentJobId: null,
    websocketState: 'disconnected',
    reconnectCount: 0,
    miningMode: null,
    connected: false,
    connectedAt: null,
    ipAddress: null,
    lastDisconnectReason: null
  };

  // Return unified object (frontend-compatible)
  return {
    ...identity,
    ...runtimeData
  };
}

// Production safety - defensive checks
const validation = {
  isValidDeviceId: (deviceId) => {
    return deviceId && typeof deviceId === 'string' && deviceId.length > 0;
  }
};

// Helper function to format uptime
function formatUptime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

// Miners endpoint - returns live miner registry (unified API)
router.get('/miners', (req, res) => {
  try {
    const runtimeDevices = state.getAllDevices();
    // Join identity + runtime for each device
    const minerList = runtimeDevices.map(device => joinDeviceState(device.deviceId)).filter(Boolean);

    res.json({
      success: true,
      count: minerList.length,
      miners: minerList
    });
  } catch (error) {
    console.error('Error getting API miners:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get miner list'
    });
  }
});

// Stats endpoint - computes from live state
router.get('/stats', (req, res) => {
  try {
    const allDevices = state.getAllDevices();
    const totalAcceptedShares = allDevices.reduce((sum, device) => sum + device.acceptedShares, 0);
    const totalRejectedShares = allDevices.reduce((sum, device) => sum + device.rejectedShares, 0);
    const totalDevicesOnline = allDevices.filter(device => device.status === 'online' || device.status === 'mining').length;
    const totalHashrate = allDevices.reduce((sum, device) => sum + device.hashrate, 0);
    
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

// Health endpoint - system status with defensive null checks
router.get('/health', async (req, res) => {
  try {
    // Defensive null checks for all system components
    const systemStats = state.getSystemStats() || { uptime: 0, connectedMiners: 0, totalHashrate: 0 };
    const wsServer = global.wsServer;
    const stratumReady = global.stratumServerReady || false;

    // Calculate actual uptime from process if systemStats.uptime is not a duration
    const uptime = typeof systemStats.uptime === 'number' && systemStats.uptime > 1000000000000
      ? Date.now() - systemStats.uptime
      : process.uptime();

    // Get WebSocket client count safely
    const wsClientCount = wsServer ? wsServer.clients.size : 0;

    // Determine Bitcoin RPC status - ACTUAL TEST
    let bitcoinRpcStatus = 'unknown';
    let rpcConfigured = false;

    // Check if RPC is configured
    if (process.env.RPC_HOST && process.env.RPC_USER && process.env.RPC_PASSWORD) {
      rpcConfigured = true;
      try {
        const { rpcService } = require('../services/rpc');
        const connected = await rpcService.testConnection();
        bitcoinRpcStatus = connected ? 'connected' : 'disconnected';
      } catch (e) {
        bitcoinRpcStatus = 'error';
      }
    } else {
      bitcoinRpcStatus = 'not_configured';
    }

    res.json({
      status: 'ok',
      uptime: Math.floor(uptime),
      websocket_clients: wsClientCount,
      stratum_status: stratumReady ? 'online' : 'offline',
      bitcoin_rpc_status: bitcoinRpcStatus,
      rpc_configured: rpcConfigured,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting API health:', error);
    // Always return a valid response even on error
    res.status(200).json({
      status: 'degraded',
      uptime: process.uptime(),
      websocket_clients: 0,
      stratum_status: 'unknown',
      bitcoin_rpc_status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Shares endpoint - share history
router.get('/shares', (req, res) => {
  try {
    const shares = state.getShares();
    
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

// Device telemetry endpoint - per-device stats
router.get('/telemetry/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;

    if (!validation.isValidDeviceId(deviceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid device ID'
      });
    }

    const device = joinDeviceState(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    // Prepare modular telemetry object (extensible for future OLED support)
    const telemetry = {
      deviceId: device.deviceId,
      workerName: device.workerName || `miner-${device.deviceId.substring(0, 8)}`,
      status: device.status,
      hashrate: device.hashrate,
      acceptedShares: device.acceptedShares,
      rejectedShares: device.rejectedShares,
      uptime: device.uptime,
      lastSeen: device.lastSeen,
      currentJobId: device.currentJobId,
      // Extensible fields for future display support
      display: {
        hashrateUnit: 'H/s',
        efficiency: device.acceptedShares > 0
          ? ((device.acceptedShares / (device.acceptedShares + device.rejectedShares)) * 100).toFixed(2) + '%'
          : '0%',
        uptimeFormatted: formatUptime(device.uptime)
      }
    };

    res.json({
      success: true,
      telemetry
    });
  } catch (error) {
    console.error('Error getting device telemetry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get device telemetry'
    });
  }
});

// System monitoring endpoint - comprehensive system stats
router.get('/monitoring', (req, res) => {
  try {
    const allDevices = state.getAllDevices();
    const systemStats = state.getSystemStats();
    const wsServer = global.wsServer;

    // Calculate comprehensive metrics
    const activeMiners = allDevices.filter(d => d.status === 'online' || d.status === 'mining').length;
    const staleMiners = allDevices.filter(d => d.status === 'stale').length;
    const offlineMiners = allDevices.filter(d => d.status === 'offline').length;
    const totalAcceptedShares = allDevices.reduce((sum, d) => sum + d.acceptedShares, 0);
    const totalRejectedShares = allDevices.reduce((sum, d) => sum + d.rejectedShares, 0);
    const totalHashrate = allDevices.reduce((sum, d) => sum + d.hashrate, 0);
    const totalReconnects = allDevices.reduce((sum, d) => sum + d.reconnectCount, 0);

    // WebSocket connection count
    const wsClientCount = wsServer ? wsServer.clients.size : 0;

    // Include device list with workerName (using joinDeviceState)
    const devicesList = allDevices.map(d => {
      const joined = joinDeviceState(d.deviceId);
      return joined ? {
        deviceId: joined.deviceId,
        workerName: joined.workerName || `miner-${joined.deviceId.substring(0, 8)}`,
        hashrate: joined.hashrate,
        acceptedShares: joined.acceptedShares,
        rejectedShares: joined.rejectedShares,
        uptime: joined.uptime,
        lastSeen: joined.lastSeen,
        status: joined.status
      } : null;
    }).filter(Boolean);

    const monitoring = {
      timestamp: Date.now(),
      server: {
        uptime: process.uptime(),
        platform: process.platform,
        nodeVersion: process.version,
        memory: process.memoryUsage()
      },
      miners: {
        total: allDevices.length,
        active: activeMiners,
        stale: staleMiners,
        offline: offlineMiners,
        totalReconnects,
        devices: devicesList
      },
      mining: {
        totalHashrate,
        totalAcceptedShares,
        totalRejectedShares,
        efficiency: totalAcceptedShares > 0 
          ? ((totalAcceptedShares / (totalAcceptedShares + totalRejectedShares)) * 100).toFixed(2) + '%'
          : '0%'
      },
      websocket: {
        connectedClients: wsClientCount
      },
      rpc: {
        status: systemState.getSnapshot().rpc.status || 'unknown'
      }
    };

    res.json({
      success: true,
      monitoring
    });
  } catch (error) {
    console.error('Error getting system monitoring:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system monitoring'
    });
  }
});

// Miner lifecycle endpoint - lifecycle statistics
router.get('/lifecycle', (req, res) => {
  try {
    const allDevices = state.getAllDevices();

    // Include device list with workerName (using joinDeviceState)
    const devicesList = allDevices.map(d => {
      const joined = joinDeviceState(d.deviceId);
      return joined ? {
        deviceId: joined.deviceId,
        workerName: joined.workerName || `miner-${joined.deviceId.substring(0, 8)}`,
        status: joined.status,
        connected: joined.connected,
        reconnectCount: joined.reconnectCount,
        websocketState: joined.websocketState
      } : null;
    }).filter(Boolean);

    // Calculate lifecycle metrics
    const lifecycleStats = {
      totalDevices: allDevices.length,
      connectedDevices: allDevices.filter(d => d.connected).length,
      disconnectedDevices: allDevices.filter(d => !d.connected).length,
      staleDevices: allDevices.filter(d => d.status === 'stale').length,
      totalReconnects: allDevices.reduce((sum, d) => sum + d.reconnectCount, 0),
      averageReconnects: allDevices.length > 0 
        ? (allDevices.reduce((sum, d) => sum + d.reconnectCount, 0) / allDevices.length).toFixed(2)
        : 0,
      devicesByStatus: {
        online: allDevices.filter(d => d.status === 'online').length,
        mining: allDevices.filter(d => d.status === 'mining').length,
        offline: allDevices.filter(d => d.status === 'offline').length,
        stale: allDevices.filter(d => d.status === 'stale').length
      },
      devicesByWebsocketState: {
        connected: allDevices.filter(d => d.websocketState === 'connected').length,
        disconnected: allDevices.filter(d => d.websocketState === 'disconnected').length,
        error: allDevices.filter(d => d.websocketState === 'error').length
      },
      devices: devicesList
    };

    res.json({
      success: true,
      lifecycleStats
    });
  } catch (error) {
    console.error('Error getting lifecycle stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get lifecycle stats'
    });
  }
});

// Top Miners endpoint - leaderboard sorted by hashrate
router.get('/top-miners', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const allDevices = state.getAllDevices();

    // Sort by hashrate DESC and limit (using joinDeviceState)
    const topMiners = allDevices
      .sort((a, b) => (b.hashrate || 0) - (a.hashrate || 0))
      .slice(0, limit)
      .map(d => {
        const joined = joinDeviceState(d.deviceId);
        return joined ? {
          workerName: joined.workerName || `miner-${joined.deviceId.substring(0, 8)}`,
          hashrate: joined.hashrate || 0,
          acceptedShares: joined.acceptedShares || 0,
          rejectedShares: joined.rejectedShares || 0,
          uptime: joined.uptime || 0,
          status: joined.status
        } : null;
      })
      .filter(Boolean);

    res.json({
      success: true,
      topMiners,
      total: topMiners.length
    });
  } catch (error) {
    console.error('Error getting top miners:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get top miners'
    });
  }
});

// System Status endpoint - proxy to /health/full (single source of truth)
router.get('/system/status', async (req, res) => {
  try {
    // Proxy to /health/full for single source of truth
    const healthResponse = await fetch(`http://localhost:${process.env.PORT || 3001}/health/full`);
    const healthData = await healthResponse.json();
    
    res.json(healthData);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Device Register endpoint - unified device registration
router.post('/device/register', (req, res) => {
  try {
    const { deviceId, deviceType, walletAddress, workerName } = req.body;
    const DeviceRegistry = require('../services/deviceRegistry');

    // Validation
    if (!deviceId || !deviceId.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Device ID is required'
      });
    }

    // Register device using DeviceRegistry
    const result = DeviceRegistry.register(deviceId, {
      deviceType: deviceType || 'web-client',
      walletAddress: walletAddress || null,
      workerName: workerName || null
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    console.log(`[API] Device registered: ${deviceId} (${result.isNew ? 'NEW' : 'UPDATE'})`);

    res.json({
      success: true,
      deviceId: result.deviceId,
      status: result.status,
      isNew: result.isNew,
      token: result.token
    });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register device'
    });
  }
});

// Connect Miner endpoint - onboarding flow
router.post('/miners/connect', (req, res) => {
  try {
    console.log('[API] MINER CONNECT REQUEST RECEIVED', req.body);
    const { walletAddress, workerName, deviceType, miningMode } = req.body;

    // Validation
    if (!walletAddress || !walletAddress.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    if (!workerName || !workerName.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Worker name is required'
      });
    }

    if (workerName.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Worker name must be at least 3 characters'
      });
    }

    // Basic Bitcoin address validation
    const bitcoinAddressRegex = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/;
    if (!bitcoinAddressRegex.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Bitcoin wallet address'
      });
    }

    // Generate device ID
    const deviceId = crypto.randomBytes(16).toString('hex');

    // Register identity in deviceRegistry
    const registration = DeviceRegistry.register(deviceId, {
      deviceType: deviceType || 'esp32',
      walletAddress: walletAddress.trim(),
      workerName: workerName.trim()
    });

    if (!registration.success) {
      return res.status(400).json(registration);
    }

    // Create runtime state in state/index.js
    const minerRuntime = {
      deviceId,
      status: 'online',
      connected: true,
      hashrate: 0,
      acceptedShares: 0,
      rejectedShares: 0,
      uptime: 0,
      lastSeen: Date.now(),
      reconnectCount: 0,
      websocketState: 'connected',
      currentJobId: null,
      miningMode: miningMode || 'standard'
    };

    state.mutations.addDevice(minerRuntime);

    // Join identity + runtime for response
    const joinedMiner = joinDeviceState(deviceId);

    // Emit WebSocket event (using joined state)
    if (global.wsServer) {
      console.log('[API] Broadcasting miner_connected event to', global.wsServer.clients.size, 'WebSocket clients');
      global.wsServer.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
          client.send(JSON.stringify({
            type: 'miner_connected',
            data: joinedMiner
          }));
        }
      });
    } else {
      console.warn('[API] No WebSocket server available for broadcasting');
    }

    console.log(`[API] Miner connected successfully: ${workerName} (${deviceId})`);

    res.json({
      success: true,
      miner: {
        deviceId: joinedMiner.deviceId,
        walletAddress: joinedMiner.walletAddress,
        workerName: joinedMiner.workerName,
        deviceType: joinedMiner.deviceType,
        miningMode: joinedMiner.miningMode,
        status: joinedMiner.status,
        connectedAt: new Date(joinedMiner.lastSeen).toISOString()
      }
    });
  } catch (error) {
    console.error('Error connecting miner:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect miner'
    });
  }
});

module.exports = router;
