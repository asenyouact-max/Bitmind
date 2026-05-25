const BitcoinRpc = require('../rpc/bitcoinRpc');

class NodeService {
  constructor() {
    this.rpc = new BitcoinRpc();
    this.isOnline = false;
    this.lastCheck = null;
  }

  async checkNodeStatus() {
    try {
      const blockchainInfo = await this.rpc.getBlockchainInfo();
      this.isOnline = true;
      this.lastCheck = new Date().toISOString();
      
      return {
        online: true,
        lastChecked: this.lastCheck,
        ...blockchainInfo
      };
    } catch (error) {
      this.isOnline = false;
      this.lastCheck = new Date().toISOString();
      
      console.log('[Node] Bitcoin Core is offline or unreachable');
      return {
        online: false,
        lastChecked: this.lastCheck,
        error: error.message
      };
    }
  }

  async getBlockchainInfo() {
    try {
      const info = await this.rpc.getBlockchainInfo();
      return {
        success: true,
        data: info
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getNetworkInfo() {
    try {
      const info = await this.rpc.getNetworkInfo();
      return {
        success: true,
        data: info
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getMiningInfo() {
    try {
      const info = await this.rpc.getMiningInfo();
      return {
        success: true,
        data: info
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getSyncStatus() {
    try {
      const blockchainInfo = await this.rpc.getBlockchainInfo();
      const networkInfo = await this.rpc.getNetworkInfo();
      
      return {
        success: true,
        data: {
          blocks: blockchainInfo.blocks,
          headers: blockchainInfo.headers,
          verificationprogress: blockchainInfo.verificationprogress,
          initialblockdownload: blockchainInfo.initialblockdownload,
          chain: blockchainInfo.chain,
          connections: networkInfo.connections
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getNetworkStatus() {
    try {
      const [networkInfo, miningInfo] = await Promise.all([
        this.rpc.getNetworkInfo(),
        this.rpc.getMiningInfo()
      ]);
      
      return {
        success: true,
        data: {
          version: networkInfo.version,
          subversion: networkInfo.subversion,
          protocolversion: networkInfo.protocolversion,
          connections: networkInfo.connections,
          networks: networkInfo.networks,
          relayfee: networkInfo.relayfee,
          difficulty: miningInfo.difficulty,
          networkhashps: miningInfo.networkhashps,
          warnings: networkInfo.warnings
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = NodeService;
