// REGISTRATION STORE ABSTRACTION LAYER
// Phase F5-P1: Identity Architecture Implementation
// Purpose: Provide storage-agnostic interface for device registration persistence
// Design: Allows storage replacement (SQLite → PostgreSQL → Redis+PostgreSQL) without protocol changes

/**
 * RegistrationStore Interface
 * 
 * This interface defines the contract for device registration storage.
 * Implementations can use different backends (SQLite, PostgreSQL, Redis, etc.)
 * without changing the protocol, firmware, or frontend.
 * 
 * Design Principles:
 * - Async/await for all operations (database I/O)
 * - Storage-agnostic interface
 * - Token validation support
 * - Registration persistence
 * - Scalable by design
 */
class RegistrationStore {
  /**
   * Register a device (or update existing registration)
   * @param {string} deviceId - Device identifier
   * @param {Object} metadata - Device metadata (workerName, walletAddress, deviceType, firmwareVersion, token)
   * @returns {Promise<Object>} Registration record with deviceId, token, and metadata
   */
  async registerDevice(deviceId, metadata = {}) {
    throw new Error('registerDevice() must be implemented by subclass');
  }

  /**
   * Get device registration
   * @param {string} deviceId - Device identifier
   * @returns {Promise<Object|null>} Registration record or null if not found
   */
  async getDevice(deviceId) {
    throw new Error('getDevice() must be implemented by subclass');
  }

  /**
   * Update device registration
   * @param {string} deviceId - Device identifier
   * @param {Object} updates - Fields to update (workerName, walletAddress, deviceType, firmwareVersion, lastSeen)
   * @returns {Promise<Object>} Updated registration record
   */
  async updateDevice(deviceId, updates = {}) {
    throw new Error('updateDevice() must be implemented by subclass');
  }

  /**
   * Remove device registration
   * @param {string} deviceId - Device identifier
   * @returns {Promise<boolean>} True if removed, false if not found
   */
  async removeDevice(deviceId) {
    throw new Error('removeDevice() must be implemented by subclass');
  }

  /**
   * Validate token for a device
   * @param {string} deviceId - Device identifier
   * @param {string} token - Token to validate
   * @returns {Promise<boolean>} True if token is valid, false if invalid
   */
  async validateToken(deviceId, token) {
    throw new Error('validateToken() must be implemented by subclass');
  }

  /**
   * Check if device is registered
   * @param {string} deviceId - Device identifier
   * @returns {Promise<boolean>} True if registered, false if not
   */
  async isRegistered(deviceId) {
    throw new Error('isRegistered() must be implemented by subclass');
  }

  /**
   * Get all registrations
   * @returns {Promise<Array>} Array of registration records
   */
  async getAllRegistrations() {
    throw new Error('getAllRegistrations() must be implemented by subclass');
  }

  /**
   * Get registration count
   * @returns {Promise<number>} Number of registrations
   */
  async getRegistrationCount() {
    throw new Error('getRegistrationCount() must be implemented by subclass');
  }

  /**
   * Check if device is a dev client (web-client-*)
   * @param {string} deviceId - Device identifier
   * @returns {boolean} True if dev client, false if not
   */
  isDevClient(deviceId) {
    return deviceId && deviceId.startsWith('web-client-');
  }

  /**
   * Clear all registrations (for testing only)
   * @returns {Promise<void>}
   */
  async clear() {
    throw new Error('clear() must be implemented by subclass');
  }

  /**
   * Initialize the store (create database, schema, etc.)
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Close the store (close database connections, etc.)
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('close() must be implemented by subclass');
  }
}

module.exports = RegistrationStore;
