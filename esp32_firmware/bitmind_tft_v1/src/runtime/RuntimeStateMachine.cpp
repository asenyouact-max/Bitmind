#include "RuntimeStateMachine.h"
#include "../storage/ConfigManager.h"
#include "../identity/DeviceIdentity.h"
#include "../display/DeviceState.h"
#include "../display/ScreenManager.h"
#include <WiFi.h>

RuntimeStateMachine::RuntimeStateMachine(ScreenManager* screenManager)
  : currentState(RuntimeState::BOOT),
    previousState(RuntimeState::BOOT),
    wifiManager(nullptr),
    backendManager(nullptr),
    registrationManager(nullptr),
    webSetupServer(nullptr),
    screenManager(screenManager),
    cachedBackendPort(0),
    apModeInitialized(false) {
  
  wifiManager = new WiFiManager();
  backendManager = new BackendManager();
  registrationManager = new RegistrationManager();
  webSetupServer = new WebSetupServer();
}

RuntimeStateMachine::~RuntimeStateMachine() {
  delete wifiManager;
  delete backendManager;
  delete registrationManager;
  delete webSetupServer;
}

void RuntimeStateMachine::begin() {
  Serial.println("[RSM] RuntimeStateMachine initializing...");
  currentState = RuntimeState::BOOT;
  previousState = RuntimeState::BOOT;
  
  // Initialize managers
  Serial.println("[RSM] Initializing WiFiManager...");
  wifiManager->begin();
  Serial.println("[RSM] WiFiManager initialized");
  
  Serial.println("[RSM] Initializing BackendManager...");
  backendManager->begin();
  Serial.println("[RSM] BackendManager initialized");
  
  Serial.println("[RSM] Initializing RegistrationManager...");
  registrationManager->begin();
  Serial.println("[RSM] RegistrationManager initialized");
  
  Serial.println("[RSM] Initializing WebSetupServer (registering HTTP handlers)...");
  webSetupServer->begin();
  Serial.println("[RSM] WebSetupServer initialized (HTTP handlers registered)");
  
  // Wire RegistrationManager to BackendManager
  Serial.println("[RSM] Wiring RegistrationManager to BackendManager...");
  registrationManager->setBackendManager(backendManager);
  Serial.println("[RSM] RegistrationManager wired to BackendManager");
  
  // Wire BackendManager message callback to RuntimeStateMachine for routing
  Serial.println("[RSM] Wiring BackendManager message callback to RuntimeStateMachine for message routing...");
  backendManager->setMessageCallback([this](const String& message) {
    Serial.println("[RSM] BackendManager message callback invoked, routing by message type");
    
    // Extract message type for routing
    int typeIndex = message.indexOf("\"type\":\"");
    if (typeIndex >= 0) {
      int typeStart = typeIndex + 8; // Skip "type":"
      int typeEnd = message.indexOf("\"", typeStart);
      if (typeEnd > typeStart) {
        String messageType = message.substring(typeStart, typeEnd);
        Serial.println("[RSM] Message type: " + messageType);
        
        // Route registration-related messages to RegistrationManager
        if (messageType == "device.registered") {
          Serial.println("[RSM] Routing device.registered to RegistrationManager");
          if (registrationManager) {
            registrationManager->handleRegistrationResponse(message);
          }
        } else {
          Serial.println("[RSM] Ignoring non-registration message: " + messageType);
        }
      }
    }
  });
  Serial.println("[RSM] BackendManager message callback wired to RuntimeStateMachine");
  
  Serial.println("[RSM] Initial state: BOOT");
}

