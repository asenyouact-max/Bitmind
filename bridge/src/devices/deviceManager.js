class DeviceManager {
  constructor() {
    this.devices = new Map(); // deviceId -> device object
  }

  registerDevice(deviceId, ip, firmwareVersion = '1.0.0') {
    const device = {
      deviceId,
      ip,
      status: 'online',
      lastSeen: new Date().toISOString(),
      firmwareVersion,
      registeredAt: new Date().toISOString()
    };

    this.devices.set(deviceId, device);
    console.log(`[Device] Registered: ${deviceId} from ${ip}`);
    return device;
  }

  updatePing(deviceId, ip) {
    const device = this.devices.get(deviceId);
    if (!device) {
      return null;
    }

    device.lastSeen = new Date().toISOString();
    device.status = 'online';
    device.ip = ip; // Update IP if changed
    
    console.log(`[Device] Ping: ${deviceId} from ${ip}`);
    return device;
  }

  getDevice(deviceId) {
    return this.devices.get(deviceId) || null;
  }

  getAllDevices() {
    return Array.from(this.devices.values());
  }

  removeDevice(deviceId) {
    const removed = this.devices.delete(deviceId);
    if (removed) {
      console.log(`[Device] Removed: ${deviceId}`);
    }
    return removed;
  }

  // Check for offline devices (not seen in last 5 minutes)
  checkOfflineDevices() {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    this.devices.forEach((device, deviceId) => {
      const lastSeen = new Date(device.lastSeen);
      if (lastSeen < fiveMinutesAgo) {
        device.status = 'offline';
        console.log(`[Device] Marked offline: ${deviceId} (last seen: ${device.lastSeen})`);
      }
    });
  }

  getDeviceStats() {
    const devices = this.getAllDevices();
    const online = devices.filter(d => d.status === 'online').length;
    const offline = devices.filter(d => d.status === 'offline').length;
    
    return {
      total: devices.length,
      online,
      offline
    };
  }
}

module.exports = DeviceManager;
