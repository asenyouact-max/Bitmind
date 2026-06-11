/*
 * Bitmind Legacy Firmware v1
 * Phase A Implementation
 * Target: ESP32 (no screen)
 * Protocol: Bitmind Device Protocol v1
 * 
 * Authoritative Documents:
 * - BITMIND_FIRMWARE_ARCHITECTURE.md
 * - BITMIND_PROTOCOL_V1_FREEZE.md
 * - docs/device-protocol-v1.json
 */

#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsClient.h>
#include <Preferences.h>
#include <esp_wifi.h>
#include <mbedtls/sha256.h>

// ============================================================================
// CONFIGURATION
// ============================================================================

#define FIRMWARE_VERSION "1.0.0"
#define DEVICE_TYPE "miner"

// WebSocket Configuration
#define WS_HOST "getbitmind.com"
#define WS_PORT 443
#define WS_PATH "/ws"

// AP Mode Configuration
#define AP_SSID "Bitmind-Setup"
#define AP_PASSWORD "12345678"
#define AP_IP "192.168.4.1"

// Timing Configuration
#define HEARTBEAT_INTERVAL 10000  // 10 seconds
#define TELEMETRY_INTERVAL 10000  // 10 seconds
#define MINING_INTERVAL 100       // 100ms
#define RECONNECT_INTERVAL 5000   // 5 seconds
#define WIFI_TIMEOUT 30000        // 30 seconds

// ============================================================================
// STATE
// ============================================================================

// Device Identity
String deviceId = "";

// Configuration
struct Config {
  String ssid;
  String password;
  String workerName;
  String wallet;
  bool registered;
  String token;
} config;

// Mining State
struct MiningState {
  bool active;
  String jobId;
  String sessionId;
  uint32_t nonceStart;
  uint32_t nonceEnd;
  uint32_t currentNonce;
  String target;
  String pseudoTarget;
  bool pseudoMining;
  uint32_t version;
  String previousblockhash;
  String merkleroot;
  uint32_t nbits;
  uint32_t ntime;
} miningState;

// Statistics
struct Stats {
  uint32_t acceptedShares;
  uint32_t rejectedShares;
  float hashrate;
  uint32_t uptime;
  uint32_t lastHashCount;
  uint32_t lastHashTime;
} stats;

// Timers
unsigned long lastHeartbeat = 0;
unsigned long lastTelemetry = 0;
unsigned long lastMining = 0;
unsigned long bootTime = 0;

// WebSocket
WebSocketsClient webSocket;
bool wsConnected = false;

// AP Mode
WebServer apServer(80);
bool apMode = false;

// Preferences
Preferences preferences;

// ============================================================================
// DEVICE IDENTITY
// ============================================================================

String generateDeviceId() {
  uint8_t mac[6];
  // ESP32 Core 3.3.8 uses esp_efuse_mac_get_default() instead of esp_read_mac()
  esp_efuse_mac_get_default(mac);
  
  // Format: esp32-{upper4hex}{lower8hex}
  char deviceIdStr[32];
  snprintf(deviceIdStr, sizeof(deviceIdStr), "esp32-%02X%02X%02X%02X%02X%02X",
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  
  return String(deviceIdStr);
}

// ============================================================================
// CONFIGURATION STORAGE
// ============================================================================

void loadConfiguration() {
  preferences.begin("bitmind", false);
  
  config.ssid = preferences.getString("ssid", "");
  config.password = preferences.getString("pass", "");
  config.workerName = preferences.getString("worker", "");
  config.wallet = preferences.getString("wallet", "");
  config.registered = preferences.getBool("registered", false);
  config.token = preferences.getString("token", "");
  
  preferences.end();
  
  Serial.println("[CONFIG] Configuration loaded");
  Serial.println("[CONFIG] SSID: " + (config.ssid.isEmpty() ? "(empty)" : config.ssid));
  Serial.println("[CONFIG] Worker: " + (config.workerName.isEmpty() ? "(empty)" : config.workerName));
  Serial.println("[CONFIG] Registered: " + String(config.registered ? "Yes" : "No"));
}

void saveConfiguration() {
  preferences.begin("bitmind", false);
  
  preferences.putString("ssid", config.ssid);
  preferences.putString("pass", config.password);
  preferences.putString("worker", config.workerName);
  preferences.putString("wallet", config.wallet);
  preferences.putBool("registered", config.registered);
  preferences.putString("token", config.token);
  
  preferences.end();
  
  Serial.println("[CONFIG] Configuration saved");
}

// ============================================================================
// AP MODE
// ============================================================================

void startAPMode() {
  Serial.println("[AP] Starting AP mode...");
  
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  WiFi.softAPConfig(IPAddress(192, 168, 4, 1), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));
  
  Serial.println("[AP] AP started");
  Serial.println("[AP] SSID: " + String(AP_SSID));
  Serial.println("[AP] IP: " + WiFi.softAPIP().toString());
  
  // Setup web server
  apServer.on("/", HTTP_GET, handleAPRoot);
  apServer.on("/save", HTTP_POST, handleAPSave);
  apServer.begin();
  
  apMode = true;
}

