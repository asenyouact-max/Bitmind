const axios = require('axios');

/**
 * Bitcoin Core RPC Bridge Service
 * Provides clean JSON-RPC communication with Bitcoin Core node
 */

class RPCService {
  constructor() {
    // Production: RPC_HOST, RPC_USER, RPC_PASSWORD MUST be set in .env
    // No fallbacks - configuration is explicit
    this.config = {
      host: process.env.RPC_HOST,
      port: parseInt(process.env.RPC_PORT) || 8332,
      user: process.env.RPC_USER,
      password: process.env.RPC_PASSWORD,
      timeout: parseInt(process.env.RPC_TIMEOUT) || 30000
    };

    // Validate required configuration
    if (!this.config.host || !this.config.user || !this.config.password) {
      console.error('[RPC] CRITICAL: RPC_HOST, RPC_USER, and RPC_PASSWORD must be set in .env');
      console.error('[RPC] Bitcoin Core RPC will be unavailable');
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

    // Request interceptor for logging (rate-limited to prevent spam)
    this.lastLogTime = 0;
    this.client.interceptors.request.use(
      (config) => {
        const now = Date.now();
        if (now - this.lastLogTime > 5000) { // Log at most once per 5 seconds
          console.log(`RPC Request: ${config.data?.method || 'unknown'}`);
          this.lastLogTime = now;
        }
        return config;
      },
      (error) => {
        const now = Date.now();
        if (now - this.lastLogTime > 5000) {
          console.error('RPC Request Error:', error.message);
          this.lastLogTime = now;
        }
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling (rate-limited)
    this.client.interceptors.response.use(
      (response) => {
        const now = Date.now();
        if (now - this.lastLogTime > 5000) {
          console.log(`RPC Response: ${response.data?.result ? 'success' : 'error'}`);
          this.lastLogTime = now;
        }
        return response;
      },
      (error) => {
        const now = Date.now();
        if (now - this.lastLogTime > 5000) {
          console.error('RPC Response Error:', error.message);
          this.lastLogTime = now;
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Generic RPC helper function
   * @param {string} method - Bitcoin Core RPC method name
   * @param {Array} params - RPC parameters (default: [])
   * @returns {Promise<any>} RPC result
   */
  async rpc(method, params = []) {
    try {
      const response = await this.client.post('', {
        jsonrpc: '2.0',
        id: Date.now(),
        method: method,
        params: params
      });

      // Handle JSON-RPC response
      if (response.data.error) {
        throw new RPCError(
          response.data.error.message || 'Unknown RPC error',
          response.data.error.code || -1
        );
      }

      return response.data.result;
    } catch (error) {
      // Handle different types of errors
      if (error.code === 'ECONNREFUSED') {
        throw new RPCError('Bitcoin Core RPC unreachable - check if node is running', -1);
      } else if (error.code === 'ECONNRESET') {
        throw new RPCError('RPC connection reset by node', -1);
      } else if (error.response?.status === 401) {
        throw new RPCError('RPC authentication failed - check credentials', -1);
      } else if (error.code === 'ETIMEDOUT') {
        throw new RPCError('RPC request timeout - node may be busy', -1);
      } else if (error instanceof RPCError) {
        throw error;
      } else {
        throw new RPCError(`RPC communication error: ${error.message}`, -1);
      }
    }
  }

  /**
   * Test RPC connection
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    try {
      await this.rpc('getblockchaininfo');
      return true;
    } catch (error) {
      console.error('RPC connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get blockchain info
   * @returns {Promise<Object>} Blockchain information
   */
  async getBlockchainInfo() {
    return await this.rpc('getblockchaininfo');
  }

  /**
   * Get block template
   * @param {Object} rules - Block template rules
   * @returns {Promise<Object>} Block template
   */
  async getBlockTemplate(rules = { rules: ['segwit'] }) {
    return await this.rpc('getblocktemplate', [rules]);
  }

  /**
   * Get network info
   * @returns {Promise<Object>} Network information
   */
  async getNetworkInfo() {
    return await this.rpc('getnetworkinfo');
  }

  /**
   * Get mining info
   * @returns {Promise<Object>} Mining information
   */
  async getMiningInfo() {
    return await this.rpc('getmininginfo');
  }
}

/**
 * Custom RPC Error class
 */
class RPCError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'RPCError';
    this.code = code;
  }
}

// Create singleton instance
const rpcService = new RPCService();

module.exports = {
  rpcService,
  RPCError
};
