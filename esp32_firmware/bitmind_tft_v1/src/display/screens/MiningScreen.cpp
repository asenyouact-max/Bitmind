#include "MiningScreen.h"
#include "../DeviceState.h"

MiningScreen::MiningScreen(DisplayManager* displayManager)
  : Screen(displayManager), lastUpdate(0), staticRendered(false), 
    lastHashrate(0.0f), lastWorker(""), lastShares(0), lastTemp(0.0f),
    smoothedHashrate(0.0f), lastParticleUpdate(0), lastStatusState("") {
  Serial.printf("[LIFECYCLE] MiningScreen::MiningScreen() - this=%p\n", this);
  initParticles();
}

void MiningScreen::onEnter() {
  Serial.println("[SCREEN] Mining screen entered");
  lastUpdate = 0;
  staticRendered = false;
  lastHashrate = 0.0f;
  lastWorker = "";
  lastShares = 0;
  lastTemp = 0.0f;
  smoothedHashrate = 0.0f;
  lastParticleUpdate = 0;
  lastStatusState = "";
  initParticles();
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

void MiningScreen::initParticles() {
  for (int i = 0; i < NUM_PARTICLES; i++) {
    particles[i].x = random(0, 320);
    particles[i].y = random(0, 240);
    particles[i].vx = random(-1, 2);
    particles[i].vy = random(-1, 2);
    particles[i].color = (random(0, 10) < 7) ? TFT_BRAND_COLOR : 0x001F; // Orange or cyan
    particles[i].alpha = 0.3f + (random(0, 100) / 200.0f);
    particles[i].pulse = random(0, 628) / 100.0f;
  }
}

void MiningScreen::updateParticles() {
  for (int i = 0; i < NUM_PARTICLES; i++) {
    particles[i].x += particles[i].vx;
    particles[i].y += particles[i].vy;
    particles[i].pulse += 0.1f;
    
    // Wrap around screen
    if (particles[i].x < -10) particles[i].x = 330;
    if (particles[i].x > 330) particles[i].x = -10;
    if (particles[i].y < -10) particles[i].y = 250;
    if (particles[i].y > 250) particles[i].y = -10;
  }
}

void MiningScreen::renderParticles() {
  unsigned long now = millis();
  if (now - lastParticleUpdate < 300) return; // Update every 300ms
  lastParticleUpdate = now;
  
  updateParticles();
  
  // Clear particle region (full screen for simplicity, could be optimized)
  display->fillScreen(TFT_BG_COLOR);
  
  // Render particles
  for (int i = 0; i < NUM_PARTICLES; i++) {
    float pulseAlpha = particles[i].alpha * (0.6f + 0.4f * sin(particles[i].pulse));
    // Note: TFT_eSPI doesn't support alpha blending directly
    // We simulate by using smaller circles for "fainter" particles
    int radius = (int)(2.0f * pulseAlpha);
    if (radius < 1) radius = 1;
    
    display->setForegroundColor(particles[i].color);
    display->fillRect(particles[i].x - radius, particles[i].y - radius, radius * 2, radius * 2);
  }
}

void MiningScreen::renderStatic() {
  const DeviceState& state = DeviceStateManager::getState();
  
  display->fillScreen(TFT_BG_COLOR);
  
  // Header row: Logo only (status pill is dynamic)
  // Logo: ₿ glyph + BITMIND text with increased padding
  display->setForegroundColor(TFT_BRAND_COLOR);
  display->drawText(16, 16, "₿", 3); // Bitcoin glyph, larger size 3
  
  display->setForegroundColor(TFT_FG_COLOR);
  display->drawText(50, 16, "BIT", 3); // Larger size 3 for branding
  display->setForegroundColor(TFT_BRAND_COLOR);
  display->drawText(98, 16, "MIND", 3); // Larger size 3 for branding
  
  // Divider line (hairline) with more whitespace
  display->setForegroundColor(TFT_LABEL_COLOR);
  display->fillRect(16, 50, 288, 1);
  
  // Bottom statistics row background (card surface) with increased padding
  display->setBackgroundColor(TFT_CARD_COLOR);
  display->fillRect(16, 165, 288, 55);
  
  // Bottom stat labels (muted) with better spacing
  display->setForegroundColor(TFT_LABEL_COLOR);
  display->drawText(26, 176, "Worker", 1);
  display->drawText(116, 176, "Shares", 1);
  display->drawText(206, 176, "Temp", 1);
  
  staticRendered = true;
}

String MiningScreen::getCurrentStateKey() {
  const DeviceState& state = DeviceStateManager::getState();
  
  if (!state.wifiConnected || !state.registered) {
    return "SYNC";
  } else if (!state.miningActive) {
    return "OFFLINE";
  } else {
    return "ONLINE";
  }
}

void MiningScreen::renderStatusPill() {
  const DeviceState& state = DeviceStateManager::getState();
  String currentStateKey = getCurrentStateKey();
  
  // Only redraw if state changed
  if (currentStateKey != lastStatusState) {
    int pillX = 200;
    int pillY = 16;
    int pillW = 100;
    int pillH = 24;
    
    // Determine status text and color
    String statusText = "ONLINE";
    uint16_t statusColor = TFT_BRAND_COLOR;
    
    if (currentStateKey == "SYNC") {
      statusText = "SYNC";
      statusColor = TFT_CYAN_COLOR;
    } else if (currentStateKey == "OFFLINE") {
      statusText = "OFFLINE";
      statusColor = TFT_DIM_COLOR;
    }
    
    // Clear and redraw status pill
    display->setBackgroundColor(TFT_BG_COLOR);
    display->fillRect(pillX, pillY, pillW, pillH);
    
    // Draw status pill background (no fill, just border for premium look)
    display->setForegroundColor(statusColor);
    display->drawRect(pillX, pillY, pillW, pillH);
    
    // Status pill text
    display->setForegroundColor(statusColor);
    display->drawText(pillX + 10, pillY + 6, "●", 1);
    display->setForegroundColor(TFT_FG_COLOR);
    display->drawText(pillX + 24, pillY + 6, statusText, 1);
    
    lastStatusState = currentStateKey;
  }
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
    display->setBackgroundColor(TFT_BG_COLOR);
    display->fillRect(16, 60, 288, 95); // Clear hero region with more padding
    
    // Determine color based on state - Bitcoin Orange dominates when online
    uint16_t hashrateColor = TFT_BRAND_COLOR; // Primary accent for hashrate
    if (!state.wifiConnected || !state.registered) {
      hashrateColor = TFT_DIM_COLOR; // Dimmed when offline/connecting
    }
    
    display->setForegroundColor(hashrateColor);
    Serial.printf("[TRACE] SCREEN formatting %.2f (smoothed)\n", smoothedHashrate);
    
    // Center the hashrate value (dominant hero element, size 6 for maximum impact)
    String hashrateStr = formatHashrate(smoothedHashrate);
    int textWidth = hashrateStr.length() * 36; // Approximate width for size 6
    int x = (320 - textWidth) / 2;
    if (x < 16) x = 16;
    
    display->drawText(x, 90, hashrateStr, 6); // Size 6 for maximum dominance
    
    lastHashrate = smoothedHashrate;
  }
}

