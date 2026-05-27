/**
 * Bitmind Restart Controller - Safe Restart Logic
 * Controls when and how the system can restart
 */

const axios = require('axios');
const { rpcService } = require('../services/rpc');

// Configuration
const RESTART_COOLDOWN_MS = 60000; // 60 seconds minimum between restarts
const CONSECUTIVE_HEALTH_FAILURES_THRESHOLD = 3;
const CONSECUTIVE_RPC_FAILURES_THRESHOLD = 3;
const MAX_RESTARTS_PER_HOUR = 10;

// State
let restartHistory = [];
let consecutiveHealthFailures = 0;
let consecutiveRpcFailures = 0;
let lastRestartTime = 0;
let isRestarting = false;

/**
 * Log with timestamp
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[RESTART_CONTROLLER ${timestamp}] [${level}] ${message}`);
}

/**
 * Check if restart is allowed based on cooldown and rate limits
 */
function canRestart() {
  const now = Date.now();
  
  // Check cooldown
  if (now - lastRestartTime < RESTART_COOLDOWN_MS) {
    const cooldownRemaining = Math.ceil((RESTART_COOLDOWN_MS - (now - lastRestartTime)) / 1000);
    log(`Restart blocked by cooldown (${cooldownRemaining}s remaining)`, 'WARN');
    return { allowed: false, reason: 'cooldown' };
  }
  
  // Check hourly rate limit
  const oneHourAgo = now - 3600000;
  const recentRestarts = restartHistory.filter(time => time > oneHourAgo);
  
  if (recentRestarts.length >= MAX_RESTARTS_PER_HOUR) {
    log(`Restart blocked: max restarts per hour (${MAX_RESTARTS_PER_HOUR}) reached`, 'ERROR');
    return { allowed: false, reason: 'rate_limit' };
  }
  
  return { allowed: true, reason: 'ok' };
}

/**
 * Record a restart event
 */
function recordRestart(reason) {
  const now = Date.now();
  restartHistory.push(now);
  lastRestartTime = now;
  
  // Clean old history (older than 1 hour)
  const oneHourAgo = now - 3600000;
  restartHistory = restartHistory.filter(time => time > oneHourAgo);
  
  log(`Restart recorded: ${reason}`, 'INFO');
}

/**
 * Check RPC connectivity
 */
async function checkRpc() {
  try {
    await rpcService.getBlockchainInfo();
    consecutiveRpcFailures = 0;
    return { ok: true, consecutiveFailures: 0 };
  } catch (error) {
    consecutiveRpcFailures++;
    log(`RPC check failed (${consecutiveRpcFailures}/${CONSECUTIVE_RPC_FAILURES_THRESHOLD}): ${error.message}`, 'WARN');
    return { ok: false, consecutiveFailures: consecutiveRpcFailures };
  }
}

/**
 * Check local health endpoint
 */
async function checkLocalHealth() {
  try {
    const response = await axios.get(`http://localhost:${process.env.PORT || 3001}/health`, {
      timeout: 5000
    });
    
    if (response.status === 200) {
      consecutiveHealthFailures = 0;
      return { ok: true, consecutiveFailures: 0 };
    }
    
    consecutiveHealthFailures++;
    log(`Health check failed with status ${response.status} (${consecutiveHealthFailures}/${CONSECUTIVE_HEALTH_FAILURES_THRESHOLD})`, 'WARN');
    return { ok: false, consecutiveFailures: consecutiveHealthFailures };
  } catch (error) {
    consecutiveHealthFailures++;
    log(`Health check failed (${consecutiveHealthFailures}/${CONSECUTIVE_HEALTH_FAILURES_THRESHOLD}): ${error.message}`, 'WARN');
    return { ok: false, consecutiveFailures: consecutiveHealthFailures };
  }
}

/**
 * Determine if restart is needed based on current state
 */
async function shouldRestart() {
  const rpcCheck = await checkRpc();
  const healthCheck = await checkLocalHealth();
  
  // Restart if RPC is critically down
  if (!rpcCheck.ok && rpcCheck.consecutiveFailures >= CONSECUTIVE_RPC_FAILURES_THRESHOLD) {
    return { 
      shouldRestart: true, 
      reason: `RPC critical failure (${rpcCheck.consecutiveFailures}/${CONSECUTIVE_RPC_FAILURES_THRESHOLD})` 
    };
  }
  
  // Restart if health is critically down
  if (!healthCheck.ok && healthCheck.consecutiveFailures >= CONSECUTIVE_HEALTH_FAILURES_THRESHOLD) {
    return { 
      shouldRestart: true, 
      reason: `Health critical failure (${healthCheck.consecutiveFailures}/${CONSECUTIVE_HEALTH_FAILURES_THRESHOLD})` 
    };
  }
  
  return { shouldRestart: false, reason: 'system healthy' };
}

/**
 * Trigger a controlled restart
 */
function triggerRestart(reason) {
  if (isRestarting) {
    log('Restart already in progress, skipping', 'WARN');
    return { success: false, reason: 'already_restarting' };
  }
  
  const canRestartCheck = canRestart();
  if (!canRestartCheck.allowed) {
    log(`Restart not allowed: ${canRestartCheck.reason}`, 'ERROR');
    return { success: false, reason: canRestartCheck.reason };
  }
  
  isRestarting = true;
  recordRestart(reason);
  
  log('Initiating controlled restart...', 'WARN');
  log(`Restart reason: ${reason}`, 'WARN');
  log(`Final state - RPC failures: ${consecutiveRpcFailures}, Health failures: ${consecutiveHealthFailures}`, 'WARN');
  
  // DISABLED: process.exit(1) - let PM2 manage restarts externally
  // The server stays alive even if RPC/health fails - logs only
  
  return { success: true, reason: 'restart_disabled_crash_free' };
}

/**
 * Manual restart trigger (for admin use)
 */
async function manualRestart(reason = 'manual') {
  log(`Manual restart requested: ${reason}`, 'WARN');
  
  // Verify system state before allowing manual restart
  const shouldRestartCheck = await shouldRestart();
  
  if (!shouldRestartCheck.shouldRestart) {
    log(`Manual restart blocked: system is healthy (${shouldRestartCheck.reason})`, 'WARN');
    return { success: false, reason: 'system_healthy' };
  }
  
  return triggerRestart(`manual: ${reason}`);
}

/**
 * Get restart controller status
 */
function getStatus() {
  const now = Date.now();
  const oneHourAgo = now - 3600000;
  const recentRestarts = restartHistory.filter(time => time > oneHourAgo);
  
  return {
    isRestarting,
    consecutiveHealthFailures,
    consecutiveRpcFailures,
    lastRestartTime: lastRestartTime ? new Date(lastRestartTime).toISOString() : null,
    restartsLastHour: recentRestarts.length,
    canRestart: canRestart().allowed,
    cooldownRemaining: Math.max(0, RESTART_COOLDOWN_MS - (now - lastRestartTime)),
    thresholds: {
      health: CONSECUTIVE_HEALTH_FAILURES_THRESHOLD,
      rpc: CONSECUTIVE_RPC_FAILURES_THRESHOLD,
      maxPerHour: MAX_RESTARTS_PER_HOUR,
      cooldown: RESTART_COOLDOWN_MS
    }
  };
}

/**
 * Reset failure counters (for recovery)
 */
function resetCounters() {
  consecutiveHealthFailures = 0;
  consecutiveRpcFailures = 0;
  log('Failure counters reset', 'INFO');
}

module.exports = {
  triggerRestart,
  manualRestart,
  shouldRestart,
  getStatus,
  resetCounters,
  checkRpc,
  checkLocalHealth
};
