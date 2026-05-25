/**
 * Test script for ESP32 Pseudo-Real Mining
 * Tests real SHA256 hashing and nonce iteration
 */

const WebSocket = require('ws');

// Test Configuration
const WS_URL = 'ws://localhost:3001/ws';
const DEVICE_ID = 'esp32-pseudo-miner-001';
const DEVICE_SOURCE = 'esp32';

// Global Variables
let ws = null;
let currentJob = null;
let deviceContext = null;
let miningStats = {
  hashesComputed: 0,
  hashrate: 0,
  acceptedShares: 0,
  validPseudoShares: 0,
  temperature: 0,
  uptime: 0,
  status: 'idle',
  currentNonce: 0
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
      // Handle session-based mining job with deviceContext
      if (message.deviceContext) {
        currentJob = {
          sessionId: message.sessionId,
          jobId: message.jobId,
          height: message.height,
          target: message.target,
          pseudoTarget: message.pseudoTarget,
          previousblockhash: message.previousblockhash,
          version: message.version,
          curtime: message.curtime,
          bits: message.bits,
          createdAt: message.createdAt,
          active: true,
          pseudoMining: message.pseudoMining
        };
        
        // Store device context for session-based mining
        deviceContext = message.deviceContext;
        miningStats.currentNonce = deviceContext.nonceStart;
        
        console.log(`📱 Session-based job received: sessionId=${deviceContext.sessionId}, nonceRange=${deviceContext.nonceStart}-${deviceContext.nonceEnd}, extranonce1=${deviceContext.extranonce1}`);
        
      } else {
        // Fallback to legacy job format
        currentJob = {
          jobId: message.jobId,
          height: message.height,
          target: message.target,
          pseudoTarget: message.pseudoTarget,
          previousblockhash: message.previousblockhash,
          version: message.version,
          curtime: message.curtime,
          bits: message.bits,
          createdAt: message.createdAt,
          active: true,
          pseudoMining: message.pseudoMining,
          nonceStart: message.nonceStart || 0
        };
        deviceContext = null;
        miningStats.currentNonce = message.nonceStart || 0;
      }
      
      miningStats.status = 'pseudo_real_mining';
      printMiningJob();
      startPseudoRealMining();
    }
    
    if (message.type === 'ack') {
      console.log('✅ Device registration acknowledged');
    }
    
    if (message.type === 'mining_job') {
      console.log('⛏ Incoming mining_job');
      currentJob = message;
      startMiningSimulation();
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log('❌ WebSocket Disconnected');
    console.log(`🔴 CLOSE CODE: ${code} | REASON: ${reason || 'No reason provided'}`);
    
    // Log disconnect reasons
    if (code === 1000) {
      console.log('📝 Normal closure - connection closed cleanly');
    } else if (code === 1001) {
      console.log('📝 Going away - server going down or browser navigating away');
    } else if (code === 1006) {
      console.log('📝 Abnormal closure - no close frame received (connection lost)');
    } else if (code === 1005) {
      console.log('📝 No status code was provided');
    } else {
      console.log(`📝 Unknown close code: ${code}`);
    }
    
    stopPseudoRealMining();
    miningStats.status = 'idle';
    
    // FIXED: Remove aggressive reconnect - let WebSocket library handle reconnects
    console.log('⏹️ Connection closed - NOT reconnecting automatically');
  });
  
  ws.on('error', (error) => {
    console.error('🚨 WebSocket Error:', error.message);
    console.error('🚨 Error type:', error.type);
    console.error('🚨 Error code:', error.code);
  });
  
  ws.on('ping', (data) => {
    console.log('📡 Ping received from server');
  });
  
  ws.on('pong', (data) => {
    console.log('📡 Pong received from server');
  });
}

// Function to print mining job details
function printMiningJob() {
  console.log('\n=== NEW PSEUDO-REAL MINING JOB ===');
  console.log(`Job ID: ${currentJob.jobId}`);
  console.log(`Height: ${currentJob.height}`);
  console.log(`Target: ${currentJob.target}`);
  console.log(`Pseudo Target: ${currentJob.pseudoTarget}`);
  console.log(`PrevHash: ${currentJob.previousblockhash}`);
  console.log(`Version: ${currentJob.version}`);
  console.log(`Curtime: ${currentJob.curtime}`);
  console.log(`Bits: ${currentJob.bits}`);
  console.log(`Nonce Start: ${currentJob.nonceStart}`);
  console.log(`Pseudo Mining: ${currentJob.pseudoMining ? 'YES' : 'NO'}`);
  console.log('========================================\n');
}

