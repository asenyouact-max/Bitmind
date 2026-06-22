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
  
  display->drawTextCentered(0, "REGISTERING", 2);
  display->drawText(0, 24, "Device: " + state.deviceId.substring(0, 12));
  display->drawText(0, 32, "Worker: " + state.workerName.substring(0, 12));
  display->drawTextCentered(48, "Please wait...", 1);
}
