// DEVICE REGISTRY MODULE
// Single source of truth for device registration
// Used by BOTH REST API (/device/register) and WebSocket handler
// Ensures unified device state across all entry points

const crypto = require('crypto');

// Device registry - in-memory store for registered devices
const registry = new Map(); // deviceId -> deviceRegistration

// Registration record structure
const createRegistration = (deviceId, metadata = {}) => ({
  deviceId,
  registeredAt: Date.now(),
  status: 'registered',
  token: metadata.token || crypto.randomBytes(32).toString('hex'), // Future-proof for ESP32 auth
  metadata: {
    deviceType: metadata.deviceType || 'unknown',
    walletAddress: metadata.walletAddress || null,
    workerName: metadata.workerName || null,
    ...metadata
  }
});

// Structured logging helper
const log = (event, deviceId, details = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[DEVICE_REGISTRY] ${timestamp} ${event} deviceId=${deviceId}`, details);
};

// Device Registry API
const DeviceRegistry = {
  // Register a device (or update existing registration)
  register: (deviceId, metadata = {}) => {
    if (!deviceId || typeof deviceId !== 'string' || deviceId.length === 0) {
      log('REGISTER_FAILED', deviceId || 'null', { reason: 'INVALID_DEVICE_ID' });
      return { success: false, error: 'INVALID_DEVICE_ID' };
    }

    const existing = registry.get(deviceId);
    const isNew = !existing;

    if (isNew) {
      const registration = createRegistration(deviceId, metadata);
      registry.set(deviceId, registration);
      log('DEVICE_REGISTERED', deviceId, { deviceType: metadata.deviceType });
    } else {
      // Update existing registration
      existing.metadata = { ...existing.metadata, ...metadata };
      log('DEVICE_UPDATED', deviceId, { deviceType: metadata.deviceType });
    }

    return {
      success: true,
      deviceId,
      status: 'registered',
      isNew,
      token: registry.get(deviceId).token
    };
  },

  // Check if device is registered
  isRegistered: (deviceId) => {
    return registry.has(deviceId);
  },

  // Get device registration
  getRegistration: (deviceId) => {
    return registry.get(deviceId) || null;
  },

  // Remove device registration
  unregister: (deviceId) => {
    const existed = registry.delete(deviceId);
    if (existed) {
      log('DEVICE_UNREGISTERED', deviceId);
    }
    return existed;
  },

  // Get all registered devices
  getAllRegistrations: () => {
    return Array.from(registry.values());
  },

  // Get registration count
  getRegistrationCount: () => {
    return registry.size;
  },

  // Check if device is a dev client (web-client-*)
  isDevClient: (deviceId) => {
    return deviceId && deviceId.startsWith('web-client-');
  },

  // Clear all registrations (for testing)
  clear: () => {
    registry.clear();
    log('REGISTRY_CLEARED', 'ALL');
  }
};

module.exports = DeviceRegistry;
