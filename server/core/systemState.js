/**
 * Bitmind System State Engine
 * Single source of truth for system status
 * NO business logic - ONLY storage layer
 */

const STATE = {
  rpc: {
    status: 'unknown',
    blocks: null,
    latencyMs: null,
    error: null,
    lastUpdate: 0
  },
  bitcoin: 'unknown',
  backend: 'starting',
  stratum: 'offline',
  timestamp: Date.now()
};

/**
 * Get current state snapshot
 * @returns {Object} Current state
 */
function getSnapshot() {
  return { ...STATE };
}

/**
 * Update RPC state
 * @param {Object} rpcResult - Result from rpcService.getLiveRpcStatus()
 */
function updateRpc(rpcResult) {
  const oldStatus = STATE.rpc.status;
  const newStatus = rpcResult.status || 'unknown';
  
  STATE.rpc.status = newStatus;
  STATE.rpc.blocks = rpcResult.blocks || null;
  STATE.rpc.latencyMs = rpcResult.latencyMs || null;
  STATE.rpc.error = rpcResult.error || null;
  STATE.rpc.lastUpdate = rpcResult.timestamp || Date.now();
  STATE.timestamp = Date.now();
  
  // Log state transitions for debugging
  if (oldStatus !== newStatus) {
    console.log('[SYSTEMSTATE] RPC state transition:', oldStatus, '→', newStatus, 'Blocks:', STATE.rpc.blocks);
  }
}

/**
 * Update Bitcoin state
 * @param {string} status - Bitcoin status
 */
function updateBitcoin(status) {
  STATE.bitcoin = status || 'unknown';
  STATE.timestamp = Date.now();
}

/**
 * Update backend state
 * @param {string} status - Backend status
 */
function updateBackend(status) {
  STATE.backend = status || 'unknown';
  STATE.timestamp = Date.now();
}

/**
 * Update stratum state
 * @param {string} status - Stratum status
 */
function updateStratum(status) {
  STATE.stratum = status || 'unknown';
  STATE.timestamp = Date.now();
}

module.exports = {
  getSnapshot,
  updateRpc,
  updateBitcoin,
  updateBackend,
  updateStratum
};
