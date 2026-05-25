// STATE MODULE - SINGLE SOURCE OF TRUTH
// Enforces strict separation of concerns - only this module can mutate state

const state = {
  devices: new Map(), // deviceId -> device state
  system: {
    connectedMiners: 0,
    totalHashrate: 0,
    blocksFound: 0,
    uptime: Date.now()
  },
  shares: [] // Array to track all share_found events (for API history)
};

// Standardized device model - ALL devices MUST follow this structure
const createDevice = (deviceId) => ({
  deviceId,
  status: "offline", // online | offline | mining | stale
  lastSeen: Date.now(),
  uptime: 0,
  acceptedShares: 0,
  rejectedShares: 0,
  currentJobId: null,
  hashrate: 0,
  nonceCounter: 0,
  // Lifecycle fields
  connected: false,
  connectedAt: null,
  reconnectCount: 0,
  firmwareVersion: null,
  ipAddress: null,
  websocketState: "disconnected", // connected | disconnected | error
  lastDisconnectReason: null,
  // Worker identity fields
  workerName: null // Primary display identity
});

// STATE MUTATION FUNCTIONS - ONLY THESE CAN MODIFY STATE
const mutations = {
  // Device mutations
  createDevice: (deviceId) => {
    const device = createDevice(deviceId);
    state.devices.set(deviceId, device);
    updateSystemStats();
    return device;
  },

  updateDevice: (deviceId, updates) => {
    const device = state.devices.get(deviceId);
    if (!device) return null;
    
    Object.assign(device, updates);
    updateSystemStats();
    return device;
  },

  removeDevice: (deviceId) => {
    const removed = state.devices.delete(deviceId);
    updateSystemStats();
    return removed;
  },

  // Share mutations
  addShare: (share) => {
    state.shares.push(share);
    
    // Keep only last 50 shares
    if (state.shares.length > 50) {
      state.shares.splice(0, state.shares.length - 50);
    }
  },

  // System mutations
  updateSystemStats: () => {
    const allDevices = Array.from(state.devices.values());
    state.system.connectedMiners = allDevices.filter(d => d.status === "online" || d.status === "mining").length;
    state.system.totalHashrate = allDevices.reduce((sum, device) => sum + device.hashrate, 0);
  },

  // Lifecycle mutations
  markDeviceConnected: (deviceId, ipAddress) => {
    const device = state.devices.get(deviceId);
    if (!device) return null;

    const wasConnected = device.connected;
    device.connected = true;
    device.connectedAt = Date.now();
    device.websocketState = "connected";
    device.ipAddress = ipAddress || device.ipAddress;
    device.status = "online";

    // Track reconnects
    if (!wasConnected) {
      device.reconnectCount++;
    }

    updateSystemStats();
    return device;
  },

  markDeviceDisconnected: (deviceId, reason) => {
    const device = state.devices.get(deviceId);
    if (!device) return null;

    device.connected = false;
    device.websocketState = "disconnected";
    device.status = "offline";
    device.lastDisconnectReason = reason;
    device.lastSeen = Date.now();

    updateSystemStats();
    return device;
  },

  markDeviceStale: (deviceId) => {
    const device = state.devices.get(deviceId);
    if (!device) return null;

    device.status = "stale";
    device.connected = false;
    device.websocketState = "error";
    device.lastDisconnectReason = "stale_timeout";

    updateSystemStats();
    return device;
  },

  cleanupStaleDevices: (staleTimeoutMs) => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [deviceId, device] of state.devices.entries()) {
      // Mark devices as stale if they haven't been seen recently
      if (device.status !== "offline" && (now - device.lastSeen) > staleTimeoutMs) {
        mutations.markDeviceStale(deviceId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
};

// STATE READ FUNCTIONS - IMMUTABLE ACCESS
const getters = {
  getDevice: (deviceId) => state.devices.get(deviceId),
  getAllDevices: () => Array.from(state.devices.values()),
  getDeviceCount: () => state.devices.size,
  getSystemStats: () => ({ ...state.system }),
  getShares: () => [...state.shares],
  getOnlineDevices: () => Array.from(state.devices.values()).filter(d => d.status === "online" || d.status === "mining")
};

// Helper function to update system stats
function updateSystemStats() {
  const allDevices = Array.from(state.devices.values());
  state.system.connectedMiners = allDevices.filter(d => d.status === "online" || d.status === "mining").length;
  state.system.totalHashrate = allDevices.reduce((sum, device) => sum + device.hashrate, 0);
}

// Export read-only interface and controlled mutations
module.exports = {
  // Read-only getters
  ...getters,
  
  // Controlled mutations
  mutations,
  
  // Device factory
  createDevice,
  
  // Direct access to devices Map for iteration (needed by cleanup utilities)
  devices: state.devices
};
