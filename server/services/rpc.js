const axios = require('axios');
const systemState = require('../core/systemState');

/**
 * Bitcoin Core RPC Service - Pure Function Model
 * NO STATE MACHINE
 * NO CACHING
 * NO AUTO-RETRY
 * Single source of truth for RPC connectivity
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

    // Runtime debug log (safe - does not print password)
    console.log('[RPC BOOT]', {
      host: this.config.host || 'MISSING',
      port: this.config.port,
      user: this.config.user ? 'SET' : 'MISSING',
      password: this.config.password ? 'SET' : 'MISSING'
    });
    console.log('[RPC BOOT] HOST=' + (this.config.host || 'MISSING'));
    console.log('[RPC BOOT] PORT=' + this.config.port);
    console.log('[RPC BOOT] USER=' + (this.config.user || 'MISSING'));
    console.log('[RPC BOOT] TIMEOUT=' + this.config.timeout);

    // Validate required configuration - throw error if missing
    if (!this.config.host || !this.config.user || !this.config.password) {
      throw new Error('[RPC] Missing required environment variables (RPC_HOST, RPC_USER, RPC_PASSWORD)');
    }

    // Create axios instance with auth and timeout
    this.client = axios.create({
      baseURL: `http://${this.config.host}:${this.config.port}/`,
      timeout: this.config.timeout,
      auth: {
        username: this.config.user,
        password: this.config.password
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get live RPC status - PURE FUNCTION
   * NO STATE, NO CACHING, NO RETRY
   * @returns {Promise<Object>} RPC status object
   */
  async getLiveRpcStatus() {
    const startTime = Date.now();

    try {
      console.log('[RPC TRACE] calling ' + this.config.host + ':' + this.config.port);
      const response = await this.client.post('', {
        jsonrpc: '1.0',
        id: 'bitmind',
        method: 'getblockchaininfo',
        params: []
      });

      const latency = Date.now() - startTime;
      console.log('[RPC TRACE] status=' + response.status);
      console.log('[RPC TRACE] hasData=' + !!response.data);

      // Check if response has data
      if (!response.data) {
        console.log('[RPC TRACE] RETURN disconnected - no response data');
        const result = {
          status: 'disconnected',
          blocks: null,
          latencyMs: latency,
          error: 'No response data',
          timestamp: Date.now()
        };
        systemState.updateRpc(result);
        return result;
      }

      // Handle JSON-RPC error (only if HTTP status is 200)
      if (response.data.error) {
        if (response.data.error.code === -1) {
          console.log('[RPC TRACE] RETURN auth_failed - JSON-RPC error code -1');
          const result = {
            status: 'auth_failed',
            blocks: null,
            latencyMs: latency,
            error: response.data.error.message || 'Authentication failed',
            timestamp: Date.now()
          };
          systemState.updateRpc(result);
          return result;
        }
        console.log('[RPC TRACE] RETURN disconnected - JSON-RPC error: ' + (response.data.error.message || 'RPC error'));
        const result = {
          status: 'disconnected',
          blocks: null,
          latencyMs: latency,
          error: response.data.error.message || 'RPC error',
          timestamp: Date.now()
        };
        systemState.updateRpc(result);
        return result;
      }

      // Check if result exists
      console.log('[RPC TRACE] hasResult=' + !!response.data.result);
      if (!response.data.result) {
        console.log('[RPC TRACE] RETURN disconnected - no result in response');
        const result = {
          status: 'disconnected',
          blocks: null,
          latencyMs: latency,
          error: 'No result in response',
          timestamp: Date.now()
        };
        systemState.updateRpc(result);
        return result;
      }

      // Success
      console.log('[RPC TRACE] blocks=' + (response.data.result.blocks || null));
      console.log('[RPC TRACE] RETURN connected');
      const result = {
        status: 'connected',
        blocks: response.data.result.blocks || null,
        latencyMs: latency,
        error: null,
        timestamp: Date.now()
      };
      systemState.updateRpc(result);
      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      console.log('[RPC TRACE] caught error: ' + error.message);
      console.log('[RPC TRACE] error.code=' + (error.code || 'none'));
      console.log('[RPC TRACE] error.response.status=' + (error.response?.status || 'none'));

      // Classify error type - ONLY HTTP 401/403 is auth failure
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log('[RPC TRACE] RETURN auth_failed - HTTP ' + error.response.status);
        const result = {
          status: 'auth_failed',
          blocks: null,
          latencyMs: latency,
          error: 'Authentication failed (HTTP ' + error.response.status + ')',
          timestamp: Date.now()
        };
        systemState.updateRpc(result);
        return result;
      }

      if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
        console.log('[RPC TRACE] RETURN disconnected - connection refused');
        const result = {
          status: 'disconnected',
          blocks: null,
          latencyMs: latency,
          error: 'Connection refused',
          timestamp: Date.now()
        };
        systemState.updateRpc(result);
        return result;
      }

      if (error.code === 'ETIMEDOUT') {
        console.log('[RPC TRACE] RETURN disconnected - timeout');
        const result = {
          status: 'disconnected',
          blocks: null,
          latencyMs: latency,
          error: 'Connection timeout',
          timestamp: Date.now()
        };
        systemState.updateRpc(result);
        return result;
      }

      console.log('[RPC TRACE] RETURN disconnected - ' + (error.message || 'Unknown error'));
      const result = {
        status: 'disconnected',
        blocks: null,
        latencyMs: latency,
        error: error.message || 'Unknown error',
        timestamp: Date.now()
      };
      systemState.updateRpc(result);
      return result;
    }
  }

  /**
   * Get blockchain info - for mining operations
   * @returns {Promise<Object>} Blockchain information
   */
  async getBlockchainInfo() {
    const response = await this.client.post('', {
      jsonrpc: '1.0',
      id: 'bitmind',
      method: 'getblockchaininfo',
      params: []
    });

    // Check if response has data
    if (!response.data) {
      throw new Error('No response data from RPC');
    }

    // Handle JSON-RPC error
    if (response.data.error) {
      throw new Error(response.data.error.message || 'RPC error');
    }

    // Check if result exists
    if (!response.data.result) {
      throw new Error('No result in RPC response');
    }

    return response.data.result;
  }

  /**
   * Get block template - for mining operations
   * @param {Object} rules - Block template rules
   * @returns {Promise<Object>} Block template
   */
  async getBlockTemplate(rules = { rules: ['segwit'] }) {
    const response = await this.client.post('', {
      jsonrpc: '1.0',
      id: 'bitmind',
      method: 'getblocktemplate',
      params: [rules]
    });

    if (response.data.error) {
      throw new Error(response.data.error.message || 'RPC error');
    }

    return response.data.result;
  }

  /**
   * Get network info - for mining operations
   * @returns {Promise<Object>} Network information
   */
  async getNetworkInfo() {
    const response = await this.client.post('', {
      jsonrpc: '1.0',
      id: 'bitmind',
      method: 'getnetworkinfo',
      params: []
    });

    if (response.data.error) {
      throw new Error(response.data.error.message || 'RPC error');
    }

    return response.data.result;
  }

  /**
   * Get mining info - for mining operations
   * @returns {Promise<Object>} Mining information
   */
  async getMiningInfo() {
    const response = await this.client.post('', {
      jsonrpc: '1.0',
      id: 'bitmind',
      method: 'getmininginfo',
      params: []
    });

    if (response.data.error) {
      throw new Error(response.data.error.message || 'RPC error');
    }

    return response.data.result;
  }
}

// Create singleton instance
const rpcService = new RPCService();

module.exports = {
  rpcService
};
