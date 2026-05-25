// Share ledger for tracking all mining submissions
const shares = [];
const LEDGER_MAX_SIZE = 10000; // Keep last 10k shares
const SHARE_RETENTION_TIME = 3600000; // 1 hour retention

/**
 * Add a share to the ledger
 * @param {Object} shareData - Share data
 */
function addShare(shareData) {
  const share = {
    ...shareData,
    timestamp: Date.now()
  };
  
  shares.push(share);
  
  // Cleanup old shares if ledger is too large
  if (shares.length > LEDGER_MAX_SIZE) {
    const cutoff = Date.now() - SHARE_RETENTION_TIME;
    const filtered = shares.filter(s => s.timestamp > cutoff);
    
    // Replace shares array with filtered version
    shares.length = 0;
    shares.push(...filtered);
  }
}

/**
 * Check for duplicate share (replay protection)
 * @param {string} device_id - Device identifier
 * @param {string} job_id - Job identifier
 * @param {string} nonce - Nonce value
 * @returns {boolean} True if this is a duplicate share
 */
function isDuplicateShare(device_id, job_id, nonce) {
  // Check recent shares for duplicates
  const recent_cutoff = Date.now() - 300000; // Last 5 minutes
  
  for (let i = shares.length - 1; i >= 0; i--) {
    const share = shares[i];
    
    // Stop if share is too old
    if (share.timestamp < recent_cutoff) {
      break;
    }
    
    // Check for exact match
    if (share.device_id === device_id && 
        share.job_id === job_id && 
        share.nonce === nonce) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get shares for a specific device
 * @param {string} device_id - Device identifier
 * @param {number} limit - Maximum number of shares to return
 * @returns {Array} Array of shares
 */
function getDeviceShares(device_id, limit = 100) {
  const deviceShares = shares.filter(share => share.device_id === device_id);
  
  // Sort by timestamp (newest first) and limit
  return deviceShares
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

/**
 * Get shares for a specific job
 * @param {string} job_id - Job identifier
 * @returns {Array} Array of shares
 */
function getJobShares(job_id) {
  return shares.filter(share => share.job_id === job_id);
}

/**
 * Get recent shares (all devices)
 * @param {number} limit - Maximum number of shares to return
 * @returns {Array} Array of recent shares
 */
function getRecentShares(limit = 50) {
  return shares
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

/**
 * Get share statistics
 * @param {Object} filters - Optional filters
 * @returns {Object} Share statistics
 */
function getShareStats(filters = {}) {
  let filteredShares = shares;
  
  // Apply filters
  if (filters.device_id) {
    filteredShares = filteredShares.filter(s => s.device_id === filters.device_id);
  }
  
  if (filters.job_id) {
    filteredShares = filteredShares.filter(s => s.job_id === filters.job_id);
  }
  
  if (filters.valid !== undefined) {
    filteredShares = filteredShares.filter(s => s.valid === filters.valid);
  }
  
  if (filters.since) {
    filteredShares = filteredShares.filter(s => s.timestamp >= filters.since);
  }
  
  const total = filteredShares.length;
  const valid = filteredShares.filter(s => s.valid).length;
  const invalid = total - valid;
  const acceptance_rate = total > 0 ? (valid / total * 100).toFixed(2) : 0;
  
  return {
    total,
    valid,
    invalid,
    acceptance_rate: parseFloat(acceptance_rate),
    time_range: {
      earliest: filteredShares.length > 0 ? Math.min(...filteredShares.map(s => s.timestamp)) : null,
      latest: filteredShares.length > 0 ? Math.max(...filteredShares.map(s => s.timestamp)) : null
    }
  };
}

/**
 * Clean up old shares
 */
function cleanupOldShares() {
  const cutoff = Date.now() - SHARE_RETENTION_TIME;
  const initialLength = shares.length;
  
  const filtered = shares.filter(share => share.timestamp > cutoff);
  
  // Replace shares array
  shares.length = 0;
  shares.push(...filtered);
  
  const removed = initialLength - shares.length;
  if (removed > 0) {
    console.log(`[ShareLedger] Cleaned up ${removed} old shares`);
  }
}

/**
 * Get ledger size and status
 * @returns {Object} Ledger status
 */
function getLedgerStatus() {
  const now = Date.now();
  const cutoff = now - SHARE_RETENTION_TIME;
  const recent_shares = shares.filter(s => s.timestamp > cutoff).length;
  
  return {
    total_shares: shares.length,
    recent_shares: recent_shares,
    max_size: LEDGER_MAX_SIZE,
    retention_hours: SHARE_RETENTION_TIME / 3600000
  };
}

// Auto-cleanup every 30 minutes
setInterval(cleanupOldShares, 1800000);

module.exports = {
  addShare,
  isDuplicateShare,
  getDeviceShares,
  getJobShares,
  getRecentShares,
  getShareStats,
  cleanupOldShares,
  getLedgerStatus
};
