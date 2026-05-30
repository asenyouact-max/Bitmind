/**
 * Bitmind Single Source of Truth Layer (SSTL)
 * ALL system state originates from this module only
 * No other module may define system truth or status
 *
 * Architecture:
 * - systemState.js = SINGLE SOURCE OF TRUTH (ledger)
 * - All other modules = readers/writers only
 * - No module can interpret reality independently
 */

const systemState = {
  system: {
    uptime: 0,
    status: "INITIALIZING"
  },

  bitcoin: {
    mode: "UNKNOWN",      // LIVE | FALLBACK
    rpc: "UNKNOWN",       // CONNECTED | AUTH_FAILED | UNREACHABLE | DISABLED
    mining: "UNKNOWN",    // LIVE_MINING | SIMULATED_WORK_ONLY
    lastError: null,
    lastUpdated: null
  },

  rpc: {
    connected: false,
    lastCheck: null,
    failureCount: 0
  },

  devices: {
    connected: 0,
    miners: []
  }
};

/**
 * Update Bitcoin state (called by RPC module only)
 * @param {Object} update - Partial state update
 */
function updateBitcoinState(update) {
  systemState.bitcoin = {
    ...systemState.bitcoin,
    ...update,
    lastUpdated: Date.now()
  };
}

/**
 * Update RPC state (called by RPC module only)
 * @param {Object} update - Partial state update
 */
function updateRPCState(update) {
  systemState.rpc = {
    ...systemState.rpc,
    ...update,
    lastCheck: Date.now()
  };
}

/**
 * Update system state (called by server.js only)
 * @param {Object} update - Partial state update
 */
function updateSystemState(update) {
  systemState.system = {
    ...systemState.system,
    ...update
  };
}

/**
 * Update devices state (called by device registry only)
 * @param {Object} update - Partial state update
 */
function updateDevicesState(update) {
  systemState.devices = {
    ...systemState.devices,
    ...update
  };
}

/**
 * Get complete system state (read-only access)
 * @returns {Object} Complete system state
 */
function getState() {
  return systemState;
}

module.exports = {
  systemState,
  updateBitcoinState,
  updateRPCState,
  updateSystemState,
  updateDevicesState,
  getState
};
