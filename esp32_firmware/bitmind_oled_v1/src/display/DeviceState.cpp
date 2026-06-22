#include "DeviceState.h"

// Initialize static state
DeviceState DeviceStateManager::state = {
  // WiFi State
  false,  // wifiConnected
  String(""),     // wifiSSID
  0,      // wifiRSSI

  // Backend State
  false,  // backendConnected
  String(""),     // backendHost

  // Registration State
  false,  // registered
  String(""),     // deviceId
  String(""),     // workerName
  String(""),     // walletAddress
  String(""),     // token

  // Mining State
  false,  // miningActive
  String(""),     // jobId
  0.0f,   // hashrate
  0,      // acceptedShares
  0,      // rejectedShares
  0       // uptime

  // System State
  String("IDLE"), // status
  String(""),     // lastError
  0,      // lastErrorTime

  // AP Mode State
  false,  // apMode
  String(""),     // apSSID
  String("")      // apIP

  // QR Code State
  String("")      // qrPayload
};

const DeviceState& DeviceStateManager::getState() {
  return state;
}

// WiFi State Updates
void DeviceStateManager::setWiFiConnected(bool connected) {
  state.wifiConnected = connected;
}

void DeviceStateManager::setWiFiSSID(const String& ssid) {
  state.wifiSSID = ssid;
}

void DeviceStateManager::setWiFiRSSI(int rssi) {
  state.wifiRSSI = rssi;
}

// Backend State Updates
void DeviceStateManager::setBackendConnected(bool connected) {
  state.backendConnected = connected;
}

void DeviceStateManager::setBackendHost(const String& host) {
  state.backendHost = host;
}

// Registration State Updates
void DeviceStateManager::setRegistered(bool registered) {
  state.registered = registered;
}

void DeviceStateManager::setDeviceId(const String& deviceId) {
  state.deviceId = deviceId;
}

void DeviceStateManager::setWorkerName(const String& workerName) {
  state.workerName = workerName;
}

void DeviceStateManager::setWalletAddress(const String& walletAddress) {
  state.walletAddress = walletAddress;
}

void DeviceStateManager::setToken(const String& token) {
  state.token = token;
}

// Mining State Updates
void DeviceStateManager::setMiningActive(bool active) {
  state.miningActive = active;
}

void DeviceStateManager::setJobId(const String& jobId) {
  state.jobId = jobId;
}

void DeviceStateManager::setHashrate(float hashrate) {
  state.hashrate = hashrate;
}

void DeviceStateManager::setAcceptedShares(uint32_t shares) {
  state.acceptedShares = shares;
}

void DeviceStateManager::setRejectedShares(uint32_t shares) {
  state.rejectedShares = shares;
}

void DeviceStateManager::setUptime(uint32_t uptime) {
  state.uptime = uptime;
}

// System State Updates
void DeviceStateManager::setStatus(const String& status) {
  state.status = status;
}

void DeviceStateManager::setLastError(const String& error) {
  state.lastError = error;
  state.lastErrorTime = millis();
}

// AP Mode State Updates
void DeviceStateManager::setAPMode(bool apMode) {
  state.apMode = apMode;
}

void DeviceStateManager::setAPSSID(const String& ssid) {
  state.apSSID = ssid;
}

void DeviceStateManager::setAPIP(const String& ip) {
  state.apIP = ip;
}

// QR Code State Updates
void DeviceStateManager::setQRPayload(const String& payload) {
  state.qrPayload = payload;
}