void handleAPRoot() {
  String html = "<html><head><title>Bitmind Setup</title></head><body>";
  html += "<h1>Bitmind Setup</h1>";
  html += "<form action='/save' method='POST'>";
  html += "WiFi SSID: <input type='text' name='ssid' required><br><br>";
  html += "WiFi Password: <input type='password' name='password' required><br><br>";
  html += "Worker Name: <input type='text' name='worker' required minlength='3'><br><br>";
  html += "Wallet Address: <input type='text' name='wallet' required><br><br>";
  html += "<input type='submit' value='Save & Reboot'>";
  html += "</form></body></html>";
  
  apServer.send(200, "text/html", html);
}

void handleAPSave() {
  config.ssid = apServer.arg("ssid");
  config.password = apServer.arg("password");
  config.workerName = apServer.arg("worker");
  config.wallet = apServer.arg("wallet");
  
  saveConfiguration();
  
  String html = "<html><head><title>Bitmind Setup</title></head><body>";
  html += "<h1>Configuration Saved</h1>";
  html += "<p>Device will reboot in 1 second...</p>";
  html += "</body></html>";
  
  apServer.send(200, "text/html", html);
  
  delay(1000);
  ESP.restart();
}

// ============================================================================
// WIFI
// ============================================================================

bool connectWiFi() {
  Serial.println("[WIFI] Connecting to WiFi...");
  Serial.println("[WIFI] SSID: " + config.ssid);
  
  WiFi.begin(config.ssid.c_str(), config.password.c_str());
  
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT) {
    delay(500);
    Serial.print(".");
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WIFI] Connected");
    Serial.println("[WIFI] IP: " + WiFi.localIP().toString());
    return true;
  } else {
    Serial.println("[WIFI] Connection timeout");
    return false;
  }
}

// ============================================================================
// WEBSOCKET
// ============================================================================

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected");
      wsConnected = false;
      break;
      
    case WStype_CONNECTED:
      Serial.println("[WS] Connected");
      wsConnected = true;
      // Delay to allow backend welcome message to be received before sending registration
      // This prevents message concatenation race condition
      delay(500);
      sendDeviceRegister();
      break;
      
    case WStype_TEXT:
      Serial.println("[WS] Message received: " + String((char *)payload));
      handleWebSocketMessage((char *)payload);
      break;
      
    case WStype_ERROR:
      Serial.println("[WS] Error");
      wsConnected = false;
      break;
  }
}

void connectWebSocket() {
  Serial.println("[WS] Connecting to WebSocket...");
  Serial.println("[WS] Host: " + String(WS_HOST));
  Serial.println("[WS] Port: " + String(WS_PORT));
  
  // Use beginSSL with empty fingerprint to bypass certificate validation
  // ESP32 Arduino Core 3.3.8 uses BearSSL which doesn't include Let's Encrypt root certificates
  // Empty fingerprint ("") disables certificate validation (development/testing only)
  // Links2004 WebSockets API: beginSSL(host, port, url, fingerprint, protocol)
  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH, "");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(RECONNECT_INTERVAL);
}

void sendWebSocketMessage(const char *message) {
  if (wsConnected) {
    webSocket.sendTXT(message);
  }
}

// ============================================================================
// PROTOCOL MESSAGES
// ============================================================================

void sendDeviceRegister() {
  String message = "{\"type\":\"device.register\",";
  message += "\"deviceId\":\"" + deviceId + "\",";
  message += "\"deviceType\":\"" + String(DEVICE_TYPE) + "\",";
  message += "\"firmwareVersion\":\"" + String(FIRMWARE_VERSION) + "\",";
  message += "\"capabilities\":{\"oled\":false,\"wifi\":true,\"stratum\":true}}";
  message += "}";
  
  Serial.println("[PROTO] Sending device.register");
  sendWebSocketMessage(message.c_str());
}

void sendHeartbeat() {
  String message = "{\"type\":\"device.heartbeat\",";
  message += "\"deviceId\":\"" + deviceId + "\",";
  message += "\"uptime\":" + String(stats.uptime) + ",";
  message += "\"wifiRssi\":" + String(WiFi.RSSI());
  message += "}";
  
  Serial.println("[PROTO] Sending device.heartbeat");
  sendWebSocketMessage(message.c_str());
}