void RuntimeStateMachine::update() {
  // Update managers
  if (wifiManager) {
    wifiManager->update();
  }
  if (backendManager) {
    backendManager->update();
  }
  if (registrationManager) {
    registrationManager->update();
  }
  
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
  
  // Reset AP mode initialization flag when leaving AP mode
  if (currentState == RuntimeState::AP_MODE && newState != RuntimeState::AP_MODE) {
    apModeInitialized = false;
    Serial.println("[RSM] Reset AP mode initialization flag");
  }
  
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
  Config config;
  
  if (configManager.loadConfiguration(config)) {
    Serial.println("[RSM] Configuration found, caching credentials");
    cachedSSID = config.ssid;
    cachedPassword = config.password;
    
    // Backend connection details from ConfigManager
    cachedBackendHost = config.backendHost;
    cachedBackendPort = config.backendPort;
    cachedBackendPath = config.backendPath;
    cachedBackendProtocol = config.backendProtocol;
    
    Serial.println("[RSM] Backend: " + config.backendProtocol + "://" + cachedBackendHost + ":" + String(cachedBackendPort) + cachedBackendPath);
    
    transitionTo(RuntimeState::WIFI_CONNECTING);
  } else {
    Serial.println("[RSM] No configuration found, entering AP mode");
    transitionTo(RuntimeState::AP_MODE);
  }
}

void RuntimeStateMachine::handleAPMode() {
  // Enter AP mode initialization on first entry
  if (!apModeInitialized) {
    handleAPModeEnter();
    apModeInitialized = true;
  }
  
  // Runtime servicing (every loop)
  if (webSetupServer && webSetupServer->isRunning()) {
    webSetupServer->handleClient();
  } else {
    if (!webSetupServer) {
      Serial.println("[RSM] AP_MODE: webSetupServer is null, cannot call handleClient()");
    } else if (!webSetupServer->isRunning()) {
      Serial.println("[RSM] AP_MODE: webSetupServer is not running, cannot call handleClient()");
    }
  }
  
  // Stay in AP mode state
  DeviceStateManager::setStatus("SETUP");
}

void RuntimeStateMachine::handleAPModeEnter() {
  Serial.println("[RSM] AP_MODE_ENTER: Initializing AP mode...");
  
  // Enter AP mode using WiFi.h directly (WiFiManager doesn't have AP mode methods)
  Serial.println("[RSM] Setting WiFi mode to WIFI_AP...");
  WiFi.mode(WIFI_AP);
  Serial.println("[RSM] WiFi mode set to WIFI_AP");
  
  Serial.print("[RSM] Starting SoftAP with SSID: ");
  Serial.println(AP_SSID);
  bool softAPResult = WiFi.softAP(AP_SSID);
  Serial.print("[RSM] WiFi.softAP() return value: ");
  Serial.println(softAPResult ? "SUCCESS" : "FAILED");
  
  Serial.print("[RSM] AP IP: ");
  Serial.println(WiFi.softAPIP());
  
  // Update DeviceStateManager with AP mode state
  DeviceStateManager::setAPMode(true);
  DeviceStateManager::setAPSSID(AP_SSID);
  DeviceStateManager::setAPIP(WiFi.softAPIP().toString());
  
  // Generate QR payload from canonical AP URL
  String qrPayload = AP_URL;
  Serial.print("[RSM] Generated QR payload: ");
  Serial.println(qrPayload.c_str());
  
  // Store QR payload in DeviceStateManager (Single Source of Truth)
  DeviceStateManager::setQRPayload(qrPayload);
  
  // Start WebSetupServer
  if (webSetupServer) {
    Serial.println("[RSM] Setting form callback...");
    webSetupServer->setFormCallback([this](const String& ssid, const String& password, const String& workerName, const String& walletAddress) {
      this->onboardingFormCallback(ssid, password, workerName, walletAddress);
    });
    Serial.println("[RSM] Form callback set");
    
    Serial.println("[RSM] Starting WebSetupServer...");
    webSetupServer->start();
    Serial.println("[RSM] WebSetupServer started");
  } else {
    Serial.println("[RSM] ERROR: webSetupServer is null");
  }
  
  // Transition to SetupScreen using screenManager instance
  if (screenManager) {
    screenManager->transitionTo<SetupScreen>();
    Serial.println("[RSM] Transitioned to SetupScreen");
  } else {
    Serial.println("[RSM] ERROR: screenManager is null");
  }
  
  Serial.println("[RSM] AP mode initialization complete");
}

