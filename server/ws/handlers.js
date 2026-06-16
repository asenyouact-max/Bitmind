// WEBSOCKET HANDLERS MODULE
// Phase D: All device communication MUST go through deviceGateway
// Only handles WebSocket events - delegates all state mutations to state module

const crypto = require('crypto');
const state = require('../state');
const { BitcoinValidation } = require('../services/bitcoinValidation');
const { sessionManager } = require('../services/sessionManager');
const DeviceRegistry = require('../services/deviceRegistry');
const deviceGateway = require('../gateway/deviceGateway');

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

// Track active sockets per device to prevent duplicates
const activeSockets = new Map(); // deviceId -> ws

// Debounce protection for rapid re-registers
const registerDebounce = new Map(); // deviceId -> lastRegisterTime
const REGISTER_DEBOUNCE_MS = 2000; // 2 seconds minimum between registers

// Production safety - defensive checks
const validation = {
  isValidDeviceId: (deviceId) => {
    return deviceId && typeof deviceId === 'string' && deviceId.length > 0;
  },

  isValidMessage: (message) => {
    return message && typeof message === 'object' && message.type;
  },

  isValidShare: (share) => {
    return share &&
           share.deviceId &&
           share.jobId &&
           share.nonce !== undefined &&
           share.hash && typeof share.hash === 'string' && /^[a-f0-9]{64}$/.test(share.hash);
  },

  isValidStats: (stats) => {
    return stats &&
           stats.deviceId &&
           typeof stats.hashrate === 'number' &&
           typeof stats.accepted === 'number' &&
           typeof stats.rejected === 'number' &&
           typeof stats.uptime === 'number';
  },

  isValidMiningStats: (stats) => {
    return stats &&
           stats.deviceId &&
           typeof stats.hashrate === 'number' &&
           typeof stats.acceptedShares === 'number' &&
           typeof stats.rejectedShares === 'number' &&
           typeof stats.uptime === 'number';
  }
};

