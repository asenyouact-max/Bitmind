// MINING SERVICES MODULE
// Handles mining logic and validation - no state mutations here

// Mining validation functions
const validation = {
  // Validate share submission
  validateShare: (share, device) => {
    if (!share || !device) {
      return { valid: false, reason: 'missing_data' };
    }

    // Check required fields
    if (!share.deviceId || !share.jobId || share.nonce === undefined) {
      return { valid: false, reason: 'invalid_format' };
    }

    // Check nonce range (basic validation)
    if (share.nonce < 0 || share.nonce > 0xFFFFFFFF) {
      return { valid: false, reason: 'invalid_nonce' };
    }

    // Check if device has current job
    if (device.currentJobId !== share.jobId) {
      return { valid: false, reason: 'stale_job' };
    }

    return { valid: true };
  },

  // Validate mining job
  validateMiningJob: (job) => {
    if (!job || !job.type || job.type !== 'mining_job') {
      return { valid: false, reason: 'invalid_type' };
    }

    if (!job.jobId || !job.height || !job.target) {
      return { valid: false, reason: 'missing_fields' };
    }

    return { valid: true };
  }
};

// Mining simulation functions
const simulation = {
  // Simulate share validation (80% accepted, 20% rejected)
  simulateShareValidation: () => {
    return Math.random() < 0.8;
  },

  // Generate mining job
  generateMiningJob: () => {
    return {
      type: "mining_job",
      jobId: require('crypto').randomUUID(),
      height: 948958, // Current block height
      difficulty: "0000ffff",
      target: "00000ffffffffffffffffffffffffffffffff"
    };
  }
};

// Mining calculation functions
const calculations = {
  // Calculate device hashrate (simplified)
  calculateHashrate: (device) => {
    if (!device || device.acceptedShares === 0) {
      return 0;
    }

    // Simplified hashrate calculation based on shares and uptime
    const uptimeHours = device.uptime / 3600;
    if (uptimeHours === 0) return 0;

    const sharesPerHour = device.acceptedShares / uptimeHours;
    return Math.round(sharesPerHour * 1000000); // Convert to H/s
  },

  // Calculate mining difficulty
  calculateDifficulty: (target) => {
    if (!target || typeof target !== 'string') {
      return null;
    }

    // Simplified difficulty calculation
    const difficulty = parseInt(target.substring(0, 4), 16);
    return difficulty;
  }
};

module.exports = {
  validation,
  simulation,
  calculations
};
