#ifndef BACKEND_MANAGER_H
#define BACKEND_MANAGER_H

#include <Arduino.h>
#include <WebSocketsClient.h>

// Backend connection states
enum class BackendState {
  DISCONNECTED,
  CONNECTING,
  CONNECTED,
  CONNECTION_FAILED,
  RECONNECTING
};

class BackendManager {
public:
  BackendManager();
  ~BackendManager();
  
  // Initialize WebSocket client
  void begin();
  
  // Connect to backend WebSocket server
  bool connect(const String& host, uint16_t port, const String& path);
  
  // Disconnect from backend
  void disconnect();
  
  // Update WebSocket client (call in main loop)
  void update();
  
  // Get current backend state
  BackendState getState() const;
  
  // Get state name as string
  String getStateName(BackendState state) const;
  
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
  
  // WebSocket event handler (for library callback)
  void onWSEvent(WStype_t type, uint8_t* payload, size_t length);
  
private:
  WebSocketsClient webSocket;
  BackendState currentState;
  unsigned long connectionStartTime;
  unsigned long connectionTimeout;
  int connectionAttempts;
  int retryLimit;
  String currentHost;
  uint16_t currentPort;
  String currentPath;
  
  // Internal state management
  void setState(BackendState newState);
  void updateDeviceStateManager();
  bool checkConnectionTimeout();
  
  // Static callback wrapper for WebSocketsClient
  static void webSocketEvent(WStype_t type, uint8_t* payload, size_t length);
  static BackendManager* instance;
};

#endif // BACKEND_MANAGER_H
