const axios = require('axios');
const config = require('../config/config');

class BitcoinRpc {
  constructor() {
    this.client = axios.create({
      baseURL: config.rpc.url,
      auth: {
        username: config.rpc.user,
        password: config.rpc.password
      },
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });
  }

  async call(method, params = []) {
    try {
      console.log(`[RPC] Calling ${method} with params:`, params);
      const response = await this.client.post('', {
        jsonrpc: '1.0',
        id: 1,
        method: method,
        params: params
      });
      
      if (response.data.error) {
        console.error(`[RPC] Error in ${method}:`, response.data.error);
        throw new Error(`RPC Error: ${response.data.error.message}`);
      }
      
      console.log(`[RPC] Success: ${method}`);
      return response.data.result;
    } catch (error) {
      console.error(`[RPC] Failed to call ${method}:`, error.message);
      throw error;
    }
  }

  async getBlockchainInfo() {
    return await this.call('getblockchaininfo');
  }

  async getNetworkInfo() {
    return await this.call('getnetworkinfo');
  }

  async getMiningInfo() {
    return await this.call('getmininginfo');
  }

  async getPeerInfo() {
    return await this.call('getpeerinfo');
  }
}

module.exports = BitcoinRpc;
