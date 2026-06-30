#include "BackendManager.h"
#include "../display/DeviceState.h"

BackendManager* BackendManager::instance = nullptr;

BackendManager::BackendManager()
  : currentState(BackendState::DISCONNECTED),
    connectionStartTime(0),
    connectionTimeout(30000), // 30 seconds default
    connectionAttempts(0),
    retryLimit(3),
    currentPort(0) {
  
  // Set instance for static callback
  instance = this;
}

BackendManager::~BackendManager() {
  disconnect();
}

void BackendManager::begin() {
  Serial.println("[BACKEND] BackendManager initializing...");
  webSocket.onEvent(webSocketEvent);
  Serial.println("[BACKEND] WebSocket client initialized");
}

bool BackendManager::connect(const String& host, uint16_t port, const String& path) {
  if (host.isEmpty()) {
    Serial.println("[BACKEND] Host is empty, cannot connect");
    return false;
  }
  
  currentHost = host;
  currentPort = port;
  currentPath = path;
  
  Serial.println("[BACKEND] Connecting to: " + host + ":" + String(port) + path);
  
  webSocket.begin(host.c_str(), port, path.c_str());
  
  connectionStartTime = millis();
  connectionAttempts++;
  setState(BackendState::CONNECTING);
  
  return true;
}

void BackendManager::disconnect() {
  Serial.println("[BACKEND] Disconnecting...");
  webSocket.disconnect();
  setState(BackendState::DISCONNECTED);
  currentHost = "";
  currentPort = 0;
  currentPath = "";
}

void BackendManager::update() {
  webSocket.loop();
  
  switch (currentState) {
    case BackendState::CONNECTING:
      if (checkConnectionTimeout()) {
        Serial.println("[BACKEND] Connection timeout");
        if (connectionAttempts >= retryLimit) {
          Serial.println("[BACKEND] Retry limit reached");
          setState(BackendState::CONNECTION_FAILED);
        } else {
          Serial.println("[BACKEND] Retrying connection...");
          setState(BackendState::RECONNECTING);
        }
      }
      break;
      
    case BackendState::RECONNECTING:
      Serial.println("[BACKEND] Reconnecting...");
      webSocket.begin(currentHost.c_str(), currentPort, currentPath.c_str());
      connectionStartTime = millis();
      connectionAttempts++;
      setState(BackendState::CONNECTING);
      break;
      
    case BackendState::DISCONNECTED:
    case BackendState::CONNECTED:
    case BackendState::CONNECTION_FAILED:
      // Stay in these states until explicit action
      break;
  }
}

BackendState BackendManager::getState() const {
  return currentState;
}

String BackendManager::getStateName(BackendState state) const {
  switch (state) {
    case BackendState::DISCONNECTED: return "DISCONNECTED";
    case BackendState::CONNECTING: return "CONNECTING";
    case BackendState::CONNECTED: return "CONNECTED";
    case BackendState::CONNECTION_FAILED: return "CONNECTION_FAILED";
    case BackendState::RECONNECTING: return "RECONNECTING";
    default: return "UNKNOWN";
  }
}

bool BackendManager::isConnected() const {
  return currentState == BackendState::CONNECTED;
}

int BackendManager::getConnectionAttempts() const {
  return connectionAttempts;
}

void BackendManager::resetConnectionAttempts() {
  connectionAttempts = 0;
}

void BackendManager::setTimeout(unsigned long timeout) {
  connectionTimeout = timeout;
}

void BackendManager::setRetryLimit(int limit) {
  retryLimit = limit;
}

void BackendManager::reconnect() {
  if (!currentHost.isEmpty()) {
    Serial.println("[BACKEND] Forced reconnect");
    connectionAttempts = 0;
    setState(BackendState::RECONNECTING);
  } else {
    Serial.println("[BACKEND] No connection details stored, cannot reconnect");
  }
}

void BackendManager::onWSEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("[BACKEND] WebSocket disconnected");
      setState(BackendState::DISCONNECTED);
      break;
      
    case WStype_CONNECTED:
      Serial.println("[BACKEND] WebSocket connected");
      setState(BackendState::CONNECTED);
      connectionAttempts = 0;
      break;
      
    case WStype_ERROR:
      Serial.println("[BACKEND] WebSocket error");
      setState(BackendState::CONNECTION_FAILED);
      break;
      
    case WStype_TEXT:
      Serial.println("[BACKEND] Received text message (length: " + String(length) + ")");
      // Message handling will be implemented in later phases
      break;
      
    case WStype_BIN:
      Serial.println("[BACKEND] Received binary message (length: " + String(length) + ")");
      // Message handling will be implemented in later phases
      break;
      
    case WStype_PING:
      Serial.println("[BACKEND] Received PING");
      break;
      
    case WStype_PONG:
      Serial.println("[BACKEND] Received PONG");
      break;
  }
}

void BackendManager::setState(BackendState newState) {
  if (currentState == newState) {
    return;
  }
  
  Serial.println("[BACKEND] State: " + getStateName(currentState) + " -> " + getStateName(newState));
  currentState = newState;
  updateDeviceStateManager();
}

void BackendManager::updateDeviceStateManager() {
  // Map backend state to device state
  String backendStatus;
  bool backendConnected = false;
  
  switch (currentState) {
    case BackendState::DISCONNECTED:
      backendStatus = "DISCONNECTED";
      backendConnected = false;
      break;
    case BackendState::CONNECTING:
      backendStatus = "CONNECTING";
      backendConnected = false;
      break;
    case BackendState::CONNECTED:
      backendStatus = "CONNECTED";
      backendConnected = true;
      break;
    case BackendState::CONNECTION_FAILED:
      backendStatus = "CONNECTION_FAILED";
      backendConnected = false;
      break;
    case BackendState::RECONNECTING:
      backendStatus = "RECONNECTING";
      backendConnected = false;
      break;
  }
  
  DeviceStateManager::setBackendStatus(backendStatus);
  DeviceStateManager::setBackendConnected(backendConnected);
  
  if (backendConnected) {
    DeviceStateManager::setBackendHost(currentHost);
  }
  
  Serial.println("[BACKEND] Updated DeviceStateManager: " + backendStatus);
}

bool BackendManager::checkConnectionTimeout() {
  return (millis() - connectionStartTime) > connectionTimeout;
}

void BackendManager::webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  if (instance) {
    instance->onWSEvent(type, payload, length);
  }
}

bool BackendManager::sendMessage(const String& message) {
  if (!isConnected()) {
    Serial.println("[BACKEND] Cannot send message: not connected");
    return false;
  }
  
  Serial.println("[BACKEND] Sending message: " + message);
  webSocket.sendTXT(message);
  return true;
}
