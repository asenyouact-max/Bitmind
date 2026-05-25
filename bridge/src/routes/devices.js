const express = require('express');
const DeviceManager = require('../devices/deviceManager');
const ShareManager = require('../mining/shareManager');

const router = express.Router();
const deviceManager = new DeviceManager();
const shareManager = new ShareManager();

// POST /device/register - Register a new ESP32 device
router.post('/register', (req, res) => {
  try {
    const { deviceId, ip, firmwareVersion } = req.body;
    
    if (!deviceId || !ip) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['deviceId', 'ip']
      });
    }

    // Check if device already exists
    const existingDevice = deviceManager.getDevice(deviceId);
    if (existingDevice) {
      // Update existing device
      deviceManager.updatePing(deviceId, ip);
      return res.json({
        success: true,
        message: 'Device updated',
        device: existingDevice
      });
    }

    // Register new device
    const device = deviceManager.registerDevice(deviceId, ip, firmwareVersion);
    
    res.status(201).json({
      success: true,
      message: 'Device registered',
      device
    });
  } catch (error) {
    console.error('[Route] POST /device/register error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// POST /device/register/miner - Register a new mining device (for Connect Miner UI)
router.post('/register/miner', (req, res) => {
  try {
    const { id, name, wallet, worker } = req.body;
    
    // Validate required fields
    if (!id || !name || !wallet) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: id, name, wallet'
      });
    }
    
    // Validate wallet address format (basic validation)
    if (!wallet.startsWith('bc1') && !wallet.startsWith('1') && !wallet.startsWith('3')) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid wallet address format'
      });
    }
    
    // Create miner device data
    const deviceData = {
      deviceId: id,
      name,
      wallet,
      worker: worker || null,
      registered_at: new Date().toISOString(),
      online: false,
      last_seen: null,
      accepted_shares: 0,
      rejected_shares: 0,
      estimated_hashrate: '0 MH/s',
      type: 'miner'
    };
    
    // Check if device already exists
    const existingDevice = deviceManager.getDevice(id);
    if (existingDevice) {
      return res.status(409).json({
        status: 'error',
        message: 'Device with this ID already exists'
      });
    }
    
    // Register the miner device using deviceManager
    const device = deviceManager.registerDevice(id, '127.0.0.1', '1.0.0');
    
    // Update device with miner-specific data
    device.name = name;
    device.wallet = wallet;
    device.worker = worker;
    device.type = 'miner';
    device.registered_at = deviceData.registered_at;
    
    console.log(`[DeviceRoutes] Miner registered: ${id} (${name})`);
    
    res.status(201).json({
      status: 'ok',
      message: 'Miner registered successfully',
      device: deviceData
    });
    
  } catch (error) {
    console.error('[DeviceRoutes] Error registering miner:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to register miner'
    });
  }
});

// POST /device/ping - Update device last seen timestamp and track shares
router.post('/ping', (req, res) => {
  try {
    const { deviceId, ip } = req.body;
    
    if (!deviceId || !ip) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['deviceId', 'ip']
      });
    }

    const device = deviceManager.updatePing(deviceId, ip);
    
    if (!device) {
      return res.status(404).json({
        error: 'Device not found',
        deviceId
      });
    }

    // Get device share stats
    const deviceStats = shareManager.getDeviceShareStats(deviceId);
    
    res.json({
      success: true,
      message: 'Ping updated',
      device: {
        ...device,
        shareStats: deviceStats
      }
    });
  } catch (error) {
    console.error('[Route] POST /device/ping error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /devices - List all registered devices
router.get('/', (req, res) => {
  try {
    const devices = deviceManager.getAllDevices();
    const stats = deviceManager.getDeviceStats();
    
    res.json({
      timestamp: new Date().toISOString(),
      stats,
      devices
    });
  } catch (error) {
    console.error('[Route] GET /devices error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /devices/:deviceId - Get specific device info
router.get('/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = deviceManager.getDevice(deviceId);
    
    if (!device) {
      return res.status(404).json({
        error: 'Device not found',
        deviceId
      });
    }

    // Get device share stats
    const deviceStats = shareManager.getDeviceShareStats(deviceId);

    res.json({
      timestamp: new Date().toISOString(),
      device: {
        ...device,
        shareStats: deviceStats
      }
    });
  } catch (error) {
    console.error('[Route] GET /devices/:deviceId error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// DELETE /devices/:deviceId - Remove a device
router.delete('/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const removed = deviceManager.removeDevice(deviceId);
    
    if (!removed) {
      return res.status(404).json({
        error: 'Device not found',
        deviceId
      });
    }

    res.json({
      success: true,
      message: 'Device removed',
      deviceId
    });
  } catch (error) {
    console.error('[Route] DELETE /devices/:deviceId error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
