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
  display->drawText(0, 24, "IP: " + state.apIP);
  display->drawText(0, 32, "Connect WiFi");
  display->drawText(0, 40, "Scan QR or");
  display->drawText(0, 48, "open browser");
}
