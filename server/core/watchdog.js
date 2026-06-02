/**
 * Bitmind Watchdog - Auto-Recovery Layer
 * Monitors system health and triggers controlled restarts
 * Phase C: Watchdog is OBSERVER-ONLY - reads systemState, never modifies it
 */

const axios = require('axios');
const systemState = require('./systemState');

// Configuration
const WATCHDOG_INTERVAL_MS = 60000; // Phase B.3: 60 seconds (reduced from 15s to minimize RPC polling)
const HEALTH_CHECK_TIMEOUT_MS = 5000;
const MAX_RESTARTS_PER_WINDOW = 3;
const RESTART_WINDOW_MS = 600000; // 10 minutes
const RESTART_COOLDOWN_MS = 60000; // 60 seconds minimum between restarts
const CONSECUTIVE_FAILURES_THRESHOLD = 3;

// State
let watchdogInterval = null;
let restartHistory = [];
let consecutiveHealthFailures = 0;
let lastRestartTime = 0;
let isRestarting = false;

// Phase 0.3: Watchdog failure state cache with cooldown
const watchdogFailureState = {
  lastFailureTime: 0,
  lastFailureReason: null,
  cooldownMs: 60000 // 60 seconds
};

/**
 * Log with timestamp
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[WATCHDOG ${timestamp}] [${level}] ${message}`);
}

/**
 * Log watchdog failure with cooldown to prevent spam
 * @param {string} reason - Failure reason
 */
function logFailure(reason) {
  const now = Date.now();
  const timeSinceLastFailure = now - watchdogFailureState.lastFailureTime;

  // Only log if cooldown period has passed or failure reason changed
  if (timeSinceLastFailure > watchdogFailureState.cooldownMs ||
      watchdogFailureState.lastFailureReason !== reason) {
    log(`FAILURE reason=${reason} cooldown=${timeSinceLastFailure}ms`, 'WARN');
    watchdogFailureState.lastFailureTime = now;
    watchdogFailureState.lastFailureReason = reason;
  }
}

/**
 * Check restart limits
 */
function canRestart() {
  const now = Date.now();
  
  // Check cooldown
  if (now - lastRestartTime < RESTART_COOLDOWN_MS) {
    const cooldownRemaining = Math.ceil((RESTART_COOLDOWN_MS - (now - lastRestartTime)) / 1000);
    log(`Restart blocked by cooldown (${cooldownRemaining}s remaining)`, 'WARN');
    return false;
  }
  
  // Check restart window
  const windowStart = now - RESTART_WINDOW_MS;
  const recentRestarts = restartHistory.filter(time => time > windowStart);
  
  if (recentRestarts.length >= MAX_RESTARTS_PER_WINDOW) {
    log(`Restart blocked: max restarts (${MAX_RESTARTS_PER_WINDOW}) reached in window`, 'ERROR');
    return false;
  }
  
  return true;
}

/**
 * Record restart event
 */
function recordRestart(reason) {
  const now = Date.now();
  restartHistory.push(now);
  lastRestartTime = now;
  log(`Restart triggered: ${reason}`, 'WARN');
  
  // Clean old history
  const windowStart = now - RESTART_WINDOW_MS;
  restartHistory = restartHistory.filter(time => time > windowStart);
}

/**
 * Check local health endpoint
 */
async function checkLocalHealth() {
  try {
    const response = await axios.get(`http://localhost:${process.env.PORT || 3001}/health/full`, {
      timeout: HEALTH_CHECK_TIMEOUT_MS
    });

    if (response.status === 200) {
      consecutiveHealthFailures = 0;
      return true;
    }

    consecutiveHealthFailures++;
    logFailure('HEALTH_CHECK_FAILED');
    return false;
  } catch (error) {
    consecutiveHealthFailures++;
    logFailure('HEALTH_CHECK_FAILED');
    return false;
  }
}

/**
 * Check WebSocket server state
 */
function checkWebSocket() {
  try {
    if (global.wsServer && global.wsServer.clients) {
      const clientCount = global.wsServer.clients.size;
      log(`WebSocket server active with ${clientCount} clients`);
      return true;
    }
    log('WebSocket server not available', 'WARN');
    return false;
  } catch (error) {
    log(`WebSocket check failed: ${error.message}`, 'WARN');
    return false;
  }
}

/**
 * Trigger controlled restart
 */
function triggerRestart(reason) {
  if (isRestarting) {
    log('Restart already in progress, skipping', 'WARN');
    return;
  }
  
  if (!canRestart()) {
    log('Restart not allowed by policy', 'ERROR');
    return;
  }
  
  isRestarting = true;
  recordRestart(reason);
  
  // Log final state before restart
  log('Restart would be triggered, but disabled for crash-free operation', 'WARN');
  log(`Final state - RPC: ${rpcService.getState()}, Health failures: ${consecutiveHealthFailures}`);
  
  // DISABLED: process.exit(1) - let PM2 manage restarts externally
  // The server stays alive even if RPC/health fails - logs only
}

/**
 * Main watchdog check cycle
 */
async function watchdogCycle() {
  if (isRestarting) {
    return;
  }

  const startTime = Date.now();

  try {
    // Phase C.3: Read system state (observer-only)
    const state = systemState.getSnapshot();

    // Check local health
    const healthOk = await checkLocalHealth();

    // Check WebSocket
    const wsOk = checkWebSocket();

    const cycleTime = Date.now() - startTime;

    // Phase C.3: Structured summary log using systemState
    log(`CYCLE_SUMMARY duration=${cycleTime}ms rpc=${state.rpc.status} health=${healthOk ? 'OK' : 'FAIL'} ws=${wsOk ? 'OK' : 'FAIL'}`);

    // Determine if restart is needed (only health endpoint, never RPC)
    const healthCritical = consecutiveHealthFailures >= CONSECUTIVE_FAILURES_THRESHOLD;

    if (healthCritical) {
      logFailure('HEALTH_CRITICAL_THRESHOLD');
      triggerRestart('Health critical failure');
    }
    // Phase C.3: Watchdog does NOT modify systemState - only reads it

  } catch (error) {
    log(`CYCLE_ERROR error=${error.message}`, 'ERROR');
  }
}

/**
 * Start watchdog
 */
function startWatchdog() {
  if (watchdogInterval) {
    log('WATCHDOG_ALREADY_RUNNING');
    return;
  }

  log('WATCHDOG_START interval=' + (WATCHDOG_INTERVAL_MS / 1000) + 's maxRestarts=' + MAX_RESTARTS_PER_WINDOW + ' window=' + (RESTART_WINDOW_MS / 60000) + 'min cooldown=' + (RESTART_COOLDOWN_MS / 1000) + 's');

  // Initial check after 5 seconds
  setTimeout(watchdogCycle, 5000);

  // Start interval
  watchdogInterval = setInterval(watchdogCycle, WATCHDOG_INTERVAL_MS);
}

/**
 * Stop watchdog
 */
function stopWatchdog() {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
    log('WATCHDOG_STOPPED');
  }
}

/**
 * Get watchdog status
 */
function getStatus() {
  return {
    running: watchdogInterval !== null,
    interval: WATCHDOG_INTERVAL_MS,
    rpcState: rpcService.getState(),
    consecutiveHealthFailures,
    restartHistory: restartHistory.length,
    lastRestartTime: lastRestartTime ? new Date(lastRestartTime).toISOString() : null,
    isRestarting,
    canRestart: canRestart()
  };
}

module.exports = {
  startWatchdog,
  stopWatchdog,
  getStatus,
  triggerRestart
};
