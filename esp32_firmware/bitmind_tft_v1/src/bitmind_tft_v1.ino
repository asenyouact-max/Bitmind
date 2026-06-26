/*
 * Bitmind TFT Firmware v1
 * Phase T2 - Screen Layout Implementation
 * Target: ESP32-2432S028 (Cheap Yellow Display - CYD)
 * Display: ILI9341 TFT 320x240 landscape
 * 
 * Authoritative Documents:
 * - BITMIND_TFT_ARCHITECTURE_PLAN.md
 * - BITMIND_TFT_PHASE_T0_AUDIT.md
 * - BITMIND_TFT_PHASE_T2_DESIGN_REVIEW.md
 */

#include <Arduino.h>
#include "display/DisplayManager.h"
#include "display/ScreenManager.h"

// ============================================================================
// CONFIGURATION
// ============================================================================

#define FIRMWARE_VERSION "1.0.0"
#define DEVICE_TYPE "tft_miner"

// ============================================================================
// GLOBAL OBJECTS
// ============================================================================

DisplayManager* displayManager = nullptr;
ScreenManager* screenManager = nullptr;

// ============================================================================
// SETUP
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("========================================");
  Serial.println("BITMIND TFT FIRMWARE v1");
  Serial.println("Phase T2 - Screen Layout Implementation");
  Serial.println("========================================");
  Serial.printf("Firmware Version: %s\n", FIRMWARE_VERSION);
  Serial.printf("Device Type: %s\n", DEVICE_TYPE);
  Serial.println();
  
  // Initialize DisplayManager
  Serial.println("[MAIN] Initializing DisplayManager...");
  displayManager = new DisplayManager();
  Serial.printf("[MAIN] DisplayManager created at %p\n", displayManager);
  
  if (displayManager->begin()) {
    Serial.println("[MAIN] DisplayManager initialized successfully");
    
    // Initialize ScreenManager (creates all screens internally)
    Serial.println("[MAIN] Initializing ScreenManager...");
    screenManager = new ScreenManager(displayManager);
    Serial.printf("[MAIN] ScreenManager created at %p\n", screenManager);
    screenManager->begin();
    
    Serial.println("[MAIN] Screen system ready");
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
  // Phase T2: Screen system active
  if (screenManager) {
    screenManager->update();
    screenManager->render();
  }
  delay(100);
}
