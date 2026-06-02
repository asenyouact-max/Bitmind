/**
 * Bitmind Device Simulator - Phase D.1 Stress Validation
 * Simulates virtual devices for stress testing the Device Contract Lock architecture
 */

const WebSocket = require('ws');
const crypto = require('crypto');

class DeviceSimulator {
  constructor(config = {}) {
    this.serverUrl = config.serverUrl || 'ws://localhost:3001/ws';
    this.deviceCount = config.deviceCount || 50;
    this.heartbeatInterval = config.heartbeatInterval || 5000;
    this.devices = new Map();
    this.metrics = {
      successfulRegistrations: 0,
      failedRegistrations: 0,
      disconnects: 0,
      heartbeatSent: 0,
      heartbeatReceived: 0,
      errors: 0,
      latencySum: 0,
      latencyCount: 0
    };
    this.isRunning = false;
  }

  /**
   * Generate a valid device ID
   */
  generateDeviceId(index) {
    return `esp32-${index.toString(16).padStart(4, '0')}`;
  }

  /**
   * Create a virtual device
   */
  createDevice(index) {
    const deviceId = this.generateDeviceId(index);
    return {
      id: deviceId,
      ws: null,
      connected: false,
      registered: false,
      lastHeartbeat: 0,
      heartbeatTimer: null,
      latency: []
    };
  }

