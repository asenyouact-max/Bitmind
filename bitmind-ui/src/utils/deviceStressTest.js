/**
 * Device Stress Testing Utility
 * Simulates 1-50 devices for system stability validation
 */

class DeviceStressTest {
  constructor() {
    this.simulatedDevices = new Map();
    this.testIntervals = new Map();
    this.isRunning = false;
  }

  // Start stress test with specified number of devices
  startTest(deviceCount = 10, updateInterval = 1000) {
    if (this.isRunning) {
      console.log('Stress test already running');
      return;
    }

    console.log(`Starting stress test with ${deviceCount} devices`);
    this.isRunning = true;

    // Create simulated devices
    for (let i = 0; i < deviceCount; i++) {
      const deviceId = `esp32-test-${String(i + 1).padStart(3, '0')}`;
      this.simulatedDevices.set(deviceId, {
        deviceId,
        status: 'online',
        hashrate: Math.floor(Math.random() * 100) + 50,
        uptime: 0,
        lastSeen: Date.now(),
        source: 'esp32'
      });
    }

    // Start sending updates at specified interval
    this.testIntervals.set('updates', setInterval(() => {
      this.sendDeviceUpdates();
    }, updateInterval));

    // Start stress scenarios
    this.startStressScenarios();
  }

  // Start various stress scenarios
  startStressScenarios() {
    // Rapid reconnect/disconnect cycles
    this.testIntervals.set('reconnect', setInterval(() => {
      const devices = Array.from(this.simulatedDevices.values());
      const randomDevice = devices[Math.floor(Math.random() * devices.length)];
      
      if (randomDevice && Math.random() > 0.7) {
        this.simulateReconnect(randomDevice.deviceId);
      }
    }, 5000));

    // Delayed packets simulation
    this.testIntervals.set('delayed', setInterval(() => {
      const devices = Array.from(this.simulatedDevices.values());
      const randomDevice = devices[Math.floor(Math.random() * devices.length)];
      
      if (randomDevice && Math.random() > 0.8) {
        setTimeout(() => {
          this.sendDeviceUpdate(randomDevice.deviceId);
        }, Math.random() * 3000); // 0-3 second delay
      }
    }, 8000));

    // Duplicate register messages
    this.testIntervals.set('duplicate', setInterval(() => {
      const devices = Array.from(this.simulatedDevices.values());
      const randomDevice = devices[Math.floor(Math.random() * devices.length)];
      
      if (randomDevice && Math.random() > 0.9) {
        this.sendDuplicateRegister(randomDevice.deviceId);
      }
    }, 12000));

    // Out-of-order messages
    this.testIntervals.set('outOfOrder', setInterval(() => {
      const devices = Array.from(this.simulatedDevices.values());
      const shuffled = [...devices].sort(() => Math.random() - 0.5);
      
      // Send updates in random order
      shuffled.slice(0, 3).forEach(device => {
        setTimeout(() => {
          this.sendDeviceUpdate(device.deviceId);
        }, Math.random() * 1000);
      });
    }, 15000));
  }

  // Simulate device reconnection
  simulateReconnect(deviceId) {
    console.log(`Simulating reconnect for ${deviceId}`);
    
    // Mark as offline briefly
    const device = this.simulatedDevices.get(deviceId);
    if (device) {
      device.status = 'offline';
      this.sendDeviceUpdate(deviceId);
      
      // Reconnect after 1-3 seconds
      setTimeout(() => {
        device.status = 'online';
        device.lastSeen = Date.now();
        this.sendDeviceUpdate(deviceId);
      }, Math.random() * 2000 + 1000);
    }
  }

  // Send duplicate register message
  sendDuplicateRegister(deviceId) {
    console.log(`Sending duplicate register for ${deviceId}`);
    
    if (window.ws && window.ws.readyState === 1) {
      window.ws.send(JSON.stringify({
        type: 'register',
        deviceId,
        source: 'esp32'
      }));
    }
  }

  // Send device update
  sendDeviceUpdate(deviceId) {
    const device = this.simulatedDevices.get(deviceId);
    if (!device) return;

    // Update device state
    device.uptime += 1;
    device.hashrate = Math.floor(Math.random() * 100) + 50;
    device.lastSeen = Date.now();

    // Send to WebSocket if available
    if (window.ws && window.ws.readyState === 1) {
      window.ws.send(JSON.stringify({
        type: 'stats',
        deviceId,
        hashrate: device.hashrate,
        uptime: device.uptime
      }));
    }
  }

  // Send updates for all devices
  sendDeviceUpdates() {
    this.simulatedDevices.forEach((device, deviceId) => {
      this.sendDeviceUpdate(deviceId);
    });
  }

  // Stop stress test
  stopTest() {
    console.log('Stopping stress test');
    this.isRunning = false;

    // Clear all intervals
    this.testIntervals.forEach(interval => clearInterval(interval));
    this.testIntervals.clear();
    this.simulatedDevices.clear();
  }

  // Get current test status
  getTestStatus() {
    return {
      isRunning: this.isRunning,
      deviceCount: this.simulatedDevices.size,
      devices: Array.from(this.simulatedDevices.values())
    };
  }
}

// Export for use in browser console
window.deviceStressTest = new DeviceStressTest();

// Auto-start with 10 devices for testing
console.log('Device stress test utility loaded. Usage:');
console.log('deviceStressTest.startTest(50); // Start with 50 devices');
console.log('deviceStressTest.stopTest(); // Stop test');
console.log('deviceStressTest.getTestStatus(); // Get current status');
