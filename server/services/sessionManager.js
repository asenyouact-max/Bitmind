const crypto = require('crypto');

/**
 * Mining Session Class
 * Represents a stratum-like mining session with distributed work assignment
 */
class MiningSession {
  constructor(jobId, height, target, blockTemplate) {
    this.sessionId = crypto.randomUUID();
    this.jobId = jobId;
    this.height = height;
    this.target = target; // Real Bitcoin target
    this.pseudoTarget = null; // No pseudo target
    this.createdAt = Date.now();
    this.activeDevices = new Map(); // deviceId -> deviceContext
    this.blockTemplate = blockTemplate;
    this.isActive = true;
  }

  /**
   * Assign work to a new device
   * @param {string} deviceId - Device identifier
   * @returns {Object} Device context with assigned work parameters
   */
  assignDevice(deviceId) {
    // Generate unique extranonce1 for this device
    const extranonce1 = crypto.randomBytes(8).toString('hex');
    
    // Calculate nonce range for this device
    const deviceCount = this.activeDevices.size + 1;
    const nonceRange = this.calculateNonceRange(deviceCount);
    
    const deviceContext = {
      sessionId: this.sessionId,
      jobId: this.jobId,
      height: this.height,
      target: this.target, // Real Bitcoin target
      pseudoTarget: null, // No pseudo target
      pseudoMining: false, // Real mining mode
      extranonce1,
      nonceStart: nonceRange.start,
      nonceEnd: nonceRange.end,
      difficulty: this.blockTemplate.bits, // Real difficulty from bits
      version: this.blockTemplate.version,
      previousblockhash: this.blockTemplate.previousblockhash,
      merkleroot: this.blockTemplate.merkleroot || '', // Real merkleroot from template
      curtime: this.blockTemplate.curtime,
      bits: this.blockTemplate.bits,
      coinbasevalue: this.blockTemplate.coinbasevalue,
      coinbaseaddress: this.blockTemplate.coinbaseaddress || ''
    };

    this.activeDevices.set(deviceId, deviceContext);
    return deviceContext;
  }

  /**
   * Calculate nonce range for device assignment
   * @param {number} deviceIndex - Device index in session
   * @returns {Object} Nonce range {start, end}
   */
  calculateNonceRange(deviceIndex) {
    const NONCE_RANGE_SIZE = 1000000; // 1M nonce range per device
    const start = (deviceIndex - 1) * NONCE_RANGE_SIZE;
    const end = start + NONCE_RANGE_SIZE - 1;
    
    return { start, end };
  }

  /**
   * Remove device from session
   * @param {string} deviceId - Device identifier
   */
  removeDevice(deviceId) {
    this.activeDevices.delete(deviceId);
  }

  /**
   * Check if nonce is within device's assigned range
   * @param {string} deviceId - Device identifier
   * @param {number} nonce - Nonce to validate
   * @returns {boolean} True if nonce is in range
   */
  isNonceInRange(deviceId, nonce) {
    const deviceContext = this.activeDevices.get(deviceId);
    if (!deviceContext) return false;
    
    return nonce >= deviceContext.nonceStart && nonce <= deviceContext.nonceEnd;
  }

  /**
   * Get device context
   * @param {string} deviceId - Device identifier
   * @returns {Object|null} Device context or null if not found
   */
  getDeviceContext(deviceId) {
    return this.activeDevices.get(deviceId) || null;
  }

  /**
   * Invalidate session (called on new block template)
   */
  invalidate() {
    this.isActive = false;
  }

  /**
   * Get session statistics
   * @returns {Object} Session stats
   */
  getStats() {
    return {
      sessionId: this.sessionId,
      jobId: this.jobId,
      height: this.height,
      activeDevices: this.activeDevices.size,
      createdAt: this.createdAt,
      isActive: this.isActive,
      uptime: Date.now() - this.createdAt
    };
  }
}

/**
 * Session Manager Class
 * Manages multiple mining sessions and device assignments
 */
class SessionManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> MiningSession
    this.deviceSessions = new Map(); // deviceId -> sessionId
    this.currentSession = null;
  }

  /**
   * Create new mining session from block template
   * @param {Object} blockTemplate - Bitcoin Core block template
   * @returns {MiningSession} New mining session
   */
  createSession(blockTemplate) {
    // Create new session (PURE - no side effects)
    const session = new MiningSession(
      blockTemplate.jobId,
      blockTemplate.height,
      blockTemplate.target,
      blockTemplate
    );

    this.sessions.set(session.sessionId, session);
    this.currentSession = session;

    console.log(`🆔 SESSION CREATED: ${session.sessionId}`);
    return session;
  }

  /**
   * Get current active session
   * @returns {MiningSession|null} Current session or null
   */
  getCurrentSession() {
    return this.currentSession;
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session identifier
   * @returns {MiningSession|null} Session or null if not found
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Assign device to current session
   * @param {string} deviceId - Device identifier
   * @returns {Object|null} Device context or null if no active session
   */
  assignDevice(deviceId) {
    if (!this.currentSession) {
      return null;
    }

    // Remove device from previous session if exists
    this.removeDeviceFromAllSessions(deviceId);

    // Assign to current session
    const deviceContext = this.currentSession.assignDevice(deviceId);
    this.deviceSessions.set(deviceId, this.currentSession.sessionId);

    console.log(`📱 Assigned device ${deviceId} to session ${this.currentSession.sessionId} (nonce range: ${deviceContext.nonceStart}-${deviceContext.nonceEnd})`);
    
    return deviceContext;
  }

  /**
   * Remove device from all sessions
   * @param {string} deviceId - Device identifier
   */
  removeDeviceFromAllSessions(deviceId) {
    const previousSessionId = this.deviceSessions.get(deviceId);
    if (previousSessionId) {
      const previousSession = this.sessions.get(previousSessionId);
      if (previousSession) {
        previousSession.removeDevice(deviceId);
      }
      this.deviceSessions.delete(deviceId);
    }
  }

  /**
   * Validate device submission
   * @param {string} deviceId - Device identifier
   * @param {string} sessionId - Session identifier from submission
   * @param {number} nonce - Nonce from submission
   * @returns {Object} Validation result
   */
  validateSubmission(deviceId, sessionId, nonce) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return {
        valid: false,
        reason: 'session_not_found',
        message: `Session ${sessionId} not found`
      };
    }

    if (!session.isActive) {
      return {
        valid: false,
        reason: 'session_inactive',
        message: `Session ${sessionId} is no longer active`
      };
    }

    if (session.jobId !== this.currentSession?.jobId) {
      return {
        valid: false,
        reason: 'stale_job',
        message: `Job ${session.jobId} is stale`
      };
    }

    const deviceContext = session.getDeviceContext(deviceId);
    if (!deviceContext) {
      return {
        valid: false,
        reason: 'device_not_assigned',
        message: `Device ${deviceId} not assigned to session ${sessionId}`
      };
    }

    if (!session.isNonceInRange(deviceId, nonce)) {
      return {
        valid: false,
        reason: 'nonce_out_of_range',
        message: `Nonce ${nonce} outside assigned range for device ${deviceId}`
      };
    }

    return {
      valid: true,
      session,
      deviceContext
    };
  }

  /**
   * Invalidate all sessions (called on new block template)
   */
  invalidateAllSessions() {
    console.log(`🔄 Invalidating ${this.sessions.size} mining sessions`);
    
    for (const session of this.sessions.values()) {
      session.invalidate();
    }
    
    this.sessions.clear();
    this.deviceSessions.clear();
    this.currentSession = null;
  }

  /**
   * Get all active sessions
   * @returns {Array} Array of session stats
   */
  getActiveSessions() {
    return Array.from(this.sessions.values())
      .filter(session => session.isActive)
      .map(session => session.getStats());
  }

  /**
   * Get session statistics
   * @returns {Object} Session manager stats
   */
  getStats() {
    const activeSessions = this.getActiveSessions();
    
    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      currentSession: this.currentSession ? this.currentSession.getStats() : null,
      totalDevices: this.deviceSessions.size
    };
  }
}

// Create singleton instance
const sessionManager = new SessionManager();

module.exports = { MiningSession, SessionManager, sessionManager };
