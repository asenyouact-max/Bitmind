const crypto = require('crypto');

/**
 * Bitcoin Work Construction Service
 * Handles coinbase transaction construction and merkle root calculation
 * for valid Bitcoin mining work
 */

class BitcoinWorkService {
  /**
   * Construct a coinbase transaction for mining
   * @param {Object} blockTemplate - Bitcoin Core block template
   * @param {string} extranonce1 - Device-specific extranonce (hex string)
   * @param {number} height - Block height for BIP34 commitment
   * @returns {Object} Coinbase transaction data
   */
  constructCoinbase(blockTemplate, extranonce1, height) {
    // Coinbase script construction
    // Format: [height][extranonce1][extranonce2][optional data]
    
    // BIP34: block height in scriptSig (little-endian, variable length integer)
    const heightScript = this.encodeHeight(height);
    
    // Extranonce1 (8 bytes from backend)
    const extranonce1Buffer = Buffer.from(extranonce1, 'hex');
    
    // Extranonce2 (4 bytes for device to vary)
    const extranonce2Buffer = Buffer.alloc(4, 0); // Device will vary this
    
    // Combine into coinbase script
    const coinbaseScript = Buffer.concat([
      heightScript,
      extranonce1Buffer,
      extranonce2Buffer
    ]);
    
    // Coinbase transaction structure (simplified for P2PKH)
    // This is a minimal coinbase - in production would need proper output construction
    const coinbaseTx = {
      version: 1, // Transaction version
      inputs: [{
        prevout: '0000000000000000000000000000000000000000000000000000000000000000', // Null prevout
        scriptSig: coinbaseScript.toString('hex'),
        sequence: 0xffffffff
      }],
      outputs: [{
        value: blockTemplate.coinbasevalue || 0,
        scriptPubKey: this.constructOutputScript(blockTemplate.coinbaseaddress)
      }],
      locktime: 0
    };
    
    return coinbaseTx;
  }

  /**
   * Encode block height for BIP34 scriptSig
   * @param {number} height - Block height
   * @returns {Buffer} Encoded height
   */
  encodeHeight(height) {
    // Variable-length integer encoding
    const buf = Buffer.alloc(9); // Max 9 bytes for varint
    let offset = 0;
    
    if (height < 0xfd) {
      buf[offset++] = height;
    } else if (height <= 0xffff) {
      buf[offset++] = 0xfd;
      buf.writeUInt16LE(height, offset);
      offset += 2;
    } else if (height <= 0xffffffff) {
      buf[offset++] = 0xfe;
      buf.writeUInt32LE(height, offset);
      offset += 4;
    } else {
      buf[offset++] = 0xff;
      // Would need 64-bit, but heights don't exceed 32-bit in practice
      buf.writeUInt32LE(height, offset);
      offset += 4;
      buf.writeUInt32LE(0, offset);
      offset += 4;
    }
    
    return buf.slice(0, offset);
  }

  /**
   * Construct output script (P2PKH for simplicity)
   * @param {string} address - Bitcoin address
   * @returns {string} ScriptPubKey hex
   */
  constructOutputScript(address) {
    // Simplified P2PKH script: OP_DUP OP_HASH160 <pubkeyHash> OP_EQUALVERIFY OP_CHECKSIG
    // In production, would need proper address parsing
    // For now, return a placeholder script
    return '76a914' + '00'.repeat(20) + '88ac'; // Placeholder
  }

  /**
   * Calculate transaction ID (double SHA256 of serialized transaction)
   * @param {Object} tx - Transaction object
   * @returns {string} Transaction ID (hex, little-endian)
   */
  calculateTxid(tx) {
    const serialized = this.serializeTransaction(tx);
    const hash = crypto.createHash('sha256').update(serialized).digest();
    const hash2 = crypto.createHash('sha256').update(hash).digest();
    
    // Reverse for little-endian (Bitcoin standard)
    return Buffer.from(hash2).reverse().toString('hex');
  }

