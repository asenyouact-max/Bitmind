/*
 * Bitmind TFT Firmware v1
 * Phase T1 - DisplayManager Implementation
 * Target: ESP32-2432S028 (Cheap Yellow Display - CYD)
 * Display: ILI9341 TFT 240x320
 * 
 * Authoritative Documents:
 * - BITMIND_TFT_ARCHITECTURE_PLAN.md
 * - BITMIND_TFT_PHASE_T0_AUDIT.md
 */

#include <Arduino.h>
#include "display/DisplayManager.h"

// ============================================================================
// CONFIGURATION
// ============================================================================

#define FIRMWARE_VERSION "1.0.0"
#define DEVICE_TYPE "tft_miner"

// ============================================================================
// GLOBAL OBJECTS
// ============================================================================

DisplayManager* displayManager = nullptr;

// ============================================================================
// SETUP
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("========================================");
  Serial.println("BITMIND TFT FIRMWARE v1");
  Serial.println("Phase T1 - DisplayManager Implementation");
  Serial.println("========================================");
  Serial.printf("Firmware Version: %s\n", FIRMWARE_VERSION);
  Serial.printf("Device Type: %s\n", DEVICE_TYPE);
  Serial.println();
  
  // Initialize DisplayManager
  Serial.println("[MAIN] Initializing DisplayManager...");
  displayManager = new DisplayManager();
  
  if (displayManager->begin()) {
    Serial.println("[MAIN] DisplayManager initialized successfully");
    
    // Display test message
    displayManager->clear();
    displayManager->setForegroundColor(TFT_FG_COLOR);
    displayManager->setBackgroundColor(TFT_BG_COLOR);
    
    // Display "BITMIND" centered
    displayManager->setTextCentered(40, "BITMIND", 3);
    
    // Display "TFT INITIALIZED" centered
    displayManager->setTextCentered(100, "TFT INITIALIZED", 2);
    
    // Display "ESP32-2432S028" centered
    displayManager->setTextCentered(160, "ESP32-2432S028", 2);
    
    Serial.println("[MAIN] Test message displayed");
  } else {
    Serial.println("[MAIN] ERROR: DisplayManager initialization failed");
  }
  
  Serial.println("[MAIN] Setup complete");
  Serial.println();
}

// ============================================================================
// LOOP
// ============================================================================

void loop() {
  // Phase T1: DisplayManager test only
  // No additional logic in this phase
  delay(1000);
}
