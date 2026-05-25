// CORE UTILITIES MODULE
// Shared logic utilities used across modules

// Device cleanup utilities
const deviceCleanup = {
  // Remove offline devices after timeout
  removeOfflineDevices: (state, timeoutMs = 30000) => {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [deviceId, device] of state.devices.entries()) {
      const timeSinceLastSeen = now - device.lastSeen;
      
      if (device.status === 'online' && timeSinceLastSeen > timeoutMs) {
        device.status = 'offline';
        cleanedCount++;
        console.log(`[DEVICE] ${deviceId} marked offline (timeout)`);
      }
    }
    
    return cleanedCount;
  },

  // Remove ghost devices (very old)
  removeGhostDevices: (state, timeoutMs = 300000) => {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [deviceId, device] of state.devices.entries()) {
      const timeSinceLastSeen = now - device.lastSeen;
      
      if (timeSinceLastSeen > timeoutMs) {
        state.devices.delete(deviceId);
        removedCount++;
        console.log(`[DEVICE] ${deviceId} removed (ghost cleanup)`);
      }
    }
    
    return removedCount;
  }
};

// Message parsing utilities
const messageParsing = {
  // Safe JSON parsing
  safeParse: (message) => {
    try {
      return JSON.parse(message.toString());
    } catch (e) {
      console.log("❌ JSON PARSE ERROR:", e.message);
      return null;
    }
  },

  // Validate message structure
  validateMessage: (data) => {
    return data && 
           typeof data === 'object' && 
           data.type && 
           typeof data.type === 'string';
  }
};

// Error handling utilities
const errorHandling = {
  // Safe error logging
  logError: (context, error, additionalInfo = {}) => {
    console.error(`[ERROR] ${context}:`, error.message);
    if (Object.keys(additionalInfo).length > 0) {
      console.error(`[ERROR] Additional info:`, additionalInfo);
    }
    if (error.stack) {
      console.error(`[ERROR] Stack:`, error.stack);
    }
  },

  // Safe operation wrapper
  safeExecute: (operation, context) => {
    try {
      return operation();
    } catch (error) {
      errorHandling.logError(context, error);
      return null;
    }
  }
};

// Timing utilities
const timing = {
  // Format timestamp for logging
  formatTimestamp: (timestamp) => {
    return new Date(timestamp).toISOString();
  },

  // Calculate uptime in human readable format
  formatUptime: (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
  },

  // Get current timestamp
  now: () => Date.now()
};

// Validation utilities
const validation = {
  // Validate device ID format
  isValidDeviceId: (deviceId) => {
    return deviceId && 
           typeof deviceId === 'string' && 
           deviceId.length > 0 && 
           deviceId.length <= 50;
  },

  // Validate IP address format
  isValidIP: (ip) => {
    if (!ip || typeof ip !== 'string') {
      return false;
    }
    
    // Basic IPv4 validation
    const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    return pattern.test(ip);
  },

  // Validate WebSocket connection
  isValidWebSocket: (ws) => {
    return ws && 
           typeof ws.send === 'function' && 
           typeof ws.on === 'function';
  }
};

module.exports = {
  deviceCleanup,
  messageParsing,
  errorHandling,
  timing,
  validation
};
