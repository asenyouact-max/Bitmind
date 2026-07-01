const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

// Database configuration
const DB_PATH = path.join(__dirname, '../../data/tokens.db');
let db = null;

/**
 * Initialize token manager and database
 */
function initialize() {
  try {
    // Ensure data directory exists
    const fs = require('fs');
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Open database
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    // Create tables
    createTables();

    console.log('[TokenManager] Initialized with database:', DB_PATH);
  } catch (error) {
    console.error('[TokenManager] Failed to initialize:', error.message);
    throw error;
  }
}

/**
 * Create database tables
 */
function createTables() {
  const createTokensTable = `
    CREATE TABLE IF NOT EXISTS tokens (
      token TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      worker_name TEXT,
      wallet_address TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      revoked INTEGER DEFAULT 0
    )
  `;

  const createDeviceIndex = `
    CREATE INDEX IF NOT EXISTS idx_device_id ON tokens(device_id)
  `;

  const createTokenIndex = `
    CREATE INDEX IF NOT EXISTS idx_token ON tokens(token)
  `;

  db.exec(createTokensTable);
  db.exec(createDeviceIndex);
  db.exec(createTokenIndex);

  console.log('[TokenManager] Database tables created/verified');
}

/**
 * Generate a cryptographically secure 32-byte hex token
 * @returns {string} 64-character hex string
 */
function generateToken() {
  const token = crypto.randomBytes(32).toString('hex');
  console.log('[TokenManager] Generated token:', token.substring(0, 16) + '...');
  return token;
}

/**
 * Store token in database
 * @param {string} deviceId - Device identifier
 * @param {string} token - Token to store
 * @param {string} workerName - Worker name
 * @param {string} walletAddress - Wallet address
 * @returns {boolean} Success status
 */
function storeToken(deviceId, token, workerName, walletAddress) {
  try {
    const now = Date.now();
    const stmt = db.prepare(`
      INSERT INTO tokens (token, device_id, worker_name, wallet_address, created_at, expires_at, revoked)
      VALUES (?, ?, ?, ?, ?, NULL, 0)
    `);

    stmt.run(token, deviceId, workerName, walletAddress, now);

    console.log('[TokenManager] Token stored for device:', deviceId);
    return true;
  } catch (error) {
    console.error('[TokenManager] Failed to store token:', error.message);
    return false;
  }
}

/**
 * Validate token and return device information
 * @param {string} token - Token to validate
 * @returns {Object|null} Device information or null if invalid
 */
function validateToken(token) {
  try {
    const stmt = db.prepare(`
      SELECT device_id, worker_name, wallet_address, created_at, expires_at, revoked
      FROM tokens
      WHERE token = ?
    `);

    const row = stmt.get(token);

    if (!row) {
      console.log('[TokenManager] Token not found:', token.substring(0, 16) + '...');
      return null;
    }

    // Check if revoked
    if (row.revoked === 1) {
      console.log('[TokenManager] Token revoked:', token.substring(0, 16) + '...');
      return null;
    }

    // Check if expired
    if (row.expires_at && row.expires_at < Date.now()) {
      console.log('[TokenManager] Token expired:', token.substring(0, 16) + '...');
      return null;
    }

    console.log('[TokenManager] Token validated for device:', row.device_id);
    return {
      deviceId: row.device_id,
      workerName: row.worker_name,
      walletAddress: row.wallet_address,
      createdAt: row.created_at
    };
  } catch (error) {
    console.error('[TokenManager] Failed to validate token:', error.message);
    return null;
  }
}

/**
 * Get device by token
 * @param {string} token - Token to lookup
 * @returns {Object|null} Device information or null if not found
 */
function getDeviceByToken(token) {
  return validateToken(token);
}

/**
 * Check if device is already registered
 * @param {string} deviceId - Device identifier
 * @returns {boolean} Registration status
 */
function isDeviceRegistered(deviceId) {
  try {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM tokens
      WHERE device_id = ? AND revoked = 0
    `);

    const row = stmt.get(deviceId);
    return row.count > 0;
  } catch (error) {
    console.error('[TokenManager] Failed to check device registration:', error.message);
    return false;
  }
}

/**
 * Get existing token for device
 * @param {string} deviceId - Device identifier
 * @returns {string|null} Token or null if not found
 */
function getDeviceToken(deviceId) {
  try {
    const stmt = db.prepare(`
      SELECT token
      FROM tokens
      WHERE device_id = ? AND revoked = 0
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const row = stmt.get(deviceId);
    return row ? row.token : null;
  } catch (error) {
    console.error('[TokenManager] Failed to get device token:', error.message);
    return null;
  }
}

/**
 * Revoke token
 * @param {string} token - Token to revoke
 * @returns {boolean} Success status
 */
function revokeToken(token) {
  try {
    const stmt = db.prepare(`
      UPDATE tokens
      SET revoked = 1
      WHERE token = ?
    `);

    stmt.run(token);
    console.log('[TokenManager] Token revoked:', token.substring(0, 16) + '...');
    return true;
  } catch (error) {
    console.error('[TokenManager] Failed to revoke token:', error.message);
    return false;
  }
}

/**
 * Get token statistics
 * @returns {Object} Statistics
 */
function getStats() {
  try {
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM tokens');
    const activeStmt = db.prepare('SELECT COUNT(*) as count FROM tokens WHERE revoked = 0');
    const revokedStmt = db.prepare('SELECT COUNT(*) as count FROM tokens WHERE revoked = 1');

    const total = totalStmt.get().count;
    const active = activeStmt.get().count;
    const revoked = revokedStmt.get().count;

    return {
      total,
      active,
      revoked
    };
  } catch (error) {
    console.error('[TokenManager] Failed to get stats:', error.message);
    return { total: 0, active: 0, revoked: 0 };
  }
}

/**
 * Shutdown token manager
 */
function shutdown() {
  console.log('[TokenManager] Shutting down...');
  if (db) {
    db.close();
    db = null;
  }
  console.log('[TokenManager] Shutdown complete');
}

module.exports = {
  initialize,
  generateToken,
  storeToken,
  validateToken,
  getDeviceByToken,
  isDeviceRegistered,
  getDeviceToken,
  revokeToken,
  getStats,
  shutdown
};
