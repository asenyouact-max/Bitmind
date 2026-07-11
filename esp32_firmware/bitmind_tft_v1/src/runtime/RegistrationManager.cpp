#include "RegistrationManager.h"
#include "../storage/ConfigManager.h"
#include "../display/DeviceState.h"
#include "../identity/DeviceIdentity.h"

RegistrationManager::RegistrationManager()
  : currentState(RegistrationState::IDLE),
    registrationStartTime(0),
    registrationTimeout(30000), // 30 seconds default
    registrationAttempts(0),
    retryLimit(5),
    backendManager(nullptr) {
}

RegistrationManager::~RegistrationManager() {
}

void RegistrationManager::begin() {
  Serial.println("[REG] RegistrationManager initializing...");
  Serial.println("[REG] Ready to handle device registration");
}

bool RegistrationManager::startRegistration(const String& deviceId, const String& workerName, const String& walletAddress) {
  if (deviceId.isEmpty() || workerName.isEmpty() || walletAddress.isEmpty()) {
    Serial.println("[REG] Invalid registration parameters");
    return false;
  }
  
  currentDeviceId = deviceId;
  currentWorkerName = workerName;
  currentWalletAddress = walletAddress;
  
  Serial.println("[REG] Starting registration for device: " + deviceId);
  Serial.println("[REG] Worker: " + workerName);
  Serial.println("[REG] Wallet: " + walletAddress);
  
  registrationStartTime = millis();
  registrationAttempts++;
  setState(RegistrationState::REGISTERING);
  
  sendRegistrationRequest();
  
  return true;
}

void RegistrationManager::update() {
  switch (currentState) {
    case RegistrationState::REGISTERING:
      if (checkRegistrationTimeout()) {
        Serial.println("[REG] Registration timeout");
        if (registrationAttempts >= retryLimit) {
          Serial.println("[REG] Retry limit reached");
          setState(RegistrationState::FAILED);
        } else {
          Serial.println("[REG] Retrying registration...");
          registrationStartTime = millis();
          registrationAttempts++;
          sendRegistrationRequest();
        }
      }
      break;
      
    case RegistrationState::IDLE:
    case RegistrationState::REGISTERED:
    case RegistrationState::FAILED:
      // Stay in these states until explicit action
      break;
  }
}

RegistrationState RegistrationManager::getState() const {
  return currentState;
}

String RegistrationManager::getStateName(RegistrationState state) const {
  switch (state) {
    case RegistrationState::IDLE: return "IDLE";
    case RegistrationState::REGISTERING: return "REGISTERING";
    case RegistrationState::REGISTERED: return "REGISTERED";
    case RegistrationState::FAILED: return "FAILED";
    default: return "UNKNOWN";
  }
}

bool RegistrationManager::isRegistered() const {
  return currentState == RegistrationState::REGISTERED;
}

String RegistrationManager::getToken() const {
  return receivedToken;
}

void RegistrationManager::handleRegistrationResponse(const String& message) {
  Serial.println("[REG] Received registration response");
  parseRegistrationResponse(message);
}

void RegistrationManager::reset() {
  Serial.println("[REG] Resetting registration state");
  setState(RegistrationState::IDLE);
  receivedToken = "";
  registrationAttempts = 0;
}

void RegistrationManager::setTimeout(unsigned long timeout) {
  registrationTimeout = timeout;
}

void RegistrationManager::setRetryLimit(int limit) {
  retryLimit = limit;
}

void RegistrationManager::setBackendManager(BackendManager* backendManager) {
  this->backendManager = backendManager;
}

void RegistrationManager::setState(RegistrationState newState) {
  if (currentState == newState) {
    return;
  }
  
  Serial.println("[REG] State: " + getStateName(currentState) + " -> " + getStateName(newState));
  currentState = newState;
  updateDeviceStateManager();
}

void RegistrationManager::updateDeviceStateManager() {
  // Map registration state to device state
  bool registered = false;
  
  switch (currentState) {
    case RegistrationState::IDLE:
      registered = false;
      break;
    case RegistrationState::REGISTERING:
      registered = false;
      break;
    case RegistrationState::REGISTERED:
      registered = true;
      break;
    case RegistrationState::FAILED:
      registered = false;
      break;
  }
  
  DeviceStateManager::setRegistered(registered);
  
  if (registered && !receivedToken.isEmpty()) {
    DeviceStateManager::setToken(receivedToken);
  }
  
  Serial.print("[REG] Updated DeviceStateManager: ");
  Serial.println(registered ? "REGISTERED" : "NOT_REGISTERED");
}

bool RegistrationManager::checkRegistrationTimeout() {
  return (millis() - registrationStartTime) > registrationTimeout;
}

void RegistrationManager::sendRegistrationRequest() {
  // Construct registration payload
  // Format: JSON for simplicity (will be replaced with proper protocol in production)
  String payload = "{";
  payload += "\"type\":\"device.register\",";
  payload += "\"deviceId\":\"" + currentDeviceId + "\",";
  payload += "\"workerName\":\"" + currentWorkerName + "\",";
  payload += "\"walletAddress\":\"" + currentWalletAddress + "\",";
  payload += "\"deviceType\":\"miner\",";
  payload += "\"firmwareVersion\":\"1.0\"";
  payload += "}";
  
  Serial.println("[REG] Sending registration request: " + payload);
  
  // Send via BackendManager
  if (backendManager && backendManager->isConnected()) {
    backendManager->sendMessage(payload);
  } else {
    Serial.println("[REG] Cannot send registration request: BackendManager not connected");
    setState(RegistrationState::FAILED);
  }
}

void RegistrationManager::parseRegistrationResponse(const String& message) {
  Serial.println("[REG] Parsing registration response: " + message);
  
  // Defensive check: only process actual registration response messages
  // This prevents unrelated messages (e.g., welcome) from causing state transitions
  if (message.indexOf("\"type\":\"device.registered\"") < 0) {
    Serial.println("[REG] Not a registration response, ignoring");
    return;
  }
  
  // Simple JSON parsing (will be replaced with proper JSON library in production)
  // Expected format: {"type":"device.registered","success":true,"deviceId":"esp32-xxxx","token":"..."}
  
  if (message.indexOf("\"success\":true") >= 0) {
    // Extract token
    int tokenIndex = message.indexOf("\"token\":\"");
    if (tokenIndex >= 0) {
      int tokenStart = tokenIndex + 9; // Skip "token":"
      int tokenEnd = message.indexOf("\"", tokenStart);
      if (tokenEnd > tokenStart) {
        receivedToken = message.substring(tokenStart, tokenEnd);
        Serial.println("[REG] Token received: " + receivedToken);
        
        // Store token in ConfigManager
        storeToken(receivedToken);
        
        setState(RegistrationState::REGISTERED);
        registrationAttempts = 0;
        return;
      }
    }
  }
  
  // If we get here, registration failed
  Serial.println("[REG] Registration failed");
  setState(RegistrationState::FAILED);
}

void RegistrationManager::storeToken(const String& token) {
  Serial.println("[REG] Storing token in ConfigManager");
  
  ConfigManager configManager;
  Config config;
  
  if (configManager.loadConfiguration(config)) {
    config.token = token;
    config.registered = true;
    
    if (configManager.saveConfiguration(config)) {
      Serial.println("[REG] Token stored successfully");
    } else {
      Serial.println("[REG] Failed to store token");
    }
  } else {
    Serial.println("[REG] Failed to load configuration for token storage");
  }
}
