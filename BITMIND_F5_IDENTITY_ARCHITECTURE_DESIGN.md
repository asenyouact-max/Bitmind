# BITMIND F5-P0 IDENTITY ARCHITECTURE DESIGN

**Phase:** F5-P0 - Identity Architecture Design  
**Date:** 2026-06-21  
**Status:** DESIGN DOCUMENT  
**Purpose:** Design production device identity architecture for Bitmind

---

## EXECUTIVE SUMMARY

**Design Goal:** Create a scalable, persistent, secure device identity architecture that supports 10,000+ devices without future architectural rewrites.

**Primary Recommendation:**
- **Phase A:** SQLite with RegistrationStore abstraction
- **Phase B:** PostgreSQL with same abstraction
- **Phase C:** Distributed cache (Redis) + PostgreSQL

**Key Design Principles:**
1. **Abstraction First:** RegistrationStore interface allows storage replacement without protocol changes
2. **Persistence Required:** All registrations must survive backend/PM2/VPS restart
3. **Token Validation:** Token must be validated on every connection
4. **Minimal Security:** Prevent spoofing without enterprise overengineering
5. **Scalable by Design:** Architecture supports 10,000+ devices from Phase A

**Storage Recommendation:** SQLite for Phase A (simple, file-based, no external dependencies)

---

## SECTION 1: CURRENT STATE ANALYSIS

### 1.1 Current Identity Architecture

**Components:**
- **DeviceRegistry:** In-memory Map (deviceId → registration)
- **state/index.js:** In-memory Map (deviceId → runtime state)
- **Firmware Preferences:** NV storage (configuration, token)

**Identity Model:**
- **deviceId:** MAC-based (esp32-XXXX)
- **token:** Generated on every WebSocket connection (not validated)
- **registration:** In-memory only (lost on restart)

### 1.2 Weaknesses

**Weakness 1: No Persistence (CRITICAL)**
- DeviceRegistry is in-memory Map
- All registrations lost on backend restart
- All registrations lost on PM2 restart
- All registrations lost on VPS reboot
- **Impact:** No persistent device identity

**Weakness 2: No Token Validation (CRITICAL)**
- Token generated on every WebSocket connection
- Token not validated on any connection
- Token not used for authentication
- **Impact:** Spoofing possible

**Weakness 3: Token Instability (HIGH)**
- Token changes on every WebSocket connection
- handlers.js generates new token on line 196
- Firmware overwrites token on every reconnection
- **Impact:** No stable identity

**Weakness 4: No DeviceId Authentication (HIGH)**
- deviceId not validated beyond format check
- deviceId can be spoofed
- No mechanism to prevent identity collision
- **Impact:** Spoofing possible

**Weakness 5: No Cloning Protection (HIGH)**
- Firmware can be cloned to another ESP32
- Cloned device has same deviceId
- Backend accepts cloned device
- **Impact:** Cloning attacks possible

### 1.3 Failure Modes

**Failure Mode 1: Backend Restart**
- DeviceRegistry cleared
- All registrations lost
- All devices must re-register
- **Severity:** CRITICAL

**Failure Mode 2: PM2 Restart**
- DeviceRegistry cleared
- All registrations lost
- All devices must re-register
- **Severity:** CRITICAL

**Failure Mode 3: VPS Reboot**
- DeviceRegistry cleared
- All registrations lost
- All devices must re-register
- **Severity:** CRITICAL

**Failure Mode 4: WebSocket Reconnection**
- Token regenerated
- Firmware token overwritten
- Identity changes
- **Severity:** HIGH

**Failure Mode 5: Firmware Cloning**
- Cloned device accepted
- Original device loses identity
- **Severity:** HIGH

### 1.4 Security Issues

**Security Issue 1: Spoofing (HIGH)**
- Any device can claim any deviceId
- No token validation
- No authentication mechanism
- **Risk:** Identity theft

**Security Issue 2: Cloning (HIGH)**
- Firmware can be cloned
- Cloned device accepted
- No detection mechanism
- **Risk:** Device duplication

**Security Issue 3: Token Replay (MEDIUM)**
- Token not validated
- Token changes on every connection
- Replay not possible due to instability
- **Risk:** LOW (token instability prevents replay)

### 1.5 Scalability Issues

**Scalability Issue 1: In-Memory Storage (CRITICAL)**
- DeviceRegistry limited by RAM
- No horizontal scaling
- No persistence
- **Limit:** ~1,000 devices (RAM constraint)

**Scalability Issue 2: No Caching (MEDIUM)**
- Every connection requires full registration lookup
- No caching layer
- **Limit:** ~100 devices (latency constraint)

**Scalability Issue 3: No Indexing (MEDIUM)**
- Linear search in Map
- No database indexing
- **Limit:** ~1,000 devices (performance constraint)

---

## SECTION 2: IDENTITY MODEL

### 2.1 Production Identity Model

**Model:** deviceId + token + registration persistence

**Components:**

**deviceId**
- **Format:** esp32-[a-f0-9]{4,12} (hardware), virtual-[a-f0-9]{16} (virtual)
- **Source:** MAC address (hardware), random generation (virtual)
- **Purpose:** Device identifier
- **Persistence:** Firmware NV storage (hardware), backend database (virtual)
- **Validation:** Format validation only (Phase A), hardware fingerprinting (Phase B+)

**token**
- **Format:** 32-byte hex (64 hex characters)
- **Source:** Backend generation on first registration
- **Purpose:** Authentication secret
- **Persistence:** Backend database, firmware NV storage
- **Validation:** Required on every WebSocket connection
- **Lifecycle:** Generated once, preserved across reconnections

