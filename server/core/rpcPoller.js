/**
 * Bitmind RPC Poller
 * Polls RPC status every 5 seconds and updates systemState
 * NO business logic - ONLY polling layer
 */

const { rpcService } = require('../services/rpc');
const systemState = require('./systemState');

const POLL_INTERVAL_MS = 5000; // 5 seconds
let pollInterval = null;

/**
 * Poll RPC status and update systemState
 */
async function pollRpc() {
  try {
    // rpcService.getLiveRpcStatus() updates systemState internally
    // DO NOT call systemState.updateRpc() here - only rpcService writes RPC state
    const rpcStatus = await rpcService.getLiveRpcStatus();
    
    // Log state for debugging
    console.log('[RPC POLLER] Status:', rpcStatus.status, 'Blocks:', rpcStatus.blocks, 'Latency:', rpcStatus.latencyMs + 'ms');
  } catch (error) {
    // This should never execute since getLiveRpcStatus() never throws
    // But if it does, DO NOT update systemState here - let rpcService handle it
    console.error('[RPC POLLER] Unexpected error:', error.message);
  }
}

/**
 * Start RPC poller
 */
function start() {
  if (pollInterval) {
    return; // Already running
  }

  console.log('[RPC POLLER] Starting (interval: 5s)');
  
  // Initial poll
  pollRpc();
  
  // Start interval
  pollInterval = setInterval(pollRpc, POLL_INTERVAL_MS);
}

/**
 * Stop RPC poller
 */
function stop() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('[RPC POLLER] Stopped');
  }
}

module.exports = {
  start,
  stop
};
