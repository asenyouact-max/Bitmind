#include "MiningScreen.h"
#include "../DeviceState.h"

MiningScreen::MiningScreen(DisplayManager* displayManager)
  : Screen(displayManager), lastUpdate(0) {
  Serial.printf("[LIFECYCLE] MiningScreen::MiningScreen() - this=%p\n", this);
}

void MiningScreen::onEnter() {
  Serial.println("[SCREEN] Mining screen entered");
  lastUpdate = 0;
}

void MiningScreen::render() {
  const DeviceState& state = DeviceStateManager::getState();
  
  display->fillScreen(TFT_BG_COLOR);
  
  // Header bar: BITMIND [MINING] (size 2, white/Bitcoin Orange)
  display->setForegroundColor(TFT_FG_COLOR);
  display->drawText(20, 20, "BITMIND", 2);
  
  display->setForegroundColor(TFT_BRAND_COLOR);
  display->drawText(200, 20, "[MINING]", 2);
  
  // Separator line
  display->setForegroundColor(TFT_GRAY_COLOR);
  display->fillRect(10, 50, 300, 2);
  
  // Worker name (left-aligned, size 2, white)
  display->setForegroundColor(TFT_FG_COLOR);
  String workerDisplay = state.workerName;
  if (workerDisplay.length() > 16) {
    workerDisplay = workerDisplay.substring(0, 16);
  }
  display->drawText(20, 80, "Worker: " + workerDisplay, 2);
  
  // Hashrate (left-aligned, size 3, Bitcoin Orange - prominent)
  display->setForegroundColor(TFT_BRAND_COLOR);
  display->drawText(20, 120, "Hashrate: " + String(state.hashrate, 1) + " MH/s", 3);
  
  // Status (left-aligned, size 2, Bitcoin Orange with icon)
  display->setForegroundColor(TFT_BRAND_COLOR);
  display->drawText(20, 160, "● " + state.status, 2);
  
  // Pool (left-aligned, size 1, light gray)
  display->setForegroundColor(TFT_GRAY_COLOR);
  display->drawText(20, 200, "Pool: stratum+tcp://...", 1);
  
  // Uptime (left-aligned, size 1, light gray)
  display->setForegroundColor(TFT_GRAY_COLOR);
  display->drawText(20, 220, "Uptime: " + String(state.uptime / 60) + "m", 1);
}

void MiningScreen::update() {
  // Update every 5 seconds
  unsigned long now = millis();
  if (now - lastUpdate >= 5000) {
    lastUpdate = now;
    // Screen will re-render on next render() call
  }
}
