const express = require('express');
const DeviceManager = require('./devices/deviceManager');
const { initialize: initializeWebSocket } = require('./ws/miningSocket');
const { initialize: initializeEventStore, shutdown: shutdownEventStore } = require('./core/eventStore');

// Import routes
const statusRoutes = require('./routes/status');
const syncRoutes = require('./routes/sync');
const networkRoutes = require('./routes/network');
const deviceRoutes = require('./routes/devices');
const miningRoutes = require('./mining/miningRoutes');
const monitoringRoutes = require('./monitoring/monitoringRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add metrics collection middleware
app.use((req, res, next) => {
  const { increment } = require('./monitoring/metricsEngine');
  
  // Increment request counter
  increment('requests', 'total', 1, { endpoint: req.route?.path || req.path });
  
  // Track response time
  const startTime = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    // Track errors
    if (res.statusCode >= 400) {
      increment('requests', 'errors', 1);
    }
  });
  
  next();
});

// Add request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Add CORS headers for ESP32 and frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Initialize device manager
const deviceManager = new DeviceManager();

// Periodic device status check (every 5 minutes)
setInterval(() => {
  deviceManager.checkOfflineDevices();
}, 5 * 60 * 1000);

// Routes
app.use('/status', statusRoutes);
app.use('/sync', syncRoutes);
app.use('/network', networkRoutes);
app.use('/device', deviceRoutes);
app.use('/devices', deviceRoutes);
app.use('/mining', miningRoutes);
app.use('/metrics', monitoringRoutes);
app.use('/monitoring', monitoringRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Bitmind Bridge',
    version: '1.0.0',
    description: 'Middleware between Bitcoin Core and external clients',
    endpoints: {
      health: '/health',
      status: '/status',
      sync: '/sync',
      network: '/network',
      devices: '/devices',
      registerDevice: 'POST /device/register',
      pingDevice: 'POST /device/ping',
      mining: {
        start: 'POST /mining/start',
        stop: 'POST /mining/stop',
        job: 'GET /mining/job',
        share: 'POST /mining/share',
        shares: 'GET /mining/shares',
        stats: 'GET /mining/stats',
        status: 'GET /mining/status'
      }
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    availableEndpoints: [
      '/health',
      '/status',
      '/sync',
      '/network',
      '/devices',
      '/device/register',
      '/device/ping'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[App] Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Initialize event store and monitoring system
async function initializeSystem() {
  try {
    console.log('[App] Initializing event store...');
    await initializeEventStore();
    
    console.log('[App] Initializing monitoring system...');
    // Monitoring system is self-initializing, just log that it's ready
    
    console.log('[App] System initialization complete');
  } catch (error) {
    console.error('[App] Failed to initialize system:', error.message);
    // Continue without persistence - system will work but without recovery
  }
}

// Start server
const server = app.listen(PORT, async () => {
  console.log('========================================');
  console.log('    BITMIND BRIDGE SERVER');
  console.log('========================================');
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoints: http://localhost:${PORT}/`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws/mining`);
  console.log('========================================');
  
  // Initialize system after server starts
  await initializeSystem();
  
  // Initialize WebSocket server
  initializeWebSocket(server);
});

// Graceful shutdown
async function gracefulShutdown() {
  console.log('\n[App] Shutting down gracefully...');
  
  try {
    // Shutdown event store
    await shutdownEventStore();
    console.log('[App] Event store shutdown complete');
  } catch (error) {
    console.error('[App] Error during shutdown:', error.message);
  }
  
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

module.exports = server;
