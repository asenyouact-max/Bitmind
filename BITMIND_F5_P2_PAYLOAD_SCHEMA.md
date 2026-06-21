# BITMIND F5-P2 FINAL PAYLOAD SCHEMA

**Phase:** F5-P2 - Onboarding Alignment Implementation  
**Date:** 2026-06-21  
**Protocol Version:** 1.0

---

## SECTION 1: device.register (ESP32 → Server)

### 1.1 Schema Definition

```json
{
  "type": "object",
  "required": ["type", "deviceId", "deviceType", "firmwareVersion"],
  "properties": {
    "type": {
      "const": "device.register",
      "description": "Message type identifier"
    },
    "deviceId": {
      "type": "string",
      "pattern": "^esp32-[a-f0-9]{4,12}$",
      "description": "Device identifier derived from MAC address"
    },
    "deviceType": {
      "enum": ["oled_miner", "miner", "test_client"],
      "description": "Device type classification"
    },
    "firmwareVersion": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Firmware version (semantic versioning)"
    },
    "workerName": {
      "type": "string",
      "minLength": 3,
      "maxLength": 50,
      "description": "Worker name for pool identification (optional for backward compatibility)"
    },
    "walletAddress": {
      "type": "string",
      "pattern": "^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$",
      "description": "Bitcoin wallet address for mining rewards (optional for backward compatibility)"
    },
    "capabilities": {
      "type": "object",
      "description": "Device capabilities",
      "properties": {
        "oled": {
          "type": "boolean",
          "description": "OLED screen presence"
        },
        "wifi": {
          "type": "boolean",
          "description": "WiFi capability"
        },
        "stratum": {
          "type": "boolean",
          "description": "Stratum protocol support"
        }
      }
    }
  }
}
```

### 1.2 Example Payload

**New Firmware (with onboarding alignment):**
```json
{
  "type": "device.register",
  "deviceId": "esp32-a1b2c3d4",
  "deviceType": "miner",
  "firmwareVersion": "1.0.0",
  "workerName": "my-miner-01",
  "walletAddress": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "capabilities": {
    "oled": false,
    "wifi": true,
    "stratum": true
  }
}
```

**Old Firmware (backward compatible):**
```json
{
  "type": "device.register",
  "deviceId": "esp32-a1b2c3d4",
  "deviceType": "miner",
  "firmwareVersion": "1.0.0",
  "capabilities": {
    "oled": false,
    "wifi": true,
    "stratum": true
  }
}
```

### 1.3 Field Descriptions

| Field | Type | Required | Description | Source |
|-------|------|----------|-------------|--------|
| type | string | Yes | Message type identifier | Constant |
| deviceId | string | Yes | Device identifier (MAC-based) | Firmware |
| deviceType | string | Yes | Device type classification | Firmware |
| firmwareVersion | string | Yes | Firmware version | Firmware |
| workerName | string | No | Worker name for pool | NV Storage |
| walletAddress | string | No | Bitcoin wallet address | NV Storage |
| capabilities | object | No | Device capabilities | Firmware |

---

## SECTION 2: device.registered (Server → ESP32)

### 2.1 Schema Definition

```json
{
  "type": "object",
  "required": ["type", "status", "deviceId", "token", "serverTime"],
  "properties": {
    "type": {
      "const": "device.registered",
      "description": "Message type identifier"
    },
    "status": {
      "const": "accepted",
      "description": "Registration status"
    },
    "deviceId": {
      "type": "string",
      "description": "Device identifier"
    },
    "token": {
      "type": "string",
      "minLength": 64,
      "maxLength": 64,
      "pattern": "^[a-f0-9]{64}$",
      "description": "32-byte hex token for authentication"
    },
    "serverTime": {
      "type": "integer",
      "description": "Server timestamp (Unix epoch)"
    }
  }
}
```

### 2.2 Example Payload

```json
{
  "type": "device.registered",
  "status": "accepted",
  "deviceId": "esp32-a1b2c3d4",
  "token": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "serverTime": 1718985600
}
```

### 2.3 Field Descriptions

| Field | Type | Required | Description | Source |
|-------|------|----------|-------------|--------|
| type | string | Yes | Message type identifier | Constant |
| status | string | Yes | Registration status | Constant |
| deviceId | string | Yes | Device identifier | From request |
| token | string | Yes | 32-byte hex token | Generated (once) |
| serverTime | integer | Yes | Server timestamp | Server |

---