// Function to simulate pseudo-real mining
function startPseudoRealMining() {
  if (!currentJob || !currentJob.active || !currentJob.pseudoMining) {
    return;
  }
  
  // Clear existing intervals
  stopPseudoRealMining();
  
  console.log('🚀 Starting PSEUDO-REAL mining with SHA256...');
  console.log(`🎯 Pseudo Target: ${currentJob.pseudoTarget}`);
  
  // Mining interval (every 100ms)
  miningInterval = setInterval(() => {
    mineBlock();
  }, 100);
  
  // Stats interval (every 5 seconds)
  statsInterval = setInterval(() => {
    sendMiningStats();
  }, 5000);
}

// Function to mine blocks (simplified SHA256 simulation)
function mineBlock() {
  if (!currentJob || !currentJob.active || !currentJob.pseudoMining) {
    return;
  }
  
  // Check nonce range if deviceContext is available
  if (deviceContext) {
    if (miningStats.currentNonce > deviceContext.nonceEnd) {
      console.log(`🚫 Nonce range exceeded: ${miningStats.currentNonce} > ${deviceContext.nonceEnd}, stopping mining`);
      stopPseudoRealMining();
      return;
    }
  }
  
  // Simulate building 80-byte block header
  const header = buildBlockHeader(miningStats.currentNonce);
  
  // Simulate double SHA256 (this would be real in ESP32)
  const hash = simulateDoubleSHA256(header);
  
  // Check if hash is valid (less than pseudo target)
  if (isValidHash(hash, currentJob.pseudoTarget)) {
    console.log(`🎯 VALID PSEUDO SHARE FOUND! Nonce: ${miningStats.currentNonce}, Hash: ${hash}`);
    
    // Log detailed header information for debugging
    console.log(`\n🔍 ESP32 HASH DEBUG - Nonce: ${miningStats.currentNonce}`);
    console.log(`   Header Hex: ${header.toString('hex')}`);
    console.log(`   Header Length: ${header.length} bytes`);
    console.log(`   Resulting Hash: ${hash}`);
    console.log(`   Target: ${currentJob.pseudoTarget}`);
    if (deviceContext) {
      console.log(`   Session: ${deviceContext.sessionId}, Range: ${deviceContext.nonceStart}-${deviceContext.nonceEnd}`);
    }
    console.log(`   ======================================\n`);
    
    sendPseudoShareFound(hash, miningStats.currentNonce);
    miningStats.validPseudoShares++;
  }
  
  // Update mining stats
  miningStats.hashesComputed++;
  miningStats.currentNonce += 1;
  
  // Calculate hashrate (hashes per second)
  const now = Date.now();
  const timeDiff = (now - startTime) / 1000;
  if (timeDiff > 0) {
    miningStats.hashrate = miningStats.hashesComputed / timeDiff;
  }
  
  // Print progress every 100 hashes
  if (miningStats.hashesComputed % 100 === 0) {
    console.log(`⛏ Mining: Nonce=${miningStats.currentNonce}, Hashes=${miningStats.hashesComputed}, Rate=${miningStats.hashrate.toFixed(1)} H/s`);
    if (deviceContext) {
      console.log(`   📱 Session: ${deviceContext.sessionId}, Range: ${deviceContext.nonceStart}-${deviceContext.nonceEnd}`);
    }
  }
}

// Function to build 80-byte Bitcoin block header (binary format)
function buildBlockHeader(nonce) {
  // Create 80-byte buffer to match backend exactly
  const header = Buffer.alloc(80);
  let offset = 0;

  // Version (4 bytes, little endian)
  header.writeUInt32LE(currentJob.version, offset);
  offset += 4;

  // Previous block hash (32 bytes, reversed)
  const prevHash = Buffer.from(currentJob.previousblockhash, 'hex');
  for (let i = 0; i < 32; i++) {
    header[offset + i] = prevHash[31 - i]; // Reverse byte order
  }
  offset += 32;

  // Merkle root (32 bytes, reversed)
  // For pseudo mining, we use a simplified merkle root (all zeros)
  const merkleRoot = Buffer.alloc(32, 0);
  for (let i = 0; i < 32; i++) {
    header[offset + i] = merkleRoot[31 - i]; // Reverse byte order
  }
  offset += 32;

  // Timestamp (4 bytes, little endian)
  header.writeUInt32LE(currentJob.curtime, offset);
  offset += 4;

  // Bits (4 bytes, little endian)
  header.writeUInt32LE(currentJob.bits, offset);
  offset += 4;

  // Nonce (4 bytes, little endian)
  header.writeUInt32LE(nonce, offset);
  offset += 4;

  return header;
}

