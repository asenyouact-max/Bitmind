#ifndef CONFIG_MANAGER_H
#define CONFIG_MANAGER_H

#include <Arduino.h>
#include <Preferences.h>

// Configuration structure
struct Config {
  // Network
  String ssid;
  String password;
  
  // Device Identity
  String workerName;
  String walletAddress;
  
  // Backend Configuration
  String backendHost;
  uint16_t backendPort;
  String backendPath;
  String backendProtocol;
  
  // Authentication
  bool registered;
  String token;
  
  Config() : registered(false), backendPort(8080), backendProtocol("ws") {}
};

class ConfigManager {
public:
  ConfigManager();
  ~ConfigManager();
  
  // Initialize NV storage
  bool begin();
  void end();
  
  // Load configuration from NV storage
  bool loadConfiguration(Config& config);
  
  // Save configuration to NV storage
  bool saveConfiguration(const Config& config);
  
  // Factory reset - clear all configuration
  bool factoryReset();
  
  // Check if configuration exists
  bool hasConfiguration();
  
  // Check if device is registered
  bool isRegistered();
  
private:
  Preferences preferences;
  static const char* NAMESPACE;
  
  // Helper methods
  String getString(const char* key, const String& defaultValue = "");
  bool putString(const char* key, const String& value);
  bool getBool(const char* key, bool defaultValue = false);
  bool putBool(const char* key, bool value);
  void clear();
};

#endif // CONFIG_MANAGER_H