  /**
   * Connect a device to the server
   */
  async connectDevice(device) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.serverUrl);
      device.ws = ws;
      device.connectTime = Date.now();

      ws.on('open', () => {
        device.connected = true;
        console.log(`[SIMULATOR] Device ${device.id} connected`);
        
        // Send registration message
        this.registerDevice(device);
        resolve();
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(device, message);
        } catch (error) {
          this.metrics.errors++;
          console.error(`[SIMULATOR] Device ${device.id} message parse error:`, error);
        }
      });

      ws.on('close', () => {
        device.connected = false;
        device.registered = false;
        this.metrics.disconnects++;
        console.log(`[SIMULATOR] Device ${device.id} disconnected`);
        
        if (device.heartbeatTimer) {
          clearInterval(device.heartbeatTimer);
        }
      });

      ws.on('error', (error) => {
        this.metrics.errors++;
        console.error(`[SIMULATOR] Device ${device.id} error:`, error);
        reject(error);
      });
    });
  }

  /**
   * Register a device with the server
   */
  registerDevice(device) {
    const registration = {
      type: 'device.register',
      deviceId: device.id,
      deviceType: 'oled_miner',
      firmwareVersion: '1.0.0',
      workerName: `miner-${device.id.substring(0, 8)}`,
      capabilities: {
        oled: true,
        wifi: true,
        stratum: true
      }
    };

    device.ws.send(JSON.stringify(registration));
    console.log(`[SIMULATOR] Device ${device.id} registration sent`);
  }

  /**
   * Handle incoming messages from server
   */
  handleMessage(device, message) {
    const latency = Date.now() - device.connectTime;
    
    switch (message.type) {
      case 'device.registered':
        if (message.status === 'accepted') {
          device.registered = true;
          this.metrics.successfulRegistrations++;
          this.metrics.latencySum += latency;
          this.metrics.latencyCount++;
          console.log(`[SIMULATOR] Device ${device.id} registered successfully`);
          
          // Start heartbeat
          this.startHeartbeat(device);
        } else {
          this.metrics.failedRegistrations++;
          console.log(`[SIMULATOR] Device ${device.id} registration rejected:`, message);
        }
        break;

      case 'device.heartbeat.ack':
        this.metrics.heartbeatReceived++;
        break;

      case 'mining_job':
        console.log(`[SIMULATOR] Device ${device.id} received mining job`);
        break;

      case 'device.error':
        this.metrics.errors++;
        console.error(`[SIMULATOR] Device ${device.id} received error:`, message);
        break;

      default:
        console.log(`[SIMULATOR] Device ${device.id} received message type: ${message.type}`);
    }
  }

  /**
   * Start heartbeat for a device
   */
  startHeartbeat(device) {
    device.heartbeatTimer = setInterval(() => {
      if (device.connected && device.registered) {
        this.sendHeartbeat(device);
      }
    }, this.heartbeatInterval);
  }

  /**
   * Send heartbeat
   */
  sendHeartbeat(device) {
    const heartbeat = {
      type: 'device.heartbeat',
      deviceId: device.id,
      uptime: Math.floor((Date.now() - device.connectTime) / 1000),
      wifiRssi: -50 + Math.floor(Math.random() * 20)
    };

    device.ws.send(JSON.stringify(heartbeat));
    this.metrics.heartbeatSent++;
    device.lastHeartbeat = Date.now();
  }

  /**
   * Pre-register devices via REST API (required before WebSocket connection)
   */
  async preRegisterDevices() {
    const axios = require('axios');
    
    console.log(`[SIMULATOR] Pre-registering ${this.deviceCount} devices via REST API...`);
    
    for (const device of this.devices.values()) {
      try {
        await axios.post('http://localhost:3001/api/device/register', {
          deviceId: device.id,
          deviceType: 'oled_miner',
          firmwareVersion: '1.0.0',
          walletAddress: null
        });
      } catch (error) {
        console.error(`[SIMULATOR] Failed to pre-register device ${device.id}:`, error.message);
      }
    }
    
    console.log(`[SIMULATOR] All devices pre-registered`);
  }

  /**
   * Start all devices
   */
  async start() {
    if (this.isRunning) {
      console.log('[SIMULATOR] Already running');
      return;
    }

    this.isRunning = true;
    console.log(`[SIMULATOR] Starting ${this.deviceCount} devices...`);

    // Create devices
    for (let i = 0; i < this.deviceCount; i++) {
      const device = this.createDevice(i);
      this.devices.set(device.id, device);
    }

    // Pre-register devices (required before WebSocket connection)
    await this.preRegisterDevices();

    // Connect all devices
    const connectPromises = Array.from(this.devices.values()).map(device => {
      return this.connectDevice(device).catch(err => {
        console.error(`[SIMULATOR] Failed to connect device ${device.id}:`, err);
      });
    });

    await Promise.all(connectPromises);
    console.log(`[SIMULATOR] All devices started`);
  }

  /**
   * Stop all devices
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    console.log('[SIMULATOR] Stopping all devices...');

    for (const device of this.devices.values()) {
      if (device.heartbeatTimer) {
        clearInterval(device.heartbeatTimer);
      }
      if (device.ws && device.connected) {
        device.ws.close();
      }
    }

    this.devices.clear();
    console.log('[SIMULATOR] All devices stopped');
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      averageLatency: this.metrics.latencyCount > 0 
        ? this.metrics.latencySum / this.metrics.latencyCount 
        : 0,
      connectedDevices: Array.from(this.devices.values()).filter(d => d.connected).length,
      registeredDevices: Array.from(this.devices.values()).filter(d => d.registered).length
    };
  }

  /**
   * Wait for all devices to register
   */
  async waitForRegistration(timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const registered = Array.from(this.devices.values()).filter(d => d.registered).length;
      if (registered === this.deviceCount) {
        console.log(`[SIMULATOR] All ${this.deviceCount} devices registered`);
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const registered = Array.from(this.devices.values()).filter(d => d.registered).length;
    console.log(`[SIMULATOR] Timeout: ${registered}/${this.deviceCount} devices registered`);
    return false;
  }

  /**
   * Disconnect all devices rapidly (for disconnect storm test)
   */
  async disconnectAll() {
    console.log(`[SIMULATOR] Disconnecting all ${this.devices.size} devices...`);
    
    for (const device of this.devices.values()) {
      if (device.heartbeatTimer) {
        clearInterval(device.heartbeatTimer);
      }
      if (device.ws && device.connected) {
        device.ws.close();
      }
    }

    // Wait for disconnects to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('[SIMULATOR] All devices disconnected');
  }
}

module.exports = DeviceSimulator;
