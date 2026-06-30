/*
 * Phase T3.1 Validation Test
 * Tests persistent storage and device identity
 * 
 * This is a standalone test sketch for validating T3.1 implementation.
 * Use this to verify:
 * 1. Device identity persistence (same deviceId every boot)
 * 2. Storage persistence (configuration survives reboot)
 * 3. Factory reset (clears all configuration)
 */

#include <Arduino.h>
#include "storage/ConfigManager.h"
#include "identity/DeviceIdentity.h"

ConfigManager configManager;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("========================================");
  Serial.println("Phase T3.1 Validation Test");
  Serial.println("========================================");
  Serial.println();
  
  // Test 1: Device Identity
  Serial.println("[TEST 1] Device Identity Persistence");
  Serial.println("----------------------------------------");
  String deviceId1 = DeviceIdentity::getDeviceId();
  Serial.println("First boot deviceId: " + deviceId1);
  
  String deviceId2 = DeviceIdentity::getDeviceId();
  Serial.println("Second call deviceId: " + deviceId2);
  
  if (deviceId1 == deviceId2) {
    Serial.println("[PASS] Device identity is consistent");
  } else {
    Serial.println("[FAIL] Device identity changed!");
  }
  Serial.println();
  
  // Test 2: Storage Persistence
  Serial.println("[TEST 2] Storage Persistence");
  Serial.println("----------------------------------------");
  
  Config testConfig;
  testConfig.ssid = "TestSSID";
  testConfig.password = "TestPassword";
  testConfig.workerName = "TestWorker";
  testConfig.walletAddress = "TestWallet";
  testConfig.registered = true;
  testConfig.token = "TestToken1234567890";
  
  Serial.println("Saving test configuration...");
  if (configManager.saveConfiguration(testConfig)) {
    Serial.println("[PASS] Configuration saved");
  } else {
    Serial.println("[FAIL] Failed to save configuration");
  }
  
  Serial.println();
  Serial.println("Loading configuration...");
  Config loadedConfig;
  if (configManager.loadConfiguration(loadedConfig)) {
    Serial.println("[PASS] Configuration loaded");
    Serial.println("SSID: " + loadedConfig.ssid);
    Serial.println("Worker: " + loadedConfig.workerName);
    Serial.println("Registered: " + String(loadedConfig.registered ? "Yes" : "No"));
    
    if (loadedConfig.ssid == testConfig.ssid &&
        loadedConfig.workerName == testConfig.workerName &&
        loadedConfig.registered == testConfig.registered) {
      Serial.println("[PASS] Configuration data matches");
    } else {
      Serial.println("[FAIL] Configuration data mismatch!");
    }
  } else {
    Serial.println("[FAIL] Failed to load configuration");
  }
  Serial.println();
  
  // Test 3: Factory Reset
  Serial.println("[TEST 3] Factory Reset");
  Serial.println("----------------------------------------");
  Serial.println("Executing factory reset...");
  if (configManager.factoryReset()) {
    Serial.println("[PASS] Factory reset executed");
  } else {
    Serial.println("[FAIL] Factory reset failed");
  }
  
  Serial.println();
  Serial.println("Loading configuration after reset...");
  Config resetConfig;
  if (configManager.loadConfiguration(resetConfig)) {
    Serial.println("SSID: " + (resetConfig.ssid.isEmpty() ? "(empty)" : resetConfig.ssid));
    Serial.println("Worker: " + (resetConfig.workerName.isEmpty() ? "(empty)" : resetConfig.workerName));
    Serial.println("Registered: " + String(resetConfig.registered ? "Yes" : "No"));
    
    if (resetConfig.ssid.isEmpty() &&
        resetConfig.workerName.isEmpty() &&
        !resetConfig.registered &&
        resetConfig.token.isEmpty()) {
      Serial.println("[PASS] Configuration cleared successfully");
    } else {
      Serial.println("[FAIL] Configuration not cleared!");
    }
  } else {
    Serial.println("[FAIL] Failed to load configuration after reset");
  }
  Serial.println();
  
  Serial.println("========================================");
  Serial.println("Validation Test Complete");
  Serial.println("========================================");
  Serial.println();
  Serial.println("Instructions:");
  Serial.println("1. Upload this sketch to the device");
  Serial.println("2. Monitor serial output at 115200 baud");
  Serial.println("3. Verify all tests pass");
  Serial.println("4. Reboot device and verify deviceId remains the same");
  Serial.println("5. Replace with main firmware after validation");
}

void loop() {
  // Nothing to do in loop
  delay(1000);
}
