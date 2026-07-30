const crypto = require('crypto');
const { rpcService } = require('./rpc');
const { sessionManager } = require('./sessionManager');

/**
 * Mining Job Manager Service
 * Generates and manages mining jobs from Bitcoin Core block templates
 */

class JobManager {
  constructor() {
    this.currentJob = null;
    this.lastBlockHeight = 0;
    this.jobRefreshInterval = null;
    this.miningStats = {
      jobsGenerated: 0,
      jobsBroadcast: 0,
      lastJobTime: null,
      connectedMiners: 0
    };
  }

  /**
   * Generate a new mining job from Bitcoin Core block template
   * @returns {Promise<Object>} Generated mining job
   */
  async generateMiningJob() {
    try {
      console.log('🔨 Generating new mining job...');
      
      // Get block template from Bitcoin Core
      const blockTemplate = await rpcService.getBlockTemplate();
      
      if (!blockTemplate) {
        throw new Error('Failed to get block template from Bitcoin Core');
      }
      
      console.log(`📦 Got block template: height=${blockTemplate.height}, target=${blockTemplate.target}`);
      
      // Create unique job ID and session
      const jobId = crypto.randomUUID();
      const createdAt = Date.now();
      
      // Use REAL Bitcoin target from block template
      blockTemplate.jobId = jobId;
      blockTemplate.pseudoMining = false; // Disable pseudo-mining mode
      
      // Create new mining session
      const session = sessionManager.createSession(blockTemplate);
      
      // Create standardized mining job format with all required Bitcoin fields
      const miningJob = {
        type: "mining_job",
        sessionId: session.sessionId,
        jobId: session.jobId,
        height: session.height,
        target: session.target, // Real Bitcoin target
        pseudoTarget: null, // No pseudo target
        pseudoMining: false, // Real mining mode
        createdAt: session.createdAt,
        // Required Bitcoin fields
        version: blockTemplate.version,
        previousblockhash: blockTemplate.previousblockhash,
        merkleroot: null, // Will be set per device during assignment (device-specific)
        nbits: blockTemplate.bits,
        ntime: blockTemplate.curtime,
        coinbasevalue: blockTemplate.coinbasevalue,
        coinbaseaddress: blockTemplate.coinbaseaddress || '',
        transactions: blockTemplate.transactions || [],
        rules: blockTemplate.rules || ['segwit'],
        // Note: deviceContext will be added per device during assignment
      };
      
      // Store current job
      this.currentJob = miningJob;
      this.lastBlockHeight = blockTemplate.height;
      this.miningStats.jobsGenerated++;
      this.miningStats.lastJobTime = createdAt;
      
      console.log(`[JOB_MANAGER] JOB_GENERATED jobId=${jobId} height=${blockTemplate.height}`);
      console.log(`[JOB_MANAGER] SESSION_CREATED sessionId=${session.sessionId} jobId=${jobId}`);
      console.log(`[JOB_MANAGER] TARGET target=${blockTemplate.target}`);
      
      return miningJob;
      
    } catch (error) {
      console.error('[JOB_MANAGER] JOB_GENERATION_FAILED error=' + error.message);
      throw error;
    }
  }

  /**
   * Start periodic job refresh
   * @param {WebSocket} wss - WebSocket server instance
   * @param {Map} devices - Connected devices map
   */
  startJobRefresh(wss, devices) {
    // Clear existing interval if any
    if (this.jobRefreshInterval) {
      clearInterval(this.jobRefreshInterval);
    }

    // Update connected miners count
    this.miningStats.connectedMiners = devices.size;

    console.log('⏰ Starting job refresh cycle (30 seconds)');

    // Generate first job immediately
    this.generateAndBroadcastJob(wss, devices);

    // Set up periodic refresh (every 30 seconds)
    this.jobRefreshInterval = setInterval(async () => {
      try {
        // Update connected miners count
        this.miningStats.connectedMiners = devices.size;
        
        // Check if block height changed (force refresh)
        const blockchainInfo = await rpcService.getBlockchainInfo();
        const heightChanged = this.lastBlockHeight !== blockchainInfo.blocks;
        
        if (heightChanged) {
          console.log('[JOB_MANAGER] BLOCK_HEIGHT_CHANGED oldHeight=' + this.lastBlockHeight + ' newHeight=' + blockchainInfo.blocks);
          await this.generateAndBroadcastJob(wss, devices);
        } else {
          // Regular 30-second refresh
          await this.generateAndBroadcastJob(wss, devices);
        }
      } catch (error) {
        console.error('[JOB_MANAGER] JOB_REFRESH_ERROR error=' + error.message);
      }
    }, 30000); // 30 seconds
  }

