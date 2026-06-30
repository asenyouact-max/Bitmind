#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>

// WiFi connection states
enum class WiFiState {
  DISCONNECTED,
  CONNECTING,
  CONNECTED,
  CONNECTION_FAILED,
  RECONNECTING
};

class WiFiManager {
public:
  WiFiManager();
  ~WiFiManager();
  
  // Initialize WiFi subsystem
  void begin();
  
  // Connect to WiFi using stored credentials
  bool connect(const String& ssid, const String& password);
  
  // Disconnect from WiFi
  void disconnect();
  
  // Update WiFi status (call in main loop)
  void update();
  
  // Get current WiFi state
  WiFiState getState() const;
  
  // Get state name as string
  String getStateName(WiFiState state) const;
  
  // Check if connected
  bool isConnected() const;
  
  // Get connection attempt count
  int getConnectionAttempts() const;
  
  // Reset connection attempt count
  void resetConnectionAttempts();
  
  // Set connection timeout (milliseconds)
  void setTimeout(unsigned long timeout);
  
  // Set retry limit
  void setRetryLimit(int limit);
  
  // Force reconnect
  void reconnect();
  
private:
  WiFiState currentState;
  unsigned long connectionStartTime;
  unsigned long connectionTimeout;
  int connectionAttempts;
  int retryLimit;
  String currentSSID;
  String currentPassword;
  
  // Internal state management
  void setState(WiFiState newState);
  void updateDeviceStateManager();
  bool checkConnectionTimeout();
};

#endif // WIFI_MANAGER_H
