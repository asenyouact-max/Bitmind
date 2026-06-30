#include "RuntimeStateMachine.h"
#include "../storage/ConfigManager.h"
#include "../identity/DeviceIdentity.h"
#include "../display/DeviceState.h"

RuntimeStateMachine::RuntimeStateMachine()
  : currentState(RuntimeState::BOOT),
    previousState(RuntimeState::BOOT) {
}

RuntimeStateMachine::~RuntimeStateMachine() {
}

void RuntimeStateMachine::begin() {
  Serial.println("[RSM] RuntimeStateMachine initializing...");
  currentState = RuntimeState::BOOT;
  previousState = RuntimeState::BOOT;
  Serial.println("[RSM] Initial state: BOOT");
}

void RuntimeStateMachine::update() {
  handleState();
}

RuntimeState RuntimeStateMachine::getCurrentState() const {
  return currentState;
}

String RuntimeStateMachine::getStateName(RuntimeState state) const {
  switch (state) {
    case RuntimeState::BOOT: return "BOOT";
    case RuntimeState::CHECK_CONFIG: return "CHECK_CONFIG";
    case RuntimeState::AP_MODE: return "AP_MODE";
    case RuntimeState::WIFI_CONNECTING: return "WIFI_CONNECTING";
    case RuntimeState::WIFI_CONNECTED: return "WIFI_CONNECTED";
    case RuntimeState::BACKEND_CONNECTING: return "BACKEND_CONNECTING";
    case RuntimeState::REGISTERING: return "REGISTERING";
    case RuntimeState::READY: return "READY";
    case RuntimeState::MINING: return "MINING";
    case RuntimeState::ERROR: return "ERROR";
    case RuntimeState::RECOVERY: return "RECOVERY";
    default: return "UNKNOWN";
  }
}

void RuntimeStateMachine::transitionTo(RuntimeState newState) {
  if (currentState == newState) {
    return;
  }
  
  Serial.println("[RSM] State transition: " + getStateName(currentState) + " -> " + getStateName(newState));
  previousState = currentState;
  currentState = newState;
  updateDeviceStateManager();
}

void RuntimeStateMachine::handleState() {
  switch (currentState) {
    case RuntimeState::BOOT:
      handleBoot();
      break;
    case RuntimeState::CHECK_CONFIG:
      handleCheckConfig();
      break;
    case RuntimeState::AP_MODE:
      handleAPMode();
      break;
    case RuntimeState::WIFI_CONNECTING:
      handleWiFiConnecting();
      break;
    case RuntimeState::WIFI_CONNECTED:
      handleWiFiConnected();
      break;
    case RuntimeState::BACKEND_CONNECTING:
      handleBackendConnecting();
      break;
    case RuntimeState::REGISTERING:
      handleRegistering();
      break;
    case RuntimeState::READY:
      handleReady();
      break;
    case RuntimeState::MINING:
      handleMining();
      break;
    case RuntimeState::ERROR:
      handleError();
      break;
    case RuntimeState::RECOVERY:
      handleRecovery();
      break;
  }
}

void RuntimeStateMachine::handleBoot() {
  Serial.println("[RSM] BOOT: Initializing device identity...");
  String deviceId = DeviceIdentity::getDeviceId();
  Serial.println("[RSM] Device ID: " + deviceId);
  
  // Update device state with device ID
  DeviceStateManager::setDeviceId(deviceId);
  
  // Transition to check config
  transitionTo(RuntimeState::CHECK_CONFIG);
}

void RuntimeStateMachine::handleCheckConfig() {
  Serial.println("[RSM] CHECK_CONFIG: Checking configuration availability...");
  
  ConfigManager configManager;
  bool hasConfig = configManager.hasConfiguration();
  
  if (hasConfig) {
    Serial.println("[RSM] Configuration found, proceeding to WiFi connection");
    transitionTo(RuntimeState::WIFI_CONNECTING);
  } else {
    Serial.println("[RSM] No configuration found, entering AP mode");
    transitionTo(RuntimeState::AP_MODE);
  }
}