// Function to simulate double SHA256 (binary format)
function simulateDoubleSHA256(header) {
  // This matches the backend exactly - using real crypto on binary buffer
  const crypto = require('crypto');
  
  // First SHA256 on binary buffer
  const hash1 = crypto.createHash('sha256').update(header).digest();
  
  // Second SHA256 (double SHA256) on binary buffer
  const hash2 = crypto.createHash('sha256').update(hash1).digest('hex');
  
  return hash2;
}

// Function to validate hash against pseudo target
function isValidHash(hash, target) {
  // Simple string comparison for testing
  return hash < target;
}

// Function to send pseudo share found
function sendPseudoShareFound(hash, nonce) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  
  const shareMsg = {
    type: 'pseudo_share_found',
    deviceId: DEVICE_ID,
    sessionId: currentJob.sessionId || null, // Include sessionId if available
    jobId: currentJob.jobId,
    nonce: nonce.toString(16).padStart(8, '0').toUpperCase(),
    hash: hash.toUpperCase(),
    target: currentJob.pseudoTarget
  };
  
  ws.send(JSON.stringify(shareMsg));
  console.log(`📤 Pseudo share sent: Nonce=${nonce.toString(16)}, Hash=${hash}`);
}

// Function to send mining stats
function sendMiningStats() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  
  miningStats.temperature = 35 + Math.random() * 30; // 35-65°C
  miningStats.uptime = Math.floor((Date.now() - startTime) / 1000);
  
  const statsMsg = {
    type: 'mining_stats',
    deviceId: DEVICE_ID,
    jobId: currentJob ? currentJob.jobId : null,
    hashrate: Math.floor(miningStats.hashrate),
    acceptedShares: miningStats.acceptedShares,
    validPseudoShares: miningStats.validPseudoShares,
    temperature: parseFloat(miningStats.temperature.toFixed(1)),
    uptime: miningStats.uptime,
    currentNonce: miningStats.currentNonce,
    hashesComputed: miningStats.hashesComputed,
    status: 'pseudo_real_mining'
  };
  
  ws.send(JSON.stringify(statsMsg));
  console.log(`📊 Stats sent: ${miningStats.hashrate.toFixed(1)} H/s, ${miningStats.validPseudoShares} valid pseudo shares`);
}

// Function to start mining simulation
function startMiningSimulation() {
  if (miningInterval) {
    clearInterval(miningInterval);
  }
  
  let nonce = 0;
  
  miningInterval = setInterval(() => {
    nonce++;
    
    // Generate fake hash
    const fakeHash = Math.random().toString(16).substring(2, 18);
    
    console.log(`⛏ mining nonce: ${nonce}`);
    
    // Simulate share found (1-3% chance)
    if (Math.random() < 0.02) {
      const shareMsg = {
        type: "share_found",
        deviceId: DEVICE_ID,
        jobId: currentJob.jobId,
        nonce: nonce,
        fakeHash: fakeHash,
        timestamp: Date.now()
      };
      
      ws.send(JSON.stringify(shareMsg));
      console.log('🎯 SHARE FOUND SENT');
    }
    
    miningStats.hashesComputed++;
    miningStats.currentNonce = nonce;
  }, 500); // Every 500ms
}

// Function to stop mining simulation
function stopPseudoRealMining() {
  if (miningInterval) {
    clearInterval(miningInterval);
    miningInterval = null;
  }
  
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  
  console.log('⏹ Pseudo-real mining simulation stopped');
}

// Start the test
console.log('🧪 Starting ESP32 Pseudo-Real Mining Test...');
console.log(`📡 Connecting to: ${WS_URL}`);
console.log(`🔧 Device ID: ${DEVICE_ID}`);
console.log('=====================================\n');

connectWebSocket();