// WebSocket event handlers - ONLY READ/WRITE THROUGH STATE MODULE
const handlers = {
  // Device registration handler with DeviceRegistry integration
  // Phase D: Uses deviceGateway for protocol-compliant validation and messages
  register: (ws, data) => {
    const deviceId = data.deviceId;
    const ipAddress = ws._socket.remoteAddress;

    // Phase D: Validate registration using deviceGateway
    const validation = deviceGateway.validateRegistration(data);
    if (!validation.valid) {
      console.log("[WS] REGISTER_FAILED deviceId=" + (deviceId || 'null') + " reason=" + validation.error);
      const errorMsg = deviceGateway.createDeviceError('PAYLOAD_INVALID', validation.error);
      ws.send(JSON.stringify(errorMsg));
      return false;
    }

    // Check if device is registered in DeviceRegistry
    const isRegistered = DeviceRegistry.isRegistered(deviceId);
    const isDevClient = DeviceRegistry.isDevClient(deviceId);
    const isEsp32Device = deviceId && deviceId.startsWith('esp32-');

    // Dev mode: allow web-client-* devices with warning
    if (!isRegistered && isDevClient) {
      console.log("[WS] DEVICE_DEV_MODE_ALLOWED deviceId=" + deviceId + " reason=DEV_CLIENT_AUTO_ACCEPT");
      // Auto-register dev clients
      DeviceRegistry.register(deviceId, { deviceType: 'web-client' });
    }

    // MODEL A: ESP32 devices auto-register on first connection
    if (!isRegistered && isEsp32Device) {
      console.log("[WS] DEVICE_AUTO_REGISTERED deviceId=" + deviceId + " reason=ESP32_SELF_REGISTRATION");
      DeviceRegistry.register(deviceId, {
        deviceType: data.deviceType || 'miner',
        workerName: data.workerName,
        walletAddress: data.walletAddress,
        firmwareVersion: data.firmwareVersion
      });
    }

    // If still not registered (non-ESP32, non-dev-client), reject
    if (!DeviceRegistry.isRegistered(deviceId)) {
      console.log("[WS] DEVICE_REJECTED_UNREGISTERED deviceId=" + deviceId);
      const errorMsg = deviceGateway.createDeviceError('AUTH_INVALID', 'Device must be registered via REST API before WebSocket connection');
      ws.send(JSON.stringify(errorMsg));
      return false;
    }

    // Debounce protection - prevent rapid re-registers
    const now = Date.now();
    const lastRegister = registerDebounce.get(deviceId) || 0;
    if (now - lastRegister < REGISTER_DEBOUNCE_MS) {
      console.log("[WS] REGISTER_DEBOUNCED deviceId=" + deviceId + " lastRegister=" + (now - lastRegister) + "ms");
      return false;
    }
    registerDebounce.set(deviceId, now);

    // Check for existing active socket and gracefully replace
    const existingSocket = activeSockets.get(deviceId);
    if (existingSocket && existingSocket !== ws && existingSocket.readyState === 1) {
      console.log("[WS] SOCKET_REPLACED deviceId=" + deviceId);
      existingSocket.close(1000, "Replaced by new connection");
      activeSockets.delete(deviceId);
    }

    try {
      // Phase D: Send protocol-compliant registration response
      const token = crypto.randomBytes(16).toString('hex');
      const regResponse = deviceGateway.createRegistrationResponse(deviceId, token);
      ws.send(JSON.stringify(regResponse));

      // Create or update device through state module
      let device = state.getDevice(deviceId);
      const isNewDevice = !device;

      if (isNewDevice) {
        device = state.mutations.createDevice(deviceId);
        console.log("[WS] DEVICE_REGISTERED deviceId=" + deviceId + " source=WEBSOCKET");
      } else {
        console.log("[WS] DEVICE_RECONNECTED deviceId=" + deviceId);
      }

      // Mark device as connected with lifecycle tracking
      state.mutations.markDeviceConnected(deviceId, ipAddress);

      // Identity fields are now stored in deviceRegistry only
      // workerName, walletAddress, deviceType, firmwareVersion are NOT written to state/index.js
      // They are read from deviceRegistry via joinDeviceState()

      // Assign mining job using jobManager for full protocol compliance
      const { jobManager } = require('../services/jobManager');
      const deviceContext = jobManager.assignWorkToDevice(deviceId);

      if (deviceContext) {
        // Get current job from jobManager
        const currentJob = jobManager.getCurrentJob();
        if (currentJob) {
          // Create protocol-compliant mining.job message with all required fields
          const miningJobMsg = {
            type: "mining.job",
            jobId: currentJob.jobId,
            sessionId: deviceContext.sessionId,
            height: currentJob.height,
            target: currentJob.target,
            pseudoTarget: currentJob.pseudoTarget || null,
            pseudoMining: currentJob.pseudoMining || false,
            createdAt: currentJob.createdAt,
            version: currentJob.version,
            previousblockhash: currentJob.previousblockhash,
            merkleroot: currentJob.merkleroot || '',
            nbits: currentJob.nbits,
            ntime: currentJob.ntime,
            deviceContext: {
              sessionId: deviceContext.sessionId,
              nonceStart: deviceContext.nonceStart,
              nonceEnd: deviceContext.nonceEnd,
              extranonce1: deviceContext.extranonce1
            }
          };

          ws.send(JSON.stringify(miningJobMsg));

          // Update device with current job
          state.mutations.updateDevice(deviceId, {
            currentJobId: currentJob.jobId
          });
        } else {
          console.log("[WS] NO_CURRENT_JOB deviceId=" + deviceId);
        }
      } else {
        console.log("[WS] NO_DEVICE_CONTEXT deviceId=" + deviceId);
      }

      // Store deviceId on WebSocket for cleanup
      ws.deviceId = deviceId;

      // Track active socket
      activeSockets.set(deviceId, ws);

      return true;

    } catch (e) {
      console.log("[WS] REGISTER_ERROR deviceId=" + deviceId + " error=" + e.message);
      return false;
    }
  },

  // Heartbeat handler
  // Phase D: Uses deviceGateway for protocol-compliant heartbeat ACK
  heartbeat: (ws, data) => {
    // Production safety - validate input
    if (!validation.isValidDeviceId(data.deviceId)) {
      console.log("[WS] HEARTBEAT_FAILED deviceId=null reason=INVALID_DEVICE_ID");
      return false;
    }

    // Validate wifiRssi if present (optional for backward compatibility)
    if (data.wifiRssi !== undefined) {
      if (typeof data.wifiRssi !== 'number' || data.wifiRssi < -100 || data.wifiRssi > 0) {
        console.log("[WS] HEARTBEAT_FAILED deviceId=" + data.deviceId + " reason=INVALID_WIFI_RSSI value=" + data.wifiRssi);
        return false;
      }
    }

    // Update device through state module with lifecycle tracking
    const device = state.mutations.updateDevice(data.deviceId, {
      lastSeen: Date.now(),
      uptime: data.uptime || 0,
      status: "mining",
      websocketState: "connected"
    });

    if (!device) {
      console.log("[WS] HEARTBEAT_FROM_UNKNOWN deviceId=" + (data.deviceId || 'null'));
      return false;
    }

    // Phase D: Send protocol-compliant heartbeat ACK
    const heartbeatAck = deviceGateway.createHeartbeatAck();
    ws.send(JSON.stringify(heartbeatAck));

    return true;
  },

  // Stats handler for miner telemetry (legacy)
  stats: (ws, data) => {
    console.log("[WS] STATS_RECEIVED deviceId=" + data.deviceId);

    // Production safety - validate input
    if (!validation.isValidStats(data)) {
      console.log("[WS] STATS_FAILED deviceId=" + (data.deviceId || 'null') + " reason=INVALID_STATS");
      return false;
    }

    // Get device through state module
    const device = state.getDevice(data.deviceId);
    if (!device) {
      console.log("[WS] STATS_FROM_UNKNOWN deviceId=" + (data.deviceId || 'null'));
      return false;
    }

    // Update device telemetry through state module
    state.mutations.updateDevice(data.deviceId, {
      lastSeen: Date.now(),
      hashrate: data.hashrate,
      acceptedShares: data.accepted,
      rejectedShares: data.rejected,
      uptime: data.uptime,
      status: "mining"
    });

    // Phase D: Send protocol-compliant device status (OLED use case)
    const deviceStatus = deviceGateway.createDeviceStatus({
      hashrate: data.hashrate,
      acceptedShares: data.accepted,
      rejectedShares: data.rejected
    });
    ws.send(JSON.stringify(deviceStatus));

    console.log("[WS] STATS_PROCESSED deviceId=" + data.deviceId + " hashrate=" + data.hashrate + " accepted=" + data.accepted + " rejected=" + data.rejected + " uptime=" + data.uptime);

    return true;
  },

  // mining_stats handler for protocol v1 compliance
  mining_stats: (ws, data) => {
    console.log("[WS] MINING_STATS_RECEIVED deviceId=" + data.deviceId);

    // Production safety - validate input
    if (!validation.isValidMiningStats(data)) {
      console.log("[WS] MINING_STATS_FAILED deviceId=" + (data.deviceId || 'null') + " reason=INVALID_MINING_STATS");
      return false;
    }

    // Get device through state module
    const device = state.getDevice(data.deviceId);
    if (!device) {
      console.log("[WS] MINING_STATS_FROM_UNKNOWN deviceId=" + (data.deviceId || 'null'));
      return false;
    }

    // Update device telemetry through state module (protocol v1 field names)
    state.mutations.updateDevice(data.deviceId, {
      lastSeen: Date.now(),
      hashrate: data.hashrate,
      acceptedShares: data.acceptedShares,
      rejectedShares: data.rejectedShares,
      uptime: data.uptime,
      status: "mining"
    });

    // Phase D: Send protocol-compliant device status (OLED use case)
    const deviceStatus = deviceGateway.createDeviceStatus({
      hashrate: data.hashrate,
      acceptedShares: data.acceptedShares,
      rejectedShares: data.rejectedShares
    });
    ws.send(JSON.stringify(deviceStatus));

    console.log("[WS] MINING_STATS_PROCESSED deviceId=" + data.deviceId + " hashrate=" + data.hashrate + " acceptedShares=" + data.acceptedShares + " rejectedShares=" + data.rejectedShares + " uptime=" + data.uptime);

    return true;
  },

  // Share submission handler
  shareFound: (ws, data) => {
    console.log("[WS] SHARE_RECEIVED deviceId=" + data.deviceId);

    // Production safety - validate input
    if (!validation.isValidShare(data)) {
      console.log("[WS] SHARE_FAILED deviceId=" + (data.deviceId || 'null') + " reason=INVALID_SHARE");
      return false;
    }

    // Get device through state module
    const device = state.getDevice(data.deviceId);
    if (!device) {
      console.log("[WS] SHARE_FROM_UNKNOWN deviceId=" + (data.deviceId || 'null'));
      return false;
    }

    // Get device context from session manager
    const currentSession = sessionManager.getCurrentSession();
    if (!currentSession) {
      console.log("[WS] SHARE_FAILED deviceId=" + (data.deviceId || 'null') + " reason=NO_ACTIVE_SESSION");
      return false;
    }

    const deviceContext = currentSession.getDeviceContext(data.deviceId);
    if (!deviceContext) {
      console.log("[WS] SHARE_FAILED deviceId=" + (data.deviceId || 'null') + " reason=NOT_IN_SESSION");
      return false;
    }

    // Update device state
    state.mutations.updateDevice(data.deviceId, {
      lastSeen: Date.now(),
      status: "mining",
      nonceCounter: device.nonceCounter + 1
    });

    // Perform Bitcoin-style validation
    const validationResult = BitcoinValidation.validateShare(data, deviceContext);
    const isAccepted = validationResult.valid;

    if (isAccepted) {
      state.mutations.updateDevice(data.deviceId, {
        acceptedShares: device.acceptedShares + 1
      });
    } else {
      state.mutations.updateDevice(data.deviceId, {
        rejectedShares: device.rejectedShares + 1
      });
    }

    // Record share in state
    state.mutations.addShare({
      deviceId: data.deviceId,
      jobId: data.jobId,
      nonce: data.nonce,
      status: isAccepted ? "accepted" : "rejected",
      reason: validationResult.reason,
      timestamp: Date.now()
    });

    // Phase D: Send protocol-compliant share result
    const shareResult = deviceGateway.createShareResult(
      data.jobId,
      isAccepted,
      validationResult.reason
    );
    ws.send(JSON.stringify(shareResult));
    console.log("[WS] SHARE_" + (isAccepted ? "ACCEPTED" : "REJECTED") + " deviceId=" + data.deviceId + " reason=" + validationResult.reason);

    return true;
  },

  // Device disconnect handler with cleanup
  disconnect: (ws) => {
    if (ws.deviceId) {
      console.log("[WS] DEVICE_DISCONNECTED deviceId=" + ws.deviceId + " reason=" + (ws.reason || "client_disconnect"));

      // Clean up active socket tracking
      const trackedSocket = activeSockets.get(ws.deviceId);
      if (trackedSocket === ws) {
        activeSockets.delete(ws.deviceId);
      }

      // Mark device as disconnected with lifecycle tracking
      state.mutations.markDeviceDisconnected(ws.deviceId, ws.reason || "client_disconnect");
    }
  }
};

module.exports = {
  handlers,
  validation
};
