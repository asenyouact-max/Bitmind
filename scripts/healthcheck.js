#!/usr/bin/env node

/**
 * Bitmind Health Check Script
 * Verifies backend, RPC, and WebSocket connectivity with latency measurements
 */

const http = require('http');
const WebSocket = require('ws');
const RPCClient = require('../node/rpc-client');

// Configuration
const BACKEND_PORT = process.env.PORT || 3001;
const BACKEND_HOST = 'localhost';
const RPC_HOST = process.env.RPC_HOST;
const RPC_PORT = process.env.RPC_PORT || 8332;
const RPC_USER = process.env.RPC_USER || 'Global';
const RPC_PASSWORD = process.env.RPC_PASSWORD;
const DOMAIN = process.env.DOMAIN || 'https://getbitmind.com';

// Health check results
const results = {
  backend: { ok: false, latency: null },
  rpc: { ok: false, latency: null },
  websocket: { ok: false, latency: null },
  domain: { ok: false, latency: null },
  timestamp: new Date().toISOString()
};

// Format latency in milliseconds
function formatLatency(ms) {
  if (ms === null) return 'N/A';
  return `${ms.toFixed(2)}ms`;
}

// Check backend HTTP with latency
function checkBackend() {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const options = {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: '/api/health',
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      const latency = Date.now() - startTime;
      if (res.statusCode === 200) {
        results.backend.ok = true;
        results.backend.latency = latency;
        console.log(`✅ Backend: PASS (${formatLatency(latency)})`);
      } else {
        console.log(`❌ Backend: FAIL (status ${res.statusCode})`);
      }
      resolve();
    });

    req.on('error', (err) => {
      console.log(`❌ Backend: FAIL (${err.message})`);
      resolve();
    });

    req.on('timeout', () => {
      req.destroy();
      console.log('❌ Backend: TIMEOUT');
      resolve();
    });

    req.end();
  });
}

// Check RPC connectivity with latency
function checkRPC() {
  return new Promise((resolve) => {
    if (!RPC_HOST || !RPC_PASSWORD) {
      console.log('⚠️  RPC: SKIP (missing credentials)');
      resolve();
      return;
    }

    const startTime = Date.now();
    try {
      const rpc = new RPCClient({
        host: RPC_HOST,
        port: RPC_PORT,
        user: RPC_USER,
        password: RPC_PASSWORD,
        timeout: 5000
      });

      rpc.testConnection().then((connected) => {
        const latency = Date.now() - startTime;
        if (connected) {
          results.rpc.ok = true;
          results.rpc.latency = latency;
          console.log(`✅ RPC: PASS (${formatLatency(latency)})`);
        } else {
          console.log('❌ RPC: FAIL (connection refused)');
        }
        resolve();
      }).catch((err) => {
        console.log(`❌ RPC: FAIL (${err.message})`);
        resolve();
      });
    } catch (err) {
      console.log(`❌ RPC: FAIL (${err.message})`);
      resolve();
    }
  });
}

// Check WebSocket with latency
function checkWebSocket() {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const wsUrl = `ws://${BACKEND_HOST}:${BACKEND_PORT}`;
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      const latency = Date.now() - startTime;
      results.websocket.ok = true;
      results.websocket.latency = latency;
      console.log(`✅ WebSocket: PASS (${formatLatency(latency)})`);
      ws.close();
      resolve();
    });

    ws.on('error', (err) => {
      console.log(`❌ WebSocket: FAIL (${err.message})`);
      resolve();
    });

    setTimeout(() => {
      if (!results.websocket.ok) {
        console.log('❌ WebSocket: TIMEOUT');
        ws.close();
        resolve();
      }
    }, 5000);
  });
}

// Check domain health with latency (optional)
function checkDomain() {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const options = {
      hostname: 'getbitmind.com',
      port: 443,
      path: '/health',
      method: 'GET',
      timeout: 5000
    };

    // Use HTTPS for domain check
    const https = require('https');
    const req = https.request(options, (res) => {
      const latency = Date.now() - startTime;
      if (res.statusCode === 200) {
        results.domain.ok = true;
        results.domain.latency = latency;
        console.log(`✅ Domain: PASS (${formatLatency(latency)})`);
      } else {
        console.log(`❌ Domain: FAIL (status ${res.statusCode})`);
      }
      resolve();
    });

    req.on('error', (err) => {
      console.log(`❌ Domain: FAIL (${err.message})`);
      resolve();
    });

    req.on('timeout', () => {
      req.destroy();
      console.log('❌ Domain: TIMEOUT');
      resolve();
    });

    req.end();
  });
}

// Run all checks
async function runHealthCheck() {
  console.log('Bitmind Health Check');
  console.log('=====================');
  console.log(`Timestamp: ${results.timestamp}`);
  console.log('');

  await checkBackend();
  await checkRPC();
  await checkWebSocket();
  await checkDomain();

  console.log('');
  console.log('=====================');
  console.log('Summary:');
  console.log(`  Backend:    ${results.backend.ok ? 'PASS' : 'FAIL'} (${formatLatency(results.backend.latency)})`);
  console.log(`  RPC:        ${results.rpc.ok ? 'PASS' : 'FAIL'} (${formatLatency(results.rpc.latency)})`);
  console.log(`  WebSocket:  ${results.websocket.ok ? 'PASS' : 'FAIL'} (${formatLatency(results.websocket.latency)})`);
  console.log(`  Domain:     ${results.domain.ok ? 'PASS' : 'FAIL'} (${formatLatency(results.domain.latency)})`);
  console.log('');

  const criticalPassed = results.backend.ok && results.rpc.ok && results.websocket.ok;
  const allPassed = criticalPassed && results.domain.ok;
  
  if (allPassed) {
    console.log('✅ ALL SYSTEMS OPERATIONAL');
    process.exit(0);
  } else if (criticalPassed) {
    console.log('⚠️  CRITICAL SYSTEMS OK (domain check failed)');
    process.exit(0);
  } else {
    console.log('❌ CRITICAL SYSTEMS FAILED');
    process.exit(1);
  }
}

// Run
runHealthCheck();
