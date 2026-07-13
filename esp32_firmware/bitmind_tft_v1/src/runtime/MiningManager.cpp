#include "MiningManager.h"
#include "../display/DeviceState.h"
#include "../identity/DeviceIdentity.h"
#include <ArduinoJson.h>

// Initialize static instance pointer
MiningManager* MiningManager::instance = nullptr;

MiningManager::MiningManager()
  : currentJobId(""),
    currentSessionId(""),
    currentTarget(""),
    currentNonceStart(0),
    currentNonceEnd(0),
    currentExtranonce1(""),
    currentVersion(0),
    currentPreviousblockhash(""),
    currentMerkleroot(""),
    currentNtime(0),
    currentNbits(0),
    jobActive(false),
    acceptedShares(0),
    rejectedShares(0),
    backendManager(nullptr),
    miningEngine(nullptr) {
  
  // Set static instance pointer for callback bridge
  instance = this;
  
  miningEngine = new MiningEngine();
}

MiningManager::~MiningManager() {
  if (miningEngine) {
    delete miningEngine;
  }
}

void MiningManager::begin() {
  Serial.println("[MINING] MiningManager initializing...");
  
  if (miningEngine) {
    miningEngine->begin();
    // Set hash result callback using static bridge for function pointer compatibility
    miningEngine->setHashResultCallback(MiningManager::hashResultCallback);
  }
  
  Serial.println("[MINING] MiningManager initialized");
}

void MiningManager::setBackendManager(BackendManager* backendManager) {
  this->backendManager = backendManager;
  Serial.println("[MINING] BackendManager reference set");
}

// Static callback bridge for MiningEngine (function pointer compatibility)
void MiningManager::hashResultCallback(uint32_t nonce, const String& hash, bool meetsTarget) {
  if (instance) {
    instance->onHashResult(nonce, hash, meetsTarget);
  }
}

void MiningManager::update() {
  // Update MiningEngine (time-sliced execution)
  if (miningEngine) {
    miningEngine->update();
    
    // Update display-ready metrics in DeviceState
    if (miningEngine->isMining()) {
      float hashrate = miningEngine->getHashrate();
      DeviceStateManager::setHashrate(hashrate);
      
      // Update uptime as mining time
      unsigned long elapsedTime = miningEngine->getElapsedTime();
      DeviceStateManager::setUptime(elapsedTime / 1000);
    }
  }
}

void MiningManager::handleMiningJob(const String& message) {
  Serial.println("[MINING] Received mining.job message");
  Serial.println("[MINING] Message: " + message);
  
  if (parseMiningJob(message)) {
    Serial.println("[MINING] Mining job parsed successfully");
    Serial.println("[MINING] Job ID: " + currentJobId);
    Serial.println("[MINING] Session ID: " + currentSessionId);
    Serial.println("[MINING] Target: " + currentTarget);
    Serial.println("[MINING] Nonce Range: " + String(currentNonceStart) + " - " + String(currentNonceEnd));
    Serial.println("[MINING] Extranonce1: " + currentExtranonce1);
    
    // Update DeviceStateManager with display-ready fields only
    // Full job data remains owned by MiningManager
    DeviceStateManager::setJobId(currentJobId);
    DeviceStateManager::setMiningActive(true);
    
    jobActive = true;
    Serial.println("[MINING] DeviceStateManager updated with display-ready mining state");
    
    // Start MiningEngine with work parameters
    if (miningEngine) {
      miningEngine->startJob(
        currentSessionId,
        currentTarget,
        currentNonceStart,
        currentNonceEnd,
        currentExtranonce1,
        currentVersion,
        currentPreviousblockhash,
        currentMerkleroot,
        currentNtime,
        currentNbits
      );
      Serial.println("[MINING] MiningEngine started with job parameters");
    }
  } else {
    Serial.println("[MINING] Failed to parse mining job");
  }
}

bool MiningManager::hasActiveJob() const {
  return jobActive;
}

String MiningManager::getCurrentJobId() const {
  return currentJobId;
}

String MiningManager::getCurrentSessionId() const {
  return currentSessionId;
}

String MiningManager::getCurrentTarget() const {
  return currentTarget;
}

uint32_t MiningManager::getNonceStart() const {
  return currentNonceStart;
}

uint32_t MiningManager::getNonceEnd() const {
  return currentNonceEnd;
}

String MiningManager::getExtranonce1() const {
  return currentExtranonce1;
}

uint32_t MiningManager::getCurrentVersion() const {
  return currentVersion;
}

String MiningManager::getCurrentPreviousblockhash() const {
  return currentPreviousblockhash;
}

String MiningManager::getCurrentMerkleroot() const {
  return currentMerkleroot;
}

uint32_t MiningManager::getCurrentNtime() const {
  return currentNtime;
}

uint32_t MiningManager::getCurrentNbits() const {
  return currentNbits;
}

