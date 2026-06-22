#include "ConnectingScreen.h"
#include "../DeviceState.h"

ConnectingScreen::ConnectingScreen(DisplayManager* displayManager)
  : Screen(displayManager) {
}

void ConnectingScreen::onEnter() {
  Serial.println("[SCREEN] Connecting screen entered");
}

void ConnectingScreen::render() {
  const DeviceState& state = DeviceStateManager::getState();
  
  display->drawTextCentered(0, "CONNECTING", 2);
  display->drawText(0, 24, "WiFi: " + state.wifiSSID);
  display->drawText(0, 32, "RSSI: " + String(state.wifiRSSI) + " dBm");
  display->drawTextCentered(48, "Please wait...", 1);
}
