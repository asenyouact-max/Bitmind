const { recordShare, updateDeviceLastJob } = require('./deviceRegistry');
const { addShare, isDuplicateShare } = require('./shareLedger');
const { getCachedJob } = require('./jobBroadcaster');

/**
 * Get current job from job broadcaster
 * @returns {Object|null} Current job data or null if no job
 */
function getCurrentJob() {
  return getCachedJob();
}

/**
 * Validate a mining share with multi-device support and replay protection
 * @param {Object} share - Share data from ESP32
 * @returns {Object} Validation result
 */
function validateShare(share) {
  const job = getCurrentJob();
  
  if (!job) {
    return {
      valid: false,
      status: 'rejected',
      message: 'No current job available'
    };
  }
  
  // Check if job matches (using new job_id format)
  if (job.job_id !== share.job_id) {
    return {
      valid: false,
      status: 'rejected',
      message: 'Job ID mismatch'
    };
  }
  
  // Check for duplicate share (replay protection)
  if (isDuplicateShare(share.device_id, share.job_id, share.nonce)) {
    return {
      valid: false,
      status: 'rejected',
      message: 'Duplicate share (replay protection)'
    };
  }
  
  // Validate hash meets target difficulty
  // Convert hex strings to BigInt for comparison
  const hash = BigInt('0x' + share.hash);
  const target = BigInt('0x' + job.target);
  
  const isValid = hash <= target;
  
  // Record share in ledger
  addShare({
    device_id: share.device_id,
    job_id: share.job_id,
    nonce: share.nonce,
    hash: share.hash,
    valid: isValid
  });
  
  // Update device stats
  recordShare(share.device_id, isValid);
  updateDeviceLastJob(share.device_id, share.job_id);
  
  if (isValid) {
    console.log(`[MiningService] Valid share from device ${share.device_id}: hash=${share.hash}, target=${job.target}`);
    return {
      valid: true,
      status: 'accepted',
      message: 'Share accepted'
    };
  } else {
    console.log(`[MiningService] Invalid share from device ${share.device_id}: hash=${share.hash}, target=${job.target}`);
    return {
      valid: false,
      status: 'rejected',
      message: 'Hash does not meet target difficulty'
    };
  }
}

module.exports = {
  getCurrentJob,
  validateShare
};
