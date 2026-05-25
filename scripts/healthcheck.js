#!/usr/bin/env node

/**
 * Bitmind Health Check Script
 * Verifies backend, RPC, and WebSocket connectivity
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

// Health check results
const results = {
  backend: false,
  rpc: false,
  websocket: false,
  timestamp: new Date().toISOString()
};

// Check backend HTTP
function checkBackend() {
  return new Promise((resolve) => {
    const options = {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: '/api/health',
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        results.backend = true;
        console.log('✅ Backend: OK');
      } else {
        console.log('❌ Backend: FAILED (status ' + res.statusCode + ')');
      }
      resolve();
    });

    req.on('error', (err) => {
      console.log('❌ Backend: FAILED (' + err.message + ')');
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

// Check RPC connectivity
function checkRPC() {
  return new Promise((resolve) => {
    if (!RPC_HOST || !RPC_PASSWORD) {
      console.log('⚠️  RPC: SKIPPED (missing credentials)');
      resolve();
      return;
    }

    try {
      const rpc = new RPCClient({
        host: RPC_HOST,
        port: RPC_PORT,
        user: RPC_USER,
        password: RPC_PASSWORD,
        timeout: 5000
      });

      rpc.testConnection().then((connected) => {
        if (connected) {
          results.rpc = true;
          console.log('✅ RPC: OK');
        } else {
          console.log('❌ RPC: FAILED (connection refused)');
        }
        resolve();
      }).catch((err) => {
        console.log('❌ RPC: FAILED (' + err.message + ')');
        resolve();
      });
    } catch (err) {
      console.log('❌ RPC: FAILED (' + err.message + ')');
      resolve();
    }
  });
}

// Check WebSocket
function checkWebSocket() {
  return new Promise((resolve) => {
    const wsUrl = `ws://${BACKEND_HOST}:${BACKEND_PORT}`;
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      results.websocket = true;
      console.log('✅ WebSocket: OK');
      ws.close();
      resolve();
    });

    ws.on('error', (err) => {
      console.log('❌ WebSocket: FAILED (' + err.message + ')');
      resolve();
    });

    setTimeout(() => {
      if (!results.websocket) {
        console.log('❌ WebSocket: TIMEOUT');
        ws.close();
        resolve();
      }
    }, 5000);
  });
}

// Run all checks
async function runHealthCheck() {
  console.log('Bitmind Health Check');
  console.log('=====================');
  console.log('');

  await checkBackend();
  await checkRPC();
  await checkWebSocket();

  console.log('');
  console.log('=====================');
  console.log('Summary:');
  console.log(`  Backend: ${results.backend ? 'OK' : 'FAIL'}`);
  console.log(`  RPC: ${results.rpc ? 'OK' : 'FAIL'}`);
  console.log(`  WebSocket: ${results.websocket ? 'OK' : 'FAIL'}`);
  console.log('');

  const allPassed = results.backend && results.rpc && results.websocket;
  if (allPassed) {
    console.log('✅ All systems operational');
    process.exit(0);
  } else {
    console.log('❌ Some systems failed');
    process.exit(1);
  }
}

// Run
runHealthCheck();
