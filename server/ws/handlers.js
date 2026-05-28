// WEBSOCKET HANDLERS MODULE
// Only handles WebSocket events - delegates all state mutations to state module

const state = require('../state');
const { BitcoinValidation } = require('../services/bitcoinValidation');
const { sessionManager } = require('../services/sessionManager');
const DeviceRegistry = require('../services/deviceRegistry');

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
           share.nonce !== undefined;
  },

  isValidStats: (stats) => {
    return stats &&
           stats.deviceId &&
           typeof stats.hashrate === 'number' &&
           typeof stats.accepted === 'number' &&
           typeof stats.rejected === 'number' &&
           typeof stats.uptime === 'number';
  }
};

// WebSocket event handlers - ONLY READ/WRITE THROUGH STATE MODULE
const handlers = {
  // Device registration handler with DeviceRegistry integration
  register: (ws, data) => {
    const deviceId = data.deviceId;
    const ipAddress = ws._socket.remoteAddress;

    // Production safety - validate input
    if (!validation.isValidDeviceId(deviceId)) {
      console.log("[WS] REGISTER_FAILED deviceId=null reason=INVALID_DEVICE_ID");
      ws.send(JSON.stringify({
        type: "error",
        error: "INVALID_DEVICE_ID",
        message: "Device ID is required"
      }));
      return false;
    }

    // Check if device is registered in DeviceRegistry
    const isRegistered = DeviceRegistry.isRegistered(deviceId);
    const isDevClient = DeviceRegistry.isDevClient(deviceId);

    // Dev mode: allow web-client-* devices with warning
    if (!isRegistered && isDevClient) {
      console.log("[WS] DEVICE_DEV_MODE_ALLOWED deviceId=" + deviceId + " reason=DEV_CLIENT_AUTO_ACCEPT");
      // Auto-register dev clients
      DeviceRegistry.register(deviceId, { deviceType: 'web-client' });
    }

    // If still not registered, reject with structured error
    if (!DeviceRegistry.isRegistered(deviceId)) {
      console.log("[WS] DEVICE_REJECTED_UNREGISTERED deviceId=" + deviceId);
      ws.send(JSON.stringify({
        type: "error",
        error: "DEVICE_NOT_REGISTERED",
        action: "CALL /device/register FIRST",
        message: "Device must be registered via REST API before WebSocket connection"
      }));
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
      // Send ACK first
      ws.send(JSON.stringify({
        type: "ack",
        status: "connected"
      }));

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

      // Handle workerName with fallback logic
      if (data.workerName && typeof data.workerName === 'string' && data.workerName.trim().length > 0) {
        // Only update workerName if device is new or explicitly changed
        if (isNewDevice || !device.workerName) {
          state.mutations.updateDevice(deviceId, {
            workerName: data.workerName.trim()
          });
          console.log("[WS] WORKER_NAME_SET deviceId=" + deviceId + " workerName=" + data.workerName.trim());
        }
      } else if (isNewDevice && !device.workerName) {
        // Fallback for new devices without workerName
        const fallbackName = `miner-${deviceId.substring(0, 8)}`;
        state.mutations.updateDevice(deviceId, {
          workerName: fallbackName
        });
        console.log("[WS] WORKER_NAME_FALLBACK deviceId=" + deviceId + " workerName=" + fallbackName);
      }

      // Preserve firmware version if provided
      if (data.firmwareVersion) {
        state.mutations.updateDevice(deviceId, {
          firmwareVersion: data.firmwareVersion
        });
      }

      // Assign mining job
      const miningJobMsg = {
        type: "mining_job",
        jobId: require('crypto').randomUUID(),
        height: 948958,
        difficulty: "0000ffff",
        target: "00000ffffffffffffffffffffffffffffffffffffffff"
      };

      ws.send(JSON.stringify(miningJobMsg));

      // Update device with current job
      state.mutations.updateDevice(deviceId, {
        currentJobId: miningJobMsg.jobId
      });

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
  heartbeat: (ws, data) => {
    // Production safety - validate input
    if (!validation.isValidDeviceId(data.deviceId)) {
      console.log("[WS] HEARTBEAT_FAILED deviceId=null reason=INVALID_DEVICE_ID");
      return false;
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

    // Send lightweight ACK
    ws.send(JSON.stringify({
      type: "heartbeat_ack",
      timestamp: Date.now()
    }));

    return true;
  },

  // Stats handler for miner telemetry
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

    // Send ACK
    ws.send(JSON.stringify({
      type: "stats_ack",
      status: "received"
    }));

    console.log("[WS] STATS_PROCESSED deviceId=" + data.deviceId + " hashrate=" + data.hashrate + " accepted=" + data.accepted + " rejected=" + data.rejected + " uptime=" + data.uptime);

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

    // Send response to device
    const response = {
      type: "share_result",
      status: isAccepted ? "accepted" : "rejected",
      reward: isAccepted ? 1 : 0,
      reason: validationResult.reason
    };

    ws.send(JSON.stringify(response));
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
