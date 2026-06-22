#ifndef DEVICE_STATE_H
#define DEVICE_STATE_H

#include <Arduino.h>

struct DeviceState {
  // WiFi State
  bool wifiConnected;
  String wifiSSID;
  int wifiRSSI;
  
  // Backend State
  bool backendConnected;
  String backendHost;
  
  // Registration State
  bool registered;
  String deviceId;
  String workerName;
  String walletAddress;
  String token;
  
  // Mining State
  bool miningActive;
  String jobId;
  float hashrate;
  uint32_t acceptedShares;
  uint32_t rejectedShares;
  uint32_t uptime;
  
  // System State
  String status;  // "IDLE", "CONNECTING", "REGISTERING", "MINING", "ERROR", "SETUP"
  String lastError;
  uint32_t lastErrorTime;
  
  // AP Mode State
  bool apMode;
  String apSSID;
  String apIP;
  
  // QR Code State
  String qrPayload;
};

class DeviceStateManager {
public:
  // Get current state (read-only)
  static const DeviceState& getState();
  
  // WiFi State Updates
  static void setWiFiConnected(bool connected);
  static void setWiFiSSID(const String& ssid);
  static void setWiFiRSSI(int rssi);
  
  // Backend State Updates
  static void setBackendConnected(bool connected);
  static void setBackendHost(const String& host);
  
  // Registration State Updates
  static void setRegistered(bool registered);
  static void setDeviceId(const String& deviceId);
  static void setWorkerName(const String& workerName);
  static void setWalletAddress(const String& walletAddress);
  static void setToken(const String& token);
  
  // Mining State Updates
  static void setMiningActive(bool active);
  static void setJobId(const String& jobId);
  static void setHashrate(float hashrate);
  static void setAcceptedShares(uint32_t shares);
  static void setRejectedShares(uint32_t shares);
  static void setUptime(uint32_t uptime);
  
  // System State Updates
  static void setStatus(const String& status);
  static void setLastError(const String& error);
  
  // AP Mode State Updates
  static void setAPMode(bool apMode);
  static void setAPSSID(const String& ssid);
  static void setAPIP(const String& ip);
  
  // QR Code State Updates
  static void setQRPayload(const String& payload);
  
private:
  static DeviceState state;
};

#endif // DEVICE_STATE_H
