#include "RegisteringScreen.h"
#include "../DeviceState.h"

RegisteringScreen::RegisteringScreen(DisplayManager* displayManager)
  : Screen(displayManager) {
}

void RegisteringScreen::onEnter() {
  Serial.println("[SCREEN] Registering screen entered");
}

void RegisteringScreen::render() {
  const DeviceState& state = DeviceStateManager::getState();
  
  display->fillScreen(TFT_BG_COLOR);
  
  // Header - REGISTERING (centered, size 3, white)
  display->setForegroundColor(TFT_FG_COLOR);
  display->drawTextCentered(20, "REGISTERING", 3);
  
  // Separator line
  display->setForegroundColor(TFT_GRAY_COLOR);
  display->fillRect(10, 50, 300, 2);
  
  // Registering device... (centered, size 2, white)
  display->setForegroundColor(TFT_FG_COLOR);
  display->drawTextCentered(80, "Registering device...", 2);
  
  // Device ID (left-aligned, size 2, light gray)
  display->setForegroundColor(TFT_GRAY_COLOR);
  display->drawText(20, 120, "Device ID: " + state.deviceId.substring(0, 12), 2);
  
  // Worker name (left-aligned, size 2, light gray)
  display->drawText(20, 150, "Worker: " + state.workerName, 2);
  
  // Registration icon (centered, Bitcoin Orange)
  display->setForegroundColor(TFT_BRAND_COLOR);
  display->fillRect(150, 180, 20, 20);
  
  // Please wait... (centered, size 2, light gray)
  display->setForegroundColor(TFT_GRAY_COLOR);
  display->drawTextCentered(220, "Please wait...", 2);
  
  // Progress spinner placeholder (Bitcoin Orange)
  display->setForegroundColor(TFT_BRAND_COLOR);
  display->fillRect(150, 250, 20, 20);
}
