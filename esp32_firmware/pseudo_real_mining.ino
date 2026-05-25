#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFiClient.h>
#include <ESP32TrueRandom.h>
#include <mbedtls/sha256.h>

// WiFi Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// WebSocket Configuration
const char* websocket_server = "192.168.1.12";
const uint16_t websocket_port = 3001;
const char* websocket_path = "/ws";

// Device Configuration
const char* DEVICE_ID = "esp32-pseudo-miner-001";
const char* DEVICE_SOURCE = "esp32";

// Mining Configuration
const unsigned long HASH_INTERVAL = 100; // 100ms per hash attempt
const unsigned long STATS_INTERVAL = 5000; // 5 seconds
const unsigned long NONCE_INCREMENT = 1; // Increment nonce by 1

// Mining State
struct MiningJob {
  String jobId;
  int height;
  String target;
  String pseudoTarget;
  String previousblockhash;
  uint32_t version;
  uint32_t curtime;
  uint32_t bits;
  uint32_t nonceStart;
  bool active;
  bool pseudoMining;
} currentJob;

struct MiningStats {
  uint64_t hashesComputed;
  float hashrate;
  int acceptedShares;
  int validPseudoShares;
  float temperature;
  unsigned long uptime;
  String status;
  uint32_t currentNonce;
} miningStats;

// Global Variables
WebSocketsClient webSocket;
WiFiClient client;
HTTPClient http;

// Timers
unsigned long lastHashTime = 0;
unsigned long lastStatsTime = 0;
unsigned long startTime = 0;
unsigned long deviceUptime = 0;

// SHA256 Context
mbedtls_sha256_context sha256_ctx;

// Function Prototypes
void connectWebSocket();
void handleWebSocketMessage(WStype_t type, uint8_t * payload, size_t length);
void printMiningJob();
void startPseudoRealMining();
void mineBlock();
bool buildBlockHeader(uint8_t* header, uint32_t nonce);
void hashBlockHeader(const uint8_t* header, uint8_t* hash);
bool isValidHash(const uint8_t* hash, const String& target);
void sendPseudoShareFound(const uint8_t* hash, uint32_t nonce);
void sendMiningStats();
float simulateTemperature();
String hashToHexString(const uint8_t* hash);

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== ESP32 Pseudo-Real Mining ===");
  
  // Initialize random seed
  randomSeed(millis());
  
  // Initialize WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi...");
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nWiFi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  
  // Initialize WebSocket
  webSocket.begin(websocket_server, websocket_port, websocket_path);
  webSocket.onEvent(handleWebSocketMessage);
  webSocket.setReconnectInterval(5000);
  
  // Initialize mining state
  currentJob.active = false;
  currentJob.pseudoMining = false;
  miningStats.hashesComputed = 0;
  miningStats.hashrate = 0;
  miningStats.acceptedShares = 0;
  miningStats.validPseudoShares = 0;
  miningStats.temperature = 0;
  miningStats.status = "idle";
  miningStats.currentNonce = 0;
  startTime = millis();
  
  // Initialize SHA256
  mbedtls_sha256_init(&sha256_ctx);
  
  Serial.println("Setup complete. Starting WebSocket connection...");
}

void loop() {
  webSocket.loop();
  
  deviceUptime = (millis() - startTime) / 1000;
  
  // Mine if we have an active pseudo job
  if (currentJob.active && currentJob.pseudoMining && millis() - lastHashTime > HASH_INTERVAL) {
    mineBlock();
    lastHashTime = millis();
  }
  
  // Send mining stats periodically
  if (millis() - lastStatsTime > STATS_INTERVAL) {
    sendMiningStats();
    lastStatsTime = millis();
  }
}

void connectWebSocket() {
  if (webSocket.isConnected()) {
    return;
  }
  
  Serial.println("Connecting to WebSocket...");
  webSocket.begin(websocket_server, websocket_port, websocket_path);
}

