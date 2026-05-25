// Device registry for multi-device mining coordination
const { addShare } = require('./shareLedger');
const { storeEvent } = require('../core/eventStore');
const { increment } = require('../monitoring/metricsEngine');

// In-memory device registry
const devices = new Map();
const DEVICE_TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout

/**
 * Register or update a device
 * @param {string} device_id - Device identifier
 */
function registerDevice(device_id) {
  const isNewDevice = !devices.has(device_id);
  
  if (isNewDevice) {
    console.log(`[DeviceRegistry] New device registered: ${device_id}`);
    devices.set(device_id, {
      device_id,
      last_seen: Date.now(),
      accepted_shares: 0,
      rejected_shares: 0,
      last_job_id: null,
      hashrate_window: [] // For basic hashrate estimation
    });
    
    // Log device registration event
    storeEvent('device_register', {
      device_id,
      timestamp: Date.now(),
      total_devices: devices.size
    });
    
    // Track device metrics
    increment('devices', 'deviceRegistrations');
    increment('devices', 'totalDevicesRegistered');
    updateActiveDeviceCount();
  } else {
    updateDeviceActivity(device_id);
  }
}

/**
 * Update active device count in metrics
 */
function updateActiveDeviceCount() {
  const now = Date.now();
  const activeDevices = Array.from(devices.values()).filter(device => 
    (now - device.last_seen) < DEVICE_TIMEOUT
  );
  
  // Update metrics (we'll track this as a gauge, not a counter)
  // For now, we'll update it when devices come online/offline
}

/**
 * Update device activity timestamp
 * @param {string} device_id - Device identifier
 */
function updateDeviceActivity(device_id) {
  const device = devices.get(device_id);
  if (device) {
    device.last_seen = Date.now();
  }
}

/**
 * Record share submission for a device
 * @param {string} device_id - Device identifier
 * @param {boolean} isValid - Whether share was accepted
 */
function recordShare(device_id, isValid) {
  const device = devices.get(device_id);
  if (!device) {
    registerDevice(device_id);
    return recordShare(device_id, isValid);
  }

  updateDeviceActivity(device_id);
  
  if (isValid) {
    device.accepted_shares++;
    // Add to hashrate window (basic estimation)
    device.hashrate_window.push(Date.now());
  } else {
    device.rejected_shares++;
  }

  // Keep hashrate window to last 60 seconds
  const cutoff = Date.now() - 60000;
  device.hashrate_window = device.hashrate_window.filter(timestamp => timestamp > cutoff);
  
  // Log device share event
  storeEvent('device_share', {
    device_id,
    accepted: isValid,
    accepted_shares: device.accepted_shares,
    rejected_shares: device.rejected_shares,
    acceptance_rate: device.accepted_shares / (device.accepted_shares + device.rejected_shares) * 100
  });
}

/**
 * Update device's last job ID
 * @param {string} device_id - Device identifier
 * @param {string} job_id - Job identifier
 */
function updateDeviceLastJob(device_id, job_id) {
  const device = devices.get(device_id);
  if (device) {
    device.last_job_id = job_id;
  }
}

/**
 * Get device statistics
 * @param {string} device_id - Device identifier
 * @returns {Object|null} Device stats or null if not found
 */
function getDeviceStats(device_id) {
  const device = devices.get(device_id);
  if (!device) {
    return null;
  }

  const now = Date.now();
  const accepted_last_minute = device.hashrate_window.length;
  const total_shares = device.accepted_shares + device.rejected_shares;
  const acceptance_rate = total_shares > 0 ? (device.accepted_shares / total_shares * 100).toFixed(2) : 0;

  return {
    device_id: device.device_id,
    last_seen: device.last_seen,
    online: (now - device.last_seen) < DEVICE_TIMEOUT,
    accepted_shares: device.accepted_shares,
    rejected_shares: device.rejected_shares,
    total_shares: total_shares,
    acceptance_rate: parseFloat(acceptance_rate),
    estimated_hashrate: accepted_last_minute, // Shares per minute as basic hashrate
    last_job_id: device.last_job_id
  };
}

/**
 * Get all registered devices
 * @returns {Array} Array of all device stats
 */
function getAllDevices() {
  const allDevices = [];
  for (const device_id of devices.keys()) {
    const stats = getDeviceStats(device_id);
    if (stats) {
      allDevices.push(stats);
    }
  }
  return allDevices;
}

/**
 * Check if device exists
 * @param {string} device_id - Device identifier
 * @returns {boolean} True if device exists
 */
function deviceExists(device_id) {
  return devices.has(device_id);
}

/**
 * Clean up inactive devices
 */
function cleanupInactiveDevices() {
  const now = Date.now();
  const cutoff = now - DEVICE_TIMEOUT;
  let removed = 0;
  
  for (const [device_id, device] of devices.entries()) {
    if (device.last_seen < cutoff) {
      devices.delete(device_id);
      removed++;
      console.log(`[DeviceRegistry] Removed inactive device: ${device_id}`);
    }
  }
  
  if (removed > 0) {
    console.log(`[DeviceRegistry] Cleaned up ${removed} inactive devices`);
  }
}

// Auto-cleanup every 5 minutes
setInterval(cleanupInactiveDevices, 300000);

module.exports = {
  registerDevice,
  updateDeviceActivity,
  recordShare,
  updateDeviceLastJob,
  getDeviceStats,
  getAllDevices,
  deviceExists,
  cleanupInactiveDevices
};