void sendShare(const String& jobId, uint32_t nonce, const String& hash) {
  String message = "{\"type\":\"mining.share\",";
  message += "\"deviceId\":\"" + deviceId + "\",";
  message += "\"jobId\":\"" + jobId + "\",";
  message += "\"nonce\":\"" + String(nonce, HEX) + "\",";
  message += "\"hash\":\"" + hash + "\"";
  message += "}";
  
  Serial.println("[PROTO] Sending mining.share");
  sendWebSocketMessage(message.c_str());
}

void sendTelemetry() {
  String message = "{\"type\":\"mining_stats\",";
  message += "\"deviceId\":\"" + deviceId + "\",";
  message += "\"hashrate\":" + String(stats.hashrate) + ",";
  message += "\"acceptedShares\":" + String(stats.acceptedShares) + ",";
  message += "\"rejectedShares\":" + String(stats.rejectedShares) + ",";
  message += "\"uptime\":" + String(stats.uptime);
  if (miningState.active) {
    message += ",\"jobId\":\"" + miningState.jobId + "\"";
  }
  message += "}";
  
  Serial.println("[PROTO] Sending mining_stats");
  sendWebSocketMessage(message.c_str());
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

void handleWebSocketMessage(const char *payload) {
  // Parse JSON message
  // For simplicity, using string parsing (in production, use ArduinoJson)
  String message(payload);
  
  if (message.indexOf("\"type\":\"device.registered\"") >= 0) {
    handleDeviceRegistered(message);
  } else if (message.indexOf("\"type\":\"device.heartbeat.ack\"") >= 0) {
    Serial.println("[PROTO] Received device.heartbeat.ack");
  } else if (message.indexOf("\"type\":\"mining.job\"") >= 0) {
    handleMiningJob(message);
  } else if (message.indexOf("\"type\":\"mining.share.result\"") >= 0) {
    handleShareResult(message);
  } else if (message.indexOf("\"type\":\"device.error\"") >= 0) {
    handleDeviceError(message);
  }
}

void handleDeviceRegistered(const String& message) {
  Serial.println("[PROTO] Received device.registered");
  
  // Extract token (simplified parsing)
  int tokenStart = message.indexOf("\"token\":\"") + 9;
  int tokenEnd = message.indexOf("\"", tokenStart);
  if (tokenStart > 8 && tokenEnd > tokenStart) {
    config.token = message.substring(tokenStart, tokenEnd);
    config.registered = true;
    saveConfiguration();
    Serial.println("[PROTO] Token saved: " + config.token);
  }
}

void handleMiningJob(const String& message) {
  Serial.println("[PROTO] Received mining.job");
  
  // Parse mining job (simplified parsing)
  // In production, use ArduinoJson for proper JSON parsing
  
  // Extract jobId
  int jobIdStart = message.indexOf("\"jobId\":\"") + 9;
  int jobIdEnd = message.indexOf("\"", jobIdStart);
  if (jobIdStart > 8 && jobIdEnd > jobIdStart) {
    miningState.jobId = message.substring(jobIdStart, jobIdEnd);
  }
  
  // Extract sessionId
  int sessionIdStart = message.indexOf("\"sessionId\":\"") + 13;
  int sessionIdEnd = message.indexOf("\"", sessionIdStart);
  if (sessionIdStart > 12 && sessionIdEnd > sessionIdStart) {
    miningState.sessionId = message.substring(sessionIdStart, sessionIdEnd);
  }
  
  // Extract target
  int targetStart = message.indexOf("\"target\":\"") + 10;
  int targetEnd = message.indexOf("\"", targetStart);
  if (targetStart > 9 && targetEnd > targetStart) {
    miningState.target = message.substring(targetStart, targetEnd);
  }
  
  // Extract pseudoTarget
  int pseudoTargetStart = message.indexOf("\"pseudoTarget\":\"") + 15;
  int pseudoTargetEnd = message.indexOf("\"", pseudoTargetStart);
  if (pseudoTargetStart > 14 && pseudoTargetEnd > pseudoTargetStart) {
    miningState.pseudoTarget = message.substring(pseudoTargetStart, pseudoTargetEnd);
  }
  
  // Extract pseudoMining
  miningState.pseudoMining = message.indexOf("\"pseudoMining\":true") >= 0;
  
  // Extract version
  int versionStart = message.indexOf("\"version\":") + 10;
  int versionEnd = message.indexOf(",", versionStart);
  if (versionStart > 9 && versionEnd > versionStart) {
    miningState.version = message.substring(versionStart, versionEnd).toInt();
  }
  
  // Extract previousblockhash
  int prevHashStart = message.indexOf("\"previousblockhash\":\"") + 20;
  int prevHashEnd = message.indexOf("\"", prevHashStart);
  if (prevHashStart > 19 && prevHashEnd > prevHashStart) {
    miningState.previousblockhash = message.substring(prevHashStart, prevHashEnd);
  }
  
  // Extract merkleroot
  int merklerootStart = message.indexOf("\"merkleroot\":\"") + 14;
  int merklerootEnd = message.indexOf("\"", merklerootStart);
  if (merklerootStart > 13 && merklerootEnd > merklerootStart) {
    miningState.merkleroot = message.substring(merklerootStart, merklerootEnd);
  }
  
  // Extract nbits
  int nbitsStart = message.indexOf("\"nbits\":") + 8;
  int nbitsEnd = message.indexOf(",", nbitsStart);
  if (nbitsStart > 7 && nbitsEnd > nbitsStart) {
    miningState.nbits = message.substring(nbitsStart, nbitsEnd).toInt();
  }
  
  // Extract ntime
  int ntimeStart = message.indexOf("\"ntime\":") + 8;
  int ntimeEnd = message.indexOf(",", ntimeStart);
  if (ntimeStart > 7 && ntimeEnd > ntimeStart) {
    miningState.ntime = message.substring(ntimeStart, ntimeEnd).toInt();
  }
  
  // Extract deviceContext
  int nonceStartStart = message.indexOf("\"nonceStart\":") + 13;
  int nonceStartEnd = message.indexOf(",", nonceStartStart);
  if (nonceStartStart > 12 && nonceStartEnd > nonceStartStart) {
    miningState.nonceStart = message.substring(nonceStartStart, nonceStartEnd).toInt();
  }
  
  int nonceEndStart = message.indexOf("\"nonceEnd\":") + 11;
  int nonceEndEnd = message.indexOf("}", nonceEndStart);
  if (nonceEndStart > 10 && nonceEndEnd > nonceEndStart) {
    miningState.nonceEnd = message.substring(nonceEndStart, nonceEndEnd).toInt();
  }
  
  // Reset mining state
  miningState.active = true;
  miningState.currentNonce = miningState.nonceStart;
  
  Serial.println("[MINING] Job received");
  Serial.println("[MINING] Job ID: " + miningState.jobId);
  Serial.println("[MINING] Session ID: " + miningState.sessionId);
  Serial.println("[MINING] Target: " + miningState.target);
  Serial.println("[MINING] Nonce range: " + String(miningState.nonceStart) + " - " + String(miningState.nonceEnd));
  Serial.println("[MINING] Pseudo mining: " + String(miningState.pseudoMining ? "Yes" : "No"));
}

void handleShareResult(const String& message) {
  Serial.println("[PROTO] Received mining.share.result");
  
  bool accepted = message.indexOf("\"accepted\":true") >= 0;
  
  if (accepted) {
    stats.acceptedShares++;
    Serial.println("[MINING] Share accepted");
  } else {
    stats.rejectedShares++;
    Serial.println("[MINING] Share rejected");
  }
}

void handleDeviceError(const String& message) {
  Serial.println("[PROTO] Received device.error");
  Serial.println("[ERROR] " + message);
}

// ============================================================================
// MINING
// ============================================================================

void doubleSHA256(const uint8_t *data, size_t len, uint8_t *hash) {
  uint8_t hash1[32];
  mbedtls_sha256(data, len, hash1, 0);
  mbedtls_sha256(hash1, 32, hash, 0);
}

void buildBlockHeader(uint8_t *header, uint32_t nonce) {
  // Version: 4 bytes (little endian)
  header[0] = miningState.version & 0xFF;
  header[1] = (miningState.version >> 8) & 0xFF;
  header[2] = (miningState.version >> 16) & 0xFF;
  header[3] = (miningState.version >> 24) & 0xFF;
  
  // Previous block hash: 32 bytes (reversed)
  String prevHash = miningState.previousblockhash;
  for (int i = 0; i < 32; i++) {
    String byteStr = prevHash.substring(i * 2, i * 2 + 2);
    header[4 + (31 - i)] = (uint8_t)strtol(byteStr.c_str(), NULL, 16);
  }
  
  // Merkle root: 32 bytes (reversed, zeros for Phase A)
  for (int i = 0; i < 32; i++) {
    header[36 + i] = 0;
  }
  
  // Timestamp: 4 bytes (little endian)
  header[68] = miningState.ntime & 0xFF;
  header[69] = (miningState.ntime >> 8) & 0xFF;
  header[70] = (miningState.ntime >> 16) & 0xFF;
  header[71] = (miningState.ntime >> 24) & 0xFF;
  
  // Bits: 4 bytes (little endian)
  header[72] = miningState.nbits & 0xFF;
  header[73] = (miningState.nbits >> 8) & 0xFF;
  header[74] = (miningState.nbits >> 16) & 0xFF;
  header[75] = (miningState.nbits >> 24) & 0xFF;
  
  // Nonce: 4 bytes (little endian)
  header[76] = nonce & 0xFF;
  header[77] = (nonce >> 8) & 0xFF;
  header[78] = (nonce >> 16) & 0xFF;
  header[79] = (nonce >> 24) & 0xFF;
}

String hashToHex(const uint8_t *hash) {
  String hexStr = "";
  for (int i = 0; i < 32; i++) {
    char buf[3];
    sprintf(buf, "%02x", hash[i]);
    hexStr += buf;
  }
  return hexStr;
}

void miningLoop() {
  if (!miningState.active || !wsConnected) {
    return;
  }
  
  // Check nonce range
  if (miningState.currentNonce > miningState.nonceEnd) {
    Serial.println("[MINING] Nonce range exhausted, waiting for new job");
    miningState.active = false;
    return;
  }
  
  // Build block header
  uint8_t header[80];
  buildBlockHeader(header, miningState.currentNonce);
  
  // Double SHA256
  uint8_t hash[32];
  doubleSHA256(header, 80, hash);
  
  // Convert hash to hex
  String hashHex = hashToHex(hash);
  
  // Compare to target
  String target = miningState.pseudoMining ? miningState.pseudoTarget : miningState.target;
  
  if (hashHex < target) {
    Serial.println("[MINING] Share found!");
    Serial.println("[MINING] Nonce: " + String(miningState.currentNonce, HEX));
    Serial.println("[MINING] Hash: " + hashHex);
    
    sendShare(miningState.jobId, miningState.currentNonce, hashHex);
  }
  
  // Increment nonce
  miningState.currentNonce++;
  
  // Update hash rate
  stats.lastHashCount++;
}

void updateHashRate() {
  unsigned long now = millis();
  if (now - stats.lastHashTime >= 1000) {
    stats.hashrate = stats.lastHashCount * 1000.0 / (now - stats.lastHashTime);
    stats.lastHashCount = 0;
    stats.lastHashTime = now;
  }
}

// ============================================================================
// MAIN LOOP
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("========================================");
  Serial.println("Bitmind Legacy Firmware v1");
  Serial.println("Phase A Implementation");
  Serial.println("========================================");
  
  bootTime = millis();
  
  // Generate device ID
  deviceId = generateDeviceId();
  Serial.println("[BOOT] Device ID: " + deviceId);
  Serial.println("[BOOT] Firmware Version: " + String(FIRMWARE_VERSION));
  
  // Load configuration
  loadConfiguration();
  
  // Check if WiFi credentials exist
  if (config.ssid.isEmpty() || config.password.isEmpty()) {
    Serial.println("[BOOT] No WiFi credentials, entering AP mode");
    startAPMode();
    return;
  }
  
  // Connect to WiFi
  if (!connectWiFi()) {
    Serial.println("[BOOT] WiFi connection failed, entering AP mode");
    startAPMode();
    return;
  }
  
  // Connect to WebSocket
  connectWebSocket();
  
  // Initialize stats
  stats.acceptedShares = 0;
  stats.rejectedShares = 0;
  stats.hashrate = 0;
  stats.uptime = 0;
  stats.lastHashCount = 0;
  stats.lastHashTime = millis();
  
  // Initialize mining state
  miningState.active = false;
  
  Serial.println("[BOOT] Setup complete");
}

void loop() {
  // Update uptime
  stats.uptime = (millis() - bootTime) / 1000;
  
  // AP mode loop
  if (apMode) {
    apServer.handleClient();
    return;
  }
  
  // WebSocket loop
  webSocket.loop();
  
  // Heartbeat
  if (millis() - lastHeartbeat >= HEARTBEAT_INTERVAL && wsConnected) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  // Telemetry
  if (millis() - lastTelemetry >= TELEMETRY_INTERVAL && wsConnected) {
    sendTelemetry();
    lastTelemetry = millis();
  }
  
  // Mining
  if (millis() - lastMining >= MINING_INTERVAL) {
    miningLoop();
    updateHashRate();
    lastMining = millis();
  }
  
  // WiFi reconnect
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WIFI] Disconnected, reconnecting...");
    connectWiFi();
  }
}
