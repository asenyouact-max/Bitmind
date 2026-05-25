// WEBSOCKET HANDLERS MODULE
// Only handles WebSocket events - delegates all state mutations to state module

const state = require('../state');
const { BitcoinValidation } = require('../services/bitcoinValidation');
const { sessionManager } = require('../services/sessionManager');

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
  // Device registration handler with duplicate prevention
  register: (ws, data) => {
    const deviceId = data.deviceId;
    const ipAddress = ws._socket.remoteAddress;

    // Production safety - validate input
    if (!validation.isValidDeviceId(deviceId)) {
      console.log("🚫 INVALID DEVICE ID:", deviceId);
      return false;
    }

    // Single device mode - only allow esp32-686C26E81F84
    if (deviceId !== "esp32-686C26E81F84") {
      console.log("🚫 UNKNOWN DEVICE BLOCKED:", deviceId);
      return false;
    }

    // Debounce protection - prevent rapid re-registers
    const now = Date.now();
    const lastRegister = registerDebounce.get(deviceId) || 0;
    if (now - lastRegister < REGISTER_DEBOUNCE_MS) {
      console.log("⏱️  REGISTER DEBOUNCED:", deviceId, `(last: ${now - lastRegister}ms ago)`);
      return false;
    }
    registerDebounce.set(deviceId, now);

    // Check for existing active socket and gracefully replace
    const existingSocket = activeSockets.get(deviceId);
    if (existingSocket && existingSocket !== ws && existingSocket.readyState === 1) {
      console.log("🔄 REPLACING OLD SOCKET:", deviceId);
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
        console.log("📱 NEW DEVICE REGISTERED:", deviceId);
      } else {
        console.log("🔄 DEVICE RECONNECTED:", deviceId);
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
          console.log(`🏷️  Worker name set: ${data.workerName.trim()}`);
        }
      } else if (isNewDevice && !device.workerName) {
        // Fallback for new devices without workerName
        const fallbackName = `miner-${deviceId.substring(0, 8)}`;
        state.mutations.updateDevice(deviceId, {
          workerName: fallbackName
        });
        console.log(`🏷️  Fallback worker name: ${fallbackName}`);
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
      console.log("❌ REGISTER HANDLER ERROR:", e.message);
      return false;
    }
  },

  // Heartbeat handler
  heartbeat: (ws, data) => {
    // Production safety - validate input
    if (!validation.isValidDeviceId(data.deviceId)) {
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
      console.log("⚠️ HEARTBEAT FROM UNKNOWN DEVICE:", data.deviceId);
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
    console.log("📊 STATS RECEIVED from device:", data.deviceId);

    // Production safety - validate input
    if (!validation.isValidStats(data)) {
      console.log("🚫 INVALID STATS DATA:", data);
      return false;
    }

    // Get device through state module
    const device = state.getDevice(data.deviceId);
    if (!device) {
      console.log("⚠️ STATS FROM UNKNOWN DEVICE:", data.deviceId);
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

    console.log(`📊 Device ${data.deviceId} stats: ${data.hashrate} H/s, ${data.accepted} accepted, ${data.rejected} rejected, ${data.uptime}s uptime`);
    
    return true;
  },

  // Share submission handler
  shareFound: (ws, data) => {
    console.log("📥 SHARE RECEIVED from device:", data.deviceId);

    // Production safety - validate input
    if (!validation.isValidShare(data)) {
      console.log("🚫 INVALID SHARE DATA:", data);
      return false;
    }

    // Get device through state module
    const device = state.getDevice(data.deviceId);
    if (!device) {
      console.log("⚠️ SHARE FROM UNKNOWN DEVICE:", data.deviceId);
      return false;
    }

    // Get device context from session manager
    const currentSession = sessionManager.getCurrentSession();
    if (!currentSession) {
      console.log("⚠️ NO ACTIVE SESSION for share validation");
      return false;
    }

    const deviceContext = currentSession.getDeviceContext(data.deviceId);
    if (!deviceContext) {
      console.log("⚠️ DEVICE NOT ASSIGNED TO SESSION:", data.deviceId);
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
    console.log(`📊 SHARE ${isAccepted ? 'ACCEPTED' : 'REJECTED'} for device:`, data.deviceId, `reason: ${validationResult.reason}`);
    
    return true;
  },

  // Device disconnect handler with cleanup
  disconnect: (ws) => {
    if (ws.deviceId) {
      console.log("🔌 DEVICE DISCONNECTED:", ws.deviceId);
      
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
