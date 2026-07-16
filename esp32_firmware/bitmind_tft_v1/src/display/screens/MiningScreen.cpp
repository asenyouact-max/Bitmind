#include "MiningScreen.h"
#include "../DeviceState.h"

MiningScreen::MiningScreen(DisplayManager* displayManager)
  : Screen(displayManager), lastUpdate(0), staticRendered(false), 
    lastHashrate(0.0f), smoothedHashrate(0.0f) {
  Serial.printf("[LIFECYCLE] MiningScreen::MiningScreen() - this=%p\n", this);
}

void MiningScreen::onEnter() {
  Serial.println("[SCREEN] Mining screen entered");
  lastUpdate = 0;
  staticRendered = false;
  lastHashrate = 0.0f;
  smoothedHashrate = 0.0f;
}

String MiningScreen::formatHashrate(float hashrateHps) {
  // Adaptive human-readable formatting based on H/s value
  if (hashrateHps < 1000.0f) {
    // < 1,000 H/s → xxx H/s
    return String((int)hashrateHps) + " H/s";
  } else if (hashrateHps < 1000000.0f) {
    // >= 1,000 H/s and < 1,000,000 H/s → x.xx kH/s
    return String(hashrateHps / 1000.0f, 2) + " kH/s";
  } else {
    // >= 1,000,000 H/s → x.xx MH/s
    return String(hashrateHps / 1000000.0f, 2) + " MH/s";
  }
}

void MiningScreen::renderStatic() {
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
  
  // Pool (left-aligned, size 1, light gray)
  display->setForegroundColor(TFT_GRAY_COLOR);
  display->drawText(20, 200, "Pool: stratum+tcp://...", 1);
  
  // Status (left-aligned, size 2, Bitcoin Orange with icon)
  display->setForegroundColor(TFT_BRAND_COLOR);
  display->drawText(20, 160, "● " + state.status, 2);
  
  // Uptime (left-aligned, size 1, light gray)
  display->setForegroundColor(TFT_GRAY_COLOR);
  display->drawText(20, 220, "Uptime: " + String(state.uptime / 60) + "m", 1);
  
  staticRendered = true;
}

void MiningScreen::renderHashrate() {
  const DeviceState& state = DeviceStateManager::getState();
  Serial.printf("[TRACE] SCREEN reading %.2f\n", state.hashrate);
  
  // Apply EMA smoothing to hashrate for display
  if (smoothedHashrate == 0.0f) {
    smoothedHashrate = state.hashrate;
  } else {
    smoothedHashrate = EMA_ALPHA * state.hashrate + (1.0f - EMA_ALPHA) * smoothedHashrate;
  }
  
  // Clear and redraw hashrate region if changed
  if (fabs(smoothedHashrate - lastHashrate) > 0.01f) {
    display->setForegroundColor(TFT_BG_COLOR);
    display->fillRect(20, 120, 300, 30);
    
    display->setForegroundColor(TFT_BRAND_COLOR);
    Serial.printf("[TRACE] SCREEN formatting %.2f (smoothed)\n", smoothedHashrate);
    display->drawText(20, 120, "Hashrate: " + formatHashrate(smoothedHashrate), 3);
    
    lastHashrate = smoothedHashrate;
  }
}

void MiningScreen::render() {
  if (!staticRendered) {
    renderStatic();
  }
  renderHashrate();
}

void MiningScreen::update() {
  // Update every 5 seconds
  unsigned long now = millis();
  if (now - lastUpdate >= 5000) {
    lastUpdate = now;
    // Screen will re-render on next render() call
  }
}
