#ifndef DEVICE_IDENTITY_H
#define DEVICE_IDENTITY_H

#include <Arduino.h>

class DeviceIdentity {
public:
  // Generate device ID from hardware identity (EFuse MAC)
  static String generateDeviceId();
  
  // Get device ID (generates if not cached)
  static String getDeviceId();
  
private:
  static String cachedDeviceId;
  static bool initialized;
  
  // Initialize device ID from hardware
  static void initialize();
};

#endif // DEVICE_IDENTITY_H
