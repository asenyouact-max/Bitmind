/**
 * Test script for ESP32 Mining Simulator
 * Simulates ESP32 behavior for testing backend integration
 */

const WebSocket = require('ws');

// Test Configuration
const WS_URL = 'ws://localhost:3001/ws';
const DEVICE_ID = 'esp32-test-miner-001';
const DEVICE_SOURCE = 'esp32';

// Mining Simulation Configuration
const MINING_INTERVAL = 2000; // 2 seconds
const STATS_INTERVAL = 5000; // 5 seconds
const SHARE_CHANCE = 10; // 10% chance per interval

// Global Variables
let ws = null;
let currentJob = null;
let miningStats = {
  hashrate: 0,
  acceptedShares: 0,
  temperature: 0,
  uptime: 0,
  status: 'idle'
};

// Timers
let miningInterval = null;
let statsInterval = null;
let startTime = Date.now();

// Function to connect to WebSocket
function connectWebSocket() {
  ws = new WebSocket(WS_URL);
  
  ws.on('open', () => {
    console.log('🔌 WebSocket Connected');
    
    // Register device
    const registerMsg = {
      type: 'register',
      deviceId: DEVICE_ID,
      source: DEVICE_SOURCE
    };
    ws.send(JSON.stringify(registerMsg));
  });
  
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📨 Received:', message.type);
    
    if (message.type === 'mining_job') {
      currentJob = {
        jobId: message.jobId,
        height: message.height,
        target: message.target,
        previousblockhash: message.previousblockhash,
        createdAt: message.createdAt,
        active: true
      };
      miningStats.status = 'mining';
      printMiningJob();
      startMiningSimulation();
    }
    
    if (message.type === 'ack') {
      console.log('✅ Device registration acknowledged');
    }
  });
  
  ws.on('close', () => {
    console.log('❌ WebSocket Disconnected');
    stopMiningSimulation();
    miningStats.status = 'idle';
    
    // Reconnect after 5 seconds
    setTimeout(connectWebSocket, 5000);
  });
  
  ws.on('error', (error) => {
    console.error('🚨 WebSocket Error:', error.message);
  });
}

// Function to print mining job details
function printMiningJob() {
  console.log('\n=== NEW MINING JOB ===');
  console.log(`Job ID: ${currentJob.jobId}`);
  console.log(`Height: ${currentJob.height}`);
  console.log(`Target: ${currentJob.target}`);
  console.log(`PrevHash: ${currentJob.previousblockhash}`);
  console.log(`Created: ${currentJob.createdAt}`);
  console.log('========================\n');
}

// Function to simulate mining
function simulateMining() {
  if (!currentJob || !currentJob.active) {
    return;
  }
  
  // Generate simulated mining stats
  miningStats.hashrate = Math.floor(Math.random() * 150) + 50; // 50-200 H/s
  miningStats.temperature = 35 + Math.random() * 30; // 35-65°C
  
  // Simulate share found (10% chance)
  if (Math.random() * 100 < SHARE_CHANCE) {
    sendShareFound();
    miningStats.acceptedShares++;
  }
  
  console.log(`⛏ Mining: ${miningStats.hashrate} H/s, ${miningStats.acceptedShares} shares, ${miningStats.temperature.toFixed(1)}°C`);
}

// Function to send mining stats
function sendMiningStats() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  
  miningStats.uptime = Math.floor((Date.now() - startTime) / 1000);
  
  const statsMsg = {
    type: 'mining_stats',
    deviceId: DEVICE_ID,
    jobId: currentJob ? currentJob.jobId : null,
    hashrate: miningStats.hashrate,
    acceptedShares: miningStats.acceptedShares,
    temperature: parseFloat(miningStats.temperature.toFixed(1)),
    uptime: miningStats.uptime
  };
  
  ws.send(JSON.stringify(statsMsg));
  console.log(`📊 Stats sent: ${miningStats.hashrate} H/s, ${miningStats.acceptedShares} shares`);
}

// Function to send share found
function sendShareFound() {
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentJob) {
    return;
  }
  
  const nonce = generateRandomNonce();
  
  const shareMsg = {
    type: 'share_found',
    deviceId: DEVICE_ID,
    jobId: currentJob.jobId,
    nonce: nonce,
    difficulty: 'simulated'
  };
  
  ws.send(JSON.stringify(shareMsg));
  console.log(`🎯 SHARE FOUND: Nonce=${nonce}, Job=${currentJob.jobId}`);
}

// Function to generate random nonce
function generateRandomNonce() {
  const hexChars = '0123456789ABCDEF';
  let nonce = '';
  for (let i = 0; i < 8; i++) {
    nonce += hexChars[Math.floor(Math.random() * 16)];
  }
  return nonce;
}

// Function to start mining simulation
function startMiningSimulation() {
  // Clear existing intervals
  stopMiningSimulation();
  
  console.log('🚀 Starting mining simulation...');
  
  // Mining interval (every 2 seconds)
  miningInterval = setInterval(simulateMining, MINING_INTERVAL);
  
  // Stats interval (every 5 seconds)
  statsInterval = setInterval(sendMiningStats, STATS_INTERVAL);
}

// Function to stop mining simulation
function stopMiningSimulation() {
  if (miningInterval) {
    clearInterval(miningInterval);
    miningInterval = null;
  }
  
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  
  console.log('⏹ Mining simulation stopped');
}

// Start the test
console.log('🧪 Starting ESP32 Mining Simulator Test...');
console.log(`📡 Connecting to: ${WS_URL}`);
console.log(`🔧 Device ID: ${DEVICE_ID}`);
console.log('=====================================\n');

connectWebSocket();