## SECTION 3: DATABASE SCHEMA

### 3.1 registrations Table

```sql
CREATE TABLE registrations (
  deviceId TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  workerName TEXT,
  walletAddress TEXT,
  deviceType TEXT,
  firmwareVersion TEXT,
  registeredAt INTEGER NOT NULL,
  lastSeen INTEGER NOT NULL
);
```

### 3.2 Field Descriptions

| Field | Type | Required | Description | Source |
|-------|------|----------|-------------|--------|
| deviceId | TEXT | Yes (PK) | Device identifier | device.register |
| token | TEXT | Yes | 32-byte hex token | Generated (once) |
| workerName | TEXT | No | Worker name for pool | device.register |
| walletAddress | TEXT | No | Bitcoin wallet address | device.register |
| deviceType | TEXT | No | Device type classification | device.register |
| firmwareVersion | TEXT | No | Firmware version | device.register |
| registeredAt | INTEGER | Yes | Registration timestamp | Server |
| lastSeen | INTEGER | Yes | Last connection timestamp | Server |

### 3.3 Indexes

```sql
CREATE INDEX idx_token ON registrations(token);
CREATE INDEX idx_lastSeen ON registrations(lastSeen);
```

---

## SECTION 4: VALIDATION RULES

### 4.1 workerName Validation

**Rules:**
- minLength: 3 characters
- maxLength: 50 characters
- Pattern: Alphanumeric, hyphens, underscores allowed
- Required for new onboarding flow
- Optional for backward compatibility

**Valid Examples:**
- "my-miner-01"
- "worker1"
- "btc_miner_alpha"

**Invalid Examples:**
- "ab" (too short)
- "a" (too short)
- "worker name with spaces" (invalid characters)

### 4.2 walletAddress Validation

**Rules:**
- Pattern: Bitcoin address format
- Supports: Legacy (1), P2SH (3), Bech32 (bc1)
- Length: 26-42 characters
- Required for new onboarding flow
- Optional for backward compatibility

**Valid Examples:**
- "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" (Legacy)
- "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh" (Bech32)

**Invalid Examples:**
- "invalid" (invalid format)
- "123" (invalid format)
- "0x1234567890abcdef" (Ethereum format)

---

## SECTION 5: BACKWARD COMPATIBILITY

### 5.1 Firmware Compatibility Matrix

| Firmware Version | workerName | walletAddress | Behavior |
|-----------------|------------|---------------|----------|
| 1.0.0 (old) | Not sent | Not sent | Registration accepted, null values stored |
| 1.0.0 (new) | Sent | Sent | Registration accepted, values stored |
| 1.0.0+ | Sent | Sent | Registration accepted, values stored |

### 5.2 Backend Compatibility

**RegistrationStore:**
- Already supports workerName and walletAddress columns
- Accepts null values for backward compatibility
- Updates existing registrations with new values

**Handlers:**
- Already extracts workerName and walletAddress from payload
- Handles missing fields gracefully (null values)
- No changes required

---

## SECTION 6: DATA FLOW

### 6.1 Registration Flow

```
Firmware NV Storage
    ↓ (workerName, walletAddress)
device.register Message
    ↓ (WebSocket)
Backend Validation
    ↓ (deviceGateway.validateRegistration)
RegistrationStore.registerDevice()
    ↓ (SQLite Database)
registrations Table
    ↓ (token generation)
device.registered Message
    ↓ (WebSocket)
Firmware NV Storage
    ↓ (token save)
Mining Operations
```

### 6.2 Reconnection Flow

```
Firmware NV Storage
    ↓ (token)
device.register Message
    ↓ (WebSocket)
Backend Validation
    ↓ (deviceGateway.validateRegistration)
RegistrationStore.getDevice()
    ↓ (SQLite Database)
registrations Table
    ↓ (token retrieval)
device.registered Message
    ↓ (same token)
Firmware NV Storage
    ↓ (token validation)
Mining Operations
```

---

## CONCLUSION

**Status:** ✅ PAYLOAD SCHEMA DEFINED

**Summary:**
The final payload schema for device.register includes workerName and walletAddress as optional fields, maintaining full backward compatibility with old firmware while enabling new firmware to provide complete onboarding identity. The schema is documented in device-protocol-v1.json and this specification. RegistrationStore already supports these fields, so no backend changes are required beyond F5-P1.

**Next Steps:**
- Deploy firmware with new payload
- Verify end-to-end registration flow
- Monitor for any issues
