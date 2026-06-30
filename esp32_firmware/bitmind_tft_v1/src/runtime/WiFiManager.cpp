#include "WiFiManager.h"
#include "../display/DeviceState.h"

WiFiManager::WiFiManager()
  : currentState(WiFiState::DISCONNECTED),
    connectionStartTime(0),
    connectionTimeout(30000), // 30 seconds default
    connectionAttempts(0),
    retryLimit(3) {
}

WiFiManager::~WiFiManager() {
  disconnect();
}

void WiFiManager::begin() {
  Serial.println("[WIFI] WiFiManager initializing...");
  WiFi.mode(WIFI_STA);
  Serial.println("[WIFI] WiFi initialized in Station mode");
}

bool WiFiManager::connect(const String& ssid, const String& password) {
  if (ssid.isEmpty()) {
    Serial.println("[WIFI] SSID is empty, cannot connect");
    return false;
  }
  
  currentSSID = ssid;
  currentPassword = password;
  
  Serial.println("[WIFI] Connecting to: " + ssid);
  
  WiFi.begin(ssid.c_str(), password.c_str());
  
  connectionStartTime = millis();
  connectionAttempts++;
  setState(WiFiState::CONNECTING);
  
  return true;
}

void WiFiManager::disconnect() {
  Serial.println("[WIFI] Disconnecting...");
  WiFi.disconnect();
  setState(WiFiState::DISCONNECTED);
  currentSSID = "";
  currentPassword = "";
}

void WiFiManager::update() {
  switch (currentState) {
    case WiFiState::CONNECTING:
      if (WiFi.status() == WL_CONNECTED) {
        Serial.println("[WIFI] Connected successfully");
        Serial.println("[WIFI] IP: " + WiFi.localIP().toString());
        setState(WiFiState::CONNECTED);
        connectionAttempts = 0;
      } else if (checkConnectionTimeout()) {
        Serial.println("[WIFI] Connection timeout");
        if (connectionAttempts >= retryLimit) {
          Serial.println("[WIFI] Retry limit reached");
          setState(WiFiState::CONNECTION_FAILED);
        } else {
          Serial.println("[WIFI] Retrying connection...");
          setState(WiFiState::RECONNECTING);
        }
      }
      break;
      
    case WiFiState::RECONNECTING:
      Serial.println("[WIFI] Reconnecting...");
      WiFi.reconnect();
      connectionStartTime = millis();
      connectionAttempts++;
      setState(WiFiState::CONNECTING);
      break;
      
    case WiFiState::CONNECTED:
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WIFI] Connection lost");
        setState(WiFiState::DISCONNECTED);
      }
      break;
      
    case WiFiState::DISCONNECTED:
    case WiFiState::CONNECTION_FAILED:
      // Stay in these states until explicit action
      break;
  }
}

WiFiState WiFiManager::getState() const {
  return currentState;
}

String WiFiManager::getStateName(WiFiState state) const {
  switch (state) {
    case WiFiState::DISCONNECTED: return "DISCONNECTED";
    case WiFiState::CONNECTING: return "CONNECTING";
    case WiFiState::CONNECTED: return "CONNECTED";
    case WiFiState::CONNECTION_FAILED: return "CONNECTION_FAILED";
    case WiFiState::RECONNECTING: return "RECONNECTING";
    default: return "UNKNOWN";
  }
}

bool WiFiManager::isConnected() const {
  return currentState == WiFiState::CONNECTED && WiFi.status() == WL_CONNECTED;
}

int WiFiManager::getConnectionAttempts() const {
  return connectionAttempts;
}

void WiFiManager::resetConnectionAttempts() {
  connectionAttempts = 0;
}

void WiFiManager::setTimeout(unsigned long timeout) {
  connectionTimeout = timeout;
}

void WiFiManager::setRetryLimit(int limit) {
  retryLimit = limit;
}

void WiFiManager::reconnect() {
  if (!currentSSID.isEmpty()) {
    Serial.println("[WIFI] Forced reconnect");
    connectionAttempts = 0;
    setState(WiFiState::RECONNECTING);
  } else {
    Serial.println("[WIFI] No credentials stored, cannot reconnect");
  }
}

void WiFiManager::setState(WiFiState newState) {
  if (currentState == newState) {
    return;
  }
  
  Serial.println("[WIFI] State: " + getStateName(currentState) + " -> " + getStateName(newState));
  currentState = newState;
  updateDeviceStateManager();
}

void WiFiManager::updateDeviceStateManager() {
  // Map WiFi state to device state
  String wifiStatus;
  bool wifiConnected = false;
  
  switch (currentState) {
    case WiFiState::DISCONNECTED:
      wifiStatus = "DISCONNECTED";
      wifiConnected = false;
      break;
    case WiFiState::CONNECTING:
      wifiStatus = "CONNECTING";
      wifiConnected = false;
      break;
    case WiFiState::CONNECTED:
      wifiStatus = "CONNECTED";
      wifiConnected = true;
      break;
    case WiFiState::CONNECTION_FAILED:
      wifiStatus = "CONNECTION_FAILED";
      wifiConnected = false;
      break;
    case WiFiState::RECONNECTING:
      wifiStatus = "RECONNECTING";
      wifiConnected = false;
      break;
  }
  
  DeviceStateManager::setWiFiStatus(wifiStatus);
  DeviceStateManager::setWiFiConnected(wifiConnected);
  
  if (wifiConnected) {
    DeviceStateManager::setWiFiIP(WiFi.localIP().toString());
    DeviceStateManager::setWiFiSSID(currentSSID);
  }
  
  Serial.println("[WIFI] Updated DeviceStateManager: " + wifiStatus);
}

bool WiFiManager::checkConnectionTimeout() {
  return (millis() - connectionStartTime) > connectionTimeout;
}
