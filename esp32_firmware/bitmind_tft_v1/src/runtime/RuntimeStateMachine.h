#ifndef RUNTIME_STATE_MACHINE_H
#define RUNTIME_STATE_MACHINE_H

#include <Arduino.h>
#include "WiFiManager.h"
#include "BackendManager.h"

// Runtime states
enum class RuntimeState {
  BOOT,
  CHECK_CONFIG,
  AP_MODE,
  WIFI_CONNECTING,
  WIFI_CONNECTED,
  BACKEND_CONNECTING,
  REGISTERING,
  READY,
  MINING,
  ERROR,
  RECOVERY
};

class RuntimeStateMachine {
public:
  RuntimeStateMachine();
  ~RuntimeStateMachine();
  
  // Initialize state machine
  void begin();
  
  // Update state machine (call in main loop)
  void update();
  
  // Get current state
  RuntimeState getCurrentState() const;
  
  // Get state name as string
  String getStateName(RuntimeState state) const;
  
  // Force state transition (for testing or recovery)
  void transitionTo(RuntimeState newState);
  
private:
  RuntimeState currentState;
  RuntimeState previousState;
  
  // Runtime managers
  WiFiManager* wifiManager;
  BackendManager* backendManager;
  
  // Configuration cache
  String cachedSSID;
  String cachedPassword;
  String cachedBackendHost;
  uint16_t cachedBackendPort;
  String cachedBackendPath;
  
  // State handlers
  void handleState();
  
  // State-specific handlers
  void handleBoot();
  void handleCheckConfig();
  void handleAPMode();
  void handleWiFiConnecting();
  void handleWiFiConnected();
  void handleBackendConnecting();
  void handleRegistering();
  void handleReady();
  void handleMining();
  void handleError();
  void handleRecovery();
  
  // State transition
  void setState(RuntimeState newState);
  
  // Update DeviceStateManager with current state
  void updateDeviceStateManager();
};

#endif // RUNTIME_STATE_MACHINE_H