void RuntimeStateMachine::handleWiFiConnecting() {
  // Check if already connected
  if (wifiManager->isConnected()) {
    Serial.println("[RSM] WiFi already connected");
    transitionTo(RuntimeState::WIFI_CONNECTED);
    return;
  }
  
  // Check if credentials are available
  if (cachedSSID.isEmpty()) {
    Serial.println("[RSM] No WiFi credentials cached, cannot connect");
    transitionTo(RuntimeState::AP_MODE);
    return;
  }
  
  // Start WiFi connection only if not already connecting
  if (wifiManager->getState() == WiFiState::DISCONNECTED) {
    Serial.println("[RSM] Initiating WiFi connection");
    if (wifiManager->connect(cachedSSID, cachedPassword)) {
      Serial.println("[RSM] WiFi connection initiated");
    } else {
      Serial.println("[RSM] WiFi connection failed to initiate");
      transitionTo(RuntimeState::ERROR);
      return;
    }
  }
  
  // Check WiFi state and transition accordingly
  if (wifiManager->getState() == WiFiState::CONNECTED) {
    Serial.println("[RSM] WiFi connection successful");
    transitionTo(RuntimeState::WIFI_CONNECTED);
  } else if (wifiManager->getState() == WiFiState::CONNECTION_FAILED) {
    Serial.println("[RSM] WiFi connection failed, entering AP mode");
    transitionTo(RuntimeState::AP_MODE);
  }
}

void RuntimeStateMachine::handleWiFiConnected() {
  Serial.println("[RSM] WIFI_CONNECTED: WiFi connected, proceeding to backend connection");
  
  // Verify WiFi is still connected
  if (!wifiManager->isConnected()) {
    Serial.println("[RSM] WiFi disconnected, retrying");
    transitionTo(RuntimeState::WIFI_CONNECTING);
    return;
  }
  
  transitionTo(RuntimeState::BACKEND_CONNECTING);
}

void RuntimeStateMachine::handleBackendConnecting() {
  Serial.println("[RSM] BACKEND_CONNECTING: Initiating backend connection");
  
  if (backendManager->isConnected()) {
    Serial.println("[RSM] Backend already connected");
    transitionTo(RuntimeState::REGISTERING);
    return;
  }
  
  // Guard against calling connect() when BackendManager already owns the connection lifecycle
  if (backendManager->getState() == BackendState::CONNECTING || 
      backendManager->getState() == BackendState::RECONNECTING) {
    Serial.println("[RSM] Backend already connecting/reconnecting, waiting for result");
    // Stay in BACKEND_CONNECTING state, observe BackendManager state transitions
    return;
  }
  
  if (cachedBackendHost.isEmpty()) {
    Serial.println("[RSM] No backend details cached, cannot connect");
    transitionTo(RuntimeState::ERROR);
    return;
  }
  
  // Start backend connection
  if (backendManager->connect(cachedBackendHost, cachedBackendPort, cachedBackendPath, cachedBackendProtocol)) {
    Serial.println("[RSM] Backend connection initiated");
    // Stay in BACKEND_CONNECTING state until BackendManager reports connected or failed
  } else {
    Serial.println("[RSM] Backend connection failed to initiate");
    transitionTo(RuntimeState::ERROR);
  }
  
  // Check backend state and transition accordingly
  if (backendManager->getState() == BackendState::CONNECTED) {
    Serial.println("[RSM] Backend connected, proceeding to registration");
    transitionTo(RuntimeState::REGISTERING);
  } else if (backendManager->getState() == BackendState::CONNECTION_FAILED) {
    Serial.println("[RSM] Backend connection failed, entering error state");
    transitionTo(RuntimeState::ERROR);
  }
}

