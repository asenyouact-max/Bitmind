#include "MiningScreen.h"
#include "../DeviceState.h"

MiningScreen::MiningScreen(DisplayManager* displayManager)
  : Screen(displayManager), lastUpdate(0) {
}

void MiningScreen::onEnter() {
  Serial.println("[SCREEN] Mining screen entered");
  lastUpdate = 0;
}

void MiningScreen::render() {
  const DeviceState& state = DeviceStateManager::getState();
  
  // Top bar: Branding + Status
  display->drawText(0, 0, "BITMIND");
  display->drawText(96, 0, state.status);
  display->drawLine(0, 10, 127, 10);
  
  // Middle: Worker name
  String workerDisplay = state.workerName;
  if (workerDisplay.length() > 12) {
    workerDisplay = workerDisplay.substring(0, 12);
  }
  display->drawText(0, 16, "Worker: " + workerDisplay);
  
  // Bottom: Hashrate (prominent) + Temperature + Status
  display->drawText(0, 36, String(state.hashrate, 1) + " MH/s", 2);
  display->drawText(96, 48, String((int)state.temperature) + "C");
  display->drawText(56, 56, "● Mining");
}

void MiningScreen::update() {
  // Update every 5 seconds
  unsigned long now = millis();
  if (now - lastUpdate >= 5000) {
    lastUpdate = now;
    // Screen will re-render on next render() call
  }
}