**registration**
- **Format:** Database record
- **Source:** Backend database
- **Purpose:** Persistent device identity
- **Persistence:** Backend database
- **Fields:** deviceId, token, workerName, walletAddress, deviceType, firmwareVersion, registeredAt, lastSeen

**ownership**
- **Model:** Backend owns token, firmware owns configuration
- **Sync:** Firmware → backend (workerName, walletAddress via device.register)
- **Authority:** Backend is single source of truth for identity

**authentication**
- **Method:** Token-based authentication
- **Validation:** Token validated on every WebSocket connection
- **Fallback:** deviceId format validation (Phase A only)

### 2.2 Lifecycle Diagrams

**First Registration:**
```
Device Boot
↓
Enter AP Mode
↓
User Configures WiFi, WorkerName, WalletAddress
↓
Device Connects to WebSocket
↓
Send device.register (deviceId, workerName, walletAddress)
↓
Backend: Check RegistrationStore
↓
Not Registered: Create Registration
↓
Generate Token (32-byte hex)
↓
Store Registration (deviceId, token, workerName, walletAddress)
↓
Send device.registered (token)
↓
Firmware: Store Token in Preferences
↓
Device Active
```

**Reconnect:**
```
Device Reconnects to WebSocket
↓
Send device.register (deviceId, workerName, walletAddress)
↓
Backend: Check RegistrationStore
↓
Registered: Validate Token
↓
Token Valid: Send device.registered (existing token)
↓
Firmware: Verify Token Matches Stored Token
↓
Token Matches: Device Active
↓
Token Mismatch: Reject Connection
```

**Firmware Reboot:**
```
Device Reboots
↓
Load Configuration from Preferences
↓
Load Token from Preferences
↓
Connect to WebSocket
↓
Send device.register (deviceId, workerName, walletAddress)
↓
Backend: Check RegistrationStore
↓
Registered: Validate Token
↓
Token Valid: Send device.registered (existing token)
↓
Firmware: Verify Token Matches Stored Token
↓
Token Matches: Device Active
```

**Backend Restart:**
```
Backend Restarts
↓
Load RegistrationStore from Database
↓
All Registrations Preserved
↓
Device Reconnects to WebSocket
↓
Send device.register (deviceId, workerName, walletAddress)
↓
Backend: Check RegistrationStore
↓
Registered: Validate Token
↓
Token Valid: Send device.registered (existing token)
↓
Firmware: Verify Token Matches Stored Token
↓
Token Matches: Device Active
```

**Factory Reset:**
```
Factory Reset Triggered
↓
Firmware: Clear Preferences
↓
Clear Token
↓
Clear WiFi, WorkerName, WalletAddress
↓
Device Reboots
↓
Enter AP Mode
↓
User Reconfigures Device
↓
Connect to WebSocket
↓
Send device.register (deviceId, workerName, walletAddress)
↓
Backend: Check RegistrationStore
↓
Registered: Validate Token
↓
Token Invalid (cleared): Generate New Token
↓
Update Registration (new token, new workerName, new walletAddress)
↓
Send device.registered (new token)
↓
Firmware: Store New Token in Preferences
↓
Device Active (New Identity)
```

**Device Replacement:**
```
Old Device Removed
↓
New Device Installed
↓
New Device Has Different MAC Address
↓
New Device Has Different deviceId
↓
New Device Connects to WebSocket
↓
Send device.register (new deviceId, workerName, walletAddress)
↓
Backend: Check RegistrationStore
↓
Not Registered: Create New Registration
↓
Generate New Token
↓
Store New Registration
↓
Send device.registered (new token)
↓
Firmware: Store New Token in Preferences
↓
Device Active (New Identity)
```

---

## SECTION 3: REGISTRATION PERSISTENCE

### 3.1 Storage Options Evaluation

**Option A: JSON Store**
- **Pros:** Simple, human-readable, no dependencies
- **Cons:** No indexing, no transactions, poor performance at scale
- **Scalability:** ~100 devices
- **Recommendation:** ❌ NOT SUITABLE

**Option B: SQLite**
- **Pros:** File-based, SQL support, indexing, transactions, no external dependencies
- **Cons:** Single-file lock, limited write concurrency
- **Scalability:** ~10,000 devices
- **Recommendation:** ✅ PHASE A

**Option C: PostgreSQL**
- **Pros:** Full SQL, indexing, transactions, high concurrency, replication
- **Cons:** External dependency, complex setup
- **Scalability:** ~100,000+ devices
- **Recommendation:** ✅ PHASE B+

**Option D: Redis**
- **Pros:** In-memory, high performance, pub/sub
- **Cons:** No persistence by default, complex data structures
- **Scalability:** ~10,000+ devices (with persistence)
- **Recommendation:** ⚠️ PHASE C (cache layer only)

### 3.2 Phase A Implementation: SQLite

**Database Schema:**
```sql
CREATE TABLE registrations (
  deviceId TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  workerName TEXT,
  walletAddress TEXT,
  deviceType TEXT,
  firmwareVersion TEXT,
  registeredAt INTEGER NOT NULL,
  lastSeen INTEGER NOT NULL,
  INDEX (token)
);
```

**File Location:** `server/data/registrations.db`

**Backup Strategy:** 
- Daily backup to `server/data/registrations.db.backup`
- Retain 7 days of backups

**Migration Strategy:**
- On startup, check if database exists
- If not, create database and schema
- If yes, load existing registrations

