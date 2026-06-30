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
#include <TFT_eSPI.h>
#include "display/DisplayManager.h"
#include "display/ScreenManager.h"
#include "display/screens/SplashScreen.h"
#include "display/screens/SetupScreen.h"
#include "display/screens/ConnectingScreen.h"
#include "display/screens/RegisteringScreen.h"
#include "display/screens/MiningScreen.h"
#include "display/screens/ErrorScreen.h"

// ============================================================================
// CONFIGURATION
// ============================================================================

#define FIRMWARE_VERSION "1.0.0"
#define DEVICE_TYPE "tft_miner"

// Phase T2.8: Temporary validation mode
#define VALIDATION_MODE 1

// ============================================================================
// GLOBAL OBJECTS
// ============================================================================

// Phase T2.5 Fix: TFT_eSPI as global object to match hardware_test construction timing
TFT_eSPI tft = TFT_eSPI();

DisplayManager* displayManager = nullptr;
ScreenManager* screenManager = nullptr;

// Phase T2.8: Validation mode state
#if VALIDATION_MODE
unsigned long lastScreenChange = 0;
int currentValidationScreen = 0;
const int NUM_VALIDATION_SCREENS = 6;
#endif

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
  
  // Initialize DisplayManager with global TFT_eSPI reference
  Serial.println("[MAIN] Initializing DisplayManager...");
  displayManager = new DisplayManager(tft);
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
#if VALIDATION_MODE
  // Phase T2.8: Validation mode - cycle through all screens every 3 seconds
  if (screenManager && millis() - lastScreenChange >= 3000) {
    lastScreenChange = millis();
    currentValidationScreen = (currentValidationScreen + 1) % NUM_VALIDATION_SCREENS;
    
    Serial.printf("[VALIDATION] Switching to screen %d\n", currentValidationScreen);
    
    switch (currentValidationScreen) {
      case 0:
        screenManager->transitionTo<SplashScreen>();
        break;
      case 1:
        screenManager->transitionTo<SetupScreen>();
        break;
      case 2:
        screenManager->transitionTo<ConnectingScreen>();
        break;
      case 3:
        screenManager->transitionTo<RegisteringScreen>();
        break;
      case 4:
        screenManager->transitionTo<MiningScreen>();
        break;
      case 5:
        screenManager->transitionTo<ErrorScreen>();
        break;
    }
  }
  
  if (screenManager) {
    // Skip update() in validation mode to prevent normal state machine from overriding validation transitions
    screenManager->render();
  }
  delay(100);
#else
  // Phase T2: Screen system active
  if (screenManager) {
    screenManager->update();
    screenManager->render();
  }
  delay(100);
#endif
}
