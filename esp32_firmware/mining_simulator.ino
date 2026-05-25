#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFiClient.h>
#include <ESP32TrueRandom.h>

// WiFi Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// WebSocket Configuration
const char* websocket_server = "getbitmind.com";
const uint16_t websocket_port = 3001;
const char* websocket_path = "/ws";

// Device Configuration
const char* DEVICE_ID = "esp32-miner-001";
const char* DEVICE_SOURCE = "esp32";

// Mining Simulation Configuration
const unsigned long MINING_INTERVAL = 2000; // 2 seconds
const unsigned long STATS_INTERVAL = 5000; // 5 seconds
const unsigned long SHARE_CHANCE = 10; // 10% chance per interval

// Global Variables
WebSocketsClient webSocket;
WiFiClient client;
HTTPClient http;

// Mining State
struct MiningJob {
  String jobId;
  int height;
  String target;
  String previousblockhash;
  unsigned long createdAt;
  bool active;
} currentJob;

struct MiningStats {
  float hashrate;
  int acceptedShares;
  float temperature;
  unsigned long uptime;
  String status;
} miningStats;

// Timers
unsigned long lastMiningTime = 0;
unsigned long lastStatsTime = 0;
unsigned long startTime = 0;
unsigned long deviceUptime = 0;

// Function Prototypes
void connectWebSocket();
void handleWebSocketMessage(WStype_t type, uint8_t * payload, size_t length);
void printMiningJob();
void simulateMining();
void sendMiningStats();
void sendShareFound();
String generateRandomNonce();
float simulateTemperature();

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== ESP32 Mining Simulator ===");
  
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
  miningStats.hashrate = 0;
  miningStats.acceptedShares = 0;
  miningStats.temperature = 0;
  miningStats.status = "idle";
  startTime = millis();
  
  Serial.println("Setup complete. Starting WebSocket connection...");
}

void loop() {
  webSocket.loop();
  
  deviceUptime = (millis() - startTime) / 1000;
  
  // Simulate mining if we have an active job
  if (currentJob.active && millis() - lastMiningTime > MINING_INTERVAL) {
    simulateMining();
    lastMiningTime = millis();
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
          currentJob.previousblockhash = doc["previousblockhash"].as<String>();
          currentJob.createdAt = doc["createdAt"];
          currentJob.active = true;
          miningStats.status = "mining";
          
          printMiningJob();
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
  Serial.println("\n=== NEW MINING JOB ===");
  Serial.printf("Job ID: %s\n", currentJob.jobId.c_str());
  Serial.printf("Height: %d\n", currentJob.height);
  Serial.printf("Target: %s\n", currentJob.target.c_str());
  Serial.printf("PrevHash: %s\n", currentJob.previousblockhash.c_str());
  Serial.printf("Created: %lu\n", currentJob.createdAt);
  Serial.println("========================\n");
}

void simulateMining() {
  if (!currentJob.active) {
    return;
  }
  
  // Generate simulated mining stats
  miningStats.hashrate = random(50, 200); // 50-200 H/s
  miningStats.temperature = simulateTemperature();
  
  // Simulate share found (10% chance)
  if (random(100) < SHARE_CHANCE) {
    sendShareFound();
  }
  
  Serial.printf("Mining: %.1f H/s, %d shares, %.1f°C\n", 
               miningStats.hashrate, miningStats.acceptedShares, miningStats.temperature);
}

void sendMiningStats() {
  if (!webSocket.isConnected()) {
    return;
  }
  
  DynamicJsonDocument doc(512);
  doc["type"] = "mining_stats";
  doc["deviceId"] = DEVICE_ID;
  doc["jobId"] = currentJob.jobId;
  doc["hashrate"] = miningStats.hashrate;
  doc["acceptedShares"] = miningStats.acceptedShares;
  doc["temperature"] = miningStats.temperature;
  doc["uptime"] = deviceUptime;
  
  String output;
  serializeJson(doc, output);
  webSocket.sendTXT(output);
  
  Serial.printf("Stats sent: %.1f H/s, %d shares\n", miningStats.hashrate, miningStats.acceptedShares);
}

void sendShareFound() {
  if (!webSocket.isConnected() || !currentJob.active) {
    return;
  }
  
  String nonce = generateRandomNonce();
  
  DynamicJsonDocument doc(256);
  doc["type"] = "share_found";
  doc["deviceId"] = DEVICE_ID;
  doc["jobId"] = currentJob.jobId;
  doc["nonce"] = nonce;
  doc["difficulty"] = "simulated";
  
  String output;
  serializeJson(doc, output);
  webSocket.sendTXT(output);
  
  miningStats.acceptedShares++;
  
  Serial.printf("🎯 SHARE FOUND: Nonce=%s, Job=%s\n", nonce.c_str(), currentJob.jobId.c_str());
}

String generateRandomNonce() {
  String nonce = "";
  const char hexChars[] = "0123456789ABCDEF";
  
  for (int i = 0; i < 8; i++) {
    nonce += hexChars[random(16)];
  }
  
  return nonce;
}

float simulateTemperature() {
  // Simulate realistic temperature range (35-65°C)
  return 35.0 + (random(0, 300) / 10.0);
}
