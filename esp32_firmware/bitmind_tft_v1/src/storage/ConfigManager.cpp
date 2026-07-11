#include "ConfigManager.h"

const char* ConfigManager::NAMESPACE = "bitmind";

ConfigManager::ConfigManager() {
}

ConfigManager::~ConfigManager() {
  end();
}

bool ConfigManager::begin() {
  return preferences.begin(NAMESPACE, false);
}

void ConfigManager::end() {
  preferences.end();
}

bool ConfigManager::loadConfiguration(Config& config) {
  if (!begin()) {
    Serial.println("[CONFIG] Failed to begin preferences");
    return false;
  }
  
  config.ssid = getString("ssid", "");
  config.password = getString("pass", "");
  config.workerName = getString("worker", "");
  config.walletAddress = getString("wallet", "");
  
  // Backend configuration
  config.backendHost = getString("backendHost", "backend.bitmind.io");
  config.backendPort = preferences.getUInt("backendPort", 8080);
  config.backendPath = getString("backendPath", "/ws");
  config.backendProtocol = getString("backendProtocol", "ws");
  
  config.registered = getBool("registered", false);
  config.token = getString("token", "");
  
  end();
  
  // One-time migration of legacy placeholder backend configuration to canonical endpoint
  if (config.backendHost == "localhost" && 
      config.backendPort == 8080 && 
      config.backendProtocol == "http" && 
      config.backendPath == "/api") {
    Serial.println("[CONFIG] Detected legacy placeholder backend configuration, migrating to canonical endpoint");
    config.backendHost = "getbitmind.com";
    config.backendPort = 443;
    config.backendProtocol = "wss";
    config.backendPath = "/ws";
    
    // Persist migrated configuration
    if (saveConfiguration(config)) {
      Serial.println("[CONFIG] Legacy backend configuration successfully migrated");
    } else {
      Serial.println("[CONFIG] WARNING: Failed to persist migrated backend configuration");
    }
  }
  
  Serial.println("[CONFIG] Configuration loaded");
  Serial.println("[CONFIG] SSID: " + (config.ssid.isEmpty() ? "(empty)" : config.ssid));
  Serial.println("[CONFIG] Worker: " + (config.workerName.isEmpty() ? "(empty)" : config.workerName));
  Serial.println("[CONFIG] Backend: " + config.backendProtocol + "://" + config.backendHost + ":" + String(config.backendPort) + config.backendPath);
  Serial.println("[CONFIG] Registered: " + String(config.registered ? "Yes" : "No"));
  
  return true;
}

bool ConfigManager::saveConfiguration(const Config& config) {
  if (!begin()) {
    Serial.println("[CONFIG] Failed to begin preferences");
    return false;
  }
  
  putString("ssid", config.ssid);
  putString("pass", config.password);
  putString("worker", config.workerName);
  putString("wallet", config.walletAddress);
  
  // Backend configuration
  putString("backendHost", config.backendHost);
  preferences.putUInt("backendPort", config.backendPort);
  putString("backendPath", config.backendPath);
  putString("backendProtocol", config.backendProtocol);
  
  putBool("registered", config.registered);
  putString("token", config.token);
  
  end();
  
  Serial.println("[CONFIG] Configuration saved");
  Serial.println("[CONFIG] SSID: " + (config.ssid.isEmpty() ? "(empty)" : config.ssid));
  Serial.println("[CONFIG] Worker: " + (config.workerName.isEmpty() ? "(empty)" : config.workerName));
  Serial.println("[CONFIG] Backend: " + config.backendProtocol + "://" + config.backendHost + ":" + String(config.backendPort) + config.backendPath);
  Serial.println("[CONFIG] Registered: " + String(config.registered ? "Yes" : "No"));
  
  return true;
}

bool ConfigManager::factoryReset() {
  if (!begin()) {
    Serial.println("[CONFIG] Failed to begin preferences");
    return false;
  }
  
  clear();
  
  end();
  
  Serial.println("[CONFIG] Factory reset complete");
  
  return true;
}

bool ConfigManager::hasConfiguration() {
  if (!begin()) {
    Serial.println("[CONFIG] Failed to begin preferences");
    return false;
  }
  
  bool hasSSID = !getString("ssid", "").isEmpty();
  bool hasPassword = !getString("pass", "").isEmpty();
  
  end();
  
  return hasSSID && hasPassword;
}

bool ConfigManager::isRegistered() {
  if (!begin()) {
    Serial.println("[CONFIG] Failed to begin preferences");
    return false;
  }
  
  bool registered = getBool("registered", false);
  
  end();
  
  return registered;
}

String ConfigManager::getString(const char* key, const String& defaultValue) {
  return preferences.getString(key, defaultValue);
}

bool ConfigManager::putString(const char* key, const String& value) {
  return preferences.putString(key, value);
}

bool ConfigManager::getBool(const char* key, bool defaultValue) {
  return preferences.getBool(key, defaultValue);
}

bool ConfigManager::putBool(const char* key, bool value) {
  return preferences.putBool(key, value);
}

void ConfigManager::clear() {
  preferences.clear();
}
