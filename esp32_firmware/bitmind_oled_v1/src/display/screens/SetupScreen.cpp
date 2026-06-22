#include "SetupScreen.h"
#include "../DeviceState.h"

SetupScreen::SetupScreen(DisplayManager* displayManager)
  : Screen(displayManager) {
}

void SetupScreen::onEnter() {
  Serial.println("[SCREEN] Setup screen entered");
}

void SetupScreen::render() {
  const DeviceState& state = DeviceStateManager::getState();
  
  display->drawTextCentered(0, "BITMIND SETUP", 2);
  display->drawText(0, 24, "SSID: " + state.apSSID);
  display->drawText(0, 32, "IP: " + state.apIP);
  display->drawText(0, 40, "Open browser");
  display->drawText(0, 48, "Waiting...");
}
