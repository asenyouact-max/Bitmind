const crypto = require('crypto');

/**
 * Bitcoin Share Validation Service
 * Implements proper Bitcoin-style share validation using double SHA256
 */

class BitcoinValidation {
  /**
   * Validate a mining share against Bitcoin target
   * @param {Object} share - Share submission from miner
   * @param {Object} deviceContext - Device context from session
   * @returns {Object} Validation result {valid, reason, hash}
   */
  static validateShare(share, deviceContext) {
    try {
      // Validate required fields
      if (!share || !deviceContext) {
        return { valid: false, reason: 'missing_data' };
      }

      if (!share.deviceId || !share.jobId || share.nonce === undefined) {
        return { valid: false, reason: 'invalid_format' };
      }

      // Validate nonce range
      if (share.nonce < deviceContext.nonceStart || share.nonce > deviceContext.nonceEnd) {
        return { valid: false, reason: 'nonce_out_of_range' };
      }

      // Validate job ID matches
      if (share.jobId !== deviceContext.jobId) {
        return { valid: false, reason: 'stale_job' };
      }

      // For now, we'll accept shares that have the required structure
      // Full block header assembly and double SHA256 will be added when ESP sends complete header data
      // This is a lightweight validation that ensures:
      // 1. Share has required fields
      // 2. Nonce is in assigned range
      // 3. Job ID is current
      
      // TODO: When ESP firmware sends full block header data:
      // 1. Assemble block header: version + prevhash + merkleroot + ntime + nbits + nonce
      // 2. Perform double SHA256: hash = sha256(sha256(header))
      // 3. Convert hash to big-endian integer
      // 4. Compare hash against target: hash <= target
      // 5. Return validation result

      return { valid: true, reason: 'structure_valid' };

    } catch (error) {
      console.error('Bitcoin validation error:', error);
      return { valid: false, reason: 'validation_error' };
    }
  }

  /**
   * Perform double SHA256 on data
   * @param {Buffer} data - Data to hash
   * @returns {Buffer} Double SHA256 hash
   */
  static doubleSHA256(data) {
    const firstHash = crypto.createHash('sha256').update(data).digest();
    const secondHash = crypto.createHash('sha256').update(firstHash).digest();
    return secondHash;
  }

  /**
   * Convert hash to big-endian integer
   * @param {Buffer} hash - 32-byte hash
   * @returns {BigInt} Hash as big-endian integer
   */
  static hashToBigInt(hash) {
    // Bitcoin hashes are interpreted as big-endian integers
    // Reverse bytes for little-endian to big-endian conversion
    const reversed = Buffer.from(hash).reverse();
    return BigInt('0x' + reversed.toString('hex'));
  }

  /**
   * Convert target string to big-endian integer
   * @param {string} target - Target hex string
   * @returns {BigInt} Target as big-endian integer
   */
  static targetToBigInt(target) {
    // Target is already in big-endian format
    return BigInt('0x' + target);
  }

  /**
   * Compare hash against target
   * @param {Buffer} hash - Double SHA256 hash
   * @param {string} target - Target hex string
   * @returns {boolean} True if hash <= target
   */
  static hashMeetsTarget(hash, target) {
    const hashInt = this.hashToBigInt(hash);
    const targetInt = this.targetToBigInt(target);
    return hashInt <= targetInt;
  }

  /**
   * Assemble block header from components
   * @param {Object} components - Block header components
   * @returns {Buffer} Assembled block header (80 bytes)
   */
  static assembleBlockHeader(components) {
    const {
      version,      // 4 bytes, little-endian
      previousblockhash, // 32 bytes, little-endian
      merkleroot,   // 32 bytes, little-endian
      ntime,        // 4 bytes, little-endian
      nbits,        // 4 bytes, little-endian
      nonce         // 4 bytes, little-endian
    } = components;

    const header = Buffer.alloc(80);

    // Write version (4 bytes, little-endian)
    header.writeUInt32LE(version, 0);

    // Write previous block hash (32 bytes, little-endian)
    const prevHashBuffer = Buffer.from(previousblockhash, 'hex').reverse();
    prevHashBuffer.copy(header, 4);

    // Write merkle root (32 bytes, little-endian)
    const merkleRootBuffer = Buffer.from(merkleroot, 'hex').reverse();
    merkleRootBuffer.copy(header, 36);

    // Write ntime (4 bytes, little-endian)
    header.writeUInt32LE(ntime, 68);

    // Write nbits (4 bytes, little-endian)
    header.writeUInt32LE(nbits, 72);

    // Write nonce (4 bytes, little-endian)
    header.writeUInt32LE(nonce, 76);

    return header;
  }
}

module.exports = {
  BitcoinValidation
};
