const axios = require('axios');

/**
 * Bitcoin Core RPC External Service Module
 * Architecture: RPC is an EXTERNAL service, not a critical dependency
 * States: CONNECTED, AUTH_FAILED, UNREACHABLE, DISABLED
 * Behavior: Non-critical, isolated, fallback-safe
 */

class RPCService {
  constructor() {
    // Phase B.3: RPC Mode - EXTERNAL_SERVICE
    this.RPC_MODE = "EXTERNAL_SERVICE";

    // Explicit RPC states
    this.RPC_STATES = {
      CONNECTED: 'CONNECTED',
      AUTH_FAILED: 'AUTH_FAILED',
      UNREACHABLE: 'UNREACHABLE',
      DISABLED: 'DISABLED'
    };

    // Current state
    this.currentState = this.RPC_STATES.DISABLED;
    this.lastStateChange = 0;

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
      this.setState(this.RPC_STATES.DISABLED);
      console.log('[RPC] EXTERNAL_SERVICE mode - configuration incomplete, RPC disabled');
    } else {
      this.setState(this.RPC_STATES.UNREACHABLE);
      console.log('[RPC] EXTERNAL_SERVICE mode - configuration loaded, attempting connection');
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

    // Phase B.3: Remove request/response interceptors to prevent log spam
    // Only log state changes, not every request

    // Phase 0.2: RPC failure state cache with 60s cooldown
    this.failureState = {
      lastFailureTime: 0,
      lastFailureReason: null,
      cooldownMs: 60000 // 60 seconds
    };

    // Phase B.1: Retry configuration with exponential backoff
    this.retryConfig = {
      maxRetries: 3,
      baseDelayMs: 5000, // 5 seconds
      maxDelayMs: 10000, // 10 seconds
      backoffMultiplier: 1.5
    };
  }

  /**
   * Phase B.3: Set RPC state with state-change-only logging
   * @param {string} newState - New RPC state
   */
  setState(newState) {
    if (this.currentState !== newState) {
      console.log(`[RPC] STATE_CHANGE from=${this.currentState} to=${newState} endpoint=${this.config.host}:${this.config.port}`);
      this.currentState = newState;
      this.lastStateChange = Date.now();
    }
  }

  /**
   * Get current RPC state
   * @returns {string} Current state
   */
  getState() {
    return this.currentState;
  }

  /**
   * Log RPC failure with cooldown to prevent spam
   * @param {string} reason - Failure reason
   * @param {string} endpoint - RPC endpoint
   */
  logFailure(reason, endpoint = 'unknown') {
    const now = Date.now();
    const timeSinceLastFailure = now - this.failureState.lastFailureTime;

    // Only log if cooldown period has passed or failure reason changed
    if (timeSinceLastFailure > this.failureState.cooldownMs ||
        this.failureState.lastFailureReason !== reason) {
      console.log(`[RPC] CONNECTION_FAILED reason=${reason} endpoint=${this.config.host}:${this.config.port} cooldown=${timeSinceLastFailure}ms`);
      this.failureState.lastFailureTime = now;
      this.failureState.lastFailureReason = reason;
    }
  }

  /**
   * Delay helper for retry backoff
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate retry delay with exponential backoff
   * @param {number} attempt - Current attempt number
   * @returns {number} Delay in milliseconds
   */
  calculateRetryDelay(attempt) {
    const delay = Math.min(
      this.retryConfig.baseDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
      this.retryConfig.maxDelayMs
    );
    return Math.floor(delay);
  }

  /**
   * Generic RPC helper function with retry backoff
   * @param {string} method - Bitcoin Core RPC method name
   * @param {Array} params - RPC parameters (default: [])
   * @returns {Promise<any>} RPC result
   */
  async rpc(method, params = []) {
    let lastError = null;

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
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

        // Phase B.3: Set state to CONNECTED on success
        this.setState(this.RPC_STATES.CONNECTED);
        return response.data.result;
      } catch (error) {
        lastError = error;

        // Classify error type
        let errorType = 'UNKNOWN_ERROR';
        if (error.code === 'ECONNREFUSED') {
          errorType = 'NETWORK_UNREACHABLE';
        } else if (error.code === 'ECONNRESET') {
          errorType = 'CONNECTION_RESET';
        } else if (error.response?.status === 401) {
          errorType = 'AUTH_INVALID';
        } else if (error.code === 'ETIMEDOUT') {
          errorType = 'TIMEOUT';
        } else if (error instanceof RPCError) {
          errorType = 'RPC_ERROR';
        }

        // Phase B.3: Set state based on error type
        if (errorType === 'AUTH_INVALID') {
          this.setState(this.RPC_STATES.AUTH_FAILED);
        } else if (errorType === 'NETWORK_UNREACHABLE' || errorType === 'CONNECTION_RESET') {
          this.setState(this.RPC_STATES.UNREACHABLE);
        }

        // Log failure with structured logging (cooldown enforced)
        this.logFailure(errorType);

        // If this is the last attempt, throw the error
        if (attempt === this.retryConfig.maxRetries) {
          if (errorType === 'NETWORK_UNREACHABLE') {
            throw new RPCError('Bitcoin Core RPC unreachable - check if node is running', -1);
          } else if (errorType === 'CONNECTION_RESET') {
            throw new RPCError('RPC connection reset by node', -1);
          } else if (errorType === 'AUTH_INVALID') {
            throw new RPCError('RPC authentication failed - check credentials', -1);
          } else if (errorType === 'TIMEOUT') {
            throw new RPCError('RPC request timeout - node may be busy', -1);
          } else if (error instanceof RPCError) {
            throw error;
          } else {
            throw new RPCError(`RPC communication error: ${error.message}`, -1);
          }
        }

        // Calculate delay and wait before retry
        const delay = this.calculateRetryDelay(attempt);
        // Phase B.3: Remove retry spam logs - only state changes are logged
        await this.delay(delay);
      }
    }

    // This should never be reached, but just in case
    throw lastError || new RPCError('RPC failed after retries', -1);
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
