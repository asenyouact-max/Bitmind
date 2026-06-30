#include "DeviceIdentity.h"

String DeviceIdentity::cachedDeviceId = "";
bool DeviceIdentity::initialized = false;

String DeviceIdentity::generateDeviceId() {
  uint64_t chipid = ESP.getEfuseMac();
  
  // Use last 2 bytes of MAC for device ID
  // Format: esp32-xxxx (where xxxx is the last 4 hex digits)
  uint16_t deviceIdSuffix = (uint16_t)(chipid & 0xFFFF);
  
  char deviceIdStr[32];
  sprintf(deviceIdStr, "esp32-%04x", deviceIdSuffix);
  
  String result = String(deviceIdStr);
  Serial.println("[DEVICE_ID] GENERATED=" + result);
  
  return result;
}

String DeviceIdentity::getDeviceId() {
  if (!initialized) {
    initialize();
  }
  
  return cachedDeviceId;
}

void DeviceIdentity::initialize() {
  cachedDeviceId = generateDeviceId();
  initialized = true;
}