void MiningScreen::renderStats() {
  const DeviceState& state = DeviceStateManager::getState();
  
  // Worker name (column 1) - larger font for values
  String workerDisplay = state.workerName;
  if (workerDisplay.length() > 12) {
    workerDisplay = workerDisplay.substring(0, 12);
  }
  if (workerDisplay != lastWorker) {
    display->setBackgroundColor(TFT_CARD_COLOR);
    display->fillRect(26, 190, 80, 20);
    display->setForegroundColor(TFT_FG_COLOR);
    display->drawText(26, 190, workerDisplay, 2); // Size 2 for value hierarchy
    lastWorker = workerDisplay;
  }
  
  // Shares (column 2) - format with commas, larger font, Bitcoin Orange
  String sharesDisplay = String(state.acceptedShares);
  if (state.acceptedShares != lastShares) {
    display->setBackgroundColor(TFT_CARD_COLOR);
    display->fillRect(116, 190, 80, 20);
    display->setForegroundColor(TFT_BRAND_COLOR); // Bitcoin Orange for important value
    display->drawText(116, 190, sharesDisplay, 2); // Size 2 for value hierarchy
    lastShares = state.acceptedShares;
  }
  
  // Temperature (column 3) - placeholder since temp not in DeviceState
  const float tempDisplay = 58.0f; // Placeholder
  if (fabs(tempDisplay - lastTemp) > 0.5f) {
    display->setBackgroundColor(TFT_CARD_COLOR);
    display->fillRect(206, 190, 80, 20);
    display->setForegroundColor(TFT_FG_COLOR);
    display->drawText(206, 190, String((int)tempDisplay) + "°C", 2); // Size 2 for value hierarchy
    lastTemp = tempDisplay;
  }
}

void MiningScreen::render() {
  if (!staticRendered) {
    renderStatic();
  }
  renderStatusPill();
  renderHashrate();
  renderStats();
  // renderParticles(); // Disabled for now to avoid full-screen clears
}

void MiningScreen::update() {
  // Update every 5 seconds
  unsigned long now = millis();
  if (now - lastUpdate >= 5000) {
    lastUpdate = now;
    // Screen will re-render on next render() call
  }
}
