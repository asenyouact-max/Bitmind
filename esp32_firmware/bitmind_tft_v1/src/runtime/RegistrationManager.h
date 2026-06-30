#ifndef REGISTRATION_MANAGER_H
#define REGISTRATION_MANAGER_H

#include <Arduino.h>
#include "BackendManager.h"

// Registration states
enum class RegistrationState {
  IDLE,
  REGISTERING,
  REGISTERED,
  FAILED
};

class RegistrationManager {
public:
  RegistrationManager();
  ~RegistrationManager();
  
  // Initialize registration manager
  void begin();
  
  // Start registration process
  bool startRegistration(const String& deviceId, const String& workerName, const String& walletAddress);
  
  // Update registration manager (call in main loop)
  void update();
  
  // Get current registration state
  RegistrationState getState() const;
  
  // Get state name as string
  String getStateName(RegistrationState state) const;
  
  // Check if registered
  bool isRegistered() const;
  
  // Get received token
  String getToken() const;
  
  // Handle registration response from backend
  void handleRegistrationResponse(const String& message);
  
  // Reset registration state
  void reset();
  
  // Set timeout (milliseconds)
  void setTimeout(unsigned long timeout);
  
  // Set retry limit
  void setRetryLimit(int limit);
  
  // Set BackendManager reference for message sending
  void setBackendManager(BackendManager* backendManager);
  
private:
  RegistrationState currentState;
  unsigned long registrationStartTime;
  unsigned long registrationTimeout;
  int registrationAttempts;
  int retryLimit;
  String receivedToken;
  String currentDeviceId;
  String currentWorkerName;
  String currentWalletAddress;
  
  // BackendManager reference for message sending
  BackendManager* backendManager;
  
  // Internal state management
  void setState(RegistrationState newState);
  void updateDeviceStateManager();
  bool checkRegistrationTimeout();
  void sendRegistrationRequest();
  void parseRegistrationResponse(const String& message);
  void storeToken(const String& token);
};

#endif // REGISTRATION_MANAGER_H