bool MiningManager::parseMiningJob(const String& message) {
  Serial.println("[MINING] JOB_RECEIVED - parsing mining.job message");
  
  // Use ArduinoJson for proper JSON parsing
  // Allocate 2048 bytes for JSON document (adjust if needed)
  StaticJsonDocument<2048> doc;
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    Serial.println("[MINING] JOB_PARSE_FAILED - JSON deserialization error: " + String(error.c_str()));
    return false;
  }
  
  // Extract top-level required fields
  if (!doc.containsKey("jobId") || !doc["jobId"].is<String>()) {
    Serial.println("[MINING] JOB_REJECTED - missing or invalid jobId");
    return false;
  }
  currentJobId = doc["jobId"].as<String>();
  
  if (!doc.containsKey("sessionId") || !doc["sessionId"].is<String>()) {
    Serial.println("[MINING] JOB_REJECTED - missing or invalid sessionId");
    return false;
  }
  currentSessionId = doc["sessionId"].as<String>();
  
  if (!doc.containsKey("target") || !doc["target"].is<String>()) {
    Serial.println("[MINING] JOB_REJECTED - missing or invalid target");
    return false;
  }
  currentTarget = doc["target"].as<String>();
  
  // Extract block header fields
  if (!doc.containsKey("version") || !doc["version"].is<unsigned long>()) {
    Serial.println("[MINING] JOB_REJECTED - missing or invalid version");
    return false;
  }
  currentVersion = doc["version"].as<uint32_t>();
  
  if (!doc.containsKey("previousblockhash") || !doc["previousblockhash"].is<String>()) {
    Serial.println("[MINING] JOB_REJECTED - missing or invalid previousblockhash");
    return false;
  }
  currentPreviousblockhash = doc["previousblockhash"].as<String>();
  
  if (!doc.containsKey("merkleroot") || !doc["merkleroot"].is<String>()) {
    Serial.println("[MINING] JOB_REJECTED - missing or invalid merkleroot");
    return false;
  }
  currentMerkleroot = doc["merkleroot"].as<String>();
  
  if (!doc.containsKey("ntime") || !doc["ntime"].is<unsigned long>()) {
    Serial.println("[MINING] JOB_REJECTED - missing or invalid ntime");
    return false;
  }
  currentNtime = doc["ntime"].as<uint32_t>();
  
  if (!doc.containsKey("nbits") || !doc["nbits"].is<unsigned long>()) {
    Serial.println("[MINING] JOB_REJECTED - missing or invalid nbits");
    return false;
  }
  currentNbits = doc["nbits"].as<uint32_t>();
  
  // Validate block header field lengths
  if (currentPreviousblockhash.length() != 64) {
    Serial.println("[MINING] JOB_REJECTED - previousblockhash must be 64 characters, got: " + String(currentPreviousblockhash.length()));
    return false;
  }
  
  if (currentMerkleroot.length() != 64) {
    Serial.println("[MINING] JOB_REJECTED - merkleroot must be 64 characters, got: " + String(currentMerkleroot.length()));
    return false;
  }
  
  // Extract and validate nested deviceContext
  if (!doc.containsKey("deviceContext") || !doc["deviceContext"].is<JsonObject>()) {
    Serial.println("[MINING] JOB_REJECTED - missing or invalid deviceContext (must be object)");
    return false;
  }
  
  JsonObject deviceContext = doc["deviceContext"].as<JsonObject>();
  
  // Extract deviceContext.sessionId
  if (!deviceContext.containsKey("sessionId") || !deviceContext["sessionId"].is<String>()) {
    Serial.println("[MINING] JOB_REJECTED - missing or invalid deviceContext.sessionId");
    return false;
  }
  String deviceContextSessionId = deviceContext["sessionId"].as<String>();
  
  // Validate sessionId consistency between top-level and deviceContext
  if (currentSessionId != deviceContextSessionId) {
    Serial.println("[MINING] JOB_REJECTED - sessionId mismatch: top-level=" + currentSessionId + " deviceContext=" + deviceContextSessionId);
    return false;
  }
  
  // Extract nonceStart (preserve full uint32_t range)
  if (!deviceContext.containsKey("nonceStart") || !deviceContext["nonceStart"].is<unsigned long>()) {
    Serial.println("[MINING] JOB_REJECTED - missing or invalid deviceContext.nonceStart");
    return false;
  }
  currentNonceStart = deviceContext["nonceStart"].as<uint32_t>();
  
  // Extract nonceEnd (preserve full uint32_t range)
  if (!deviceContext.containsKey("nonceEnd") || !deviceContext["nonceEnd"].is<unsigned long>()) {
    Serial.println("[MINING] JOB_REJECTED - missing or invalid deviceContext.nonceEnd");
    return false;
  }
  currentNonceEnd = deviceContext["nonceEnd"].as<uint32_t>();
  
  // Extract extranonce1
  if (!deviceContext.containsKey("extranonce1") || !deviceContext["extranonce1"].is<String>()) {
    Serial.println("[MINING] JOB_REJECTED - missing or invalid deviceContext.extranonce1");
    return false;
  }
  currentExtranonce1 = deviceContext["extranonce1"].as<String>();
  
  // Validate nonce range
  if (currentNonceStart >= currentNonceEnd) {
    Serial.println("[MINING] JOB_REJECTED - invalid nonce range: start=" + String(currentNonceStart) + " end=" + String(currentNonceEnd));
    return false;
  }
  
  // Log successful parsing with key identifiers
  Serial.println("[MINING] JOB_PARSED - jobId=" + currentJobId + " sessionId=" + currentSessionId);
  Serial.println("[MINING] DEVICE_CONTEXT - nonceStart=" + String(currentNonceStart) + " nonceEnd=" + String(currentNonceEnd) + " extranonce1=" + currentExtranonce1);
  
  return true;
}

