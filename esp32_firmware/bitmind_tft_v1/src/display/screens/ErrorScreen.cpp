#include "ErrorScreen.h"
#include "../DeviceState.h"

ErrorScreen::ErrorScreen(DisplayManager* displayManager)
  : Screen(displayManager) {
}

void ErrorScreen::onEnter() {
  Serial.println("[SCREEN] Error screen entered");
}

void ErrorScreen::render() {
  const DeviceState& state = DeviceStateManager::getState();
  
  display->drawTextCentered(0, "ERROR", 2);
  display->drawText(0, 24, "Status: " + state.status);
  display->drawText(0, 32, "Error:");
  display->drawText(0, 40, state.lastError.substring(0, 16));
  display->drawTextCentered(56, "Check serial", 1);
}