void handleWebSocketMessage(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_t::WStype_DISCONNECTED:
      Serial.println("WebSocket Disconnected");
      currentJob.active = false;
      miningStats.status = "idle";
      break;
      
    case WStype_t::WStype_CONNECTED:
      Serial.println("WebSocket Connected");
      
      // Register device
      DynamicJsonDocument doc(256);
      doc["type"] = "register";
      doc["deviceId"] = DEVICE_ID;
      doc["source"] = DEVICE_SOURCE;
      
      String output;
      serializeJson(doc, output);
      webSocket.sendTXT(output);
      break;
      
    case WStype_t::WStype_TEXT:
      {
        Serial.printf("Received: %s\n", payload);
        
        DynamicJsonDocument doc(2048);
        DeserializationError error = deserializeJson(doc, payload);
        
        if (error) {
          Serial.printf("JSON Parse Error: %s\n", error.c_str());
          return;
        }
        
        String messageType = doc["type"];
        
        if (messageType == "mining_job") {
          // Handle new mining job
          currentJob.jobId = doc["jobId"].as<String>();
          currentJob.height = doc["height"];
          currentJob.target = doc["target"].as<String>();
          currentJob.pseudoTarget = doc["pseudoTarget"].as<String>();
          currentJob.previousblockhash = doc["previousblockhash"].as<String>();
          currentJob.version = doc["version"];
          currentJob.curtime = doc["curtime"];
          currentJob.bits = doc["bits"];
          currentJob.nonceStart = doc["nonceStart"] | 0;
          currentJob.createdAt = doc["createdAt"];
          currentJob.active = true;
          currentJob.pseudoMining = doc["pseudoMining"] | false;
          miningStats.currentNonce = currentJob.nonceStart;
          miningStats.status = "mining";
          
          printMiningJob();
          startPseudoRealMining();
        }
        else if (messageType == "ack") {
          Serial.println("Device registration acknowledged");
        }
        break;
      }
      
    case WStype_t::WStype_BIN:
    case WStype_t::WStype_ERROR:
    case WStype_t::WStype_FRAGMENT_TEXT_START:
    case WStype_t::WStype_FRAGMENT_BIN_START:
    case WStype_t::WStype_FRAGMENT:
    case WStype_t::WStype_FRAGMENT_FIN:
      break;
  }
}

void printMiningJob() {
  Serial.println("\n=== NEW PSEUDO-MINING JOB ===");
  Serial.printf("Job ID: %s\n", currentJob.jobId.c_str());
  Serial.printf("Height: %d\n", currentJob.height);
  Serial.printf("Target: %s\n", currentJob.target.c_str());
  Serial.printf("Pseudo Target: %s\n", currentJob.pseudoTarget.c_str());
  Serial.printf("PrevHash: %s\n", currentJob.previousblockhash.c_str());
  Serial.printf("Version: %d\n", currentJob.version);
  Serial.printf("Curtime: %d\n", currentJob.curtime);
  Serial.printf("Bits: %d\n", currentJob.bits);
  Serial.printf("Nonce Start: %d\n", currentJob.nonceStart);
  Serial.printf("Pseudo Mining: %s\n", currentJob.pseudoMining ? "YES" : "NO");
  Serial.println("================================\n");
}

void startPseudoRealMining() {
  if (!currentJob.active || !currentJob.pseudoMining) {
    return;
  }
  
  Serial.println("🚀 Starting PSEUDO-REAL mining with SHA256...");
  Serial.printf("🎯 Target: %s\n", currentJob.pseudoTarget.c_str());
}

void mineBlock() {
  if (!currentJob.active || !currentJob.pseudoMining) {
    return;
  }
  
  // Build 80-byte block header
  uint8_t header[80];
  if (!buildBlockHeader(header, miningStats.currentNonce)) {
    return;
  }
  
  // Hash the header (double SHA256)
  uint8_t hash[32];
  hashBlockHeader(header, hash);
  
  // Check if hash is valid (less than target)
  if (isValidHash(hash, currentJob.pseudoTarget)) {
    Serial.printf("🎯 VALID PSEUDO SHARE FOUND! Nonce: %u\n", miningStats.currentNonce);
    sendPseudoShareFound(hash, miningStats.currentNonce);
  }
  
  // Update mining stats
  miningStats.hashesComputed++;
  miningStats.currentNonce += NONCE_INCREMENT;
  
  // Calculate hashrate (hashes per second)
  static unsigned long lastHashrateTime = 0;
  if (millis() - lastHashrateTime > 1000) {
    miningStats.hashrate = miningStats.hashesComputed;
    miningStats.hashesComputed = 0;
    lastHashrateTime = millis();
  }
  
  // Print progress every 1000 hashes
  if (miningStats.hashesComputed % 1000 == 0) {
    Serial.printf("⛏ Mining: Nonce=%u, Hashes=%llu, Rate=%.1f H/s\n", 
               miningStats.currentNonce, miningStats.hashesComputed, miningStats.hashrate);
  }
}

