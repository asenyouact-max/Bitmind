class ShareManager {
  constructor() {
    this.shares = []; // Array to store all shares
    this.deviceShares = new Map(); // deviceId -> shares array
  }

  addShare(deviceId, jobId, hash, nonce) {
    const share = {
      id: this.generateShareId(),
      deviceId,
      jobId,
      hash,
      nonce,
      timestamp: new Date().toISOString(),
      status: 'accepted' // Phase 1: accept all shares
    };

    // Add to global shares
    this.shares.push(share);
    
    // Add to device-specific shares
    if (!this.deviceShares.has(deviceId)) {
      this.deviceShares.set(deviceId, []);
    }
    this.deviceShares.get(deviceId).push(share);
    
    console.log(`[ShareManager] Share added: ${share.id} from device ${deviceId}, job ${jobId}`);
    return share;
  }

  getSharesByDevice(deviceId) {
    return this.deviceShares.get(deviceId) || [];
  }

  getAllShares() {
    return {
      total: this.shares.length,
      shares: this.shares,
      deviceShares: Object.fromEntries(this.deviceShares)
    };
  }

  getRecentShares(limit = 50) {
    return this.shares
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  getDeviceShareStats(deviceId) {
    const deviceShares = this.getSharesByDevice(deviceId);
    
    return {
      deviceId,
      totalShares: deviceShares.length,
      lastShare: deviceShares.length > 0 ? deviceShares[deviceShares.length - 1] : null,
      lastShareTime: deviceShares.length > 0 ? deviceShares[deviceShares.length - 1].timestamp : null
    };
  }

  getAllDeviceStats() {
    const stats = {};
    
    for (const [deviceId, shares] of this.deviceShares.entries()) {
      stats[deviceId] = {
        deviceId,
        totalShares: shares.length,
        lastShare: shares.length > 0 ? shares[shares.length - 1] : null,
        lastShareTime: shares.length > 0 ? shares[shares.length - 1].timestamp : null
      };
    }
    
    return stats;
  }

  validateDevice(deviceId) {
    // Check if device has registered shares
    const deviceShares = this.getSharesByDevice(deviceId);
    
    if (deviceShares.length === 0) {
      return {
        valid: false,
        reason: 'No shares found for device'
      };
    }

    // Phase 1: Always valid (no real proof-of-work validation yet)
    return {
      valid: true,
      shares: deviceShares.length,
      lastShare: deviceShares[deviceShares.length - 1]
    };
  }

  generateShareId() {
    return `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getShareStats() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentShares = this.shares.filter(share => 
      new Date(share.timestamp) >= last24h
    );

    return {
      totalShares: this.shares.length,
      last24Hours: recentShares.length,
      uniqueDevices: new Set(this.shares.map(s => s.deviceId)).size,
      lastShare: this.shares.length > 0 ? this.shares[this.shares.length - 1] : null
    };
  }
}

module.exports = ShareManager;