### 3.3 Future Scaling Path

**Phase A (Current): SQLite**
- **Scale:** 10 devices → 1,000 devices
- **Storage:** Single file
- **Backup:** File copy
- **Migration:** Export to PostgreSQL

**Phase B (Medium Scale): PostgreSQL**
- **Scale:** 1,000 devices → 10,000 devices
- **Storage:** PostgreSQL database
- **Backup:** pg_dump
- **Migration:** Same schema, different backend

**Phase C (Large Scale): Redis + PostgreSQL**
- **Scale:** 10,000 devices → 100,000+ devices
- **Storage:** Redis (cache) + PostgreSQL (persistence)
- **Backup:** Redis RDB + pg_dump
- **Migration:** Same RegistrationStore interface

### 3.4 Recommendation

**Phase A:** SQLite
- Simple implementation
- No external dependencies
- File-based backup
- Sufficient for 10,000 devices
- Easy migration to PostgreSQL

**Future:** PostgreSQL
- When scaling beyond 10,000 devices
- Same RegistrationStore interface
- No protocol changes
- No firmware changes

---

## SECTION 4: REGISTRATION STORE ABSTRACTION

### 4.1 RegistrationStore Interface

```javascript
// server/services/registrationStore.js

class RegistrationStore {
  /**
   * Register a device (or update existing registration)
   * @param {string} deviceId - Device identifier
   * @param {Object} metadata - Device metadata
   * @returns {Promise<Object>} Registration record
   */
  async registerDevice(deviceId, metadata) {
    throw new Error('Not implemented');
  }

  /**
   * Get device registration
   * @param {string} deviceId - Device identifier
   * @returns {Promise<Object|null>} Registration record or null
   */
  async getDevice(deviceId) {
    throw new Error('Not implemented');
  }

  /**
   * Update device registration
   * @param {string} deviceId - Device identifier
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated registration record
   */
  async updateDevice(deviceId, updates) {
    throw new Error('Not implemented');
  }

  /**
   * Remove device registration
   * @param {string} deviceId - Device identifier
   * @returns {Promise<boolean>} True if removed, false if not found
   */
  async removeDevice(deviceId) {
    throw new Error('Not implemented');
  }

  /**
   * Validate token
   * @param {string} deviceId - Device identifier
   * @param {string} token - Token to validate
   * @returns {Promise<boolean>} True if valid, false if invalid
   */
  async validateToken(deviceId, token) {
    throw new Error('Not implemented');
  }

  /**
   * Check if device is registered
   * @param {string} deviceId - Device identifier
   * @returns {Promise<boolean>} True if registered, false if not
   */
  async isRegistered(deviceId) {
    throw new Error('Not implemented');
  }

  /**
   * Get all registrations
   * @returns {Promise<Array>} Array of registration records
   */
  async getAllRegistrations() {
    throw new Error('Not implemented');
  }

  /**
   * Get registration count
   * @returns {Promise<number>} Number of registrations
   */
  async getRegistrationCount() {
    throw new Error('Not implemented');
  }

  /**
   * Clear all registrations (for testing)
   * @returns {Promise<void>}
   */
  async clear() {
    throw new Error('Not implemented');
  }
}

module.exports = RegistrationStore;
```

### 4.2 SQLite Implementation