void RuntimeStateMachine::handleRegistering() {
  Serial.println("[RSM] REGISTERING: Starting device registration");
  
  // Check if already registered
  ConfigManager configManager;
  if (configManager.isRegistered()) {
    Serial.println("[RSM] Device already registered, proceeding to READY");
    DeviceStateManager::setRegistered(true);
    transitionTo(RuntimeState::READY);
    return;
  }
  
  // Check if RegistrationManager is already in progress
  if (registrationManager->getState() == RegistrationState::REGISTERING) {
    Serial.println("[RSM] Registration in progress, waiting for response");
    // Stay in REGISTERING state
    return;
  }
  
  // Check if registration succeeded
  if (registrationManager->getState() == RegistrationState::REGISTERED) {
    Serial.println("[RSM] Registration successful, proceeding to READY");
    transitionTo(RuntimeState::READY);
    return;
  }
  
  // Check if registration failed
  if (registrationManager->getState() == RegistrationState::FAILED) {
    Serial.println("[RSM] Registration failed, entering ERROR state");
    transitionTo(RuntimeState::ERROR);
    return;
  }
  
  // Start registration
  String deviceId = DeviceIdentity::getDeviceId();
  Config config;
  if (configManager.loadConfiguration(config)) {
    // Propagate worker name and wallet address to DeviceStateManager for display/runtime SSOT
    DeviceStateManager::setWorkerName(config.workerName);
    DeviceStateManager::setWalletAddress(config.walletAddress);
    
    if (registrationManager->startRegistration(deviceId, config.workerName, config.walletAddress)) {
      Serial.println("[RSM] Registration started");
      // Stay in REGISTERING state
    } else {
      Serial.println("[RSM] Failed to start registration");
      transitionTo(RuntimeState::ERROR);
    }
  } else {
    Serial.println("[RSM] Failed to load configuration for registration");
    transitionTo(RuntimeState::ERROR);
  }
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

void RuntimeStateMachine::onboardingFormCallback(const String& ssid, const String& password, const String& workerName, const String& walletAddress) {
  Serial.println("[RSM] Onboarding form callback received");
  Serial.print("[RSM] SSID: ");
  Serial.println(ssid);
  Serial.print("[RSM] Password: ");
  Serial.println(password.length() > 0 ? "***" : "(empty)");
  Serial.print("[RSM] Worker Name: ");
  Serial.println(workerName);
  Serial.print("[RSM] Wallet Address: ");
  Serial.println(walletAddress);
  
  // Basic validation
  if (ssid.isEmpty() || password.isEmpty() || workerName.isEmpty() || walletAddress.isEmpty()) {
    Serial.println("[RSM] ERROR: Form validation failed - empty fields");
    return;
  }
  
  // Save configuration via ConfigManager
  ConfigManager configManager;
  Config config;
  config.ssid = ssid;
  config.password = password;
  config.workerName = workerName;
  config.walletAddress = walletAddress;
  config.backendHost = "getbitmind.com";
  config.backendPort = 443;
  config.backendProtocol = "wss";
  config.backendPath = "/ws";
  
  if (configManager.saveConfiguration(config)) {
    Serial.println("[RSM] Configuration saved successfully");
    
    // Stop WebSetupServer (lifecycle symmetry: begin/start -> stop/end)
    if (webSetupServer) {
      webSetupServer->stop();
      webSetupServer->end();
      Serial.println("[RSM] WebSetupServer stopped");
    }
    
    // Exit AP mode using WiFi.h directly (WiFiManager doesn't have AP mode methods)
    WiFi.mode(WIFI_STA);
    DeviceStateManager::setAPMode(false);
    Serial.println("[RSM] AP mode exited");
    
    // Clear QR payload
    DeviceStateManager::setQRPayload("");
    Serial.println("[RSM] QR payload cleared");
    
    // Reboot to apply configuration
    Serial.println("[RSM] Rebooting to apply configuration...");
    ESP.restart();
  } else {
    Serial.println("[RSM] ERROR: Failed to save configuration");
  }
}
