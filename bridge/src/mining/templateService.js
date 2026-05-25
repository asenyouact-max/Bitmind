const BitcoinRpc = require('../rpc/bitcoinRpc');

class TemplateService {
  constructor() {
    this.rpc = new BitcoinRpc();
    this.currentTemplate = null;
    this.lastTemplateHash = null;
  }

  async fetchBlockTemplate() {
    try {
      console.log('[Template] Fetching new block template...');
      const template = await this.rpc.call('getblocktemplate', []);
      
      if (!template) {
        throw new Error('Failed to fetch block template');
      }

      this.currentTemplate = this.normalizeTemplate(template);
      this.lastTemplateHash = template.previousblockhash;
      
      console.log(`[Template] New template for block ${template.height}, prevhash: ${template.previousblockhash}`);
      return this.currentTemplate;
    } catch (error) {
      console.error('[Template] Error fetching block template:', error.message);
      throw error;
    }
  }

  normalizeTemplate(template) {
    // Simplify template for ESP32 devices
    return {
      jobId: this.generateJobId(),
      blockHeight: template.height,
      prevHash: template.previousblockhash,
      difficulty: template.difficulty,
      target: template.target,
      timestamp: template.curtime,
      version: template.version,
      // Remove complex coinbase transaction data for simplicity
      coinbaseTx: {
        data: template.coinbasevalue || '0100000001000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        required: template.coinbasevalue ? true : false
      },
      // Simplify merkle root for ESP32
      merkleRoot: template.merkleroot || '0000000000000000000000000000000000000000000000000000000000000000000',
      // Include only essential fields
      bits: template.bits || '1d00ffff',
      nonce: template.nonce || '00000000',
      transactions: []
    };
  }

  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getCurrentJob() {
    if (!this.currentTemplate) {
      return null;
    }

    return {
      ...this.currentTemplate,
      jobId: this.currentTemplate.jobId,
      timestamp: Date.now()
    };
  }

  hasTemplateChanged() {
    return this.currentTemplate && this.currentTemplate.prevHash !== this.lastTemplateHash;
  }

  getTemplateInfo() {
    return {
      hasCurrent: !!this.currentTemplate,
      lastUpdated: this.currentTemplate ? this.currentTemplate.timestamp : null,
      blockHeight: this.currentTemplate ? this.currentTemplate.blockHeight : null,
      jobId: this.currentTemplate ? this.currentTemplate.jobId : null
    };
  }
}

module.exports = TemplateService;