void RuntimeStateMachine::handleAPMode() {
  Serial.println("[RSM] AP_MODE: Waiting for user provisioning...");
  // AP mode implementation will be added in T3.6
  // For now, stay in AP mode
  DeviceStateManager::setStatus("SETUP");
  DeviceStateManager::setAPMode(true);
  DeviceStateManager::setAPSSID("Bitmind-Setup");
  DeviceStateManager::setAPIP("192.168.4.1");
}

void RuntimeStateMachine::handleWiFiConnecting() {
  Serial.println("[RSM] WIFI_CONNECTING: WiFi connection will be implemented in T3.2+");
  // WiFi connection implementation will be added in T3.2
  // For now, transition to error for testing
  transitionTo(RuntimeState::ERROR);
}

void RuntimeStateMachine::handleWiFiConnected() {
  Serial.println("[RSM] WIFI_CONNECTED: WiFi connected, proceeding to backend connection");
  transitionTo(RuntimeState::BACKEND_CONNECTING);
}

void RuntimeStateMachine::handleBackendConnecting() {
  Serial.println("[RSM] BACKEND_CONNECTING: Backend connection will be implemented in T3.2+");
  // Backend connection implementation will be added in T3.2
  // For now, transition to error for testing
  transitionTo(RuntimeState::ERROR);
}

void RuntimeStateMachine::handleRegistering() {
  Serial.println("[RSM] REGISTERING: Registration will be implemented in T3.3");
  // Registration implementation will be added in T3.3
  // For now, transition to error for testing
  transitionTo(RuntimeState::ERROR);
}

void RuntimeStateMachine::handleReady() {
  Serial.println("[RSM] READY: Device ready for mining");
  transitionTo(RuntimeState::MINING);
}

void RuntimeStateMachine::handleMining() {
  Serial.println("[RSM] MINING: Mining will be implemented in T3.4");
  // Mining implementation will be added in T3.4
  // For now, stay in mining state
  DeviceStateManager::setStatus("MINING");
  DeviceStateManager::setMiningActive(true);
}

void RuntimeStateMachine::handleError() {
  Serial.println("[RSM] ERROR: Error state, will attempt recovery");
  DeviceStateManager::setStatus("ERROR");
  DeviceStateManager::setLastError("Runtime error - implementation pending");
  // Transition to recovery after delay
  transitionTo(RuntimeState::RECOVERY);
}

void RuntimeStateMachine::handleRecovery() {
  Serial.println("[RSM] RECOVERY: Attempting recovery...");
  // Recovery logic will be added in T3.8
  // For now, transition back to check config
  transitionTo(RuntimeState::CHECK_CONFIG);
}

void RuntimeStateMachine::setState(RuntimeState newState) {
  transitionTo(newState);
}

void RuntimeStateMachine::updateDeviceStateManager() {
  // Map runtime state to device state status
  String status;
  switch (currentState) {
    case RuntimeState::BOOT:
      status = "BOOT";
      break;
    case RuntimeState::CHECK_CONFIG:
      status = "CHECK_CONFIG";
      break;
    case RuntimeState::AP_MODE:
      status = "SETUP";
      break;
    case RuntimeState::WIFI_CONNECTING:
      status = "CONNECTING";
      break;
    case RuntimeState::WIFI_CONNECTED:
      status = "CONNECTING";
      break;
    case RuntimeState::BACKEND_CONNECTING:
      status = "REGISTERING";
      break;
    case RuntimeState::REGISTERING:
      status = "REGISTERING";
      break;
    case RuntimeState::READY:
      status = "READY";
      break;
    case RuntimeState::MINING:
      status = "MINING";
      break;
    case RuntimeState::ERROR:
      status = "ERROR";
      break;
    case RuntimeState::RECOVERY:
      status = "RECOVERY";
      break;
  }
  
  DeviceStateManager::setStatus(status);
  Serial.println("[RSM] Updated DeviceStateManager status: " + status);
}