String MiningManager::extractStringField(const String& message, const String& field) {
  String searchPattern = "\"" + field + "\":\"";
  int fieldIndex = message.indexOf(searchPattern);
  
  if (fieldIndex < 0) {
    return "";
  }
  
  int valueStart = fieldIndex + searchPattern.length();
  int valueEnd = message.indexOf("\"", valueStart);
  
  if (valueEnd < 0) {
    return "";
  }
  
  return message.substring(valueStart, valueEnd);
}

uint32_t MiningManager::extractNumericField(const String& message, const String& field) {
  String searchPattern = "\"" + field + "\":";
  int fieldIndex = message.indexOf(searchPattern);
  
  if (fieldIndex < 0) {
    return 0;
  }
  
  int valueStart = fieldIndex + searchPattern.length();
  int valueEnd = message.indexOf(",", valueStart);
  
  if (valueEnd < 0) {
    valueEnd = message.indexOf("}", valueStart);
  }
  
  if (valueEnd < 0) {
    return 0;
  }
  
  String valueStr = message.substring(valueStart, valueEnd);
  valueStr.trim();
  
  return valueStr.toInt();
}

bool MiningManager::extractBooleanField(const String& message, const String& field) {
  String searchPattern = "\"" + field + "\":";
  int fieldIndex = message.indexOf(searchPattern);
  
  if (fieldIndex < 0) {
    return false;
  }
  
  int valueStart = fieldIndex + searchPattern.length();
  int valueEnd = message.indexOf(",", valueStart);
  
  if (valueEnd < 0) {
    valueEnd = message.indexOf("}", valueStart);
  }
  
  if (valueEnd < 0) {
    return false;
  }
  
  String valueStr = message.substring(valueStart, valueEnd);
  valueStr.trim();
  
  return (valueStr == "true");
}

String MiningManager::createMiningShare(const String& deviceId, const String& jobId, uint32_t nonce, const String& hash) {
  // Convert nonce to hex string (8 characters, little-endian)
  char nonceHex[9];
  sprintf(nonceHex, "%08x", nonce);
  String nonceStr = nonceHex;
  
  // Build JSON message according to protocol
  String message = "{\"type\":\"mining.share\",\"deviceId\":\"" + deviceId + 
                  "\",\"jobId\":\"" + jobId + 
                  "\",\"nonce\":\"" + nonceStr + 
                  "\",\"hash\":\"" + hash + "\"}";
  
  return message;
}

void MiningManager::handleShareResult(const String& message) {
  Serial.println("[MINING] Received mining.share.result");
  Serial.println("[MINING] Message: " + message);
  
  String resultJobId = extractStringField(message, "jobId");
  bool accepted = extractBooleanField(message, "accepted");
  String reason = extractStringField(message, "reason");
  
  Serial.println("[MINING] Job ID: " + resultJobId);
  Serial.println("[MINING] Accepted: " + String(accepted ? "true" : "false"));
  Serial.println("[MINING] Reason: " + reason);
  
  if (accepted) {
    acceptedShares++;
    Serial.println("[MINING] Share accepted");
  } else {
    rejectedShares++;
    Serial.println("[MINING] Share rejected");
  }
  
  // Update DeviceState with display-ready share counters
  DeviceStateManager::setAcceptedShares(acceptedShares);
  DeviceStateManager::setRejectedShares(rejectedShares);
}

void MiningManager::onHashResult(uint32_t nonce, const String& hash, bool meetsTarget) {
  if (meetsTarget) {
    Serial.println("[MINING] Hash result received from MiningEngine");
    Serial.println("[MINING] Share found - Nonce: " + String(nonce) + " Hash: " + hash);
    
    // Get actual deviceId from DeviceIdentity (same as used during registration)
    String deviceId = DeviceIdentity::getDeviceId();
    Serial.println("[MINING] Device ID: " + deviceId);
    
    // Create mining.share message
    String shareMessage = createMiningShare(deviceId, currentJobId, nonce, hash);
    Serial.println("[MINING] Creating mining.share");
    Serial.println("[MINING] Submitting share: jobId=" + currentJobId + " nonce=" + String(nonce));
    
    // Submit share via BackendManager
    if (backendManager && backendManager->isConnected()) {
      bool sent = backendManager->sendMessage(shareMessage);
      if (sent) {
        Serial.println("[BACKEND] mining.share transmitted");
      } else {
        Serial.println("[BACKEND] Failed to send mining.share");
      }
    } else {
      Serial.println("[BACKEND] BackendManager not connected - share not sent");
    }
  }
}
