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
  
  display->drawText(0, 0, "Worker: " + state.workerName.substring(0, 10));
  display->drawText(0, 16, "Hash: " + String(state.hashrate, 1) + " H/s");
  display->drawText(0, 32, "Acc: " + String(state.acceptedShares));
  display->drawText(0, 40, "Rej: " + String(state.rejectedShares));
  display->drawText(0, 56, "Up: " + String(state.uptime) + "s");
}

void MiningScreen::update() {
  // Update every 5 seconds
  unsigned long now = millis();
  if (now - lastUpdate >= 5000) {
    lastUpdate = now;
    // Screen will re-render on next render() call
  }
}
