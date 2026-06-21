// SQLITE REGISTRATION STORE IMPLEMENTATION
// Phase F5-P1: Identity Architecture Implementation
// Purpose: SQLite-based persistent storage for device registrations
// Design: File-based database, no external dependencies, sufficient for 10,000 devices

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

/**
 * SQLiteRegistrationStore
 * 
 * SQLite implementation of RegistrationStore interface.
 * Provides persistent storage for device registrations using SQLite database.
 * 
 * Features:
 * - Persistent storage (survives backend/PM2/VPS restart)
 * - Token generation (once per device identity)
 * - Token validation
 * - Database indexing for performance
 * - WAL mode for write concurrency
 * 
 * Schema:
 * - registrations table with deviceId (PK), token, workerName, walletAddress, deviceType, firmwareVersion, registeredAt, lastSeen
 * - Index on token for fast validation
 */
class SQLiteRegistrationStore {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this.initialized = false;
  }

  /**
   * Initialize the store (create database, schema, etc.)
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(new Error(`Failed to open database: ${err.message}`));
        } else {
          this.createSchema()
            .then(() => {
              this.initialized = true;
              console.log(`[REGISTRATION_STORE] SQLite initialized: ${this.dbPath}`);
              resolve();
            })
            .catch(reject);
        }
      });
    });
  }

  /**
   * Create database schema
   * @returns {Promise<void>}
   */
  async createSchema() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS registrations (
          deviceId TEXT PRIMARY KEY,
          token TEXT NOT NULL,
          workerName TEXT,
          walletAddress TEXT,
          deviceType TEXT,
          firmwareVersion TEXT,
          registeredAt INTEGER NOT NULL,
          lastSeen INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_token ON registrations(token);
        CREATE INDEX IF NOT EXISTS idx_lastSeen ON registrations(lastSeen);
        PRAGMA journal_mode = WAL;
      `;
      this.db.exec(sql, (err) => {
        if (err) {
          reject(new Error(`Failed to create schema: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Register a device (or update existing registration)
   * @param {string} deviceId - Device identifier
   * @param {Object} metadata - Device metadata
   * @returns {Promise<Object>} Registration record
   */
  async registerDevice(deviceId, metadata = {}) {
    if (!deviceId || typeof deviceId !== 'string' || deviceId.length === 0) {
      throw new Error('Invalid deviceId');
    }

    const existing = await this.getDevice(deviceId);
    const now = Date.now();

    if (existing) {
      // Update existing registration (preserve token)
      const updates = {
        workerName: metadata.workerName !== undefined ? metadata.workerName : existing.workerName,
        walletAddress: metadata.walletAddress !== undefined ? metadata.walletAddress : existing.walletAddress,
        deviceType: metadata.deviceType !== undefined ? metadata.deviceType : existing.deviceType,
        firmwareVersion: metadata.firmwareVersion !== undefined ? metadata.firmwareVersion : existing.firmwareVersion,
        lastSeen: now
      };

      return await this.updateDevice(deviceId, updates);
    } else {
      // Create new registration (generate token)
      const token = metadata.token || crypto.randomBytes(32).toString('hex');
      
      return new Promise((resolve, reject) => {
        const sql = `
          INSERT INTO registrations (deviceId, token, workerName, walletAddress, deviceType, firmwareVersion, registeredAt, lastSeen)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        this.db.run(sql, [
          deviceId,
          token,
          metadata.workerName || null,
          metadata.walletAddress || null,
          metadata.deviceType || 'unknown',
          metadata.firmwareVersion || null,
          now,
          now
        ], function(err) {
          if (err) {
            reject(new Error(`Failed to register device: ${err.message}`));
          } else {
            resolve({
              deviceId,
              token,
              workerName: metadata.workerName || null,
              walletAddress: metadata.walletAddress || null,
              deviceType: metadata.deviceType || 'unknown',
              firmwareVersion: metadata.firmwareVersion || null,
              registeredAt: now,
              lastSeen: now
            });
          }
        });
      });
    }
  }

  /**
   * Get device registration
   * @param {string} deviceId - Device identifier
   * @returns {Promise<Object|null>} Registration record or null
   */
  async getDevice(deviceId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM registrations WHERE deviceId = ?';
      this.db.get(sql, [deviceId], (err, row) => {
        if (err) {
          reject(new Error(`Failed to get device: ${err.message}`));
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * Update device registration
   * @param {string} deviceId - Device identifier
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated registration record
   */
  async updateDevice(deviceId, updates = {}) {
    const existing = await this.getDevice(deviceId);
    if (!existing) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    const fields = [];
    const values = [];

    if (updates.workerName !== undefined) {
      fields.push('workerName = ?');
      values.push(updates.workerName);
    }
    if (updates.walletAddress !== undefined) {
      fields.push('walletAddress = ?');
      values.push(updates.walletAddress);
    }
    if (updates.deviceType !== undefined) {
      fields.push('deviceType = ?');
      values.push(updates.deviceType);
    }
    if (updates.firmwareVersion !== undefined) {
      fields.push('firmwareVersion = ?');
      values.push(updates.firmwareVersion);
    }
    if (updates.token !== undefined) {
      fields.push('token = ?');
      values.push(updates.token);
    }

    fields.push('lastSeen = ?');
    values.push(Date.now());
    values.push(deviceId);

    return new Promise((resolve, reject) => {
      const sql = `UPDATE registrations SET ${fields.join(', ')} WHERE deviceId = ?`;
      this.db.run(sql, values, (err) => {
        if (err) {
          reject(new Error(`Failed to update device: ${err.message}`));
        } else {
          this.getDevice(deviceId).then(resolve).catch(reject);
        }
      });
    });
  }

  /**
   * Remove device registration
   * @param {string} deviceId - Device identifier
   * @returns {Promise<boolean>} True if removed, false if not found
   */
  async removeDevice(deviceId) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM registrations WHERE deviceId = ?';
      this.db.run(sql, [deviceId], function(err) {
        if (err) {
          reject(new Error(`Failed to remove device: ${err.message}`));
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  /**
   * Validate token for a device
   * @param {string} deviceId - Device identifier
   * @param {string} token - Token to validate
   * @returns {Promise<boolean>} True if valid, false if invalid
   */
  async validateToken(deviceId, token) {
    try {
      const registration = await this.getDevice(deviceId);
      if (!registration) {
        return false;
      }
      return registration.token === token;
    } catch (err) {
      console.error(`[REGISTRATION_STORE] Token validation error: ${err.message}`);
      return false;
    }
  }

  /**
   * Check if device is registered
   * @param {string} deviceId - Device identifier
   * @returns {Promise<boolean>} True if registered, false if not
   */
  async isRegistered(deviceId) {
    try {
      const registration = await this.getDevice(deviceId);
      return registration !== null;
    } catch (err) {
      console.error(`[REGISTRATION_STORE] isRegistered error: ${err.message}`);
      return false;
    }
  }

  /**
   * Get all registrations
   * @returns {Promise<Array>} Array of registration records
   */
  async getAllRegistrations() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM registrations ORDER BY registeredAt DESC';
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(new Error(`Failed to get all registrations: ${err.message}`));
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get registration count
   * @returns {Promise<number>} Number of registrations
   */
  async getRegistrationCount() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT COUNT(*) as count FROM registrations';
      this.db.get(sql, [], (err, row) => {
        if (err) {
          reject(new Error(`Failed to get registration count: ${err.message}`));
        } else {
          resolve(row ? row.count : 0);
        }
      });
    });
  }

  /**
   * Clear all registrations (for testing only)
   * @returns {Promise<void>}
   */
  async clear() {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM registrations';
      this.db.run(sql, [], (err) => {
        if (err) {
          reject(new Error(`Failed to clear registrations: ${err.message}`));
        } else {
          console.log('[REGISTRATION_STORE] All registrations cleared');
          resolve();
        }
      });
    });
  }

  /**
   * Close the store (close database connection)
   * @returns {Promise<void>}
   */
  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(new Error(`Failed to close database: ${err.message}`));
          } else {
            console.log('[REGISTRATION_STORE] SQLite closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = SQLiteRegistrationStore;