```javascript
// server/services/registrationStore/sqlite.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

class SQLiteRegistrationStore extends RegistrationStore {
  constructor(dbPath) {
    super();
    this.dbPath = dbPath;
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          this.createSchema().then(resolve).catch(reject);
        }
      });
    });
  }

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
      `;
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async registerDevice(deviceId, metadata = {}) {
    return new Promise((resolve, reject) => {
      const existing = await this.getDevice(deviceId);
      const now = Date.now();
      
      if (existing) {
        // Update existing registration
        const sql = `
          UPDATE registrations
          SET workerName = ?, walletAddress = ?, deviceType = ?, firmwareVersion = ?, lastSeen = ?
          WHERE deviceId = ?
        `;
        this.db.run(sql, [
          metadata.workerName || existing.workerName,
          metadata.walletAddress || existing.walletAddress,
          metadata.deviceType || existing.deviceType,
          metadata.firmwareVersion || existing.firmwareVersion,
          now,
          deviceId
        ], (err) => {
          if (err) reject(err);
          else resolve({ ...existing, ...metadata, lastSeen: now });
        });
      } else {
        // Create new registration
        const token = metadata.token || crypto.randomBytes(32).toString('hex');
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
        ], (err) => {
          if (err) reject(err);
          else resolve({
            deviceId,
            token,
            workerName: metadata.workerName || null,
            walletAddress: metadata.walletAddress || null,
            deviceType: metadata.deviceType || 'unknown',
            firmwareVersion: metadata.firmwareVersion || null,
            registeredAt: now,
            lastSeen: now
          });
        });
      }
    });
  }

  async getDevice(deviceId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM registrations WHERE deviceId = ?';
      this.db.get(sql, [deviceId], (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }

  async updateDevice(deviceId, updates) {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = fields.map(f => `${f} = ?`).join(', ');
      const sql = `UPDATE registrations SET ${setClause}, lastSeen = ? WHERE deviceId = ?`;
      
      this.db.run(sql, [...values, Date.now(), deviceId], (err) => {
        if (err) reject(err);
        else this.getDevice(deviceId).then(resolve).catch(reject);
      });
    });
  }

  async removeDevice(deviceId) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM registrations WHERE deviceId = ?';
      this.db.run(sql, [deviceId], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  async validateToken(deviceId, token) {
    const registration = await this.getDevice(deviceId);
    return registration && registration.token === token;
  }

  async isRegistered(deviceId) {
    const registration = await this.getDevice(deviceId);
    return registration !== null;
  }

  async getAllRegistrations() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM registrations';
      this.db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async getRegistrationCount() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT COUNT(*) as count FROM registrations';
      this.db.get(sql, [], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.count : 0);
      });
    });
  }

  async clear() {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM registrations';
      this.db.run(sql, [], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = SQLiteRegistrationStore;
```

### 4.3 PostgreSQL Implementation (Future)

```javascript
// server/services/registrationStore/postgresql.js

const { Pool } = require('pg');
const crypto = require('crypto');

class PostgreSQLRegistrationStore extends RegistrationStore {
  constructor(connectionString) {
    super();
    this.pool = new Pool({ connectionString });
  }

  async initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        deviceId TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        workerName TEXT,
        walletAddress TEXT,
        deviceType TEXT,
        firmwareVersion TEXT,
        registeredAt BIGINT NOT NULL,
        lastSeen BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_token ON registrations(token);
    `);
  }

  async registerDevice(deviceId, metadata = {}) {
    const existing = await this.getDevice(deviceId);
    const now = Date.now();
    
    if (existing) {
      await this.pool.query(
        `UPDATE registrations 
         SET workerName = $1, walletAddress = $2, deviceType = $3, firmwareVersion = $4, lastSeen = $5 
         WHERE deviceId = $6`,
        [metadata.workerName || existing.workerName, metadata.walletAddress || existing.walletAddress, metadata.deviceType || existing.deviceType, metadata.firmwareVersion || existing.firmwareVersion, now, deviceId]
      );
      return { ...existing, ...metadata, lastSeen: now };
    } else {
      const token = metadata.token || crypto.randomBytes(32).toString('hex');
      await this.pool.query(
        `INSERT INTO registrations (deviceId, token, workerName, walletAddress, deviceType, firmwareVersion, registeredAt, lastSeen)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [deviceId, token, metadata.workerName || null, metadata.walletAddress || null, metadata.deviceType || 'unknown', metadata.firmwareVersion || null, now, now]
      );
      return {
        deviceId,
        token,
        workerName: metadata.workerName || null,
        walletAddress: metadata.walletAddress || null,
        deviceType: metadata.deviceType || 'unknown',
        firmwareVersion: metadata.firmwareVersion || null,
        registeredAt: now,
        lastSeen: now
      };
    }
  }

  async getDevice(deviceId) {
    const result = await this.pool.query('SELECT * FROM registrations WHERE deviceId = $1', [deviceId]);
    return result.rows[0] || null;
  }

  async updateDevice(deviceId, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    await this.pool.query(
      `UPDATE registrations SET ${setClause}, lastSeen = $${fields.length + 1} WHERE deviceId = $${fields.length + 2}`,
      [...values, Date.now(), deviceId]
    );
    return this.getDevice(deviceId);
  }

  async removeDevice(deviceId) {
    const result = await this.pool.query('DELETE FROM registrations WHERE deviceId = $1', [deviceId]);
    return result.rowCount > 0;
  }

  async validateToken(deviceId, token) {
    const registration = await this.getDevice(deviceId);
    return registration && registration.token === token;
  }

  async isRegistered(deviceId) {
    const registration = await this.getDevice(deviceId);
    return registration !== null;
  }

  async getAllRegistrations() {
    const result = await this.pool.query('SELECT * FROM registrations');
    return result.rows;
  }

  async getRegistrationCount() {
    const result = await this.pool.query('SELECT COUNT(*) as count FROM registrations');
    return parseInt(result.rows[0].count);
  }

  async clear() {
    await this.pool.query('DELETE FROM registrations');
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = PostgreSQLRegistrationStore;
```

### 4.4 Usage in handlers.js

```javascript
// server/ws/handlers.js

const RegistrationStore = require('../services/registrationStore');

// Initialize store
const registrationStore = new SQLiteRegistrationStore('./server/data/registrations.db');
await registrationStore.initialize();

// In register handler:
const registration = await registrationStore.getDevice(deviceId);
if (!registration) {
  // Auto-register ESP32 devices
  if (isEsp32Device) {
    registration = await registrationStore.registerDevice(deviceId, {
      deviceType: data.deviceType || 'miner',
      workerName: data.workerName,
      walletAddress: data.walletAddress,
      firmwareVersion: data.firmwareVersion
    });
  } else {
    // Reject unregistered non-ESP32 devices
    return false;
  }
}

// Validate token (optional for Phase A, required for Phase B+)
const tokenValid = await registrationStore.validateToken(deviceId, data.token);
if (!tokenValid) {
  // Reject invalid token
  return false;
}

// Use existing token
const token = registration.token;
```

---

## SECTION 5: TOKEN LIFECYCLE

### 5.1 Complete Token Lifecycle

**First Registration:**
```
Device sends device.register (no token)
↓
Backend: Check RegistrationStore
↓
Not registered: Create registration
↓
Generate token (32-byte hex)
↓
Store token in RegistrationStore
↓
Send device.registered (token)
↓
Firmware: Store token in Preferences
↓
Token lifecycle: CREATED
```

**Reconnect:**
```
Device sends device.register (no token in payload)
↓
Backend: Check RegistrationStore
↓
Registered: Get existing token
↓
Validate token (optional Phase A, required Phase B+)
↓
Send device.registered (existing token)
↓
Firmware: Verify token matches stored token
↓
Token lifecycle: PRESERVED
```

**Firmware Reboot:**
```
Device reboots
↓
Firmware: Load token from Preferences
↓
Device sends device.register (no token in payload)
↓
Backend: Check RegistrationStore
↓
Registered: Get existing token
↓
Send device.registered (existing token)
↓
Firmware: Verify token matches stored token
↓
Token lifecycle: PRESERVED
```

**Backend Restart:**
```
Backend restarts
↓
RegistrationStore: Load from database
↓
All registrations preserved
↓
Device reconnects
↓
Device sends device.register (no token in payload)
↓
Backend: Check RegistrationStore
↓
Registered: Get existing token
↓
Send device.registered (existing token)
↓
Firmware: Verify token matches stored token
↓
Token lifecycle: PRESERVED
```

**PM2 Restart:**
```
PM2 restarts backend
↓
RegistrationStore: Load from database
↓
All registrations preserved
↓
Device reconnects
↓
Device sends device.register (no token in payload)
↓
Backend: Check RegistrationStore
↓
Registered: Get existing token
↓
Send device.registered (existing token)
↓
Firmware: Verify token matches stored token
↓
Token lifecycle: PRESERVED
```

**VPS Reboot:**
```
VPS reboots
↓
Backend process killed
↓
Backend restarts
↓
RegistrationStore: Load from database
↓
All registrations preserved
↓
Device reconnects
↓
Device sends device.register (no token in payload)
↓
Backend: Check RegistrationStore
↓
Registered: Get existing token
↓
Send device.registered (existing token)
↓
Firmware: Verify token matches stored token
↓
Token lifecycle: PRESERVED
```

**Factory Reset:**
```
Factory reset triggered
↓
Firmware: Clear Preferences
↓
Token cleared
↓
Device reboots
↓
Device enters AP mode
↓
User reconfigures device
↓
Device sends device.register (no token in payload)
↓
Backend: Check RegistrationStore
↓
Registered: Get existing token
↓
Token mismatch (firmware token cleared)
↓
Generate new token
↓
Update registration (new token, new workerName, new walletAddress)
↓
Send device.registered (new token)
↓
Firmware: Store new token in Preferences
↓
Token lifecycle: ROTATED
```

**Device Replacement:**
```
Old device removed
↓
New device installed
↓
New device has different MAC address
↓
New device has different deviceId
↓
Device sends device.register (new deviceId)
↓
Backend: Check RegistrationStore
↓
Not registered: Create new registration
↓
Generate new token
↓
Store new registration
↓
Send device.registered (new token)
↓
Firmware: Store new token in Preferences
↓
Token lifecycle: NEW IDENTITY
```

### 5.2 Token Validation Strategy

**Phase A: Optional Validation**
- Token generated once per device identity
- Token preserved across reconnections
- Token validation optional (logging only)
- **Reason:** Allow migration from old firmware

**Phase B: Required Validation**
- Token generated once per device identity
- Token preserved across reconnections
- Token validation required
- Invalid tokens rejected
- **Reason:** Prevent spoofing

**Phase C: Token Rotation**
- Token generated once per device identity
- Token preserved across reconnections
- Token validation required
- Token rotation on factory reset
- **Reason:** Enhanced security

---

## SECTION 6: DEVICE CLONING

### 6.1 Cloning Scenario

**Scenario:** Firmware cloned to second ESP32

**Current Behavior:**
- Cloned device has same deviceId (MAC-based)
- Cloned device connects to WebSocket
- Backend accepts cloned device
- Original device loses identity
- **Risk:** HIGH

### 6.2 Expected Behavior

**Phase A: Accept Both (No Protection)**
- Both devices accepted
- Last connection wins
- **Reason:** Simple implementation, no cloning protection

**Phase B: Reject Duplicate (Basic Protection)**
- Detect duplicate deviceId
- Reject second connection
- Log warning
- **Reason:** Basic cloning protection

**Phase C: Hardware Fingerprinting (Advanced Protection)**
- Collect hardware fingerprint (WiFi MAC, ESP32 chip ID, flash size)
- Store fingerprint in registration
- Validate fingerprint on connection
- Reject mismatched fingerprints
- **Reason:** Advanced cloning protection

### 6.3 Recommended Protection

**Phase A: No Protection**
- Accept cloning
- Log warnings
- **Reason:** Simple implementation

**Phase B: Duplicate Detection**
- Track active connections per deviceId
- Reject second connection
- Log security event
- **Reason:** Basic protection

**Phase C: Hardware Fingerprinting**
- Collect hardware fingerprint
- Validate fingerprint on connection
- Reject mismatched fingerprints
- **Reason:** Advanced protection

### 6.4 Implementation (Phase B)

```javascript
// server/ws/handlers.js

const activeConnections = new Map(); // deviceId -> Set of socket IDs

// In register handler:
const deviceId = data.deviceId;
const socketId = ws.id;

if (activeConnections.has(deviceId)) {
  const existingSockets = activeConnections.get(deviceId);
  if (existingSockets.size > 0) {
    console.log("[WS] DUPLICATE_DEVICE deviceId=" + deviceId + " reason=CLONING_DETECTED");
    const errorMsg = deviceGateway.createDeviceError('AUTH_DUPLICATE', 'Device already connected - possible cloning');
    ws.send(JSON.stringify(errorMsg));
    return false;
  }
}

activeConnections.set(deviceId, new Set([socketId]));

// In disconnect handler:
if (activeConnections.has(deviceId)) {
  const sockets = activeConnections.get(deviceId);
  sockets.delete(socketId);
  if (sockets.size === 0) {
    activeConnections.delete(deviceId);
  }
}
```

---

## SECTION 7: SECURITY MODEL

### 7.1 Minimal Production Security Model

**Principles:**
- Prevent spoofing
- Validate identity
- Maintain simplicity
- Avoid enterprise overengineering

### 7.2 Security Layers

**Layer 1: DeviceId Format Validation**
- Validate deviceId format (esp32-[a-f0-9]{4,12}, virtual-[a-f0-9]{16})
- Reject invalid formats
- **Implementation:** deviceGateway.js

**Layer 2: Token Validation**
- Validate token on every WebSocket connection
- Reject invalid tokens
- **Implementation:** handlers.js + RegistrationStore

**Layer 3: Duplicate Detection**
- Detect duplicate deviceId connections
- Reject second connection
- **Implementation:** handlers.js

**Layer 4: Hardware Fingerprinting (Phase C)**
- Collect hardware fingerprint
- Validate fingerprint on connection
- Reject mismatched fingerprints
- **Implementation:** firmware + backend

### 7.3 Threat Model

**Threat 1: Spoofing**
- **Attack:** Attacker claims arbitrary deviceId
- **Mitigation:** Token validation
- **Severity:** HIGH → LOW (with token validation)

**Threat 2: Cloning**
- **Attack:** Attacker clones firmware to another ESP32
- **Mitigation:** Duplicate detection, hardware fingerprinting
- **Severity:** HIGH → MEDIUM (with duplicate detection)

**Threat 3: Token Replay**
- **Attack:** Attacker replays captured token
- **Mitigation:** Token validation, token rotation
- **Severity:** MEDIUM → LOW (with token validation)

**Threat 4: Man-in-the-Middle**
- **Attack:** Attacker intercepts WebSocket connection
- **Mitigation:** TLS (already implemented)
- **Severity:** LOW (TLS protects)

### 7.4 Security Recommendations

**Phase A:**
- Implement token validation (optional logging)
- Implement duplicate detection (logging only)
- **Reason:** Allow migration, basic protection

**Phase B:**
- Implement token validation (required)
- Implement duplicate detection (required)
- **Reason:** Production security

**Phase C:**
- Implement hardware fingerprinting
- Implement token rotation
- **Reason:** Enhanced security

---

## SECTION 8: SCALABILITY MODEL

### 8.1 10 Devices

**Load:**
- 10 WebSocket connections
- 10 registrations in database
- 10 registrations per minute

**Performance:**
- SQLite: Excellent
- PostgreSQL: Excellent
- Redis: Excellent

**Bottlenecks:** None

**Phase A:** ✅ SUFFICIENT

---

### 8.2 100 Devices

**Load:**
- 100 WebSocket connections
- 100 registrations in database
- 100 registrations per minute

**Performance:**
- SQLite: Excellent
- PostgreSQL: Excellent
- Redis: Excellent

**Bottlenecks:** None

**Phase A:** ✅ SUFFICIENT

---

### 8.3 1,000 Devices

**Load:**
- 1,000 WebSocket connections
- 1,000 registrations in database
- 1,000 registrations per minute

**Performance:**
- SQLite: Good (single-file lock may be bottleneck)
- PostgreSQL: Excellent
- Redis: Excellent

**Bottlenecks:** SQLite write concurrency

**Phase A:** ⚠️ MAY NEED OPTIMIZATION
- Consider write batching
- Consider connection pooling

**Phase B:** ✅ RECOMMENDED

---

### 8.4 10,000 Devices

**Load:**
- 10,000 WebSocket connections
- 10,000 registrations in database
- 10,000 registrations per minute

**Performance:**
- SQLite: Poor (single-file lock is bottleneck)
- PostgreSQL: Good
- Redis: Excellent

**Bottlenecks:** SQLite write concurrency, database query performance

**Phase A:** ❌ INSUFFICIENT
- Single-file lock limits write concurrency
- No horizontal scaling

**Phase B:** ✅ RECOMMENDED
- PostgreSQL handles 10,000 devices
- Indexing improves query performance
- Connection pooling improves concurrency

**Phase C:** ✅ OPTIMAL
- Redis cache reduces database load
- PostgreSQL handles persistence
- Horizontal scaling possible

---

### 8.5 Scaling Limits

**SQLite:**
- **Read Operations:** ~10,000/sec
- **Write Operations:** ~100/sec (single-file lock)
- **Max Devices:** ~1,000
- **Bottleneck:** Write concurrency

**PostgreSQL:**
- **Read Operations:** ~100,000/sec
- **Write Operations:** ~10,000/sec
- **Max Devices:** ~100,000
- **Bottleneck:** Database size, query complexity

**Redis:**
- **Read Operations:** ~1,000,000/sec
- **Write Operations:** ~100,000/sec
- **Max Devices:** ~1,000,000
- **Bottleneck:** Memory size

---

## SECTION 9: MIGRATION PATH

### 9.1 Phase A: Simple Implementation

**Storage:** SQLite
**Scale:** 10 → 1,000 devices
**Features:**
- Registration persistence
- Token generation (once per device)
- Token validation (optional logging)
- Duplicate detection (logging only)

**Implementation:**
1. Create RegistrationStore interface
2. Implement SQLiteRegistrationStore
3. Replace DeviceRegistry with RegistrationStore
4. Update handlers.js to use RegistrationStore
5. Add token validation (optional)
6. Add duplicate detection (logging)

**Migration:** No migration needed (fresh implementation)

---

### 9.2 Phase B: Medium Scale

**Storage:** PostgreSQL
**Scale:** 1,000 → 10,000 devices
**Features:**
- Registration persistence
- Token generation (once per device)
- Token validation (required)
- Duplicate detection (required)

**Implementation:**
1. Implement PostgreSQLRegistrationStore
2. Migrate SQLite to PostgreSQL
3. Update configuration to use PostgreSQL
4. Enable token validation (required)
5. Enable duplicate detection (required)

**Migration:**
```bash
# Export SQLite to CSV
sqlite3 registrations.db .dump > registrations.sql

# Import to PostgreSQL
psql -U bitmind -d bitmind -f registrations.sql

# Update configuration
# server/config/production.json
{
  "registrationStore": {
    "type": "postgresql",
    "connectionString": "postgresql://user:password@localhost/bitmind"
  }
}
```

**Protocol Changes:** None (same RegistrationStore interface)

**Firmware Changes:** None

**Frontend Changes:** None

---

### 9.3 Phase C: Large Scale

**Storage:** Redis + PostgreSQL
**Scale:** 10,000 → 100,000+ devices
**Features:**
- Registration persistence (PostgreSQL)
- Token cache (Redis)
- Token validation (required)
- Duplicate detection (required)
- Hardware fingerprinting (optional)

**Implementation:**
1. Implement RedisRegistrationStore (cache layer)
2. Implement PostgreSQLRegistrationStore (persistence layer)
3. Create HybridRegistrationStore (Redis + PostgreSQL)
4. Update configuration to use HybridRegistrationStore
5. Add hardware fingerprinting (optional)

**Migration:**
```javascript
// server/services/registrationStore/hybrid.js

class HybridRegistrationStore extends RegistrationStore {
  constructor(redisStore, postgresStore) {
    super();
    this.redis = redisStore;
    this.postgres = postgresStore;
  }

  async getDevice(deviceId) {
    // Try Redis first
    let device = await this.redis.getDevice(deviceId);
    if (device) return device;
    
    // Fallback to PostgreSQL
    device = await this.postgres.getDevice(deviceId);
    if (device) {
      // Cache in Redis
      await this.redis.registerDevice(deviceId, device);
    }
    return device;
  }

  async registerDevice(deviceId, metadata) {
    // Write to both
    await this.postgres.registerDevice(deviceId, metadata);
    await this.redis.registerDevice(deviceId, metadata);
    return metadata;
  }
}
```

**Protocol Changes:** None (same RegistrationStore interface)

**Firmware Changes:** None (unless adding hardware fingerprinting)

**Frontend Changes:** None

---

## SECTION 10: CANONICAL STATE IMPACT

### 10.1 Required BITMIND_CANONICAL_STATE.md Updates

**Section: Device Identity Model**

**Current:**
```
Device Identity:
- deviceId: MAC-based (esp32-XXXX)
- token: Generated on registration, stored in firmware
- registration: In-memory only
```

**Update Request:**
```
Device Identity:
- deviceId: MAC-based (esp32-XXXX) for hardware, random hex for virtual
- token: Generated once per device identity, validated on every connection
- registration: Persistent (SQLite Phase A, PostgreSQL Phase B+, Redis+PostgreSQL Phase C)
- authentication: Token-based authentication required (Phase B+)
- cloning protection: Duplicate detection (Phase B), hardware fingerprinting (Phase C)
```

**Section: Device Registration**

**Current:**
```
Device Registration:
- MODEL A: WebSocket self-registration (ESP32)
- MODEL B: REST API pre-registration (virtual)
- Registration: In-memory only
```

**Update Request:**
```
Device Registration:
- MODEL A: WebSocket self-registration (ESP32)
- MODEL B: REST API pre-registration (virtual)
- Registration: Persistent (RegistrationStore abstraction)
- Storage: SQLite (Phase A), PostgreSQL (Phase B+), Redis+PostgreSQL (Phase C)
- Token: Generated once per device identity, preserved across reconnections
- Validation: Token validation required (Phase B+)
```

**Section: Security Model**

**Current:**
```
Security:
- TLS for WebSocket connections
- No device authentication
```

**Update Request:**
```
Security:
- TLS for WebSocket connections
- Token-based device authentication (Phase B+)
- Duplicate detection (Phase B)
- Hardware fingerprinting (Phase C)
- DeviceId format validation
```

**Section: Scalability**

**Current:**
```
Scalability:
- In-memory storage
- Limited by RAM
```

**Update Request:**
```
Scalability:
- Persistent storage (SQLite, PostgreSQL, Redis)
- RegistrationStore abstraction for storage replacement
- Phase A: 10 → 1,000 devices (SQLite)
- Phase B: 1,000 → 10,000 devices (PostgreSQL)
- Phase C: 10,000 → 100,000+ devices (Redis+PostgreSQL)
```

---

## FINAL QUESTIONS

### Q1. What is the correct Bitmind identity model?

**Answer:** deviceId + token + registration persistence

**Components:**
- **deviceId:** MAC-based (hardware), random hex (virtual)
- **token:** Generated once per device identity, validated on every connection
- **registration:** Persistent database record (SQLite, PostgreSQL, or Redis+PostgreSQL)
- **authentication:** Token-based authentication
- **cloning protection:** Duplicate detection (Phase B), hardware fingerprinting (Phase C)

**Reasoning:**
- deviceId provides device identification
- token provides authentication
- persistence provides identity survival
- validation provides security
- abstraction provides scalability

---

### Q2. What storage should be used first?

**Answer:** SQLite

**Reasoning:**
- Simple implementation
- No external dependencies
- File-based backup
- Sufficient for 10,000 devices
- Easy migration to PostgreSQL
- Fits Phase A requirements

**Implementation:**
- File: `server/data/registrations.db`
- Schema: Single table with indexes
- Backup: Daily file copy
- Migration: Export to PostgreSQL when scaling

---

### Q3. How can Bitmind scale to 10,000+ devices?

**Answer:** Through RegistrationStore abstraction and storage migration

**Path:**
- **Phase A (10 → 1,000 devices):** SQLite
- **Phase B (1,000 → 10,000 devices):** PostgreSQL
- **Phase C (10,000 → 100,000+ devices):** Redis + PostgreSQL

**Key Design:**
- RegistrationStore interface allows storage replacement
- No protocol changes required
- No firmware changes required
- No frontend changes required
- Same business logic across all phases

**Scaling Techniques:**
- Database indexing (token, deviceId)
- Connection pooling
- Write batching
- Cache layer (Redis)
- Horizontal scaling (PostgreSQL replication)

---

### Q4. How can storage be replaced later without breaking miners?

**Answer:** Through RegistrationStore abstraction

**Abstraction Layer:**
```javascript
class RegistrationStore {
  async registerDevice(deviceId, metadata) { }
  async getDevice(deviceId) { }
  async updateDevice(deviceId, updates) { }
  async removeDevice(deviceId) { }
  async validateToken(deviceId, token) { }
  async isRegistered(deviceId) { }
  async getAllRegistrations() { }
  async getRegistrationCount() { }
  async clear() { }
}
```

**Implementation:**
- SQLiteRegistrationStore (Phase A)
- PostgreSQLRegistrationStore (Phase B)
- HybridRegistrationStore (Phase C)

**Migration:**
1. Implement new RegistrationStore
2. Migrate data from old to new storage
3. Update configuration
4. Restart backend
5. No protocol changes
6. No firmware changes
7. No frontend changes

**Example:**
```javascript
// server/config/production.json
{
  "registrationStore": {
    "type": "postgresql",
    "connectionString": "postgresql://user:password@localhost/bitmind"
  }
}

// server/index.js
const storeType = config.registrationStore.type;
let registrationStore;

if (storeType === 'sqlite') {
  registrationStore = new SQLiteRegistrationStore('./server/data/registrations.db');
} else if (storeType === 'postgresql') {
  registrationStore = new PostgreSQLRegistrationStore(config.registrationStore.connectionString);
} else if (storeType === 'hybrid') {
  registrationStore = new HybridRegistrationStore(redisStore, postgresStore);
}

await registrationStore.initialize();
```

---

### Q5. What should become F5-P1 implementation scope?

**Answer:** Phase A Identity Architecture Implementation

**Scope:**

**Priority 0 (CRITICAL):**
1. Create RegistrationStore interface
2. Implement SQLiteRegistrationStore
3. Replace DeviceRegistry with RegistrationStore
4. Update handlers.js to use RegistrationStore
5. Add token generation (once per device)
6. Add token validation (optional logging)
7. Add duplicate detection (logging only)

**Priority 1 (CRITICAL - BLOCKED):**
- Add workerName and walletAddress to device.register (BLOCKED until Priority 0 complete)

**Priority 2 (HIGH - BLOCKED):**
- Backend virtual device changes (BLOCKED until Priority 0 complete)

**Priority 3 (MEDIUM - BLOCKED):**
- Frontend UI changes (BLOCKED until Priority 0 complete)

**Priority 4 (LOW - BLOCKED):**
- Documentation updates (BLOCKED until Priority 0 complete)

**Files to Modify:**
- `server/services/registrationStore.js` (new)
- `server/services/registrationStore/sqlite.js` (new)
- `server/services/deviceRegistry.js` (replace with RegistrationStore)
- `server/ws/handlers.js` (use RegistrationStore)
- `server/api/routes.js` (use RegistrationStore)
- `server/config/production.json` (add registrationStore config)

**Estimated Effort:** 4-6 hours

**Testing:**
- Unit tests for RegistrationStore
- Integration tests for handlers.js
- End-to-end tests for registration flow
- Migration tests (SQLite → PostgreSQL)

**Rollback:**
- Revert to DeviceRegistry if issues occur
- No data loss (SQLite file preserved)

---

## CONCLUSION

**Design Status:** ✅ COMPLETE

**Primary Recommendation:**
- **Phase A:** SQLite with RegistrationStore abstraction
- **Phase B:** PostgreSQL with same abstraction
- **Phase C:** Redis + PostgreSQL with same abstraction

**Key Design Principles:**
1. **Abstraction First:** RegistrationStore interface allows storage replacement
2. **Persistence Required:** All registrations must survive backend/PM2/VPS restart
3. **Token Validation:** Token must be validated on every connection
4. **Minimal Security:** Prevent spoofing without enterprise overengineering
5. **Scalable by Design:** Architecture supports 10,000+ devices from Phase A

**Next Steps:**
1. Review and approve design
2. Begin F5-P1 implementation (Phase A)
3. Implement RegistrationStore interface
4. Implement SQLiteRegistrationStore
5. Replace DeviceRegistry with RegistrationStore
6. Test thoroughly
7. Deploy to production
8. Monitor performance
9. Plan Phase B migration when scaling beyond 1,000 devices

**Status:** READY FOR IMPLEMENTATION