  /**
   * Stop periodic job refresh
   */
  stopJobRefresh() {
    if (this.jobRefreshInterval) {
      clearInterval(this.jobRefreshInterval);
      this.jobRefreshInterval = null;
      console.log('[JOB_MANAGER] JOB_REFRESH_STOPPED');
    }
  }

  /**
   * Generate and broadcast job to connected devices
   * @param {WebSocket} wss - WebSocket server instance
   * @param {Map} devices - Connected devices map
   */
  async generateAndBroadcastJob(wss, devices) {
    try {
      // Generate new job (creates new session)
      const job = await this.generateMiningJob();
      
      // Broadcast session_created event
      this.broadcastEvent(wss, {
        type: 'session_created',
        data: {
          sessionId: job.sessionId,
          jobId: job.jobId,
          height: job.height,
          createdAt: job.createdAt
        }
      });
      
      // Assign individual work to each device
      let broadcastCount = 0;
      for (const [deviceId, device] of devices) {
        if (device.ws && device.ws.readyState === 1) { // WebSocket.OPEN
          const deviceContext = this.assignWorkToDevice(deviceId, job);
          
          if (deviceContext) {
            // Create device-specific job with context and effective target
            const deviceJob = {
              ...job,
              target: deviceContext.effectiveTarget, // Phase 1: Use effective target
              pseudoTarget: deviceContext.pseudoTarget, // Phase 1: Keep for backward compatibility
              pseudoMining: deviceContext.pseudoMining, // Phase 1: Keep for backward compatibility
              deviceContext: {
                sessionId: deviceContext.sessionId,
                nonceStart: deviceContext.nonceStart,
                nonceEnd: deviceContext.nonceEnd,
                extranonce1: deviceContext.extranonce1
              }
            };
            
            device.ws.send(JSON.stringify(deviceJob));
            broadcastCount++;
            
            // Broadcast device_assigned_work event
            this.broadcastEvent(wss, {
              type: 'device_assigned_work',
              data: {
                deviceId,
                sessionId: deviceContext.sessionId,
                nonceRange: `${deviceContext.nonceStart}-${deviceContext.nonceEnd}`,
                extranonce1: deviceContext.extranonce1,
                effectiveTarget: deviceContext.effectiveTarget,
                pseudoMining: deviceContext.pseudoMining
              }
            });
          }
        }
      }

      this.miningStats.jobsBroadcast += broadcastCount;
      
      console.log('[JOB_MANAGER] JOB_BROADCASTED count=' + broadcastCount + ' jobId=' + job.jobId);
      
      return {
        success: true,
        jobId: job.jobId,
        broadcastCount
      };
      
    } catch (error) {
      console.error('[JOB_MANAGER] JOB_BROADCAST_ERROR error=' + error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Broadcast event to all connected clients
   * @param {WebSocket} wss - WebSocket server instance
   * @param {Object} event - Event object to broadcast
   */
  broadcastEvent(wss, event) {
    const message = JSON.stringify(event);
    let broadcastCount = 0;
    
    wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
        broadcastCount++;
      }
    });
    
    console.log(`📡 Event broadcasted: ${event.type} to ${broadcastCount} clients`);
  }

  /**
   * Get current active mining job
   * @returns {Object|null} Current job or null
   */
  getCurrentJob() {
    return this.currentJob;
  }

  /**
   * Determine if device should use pseudo-mining mode
   * @param {string} deviceId - Device identifier
   * @returns {boolean} True if device should use pseudo-mining
   */
  shouldUsePseudoMining(deviceId) {
    // ESP32 devices use pseudo-mining for demonstration/testing
    // ASIC devices use real mining
    return deviceId.startsWith('esp32-');
  }

