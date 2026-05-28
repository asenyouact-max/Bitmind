const crypto = require('crypto');

/**
 * Share Validator Service
 * Implements cryptographic validation of submitted pseudo shares
 */

class ShareValidator {
  constructor() {
    this.validationStats = {
      totalValidations: 0,
      validShares: 0,
      invalidShares: 0,
      hashMismatches: 0,
      targetInvalidations: 0
    };
  }

  /**
   * Rebuild exact 80-byte Bitcoin block header
   * @param {Object} job - Mining job object
   * @param {number} nonce - Nonce to test
   * @returns {Buffer} 80-byte block header
   */
  rebuildBlockHeader(job, nonce) {
    // Create 80-byte buffer for block header
    const header = Buffer.alloc(80);
    let offset = 0;

    // Version (4 bytes, little endian)
    header.writeUInt32LE(job.version, offset);
    offset += 4;

    // Previous block hash (32 bytes, reversed)
    const prevHash = Buffer.from(job.previousblockhash, 'hex');
    for (let i = 0; i < 32; i++) {
      header[offset + i] = prevHash[31 - i]; // Reverse byte order
    }
    offset += 32;

    // Merkle root (32 bytes, reversed)
    // For pseudo mining, we use a simplified merkle root (all zeros)
    const merkleRoot = Buffer.alloc(32, 0);
    for (let i = 0; i < 32; i++) {
      header[offset + i] = merkleRoot[31 - i]; // Reverse byte order
    }
    offset += 32;

    // Timestamp (4 bytes, little endian)
    header.writeUInt32LE(job.curtime, offset);
    offset += 4;

    // Bits (4 bytes, little endian)
    header.writeUInt32LE(job.bits, offset);
    offset += 4;

    // Nonce (4 bytes, little endian)
    header.writeUInt32LE(nonce, offset);
    offset += 4;

    return header;
  }

  /**
   * Perform double SHA256 hash
   * @param {Buffer} header - 80-byte block header
   * @returns {string} Hex string of double SHA256 hash
   */
  doubleSHA256(header) {
    // First SHA256
    const hash1 = crypto.createHash('sha256').update(header).digest();
    
    // Second SHA256 (double SHA256)
    const hash2 = crypto.createHash('sha256').update(hash1).digest();
    
    // Convert to hex string
    return hash2.toString('hex');
  }

  /**
   * Validate submitted pseudo share
   * @param {Object} job - Current mining job
   * @param {string} submittedNonce - Submitted nonce (hex string)
   * @param {string} submittedHash - Submitted hash (hex string)
   * @returns {Object} Validation result
   */
  validateShare(job, submittedNonce, submittedHash) {
    this.validationStats.totalValidations++;

    let recomputedHash = null;
    
    try {
      // Parse nonce from hex string
      const nonce = parseInt(submittedNonce, 16);
      if (isNaN(nonce)) {
        return {
          valid: false,
          recomputeHash: null,
          submittedHash,
          nonce: submittedNonce,
          target: job.pseudoTarget,
          reason: 'invalid_nonce_format'
        };
      }

      // Rebuild block header with submitted nonce
      const header = this.rebuildBlockHeader(job, nonce);
      
      // Recompute hash independently
      recomputedHash = this.doubleSHA256(header);
      
      // Verify recomputed hash matches submitted hash
      if (recomputedHash !== submittedHash.toLowerCase()) {
        this.validationStats.hashMismatches++;
        this.validationStats.invalidShares++;
        
        return {
          valid: false,
          recomputeHash: recomputedHash,
          submittedHash,
          nonce,
          target: job.pseudoTarget,
          reason: 'hash_mismatch'
        };
      }

      // Compare recomputed hash against pseudo target
      const isValidTarget = recomputedHash < job.pseudoTarget;
      
      if (!isValidTarget) {
        this.validationStats.targetInvalidations++;
        this.validationStats.invalidShares++;
        
        return {
          valid: false,
          recomputeHash: recomputedHash,
          submittedHash,
          nonce,
          target: job.pseudoTarget,
          reason: 'invalid_target'
        };
      }

      // Share is valid
      this.validationStats.validShares++;
      
      return {
        valid: true,
        recomputeHash: recomputedHash,
        submittedHash,
        nonce,
        target: job.pseudoTarget,
        reason: 'valid_share'
      };

    } catch (error) {
      this.validationStats.invalidShares++;
      
      console.log(`🔍 VALIDATION ERROR: ${error.message}`);
      console.log(`🔍 ERROR STACK: ${error.stack}`);
      console.log(`🔍 RECOMPUTED HASH VALUE: ${recomputedHash}`);
      
      return {
        valid: false,
        recomputeHash: recomputedHash || null,
        submittedHash,
        nonce: submittedNonce,
        target: job.pseudoTarget,
        reason: 'validation_error',
        error: error.message
      };
    }
  }

  /**
   * Get validation statistics
   * @returns {Object} Validation stats
   */
  getValidationStats() {
    return { ...this.validationStats };
  }

  /**
   * Reset validation statistics
   */
  resetStats() {
    this.validationStats = {
      totalValidations: 0,
      validShares: 0,
      invalidShares: 0,
      hashMismatches: 0,
      targetInvalidations: 0
    };
  }

  /**
   * Log validation result with detailed information
   * @param {string} deviceId - Device ID
   * @param {Object} result - Validation result
   * @param {Object} job - Mining job (for detailed debugging)
   */
  logValidationResult(deviceId, result, job) {
    console.log(`\n🔍 HASH PARITY DEBUG - Device: ${deviceId}`);
    console.log(`   Reason: ${result.reason}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log(`   Nonce: ${result.nonce}`);
    console.log(`   Submitted Hash: ${result.submittedHash}`);
    if (result.recomputeHash) {
      console.log(`   Recomputed Hash: ${result.recomputeHash}`);
      console.log(`   Hash Match: ${result.submittedHash.toLowerCase() === result.recomputeHash}`);
    }
    console.log(`   Target: ${result.target}`);
    
    if (job && result.recomputeHash) {
      // Rebuild header for debugging
      const header = this.rebuildBlockHeader(job, result.nonce);
      console.log(`   Header Hex: ${header.toString('hex')}`);
      console.log(`   Header Length: ${header.length} bytes`);
      
      // Log individual components
      console.log(`   Version: ${job.version} (0x${job.version.toString(16)})`);
      console.log(`   PrevHash: ${job.previousblockhash}`);
      console.log(`   MerkleRoot: (simplified zeros)`);
      console.log(`   Curtime: ${job.curtime}`);
      console.log(`   Bits: ${job.bits}`);
      console.log(`   Nonce: ${result.nonce} (0x${result.nonce.toString(16)})`);
    }
    
    if (result.valid) {
      console.log(`[SHARE_VALIDATOR] SHARE_VALID deviceId=${deviceId} nonce=${result.nonce}`);
    } else {
      console.log(`[SHARE_VALIDATOR] SHARE_INVALID deviceId=${deviceId} nonce=${result.nonce} reason=${result.reason || 'unknown'}`);
    }
    console.log(`   ======================================\n`);
  }
}

// Create singleton instance
const shareValidator = new ShareValidator();

module.exports = { shareValidator };
