/**
 * Bitmind Device Gateway - Single Gateway for Device Communication
 * Phase D: Contract Lock - All device communication MUST go through this gateway
 * 
 * Responsibilities:
 * - Translate systemState → device protocol messages
 * - Enforce schema validation
 * - Block invalid payloads
 * - Ensure version compliance
 * - Hide internal systemState from devices
 */

const { getState } = require('../state/systemState');
const protocolSpec = require('../../docs/device-protocol-v1.json');

const PROTOCOL_VERSION = "1.0";

/**
 * State Mapping Layer - systemState → deviceProtocol
 * Devices NEVER read systemState directly
 */
const STATE_MAPPING = {
  // Bitcoin mode mapping
  bitcoinMode: {
    'LIVE': 'LIVE',
    'FALLBACK': 'FALLBACK',
    'UNKNOWN': 'FALLBACK' // Default to fallback if unknown
  },
  
  // RPC state mapping
  rpcState: {
    'CONNECTED': 'CONNECTED',
    'AUTH_FAILED': 'AUTH_FAILED',
    'UNREACHABLE': 'UNREACHABLE',
    'DISABLED': 'DISABLED',
    'UNKNOWN': 'UNREACHABLE' // Default to unreachable if unknown
  },
  
  // Mining mode mapping
  miningMode: {
    'LIVE_MINING': 'LIVE_MINING',
    'SIMULATED_WORK_ONLY': 'SIMULATED_WORK_ONLY',
    'IDLE': 'IDLE',
    'UNKNOWN': 'IDLE' // Default to idle if unknown
  }
};

/**
 * Validate device protocol version
 * @param {string} version - Device protocol version
 * @returns {boolean} Valid or not
 */
function validateProtocolVersion(version) {
  if (!version) return false;
  const [major, minor] = version.split('.').map(Number);
  const [reqMajor, reqMinor] = PROTOCOL_VERSION.split('.').map(Number);
  
  // Exact match required for v1.0
  return major === reqMajor && minor === reqMinor;
}

/**
 * Map systemState to device protocol system state
 * @returns {Object} Device protocol system state
 */
function mapSystemState() {
  const state = getState();
  
  return {
    status: state.bitcoin.mode === 'LIVE' ? 'ok' : 'degraded',
    mode: STATE_MAPPING.bitcoinMode[state.bitcoin.mode] || 'FALLBACK',
    rpc: STATE_MAPPING.rpcState[state.bitcoin.rpc] || 'UNREACHABLE',
    mining: STATE_MAPPING.miningMode[state.bitcoin.mining] || 'IDLE'
  };
}

/**
 * Create device registration response
 * @param {string} deviceId - Device ID
 * @param {string} token - Auth token
 * @returns {Object} Device registered message
 */
function createRegistrationResponse(deviceId, token) {
  return {
    type: 'device.registered',
    status: 'accepted',
    deviceId: deviceId,
    token: token,
    serverTime: Math.floor(Date.now() / 1000)
  };
}

/**
 * Create heartbeat acknowledgment
 * @returns {Object} Heartbeat ack message
 */
function createHeartbeatAck() {
  return {
    type: 'device.heartbeat.ack',
    systemState: mapSystemState()
  };
}

/**
 * Create mining job message
 * @param {Object} job - Mining job data
 * @returns {Object} Mining job message
 */
function createMiningJob(job) {
  return {
    type: 'mining.job',
    jobId: job.jobId,
    algorithm: 'sha256',
    data: job.data,
    target: job.target,
    difficulty: job.difficulty
  };
}

/**
 * Create share result message
 * @param {string} jobId - Job ID
 * @param {boolean} accepted - Share accepted or not
 * @param {string} reason - Reason for result
 * @returns {Object} Share result message
 */
function createShareResult(jobId, accepted, reason) {
  return {
    type: 'mining.share.result',
    jobId: jobId,
    accepted: accepted,
    reason: reason
  };
}

/**
 * Create device status message (OLED use case)
 * @param {Object} miningStats - Mining statistics
 * @returns {Object} Device status message
 */
function createDeviceStatus(miningStats = {}) {
  const systemState = mapSystemState();
  
  // Determine display message and color based on system state
  let displayMessage = 'SYSTEM INITIALIZING';
  let displayColor = 'white';
  
  if (systemState.mode === 'LIVE' && systemState.rpc === 'CONNECTED') {
    displayMessage = 'MINING ACTIVE';
    displayColor = 'green';
  } else if (systemState.rpc === 'AUTH_FAILED') {
    displayMessage = 'AUTH FAILED';
    displayColor = 'red';
  } else if (systemState.mode === 'FALLBACK') {
    displayMessage = 'FALLBACK MODE';
    displayColor = 'yellow';
  }
  
  return {
    type: 'device.status',
    system: {
      mode: systemState.mode,
      rpc: systemState.rpc
    },
    mining: {
      hashrate: miningStats.hashrate || 0,
      acceptedShares: miningStats.acceptedShares || 0,
      rejectedShares: miningStats.rejectedShares || 0
    },
    display: {
      message: displayMessage,
      color: displayColor
    }
  };
}

/**
 * Create device error message
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @returns {Object} Device error message
 */
function createDeviceError(code, message) {
  return {
    type: 'device.error',
    code: code,
    message: message
  };
}

/**
 * Validate incoming device message against protocol schema
 * @param {Object} message - Incoming message
 * @returns {Object} Validation result { valid: boolean, error: string }
 */
function validateIncomingMessage(message) {
  if (!message || typeof message !== 'object') {
    return { valid: false, error: 'Invalid message format' };
  }
  
  if (!message.type) {
    return { valid: false, error: 'Missing message type' };
  }
  
  // Check if message type is defined in protocol
  const messageType = message.type;
  if (!protocolSpec.messageTypes[messageType]) {
    return { valid: false, error: `Unknown message type: ${messageType}` };
  }
  
  // Basic schema validation (simplified - full validation would use JSON Schema)
  const schema = protocolSpec.messageTypes[messageType].schema;
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in message)) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }
  }
  
  return { valid: true };
}

/**
 * Validate device registration payload
 * @param {Object} payload - Registration payload
 * @returns {Object} Validation result
 */
function validateRegistration(payload) {
  const validation = validateIncomingMessage(payload);
  if (!validation.valid) {
    return validation;
  }
  
  // Validate protocol version
  if (payload.firmwareVersion && !validateProtocolVersion(payload.firmwareVersion)) {
    return { 
      valid: false, 
      error: `Protocol version mismatch. Expected: ${PROTOCOL_VERSION}, Got: ${payload.firmwareVersion}` 
    };
  }
  
  // Validate device ID format
  if (!payload.deviceId || !/^esp32-[a-f0-9]{4,12}$/.test(payload.deviceId)) {
    return { valid: false, error: 'Invalid device ID format' };
  }
  
  // Validate device type
  const validTypes = ['oled_miner', 'miner', 'test_client'];
  if (!validTypes.includes(payload.deviceType)) {
    return { valid: false, error: `Invalid device type: ${payload.deviceType}` };
  }
  
  return { valid: true };
}

module.exports = {
  PROTOCOL_VERSION,
  validateProtocolVersion,
  mapSystemState,
  createRegistrationResponse,
  createHeartbeatAck,
  createMiningJob,
  createShareResult,
  createDeviceStatus,
  createDeviceError,
  validateIncomingMessage,
  validateRegistration
};