  /**
   * Calculate pseudo-target from real target for low-power devices
   * Adds 12-16 leading zeros to make target achievable at ~600 H/s
   * @param {string} realTarget - Real Bitcoin target (64 hex chars)
   * @returns {string} Pseudo-target with adjusted difficulty
   */
  calculatePseudoTarget(realTarget) {
    // For pseudo-mining, add 14 leading zeros to the target
    // This makes it ~2^56 times easier, suitable for ESP32 at ~600 H/s
    // Expected time: ~1-2 hours per share instead of ~6,700 years
    const leadingZeros = '00000000000000'; // 14 zeros
    const adjustedTarget = leadingZeros + realTarget.substring(14);
    console.log('[JOB_MANAGER] PSEUDO_TARGET_CALCULATED real=' + realTarget + ' pseudo=' + adjustedTarget);
    return adjustedTarget;
  }

  /**
   * Assign work to a specific device with target selection
   * @param {string} deviceId - Device identifier
   * @param {Object} baseJob - Base job with real target
   * @returns {Object|null} Device context with assigned work and selected target
   */
  assignWorkToDevice(deviceId, baseJob) {
    const deviceContext = sessionManager.assignDevice(deviceId);
    
    if (!deviceContext) {
      console.log('[JOB_MANAGER] NO_ACTIVE_SESSION deviceId=' + deviceId);
      return null;
    }

    // Determine if device should use pseudo-mining
    const usePseudoMining = this.shouldUsePseudoMining(deviceId);
    
    // Select effective target based on device type
    let effectiveTarget;
    let pseudoTarget = null;
    
    if (usePseudoMining) {
      pseudoTarget = this.calculatePseudoTarget(baseJob.target);
      effectiveTarget = pseudoTarget;
      console.log('[JOB_MANAGER] PSEUDO_MINING_ENABLED deviceId=' + deviceId + ' effectiveTarget=' + effectiveTarget);
    } else {
      effectiveTarget = baseJob.target;
      console.log('[JOB_MANAGER] REAL_MINING deviceId=' + deviceId + ' effectiveTarget=' + effectiveTarget);
    }

    // Return device context with target selection
    return {
      ...deviceContext,
      effectiveTarget,
      pseudoTarget,
      pseudoMining: usePseudoMining
    };
  }

  /**
   * Get mining statistics
   * @returns {Object} Mining stats
   */
  getMiningStats() {
    return {
      ...this.miningStats,
      uptime: process.uptime(),
      currentJobId: this.currentJob ? this.currentJob.jobId : null,
      lastBlockHeight: this.lastBlockHeight
    };
  }

  /**
   * Handle WebSocket client connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} deviceId - Device identifier
   */
  handleDeviceConnection(ws, deviceId) {
    // Send current job to newly connected device with target selection
    if (this.currentJob) {
      console.log(`📤 Sending current job to new device: ${deviceId}`);
      
      const deviceContext = this.assignWorkToDevice(deviceId, this.currentJob);
      
      if (deviceContext) {
        const deviceJob = {
          ...this.currentJob,
          target: deviceContext.effectiveTarget, // Phase 1: Use effective target
          pseudoTarget: deviceContext.pseudoTarget, // Phase 1: Keep for backward compatibility
          pseudoMining: deviceContext.pseudoMining, // Phase 1: Keep for backward compatibility
          deviceContext: {
            sessionId: deviceContext.sessionId,
            nonceStart: deviceContext.nonceStart,
            nonceEnd: deviceContext.nonceEnd,
            extranonce1: deviceContext.extranonce1
          }
        };
        ws.send(JSON.stringify(deviceJob));
      }
    }
  }

  /**
   * Reset job manager state
   */
  reset() {
    this.currentJob = null;
    this.lastBlockHeight = 0;
    this.miningStats = {
      jobsGenerated: 0,
      jobsBroadcast: 0,
      lastJobTime: null,
      connectedMiners: 0
    };
    this.stopJobRefresh();
    console.log('🔄 Job manager reset');
  }
}

// Create singleton instance
const jobManager = new JobManager();

module.exports = {
  jobManager
};