  /**
   * Serialize transaction for hashing
   * @param {Object} tx - Transaction object
   * @returns {Buffer} Serialized transaction
   */
  serializeTransaction(tx) {
    const buffers = [];
    
    // Version (4 bytes, little-endian)
    const versionBuf = Buffer.alloc(4);
    versionBuf.writeUInt32LE(tx.version, 0);
    buffers.push(versionBuf);
    
    // Input count (varint)
    buffers.push(this.encodeVarint(tx.inputs.length));
    
    // Inputs
    for (const input of tx.inputs) {
      // Previous output hash (32 bytes, reversed)
      const prevoutHash = Buffer.from(input.prevout, 'hex').reverse();
      buffers.push(prevoutHash);
      
      // Previous output index (4 bytes, little-endian)
      const prevoutIndex = Buffer.alloc(4);
      prevoutIndex.writeUInt32LE(0, 0); // Coinbase always index 0
      buffers.push(prevoutIndex);
      
      // ScriptSig length (varint)
      const scriptSig = Buffer.from(input.scriptSig, 'hex');
      buffers.push(this.encodeVarint(scriptSig.length));
      buffers.push(scriptSig);
      
      // Sequence (4 bytes, little-endian)
      const sequence = Buffer.alloc(4);
      sequence.writeUInt32LE(input.sequence, 0);
      buffers.push(sequence);
    }
    
    // Output count (varint)
    buffers.push(this.encodeVarint(tx.outputs.length));
    
    // Outputs
    for (const output of tx.outputs) {
      // Value (8 bytes, little-endian)
      const valueBuf = Buffer.alloc(8);
      valueBuf.writeBigUInt64LE(BigInt(output.value), 0);
      buffers.push(valueBuf);
      
      // ScriptPubKey length (varint)
      const scriptPubKey = Buffer.from(output.scriptPubKey, 'hex');
      buffers.push(this.encodeVarint(scriptPubKey.length));
      buffers.push(scriptPubKey);
    }
    
    // Locktime (4 bytes, little-endian)
    const locktimeBuf = Buffer.alloc(4);
    locktimeBuf.writeUInt32LE(tx.locktime, 0);
    buffers.push(locktimeBuf);
    
    return Buffer.concat(buffers);
  }

  /**
   * Encode variable-length integer
   * @param {number} n - Number to encode
   * @returns {Buffer} Encoded varint
   */
  encodeVarint(n) {
    if (n < 0xfd) {
      return Buffer.from([n]);
    } else if (n <= 0xffff) {
      const buf = Buffer.alloc(3);
      buf[0] = 0xfd;
      buf.writeUInt16LE(n, 1);
      return buf;
    } else if (n <= 0xffffffff) {
      const buf = Buffer.alloc(5);
      buf[0] = 0xfe;
      buf.writeUInt32LE(n, 1);
      return buf;
    } else {
      const buf = Buffer.alloc(9);
      buf[0] = 0xff;
      buf.writeBigUInt64LE(BigInt(n), 1);
      return buf;
    }
  }

  /**
   * Calculate merkle root from transaction IDs
   * @param {Array<string>} txids - Array of transaction IDs (hex strings)
   * @returns {string} Merkle root (hex, little-endian)
   */
  calculateMerkleRoot(txids) {
    if (txids.length === 0) {
      // Empty merkle root (should not happen in valid block)
      return '0'.repeat(64);
    }
    
    if (txids.length === 1) {
      // Single transaction - merkle root is the txid
      return txids[0];
    }
    
    // Convert txids to buffers (little-endian to big-endian for hashing)
    let level = txids.map(txid => {
      const buf = Buffer.from(txid, 'hex');
      return buf.reverse(); // Convert to big-endian for hashing
    });
    
    // Build merkle tree
    while (level.length > 1) {
      const nextLevel = [];
      
      // Hash pairs
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = (i + 1 < level.length) ? level[i + 1] : left; // Duplicate if odd
        
        // Concatenate and double SHA256
        const combined = Buffer.concat([left, right]);
        const hash1 = crypto.createHash('sha256').update(combined).digest();
        const hash2 = crypto.createHash('sha256').update(hash1).digest();
        
        nextLevel.push(hash2);
      }
      
      level = nextLevel;
    }
    
    // Convert result back to little-endian hex
    return level[0].reverse().toString('hex');
  }

  /**
   * Construct device-specific mining work
   * @param {Object} blockTemplate - Bitcoin Core block template
   * @param {string} extranonce1 - Device-specific extranonce
   * @returns {Object} Device-specific work data
   */
  constructDeviceWork(blockTemplate, extranonce1) {
    // Construct coinbase with device-specific extranonce
    const coinbase = this.constructCoinbase(blockTemplate, extranonce1, blockTemplate.height);
    
    // Calculate coinbase txid
    const coinbaseTxid = this.calculateTxid(coinbase);
    
    // Get transaction txids from template
    const templateTxids = (blockTemplate.transactions || []).map(tx => tx.txid || tx.hash);
    
    // Build full transaction list: coinbase + template transactions
    const allTxids = [coinbaseTxid, ...templateTxids];
    
    // Calculate merkle root
    const merkleroot = this.calculateMerkleRoot(allTxids);
    
    return {
      coinbase,
      coinbaseTxid,
      merkleroot,
      allTxids
    };
  }
}

// Create singleton instance
const bitcoinWorkService = new BitcoinWorkService();

module.exports = {
  bitcoinWorkService
};
