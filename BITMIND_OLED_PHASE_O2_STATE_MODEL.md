# BITMIND OLED PHASE O2 - DEVICE STATE MODEL

**Date:** 2026-06-22  
**Phase:** O2 - Display Foundation Implementation  
**Purpose:** Centralized device state for display layer  

---

## DESIGN PRINCIPLES

1. **Separation of Concerns**
   - Display code consumes state, does not own business logic
   - State is owned by core firmware systems
   - Display layer is read-only for state

2. **Single Source of Truth**
   - Centralized state model
   - No duplicate state tracking
   - No display-specific state storage

3. **Loose Coupling**
   - Display code depends on state interface, not implementation
   - Business logic independent of display
   - Easy to test display without business logic

4. **Minimal Scope**
   - Only state needed for display
   - No internal implementation details exposed
   - Simple, flat structure

---

## STATE MODEL

```cpp
struct DeviceState {
  // WiFi State
  bool wifiConnected;
  String wifiSSID;
  int wifiRSSI;
  
  // Backend State
  bool backendConnected;
  String backendHost;
  
  // Registration State
  bool registered;
  String deviceId;
  String workerName;
  String walletAddress;
  String token;
  
  // Mining State
  bool miningActive;
  String jobId;
  float hashrate;
  uint32_t acceptedShares;
  uint32_t rejectedShares;
  uint32_t uptime;
  
  // System State
  String status;  // "IDLE", "CONNECTING", "REGISTERING", "MINING", "ERROR"
  String lastError;
  uint32_t lastErrorTime;
  
  // AP Mode State
  bool apMode;
  String apIP;
};
```

---

## STATE ACCESS LAYER

```cpp
class DeviceStateManager {
public:
  // Get current state (read-only)
  static const DeviceState& getState();
  
  // Update methods (called by business logic)
  static void setWiFiConnected(bool connected);
  static void setWiFiSSID(const String& ssid);
  static void setWiFiRSSI(int rssi);
  
  static void setBackendConnected(bool connected);
  static void setBackendHost(const String& host);
  
  static void setRegistered(bool registered);
  static void setDeviceId(const String& deviceId);
  static void setWorkerName(const String& workerName);
  static void setWalletAddress(const String& walletAddress);
  static void setToken(const String& token);
  
  static void setMiningActive(bool active);
  static void setJobId(const String& jobId);
  static void setHashrate(float hashrate);
  static void setAcceptedShares(uint32_t shares);
  static void setRejectedShares(uint32_t shares);
  static void setUptime(uint32_t uptime);
  
  static void setStatus(const String& status);
  static void setLastError(const String& error);
  
  static void setAPMode(bool apMode);
  static void setAPIP(const String& ip);
  
private:
  static DeviceState state;
};
```

---

## STATE INITIALIZATION

```cpp
DeviceState DeviceStateManager::state = {
  // WiFi State
  false,  // wifiConnected
  "",     // wifiSSID
  0,      // wifiRSSI
  
  // Backend State
  false,  // backendConnected
  "",     // backendHost
  
  // Registration State
  false,  // registered
  "",     // deviceId
  "",     // workerName
  "",     // walletAddress
  "",     // token
  
  // Mining State
  false,  // miningActive
  "",     // jobId
  0.0f,   // hashrate
  0,      // acceptedShares
  0,      // rejectedShares
  0,      // uptime
  
  // System State
  "IDLE", // status
  "",     // lastError
  0,      // lastErrorTime
  
  // AP Mode State
  false,  // apMode
  ""      // apIP
};
```

---

## INTEGRATION WITH EXISTING CODE

### WiFi Manager Integration

```cpp
// In WiFi connection code
bool connectWiFi() {
  Serial.println("[WIFI] Connecting to WiFi...");
  WiFi.begin(config.ssid.c_str(), config.password.c_str());
  
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT) {
    delay(500);
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    DeviceStateManager::setWiFiConnected(true);
    DeviceStateManager::setWiFiSSID(config.ssid);
    DeviceStateManager::setWiFiRSSI(WiFi.RSSI());
    DeviceStateManager::setStatus("CONNECTING");
    return true;
  } else {
    DeviceStateManager::setWiFiConnected(false);
    DeviceStateManager::setStatus("ERROR");
    DeviceStateManager::setLastError("WiFi connection timeout");
    return false;
  }
}
```

### Registration Integration

