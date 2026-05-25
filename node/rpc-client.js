/**
 * Bitcoin Core RPC Client
 * Provides clean JSON-RPC communication with Bitcoin Core node
 * Designed for Tailscale VPN connectivity only
 */

const axios = require('axios');

class RPCClient {
  constructor(config) {
    this.config = {
      host: config.host || process.env.RPC_HOST,
      port: config.port || process.env.RPC_PORT || 8332,
      user: config.user || process.env.RPC_USER || 'Global',
      password: config.password || process.env.RPC_PASSWORD,
      timeout: config.timeout || parseInt(process.env.RPC_TIMEOUT) || 30000
    };

    // Validate configuration
    if (!this.config.host) {
      throw new Error('RPC_HOST is required in environment or config');
    }
    if (!this.config.password) {
      throw new Error('RPC_PASSWORD is required in environment or config');
    }

    // Create axios instance with auth and timeout
    this.client = axios.create({
      baseURL: `http://${this.config.host}:${this.config.port}`,
      timeout: this.config.timeout,
      auth: {
        username: this.config.user,
        password: this.config.password
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Rate-limited logging
    this.lastLogTime = 0;
    this.logInterval = 5000; // 5 seconds
  }

  /**
   * Log message with rate limiting
   */
  log(message) {
    const now = Date.now();
    if (now - this.lastLogTime > this.logInterval) {
      console.log(`[RPC] ${message}`);
      this.lastLogTime = now;
    }
  }

  /**
   * Execute RPC call
   */
  async call(method, params = []) {
    try {
      const response = await this.client.post('/', {
        jsonrpc: '1.0',
        id: Date.now(),
        method,
        params
      });

      if (response.data.error) {
        throw new Error(`RPC Error: ${response.data.error.message}`);
      }

      return response.data.result;
    } catch (error) {
      this.log(`RPC call failed: ${method} - ${error.message}`);
      throw error;
    }
  }

  /**
   * Get blockchain info
   */
  async getBlockchainInfo() {
    return this.call('getblockchaininfo');
  }

  /**
   * Get network info
   */
  async getNetworkInfo() {
    return this.call('getnetworkinfo');
  }

  /**
   * Get mempool info
   */
  async getMempoolInfo() {
    return this.call('getmempoolinfo');
  }

  /**
   * Get block hash by height
   */
  async getBlockHash(height) {
    return this.call('getblockhash', [height]);
  }

  /**
   * Get block by hash
   */
  async getBlock(hash, verbosity = 2) {
    return this.call('getblock', [hash, verbosity]);
  }

  /**
   * Get raw transaction
   */
  async getRawTransaction(txid, verbose = 1) {
    return this.call('getrawtransaction', [txid, verbose]);
  }

  /**
   * Test connectivity
   */
  async testConnection() {
    try {
      await this.getBlockchainInfo();
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = RPCClient;
