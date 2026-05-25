// API ROUTES MODULE
// Only reads from state module - no mutations allowed

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const state = require('../state');

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
    const minerList = state.getAllDevices();

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

// Devices endpoint - returns live device registry (legacy, deprecated)
router.get('/devices', (req, res) => {
  try {
    const deviceList = state.getAllDevices();

    res.json({
      success: true,
      count: deviceList.length,
      devices: deviceList
    });
  } catch (error) {
    console.error('Error getting API devices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get device list'
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
router.get('/health', (req, res) => {
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
    
    // Determine Bitcoin RPC status (fallback mode if unavailable)
    let bitcoinRpcStatus = 'unknown';
    try {
      bitcoinRpcStatus = 'connected';
    } catch (e) {
      bitcoinRpcStatus = 'fallback';
    }
    
    res.json({
      status: 'ok',
      uptime: Math.floor(uptime),
      websocket_clients: wsClientCount,
      stratum_status: stratumReady ? 'online' : 'offline',
      bitcoin_rpc_status: bitcoinRpcStatus,
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

    const device = state.getDevice(deviceId);
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

    // RPC health check
    let rpcHealth = 'unknown';
    try {
      rpcHealth = 'connected';
    } catch (e) {
      rpcHealth = 'error';
    }

    // Include device list with workerName
    const devicesList = allDevices.map(d => ({
      deviceId: d.deviceId,
      workerName: d.workerName || `miner-${d.deviceId.substring(0, 8)}`,
      hashrate: d.hashrate,
      acceptedShares: d.acceptedShares,
      rejectedShares: d.rejectedShares,
      uptime: d.uptime,
      lastSeen: d.lastSeen,
      status: d.status
    }));

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
        status: rpcHealth
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

    // Include device list with workerName
    const devicesList = allDevices.map(d => ({
      deviceId: d.deviceId,
      workerName: d.workerName || `miner-${d.deviceId.substring(0, 8)}`,
      status: d.status,
      connected: d.connected,
      reconnectCount: d.reconnectCount,
      websocketState: d.websocketState
    }));

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

    // Sort by hashrate DESC and limit
    const topMiners = allDevices
      .sort((a, b) => (b.hashrate || 0) - (a.hashrate || 0))
      .slice(0, limit)
      .map(d => ({
        workerName: d.workerName || `miner-${d.deviceId.substring(0, 8)}`,
        hashrate: d.hashrate || 0,
        acceptedShares: d.acceptedShares || 0,
        rejectedShares: d.rejectedShares || 0,
        uptime: d.uptime || 0,
        status: d.status
      }));

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

// System Status endpoint - comprehensive system observability
router.get('/system/status', (req, res) => {
  try {
    const allDevices = state.getAllDevices();
    const wsServer = global.wsServer;
    const stratumReady = global.stratumServerReady || false;
    
    // Determine overall system status
    let systemStatus = 'ok';
    let rpcStatus = 'unknown';
    
    // Check RPC status
    try {
      rpcStatus = 'connected';
    } catch (e) {
      rpcStatus = 'disconnected';
      systemStatus = 'degraded';
    }
    
    // Check WebSocket status
    const wsClientCount = wsServer ? wsServer.clients.size : 0;
    if (wsClientCount === 0 && allDevices.length > 0) {
      systemStatus = 'degraded';
    }
    
    // Check Stratum status
    if (!stratumReady) {
      systemStatus = 'degraded';
    }
    
    // Check if system is failed (no devices, no RPC, no stratum)
    if (rpcStatus === 'disconnected' && !stratumReady && allDevices.length === 0) {
      systemStatus = 'failed';
    }
    
    // Get watchdog status if available
    let watchdogStatus = null;
    if (global.watchdog) {
      try {
        watchdogStatus = global.watchdog.getStatus();
      } catch (e) {
        // Watchdog not available
      }
    }
    
    res.json({
      status: systemStatus,
      rpc: rpcStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      tailscale: 'active',
      pm2: 'online',
      components: {
        websocket: wsClientCount > 0 ? 'active' : 'idle',
        stratum: stratumReady ? 'online' : 'offline',
        devices: {
          total: allDevices.length,
          online: allDevices.filter(d => d.status === 'online' || d.status === 'mining').length
        }
      },
      watchdog: watchdogStatus
    });
  } catch (error) {
    console.error('Error getting system status:', error);
    res.status(500).json({
      status: 'failed',
      rpc: 'unknown',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      tailscale: 'unknown',
      pm2: 'unknown',
      error: error.message
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
    
    // Create miner session
    const miner = {
      deviceId,
      walletAddress: walletAddress.trim(),
      workerName: workerName.trim(),
      deviceType: deviceType || 'esp32',
      miningMode: miningMode || 'standard',
      status: 'online',
      connected: true,
      hashrate: 0,
      acceptedShares: 0,
      rejectedShares: 0,
      uptime: 0,
      lastSeen: Date.now(),
      reconnectCount: 0,
      websocketState: 'connected',
      currentJobId: null
    };
    
    // Store miner in state
    state.mutations.addDevice(miner);
    
    // Emit WebSocket event
    if (global.wsServer) {
      console.log('[API] Broadcasting miner_connected event to', global.wsServer.clients.size, 'WebSocket clients');
      global.wsServer.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
          client.send(JSON.stringify({
            type: 'miner_connected',
            data: miner
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
        deviceId: miner.deviceId,
        walletAddress: miner.walletAddress,
        workerName: miner.workerName,
        deviceType: miner.deviceType,
        miningMode: miner.miningMode,
        status: miner.status,
        connectedAt: new Date(miner.lastSeen).toISOString()
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