```cpp
// In registration handler
void handleDeviceRegistered(const String& message) {
  Serial.println("[PROTO] Received device.registered");
  
  int tokenStart = message.indexOf("\"token\":\"") + 9;
  int tokenEnd = message.indexOf("\"", tokenStart);
  if (tokenStart > 8 && tokenEnd > tokenStart) {
    config.token = message.substring(tokenStart, tokenEnd);
    config.registered = true;
    saveConfiguration();
    
    DeviceStateManager::setToken(config.token);
    DeviceStateManager::setRegistered(true);
    DeviceStateManager::setStatus("MINING");
  }
}
```

### Mining Integration

```cpp
// In mining loop
void miningLoop() {
  if (!miningState.active || !wsConnected) {
    DeviceStateManager::setMiningActive(false);
    return;
  }
  
  DeviceStateManager::setMiningActive(true);
  DeviceStateManager::setJobId(miningState.jobId);
  
  // ... mining logic ...
  
  DeviceStateManager::setHashrate(stats.hashrate);
  DeviceStateManager::setAcceptedShares(stats.acceptedShares);
  DeviceStateManager::setRejectedShares(stats.rejectedShares);
  DeviceStateManager::setUptime(stats.uptime);
}
```

### AP Mode Integration

```cpp
// In AP mode start
void startAPMode() {
  Serial.println("[AP] Starting AP mode...");
  
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  WiFi.softAPConfig(IPAddress(192, 168, 4, 1), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));
  
  DeviceStateManager::setAPMode(true);
  DeviceStateManager::setAPIP("192.168.4.1");
  DeviceStateManager::setStatus("SETUP");
  
  // ... rest of AP mode setup ...
}
```

---

## DISPLAY LAYER USAGE

### Screen Reading State

```cpp
// In screen implementation
void MiningScreen::render() {
  const DeviceState& state = DeviceStateManager::getState();
  
  display->setCursor(0, 0);
  display->println("Worker: " + state.workerName.substring(0, 12));
  
  display->setCursor(0, 16);
  display->println("Hash: " + String(state.hashrate, 1) + " H/s");
  
  display->setCursor(0, 32);
  display->println("Accepted: " + String(state.acceptedShares));
  
  display->setCursor(0, 48);
  display->println("Uptime: " + String(state.uptime) + "s");
}
```

### Screen Manager Using State

```cpp
// In screen manager routing
void ScreenManager::update() {
  const DeviceState& state = DeviceStateManager::getState();
  
  if (state.apMode) {
    transitionTo<SetupScreen>();
  } else if (!state.wifiConnected) {
    transitionTo<ConnectingScreen>();
  } else if (!state.registered) {
    transitionTo<RegisteringScreen>();
  } else if (state.miningActive) {
    transitionTo<MiningScreen>();
  } else {
    transitionTo<IdleScreen>();
  }
}
```

---

## BENEFITS

1. **Loose Coupling**
   - Display code depends only on state interface
   - Business logic unchanged
   - Easy to test display independently

2. **Single Source of Truth**
   - No duplicate state
   - Consistent state across system
   - No synchronization issues

3. **Maintainability**
   - Clear state ownership
   - Easy to add new state fields
   - Easy to track state changes

4. **Testability**
   - Can mock state for display testing
   - Can test business logic without display
   - Clear interfaces

5. **Scalability**
   - Easy to add new display consumers
   - Easy to add new state producers
   - No tight coupling

---

## RISKS

**Low Risk:**
- Simple, flat structure
- No complex state management
- Clear ownership

**Mitigations:**
- Keep state minimal
- Only expose what display needs
- Document state fields clearly
- Use const references for read access

---

## ALTERNATIVES CONSIDERED

### Option 1: Direct Access to Global Variables
**Rejected:** Tight coupling, hard to test, no encapsulation

### Option 2: Event-Based State Updates
**Rejected:** Overkill for Phase O2, adds complexity

### Option 3: Display Owns State
**Rejected:** Violates separation of concerns, duplicate state

### Option 4: No Centralized State (Direct Access)
**Rejected:** Tight coupling, display depends on business logic implementation

---

## CONCLUSION

**Decision:** Centralized DeviceStateManager with read-only state access

**Justification:**
- Clear separation of concerns
- Display layer consumes state only
- Business logic owns state
- Loose coupling
- Testable
- Maintainable
- Scalable

**Next Steps:**
1. Implement DeviceStateManager class
2. Integrate with existing WiFi, registration, mining code
3. Implement DisplayManager using state
4. Implement screens using state

---

**END OF STATE MODEL DESIGN**
