#ifndef RUNTIME_STATE_MACHINE_H
#define RUNTIME_STATE_MACHINE_H

#include <Arduino.h>
#include "WiFiManager.h"
#include "BackendManager.h"
#include "RegistrationManager.h"
#include "WebSetupServer.h"

// Forward declaration (ScreenManager is in display layer, runtime layer depends on it)
class ScreenManager;

// AP Mode Configuration (Canonical)
constexpr const char* AP_SSID = "Bitmind-Setup";
constexpr const char* AP_IP = "192.168.4.1";
constexpr const char* AP_URL = "http://192.168.4.1";

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
  RuntimeStateMachine(ScreenManager* screenManager);
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
  RegistrationManager* registrationManager;
  WebSetupServer* webSetupServer;
  ScreenManager* screenManager;
  
  // Configuration cache
  String cachedSSID;
  String cachedPassword;
  String cachedBackendHost;
  uint16_t cachedBackendPort;
  String cachedBackendPath;
  String cachedBackendProtocol;
  
  // AP mode initialization flag
  bool apModeInitialized;
  
  // State handlers
  void handleState();
  
  // State-specific handlers
  void handleBoot();
  void handleCheckConfig();
  void handleAPMode();
  void handleAPModeEnter();
  void handleWiFiConnecting();
  void handleWiFiConnected();
  void handleBackendConnecting();
  void handleRegistering();
  void handleReady();
  void handleMining();
  void handleError();
  void handleRecovery();
  
  // Onboarding callback
  void onboardingFormCallback(const String& ssid, const String& password, const String& workerName, const String& walletAddress);
  
  // State transition
  void setState(RuntimeState newState);
  
  // Update DeviceStateManager with current state
  void updateDeviceStateManager();
};

#endif // RUNTIME_STATE_MACHINE_H