bool buildBlockHeader(uint8_t* header, uint32_t nonce) {
  // Build 80-byte Bitcoin block header
  // Version (4 bytes, little endian)
  header[0] = currentJob.version & 0xFF;
  header[1] = (currentJob.version >> 8) & 0xFF;
  header[2] = (currentJob.version >> 16) & 0xFF;
  header[3] = (currentJob.version >> 24) & 0xFF;
  
  // Previous block hash (32 bytes, reversed)
  String prevHash = currentJob.previousblockhash;
  for (int i = 0; i < 32; i++) {
    header[4 + i] = strtol(prevHash.substring(62 - i*2, 64).c_str(), NULL, 16);
  }
  
  // Merkle root (simplified - using 32 bytes of zeros for testing)
  for (int i = 0; i < 32; i++) {
    header[36 + i] = 0x00;
  }
  
  // Timestamp (4 bytes, little endian)
  header[68] = currentJob.curtime & 0xFF;
  header[69] = (currentJob.curtime >> 8) & 0xFF;
  header[70] = (currentJob.curtime >> 16) & 0xFF;
  header[71] = (currentJob.curtime >> 24) & 0xFF;
  
  // Bits (4 bytes, little endian)
  header[72] = currentJob.bits & 0xFF;
  header[73] = (currentJob.bits >> 8) & 0xFF;
  header[74] = (currentJob.bits >> 16) & 0xFF;
  header[75] = (currentJob.bits >> 24) & 0xFF;
  
  // Nonce (4 bytes, little endian)
  header[76] = nonce & 0xFF;
  header[77] = (nonce >> 8) & 0xFF;
  header[78] = (nonce >> 16) & 0xFF;
  header[79] = (nonce >> 24) & 0xFF;
  
  return true;
}

void hashBlockHeader(const uint8_t* header, uint8_t* hash) {
  // First SHA256
  mbedtls_sha256_starts(&sha256_ctx, header, 80);
  mbedtls_sha256_finish(&sha256_ctx, hash);
  
  // Second SHA256 (double SHA256)
  mbedtls_sha256_starts(&sha256_ctx, hash, 32);
  mbedtls_sha256_finish(&sha256_ctx, hash);
}

bool isValidHash(const uint8_t* hash, const String& target) {
  // Convert hash to hex string for comparison
  String hashHex = hashToHexString(hash);
  
  // Simple string comparison (target is in hex, hash is in hex)
  return hashHex < target;
}

void sendPseudoShareFound(const uint8_t* hash, uint32_t nonce) {
  if (!webSocket.isConnected()) {
    return;
  }
  
  DynamicJsonDocument doc(512);
  doc["type"] = "pseudo_share_found";
  doc["deviceId"] = DEVICE_ID;
  doc["jobId"] = currentJob.jobId;
  doc["nonce"] = String(nonce, HEX);
  doc["hash"] = hashToHexString(hash);
  doc["target"] = currentJob.pseudoTarget;
  
  String output;
  serializeJson(doc, output);
  webSocket.sendTXT(output);
  
  miningStats.validPseudoShares++;
  Serial.printf("📤 Pseudo share sent: Nonce=%s, Hash=%s\n", 
             String(nonce, HEX).c_str(), hashToHexString(hash).c_str());
}

void sendMiningStats() {
  if (!webSocket.isConnected()) {
    return;
  }
  
  miningStats.temperature = simulateTemperature();
  
  DynamicJsonDocument doc(512);
  doc["type"] = "mining_stats";
  doc["deviceId"] = DEVICE_ID;
  doc["jobId"] = currentJob.jobId;
  doc["hashrate"] = miningStats.hashrate;
  doc["acceptedShares"] = miningStats.acceptedShares;
  doc["validPseudoShares"] = miningStats.validPseudoShares;
  doc["temperature"] = miningStats.temperature;
  doc["uptime"] = deviceUptime;
  doc["currentNonce"] = miningStats.currentNonce;
  doc["hashesComputed"] = miningStats.hashesComputed;
  doc["status"] = "pseudo_real_mining";
  
  String output;
  serializeJson(doc, output);
  webSocket.sendTXT(output);
  
  Serial.printf("📊 Stats sent: %.1f H/s, %d valid shares, Nonce=%u\n", 
             miningStats.hashrate, miningStats.validPseudoShares, miningStats.currentNonce);
}

float simulateTemperature() {
  // Simulate realistic temperature range (35-65°C)
  return 35.0 + (random(0, 300) / 10.0;
}

String hashToHexString(const uint8_t* hash) {
  String hexString = "";
  for (int i = 0; i < 32; i++) {
    if (hash[i] < 16) {
      hexString += "0";
    }
    hexString += String(hash[i], HEX);
  }
  return hexString;
}
