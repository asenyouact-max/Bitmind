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
    particles[i].color = (random(0, 10) < 7) ? TFT_BRAND_COLOR : TFT_CYAN_COLOR; // Orange or cyan
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
  display->fillScreen(TFT_BG_COLOR); // Uses DisplayManager abstraction
  
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
  
  // Header row: Logo (status pill is dynamic)
  // Logo: ₿ glyph + BITMIND text matching HTML spec
  // HTML: glyph 26x26, text 22px, gap 8px
  display->setForegroundColor(TFT_BRAND_COLOR);
  display->drawText(14, 12, "₿", 4); // Bitcoin glyph at top-left with padding
  
  display->setForegroundColor(TFT_FG_COLOR);
  display->drawText(44, 12, "BIT", 4); // White "BIT"
  display->setForegroundColor(TFT_BRAND_COLOR);
  display->drawText(84, 12, "MIND", 4); // Orange "MIND"
  
  // Divider line (hairline) matching HTML spec
  // HTML: height 1px, margin 10px 0, gradient
  display->setForegroundColor(TFT_LABEL_COLOR);
  display->fillRect(14, 44, 292, 1);
  
  // Hero subtitle: "Hashrate" label (muted, small, uppercase)
  // HTML: 9px, #7d8a99, letter-spacing 0.15em, uppercase
  display->setForegroundColor(TFT_LABEL_COLOR);
  display->drawTextCentered(75, "Hashrate", 1);
  
  // Bottom statistics row background (surface color)
  // HTML: rgba(11,15,20,0.4), padding 6px 4px 0, border-radius 4px
  display->setBackgroundColor(TFT_SURFACE_COLOR);
  display->fillRect(14, 200, 292, 36);
  
  // Bottom stat labels (muted, small, uppercase)
  // HTML: 8px, #4a5361, uppercase
  display->setForegroundColor(TFT_DIM_COLOR);
  display->drawText(18, 206, "Worker", 1);
  display->drawText(110, 206, "Shares", 1);
  display->drawText(202, 206, "Temp", 1);
  
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
    // HTML spec: padding 3px 8px, border 1px, font 9px, gap 5px
    int pillX = 230;
    int pillY = 12;
    int pillW = 76;
    int pillH = 20;
    
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
    
    // Draw status pill border (HTML: border 1px, transparent interior)
    display->setForegroundColor(statusColor);
    display->drawRect(pillX, pillY, pillW, pillH);
    
    // Status pill dot and text (HTML: gap 5px, font 9px)
    display->setForegroundColor(statusColor);
    display->drawText(pillX + 6, pillY + 5, "●", 1);
    display->setForegroundColor(statusColor);
    display->drawText(pillX + 14, pillY + 5, statusText, 1);
    
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
    display->fillRect(14, 85, 292, 50); // Clear hero value region
    
    // Determine color based on state - white value, orange unit
    uint16_t valueColor = TFT_FG_COLOR; // White for value
    uint16_t unitColor = TFT_BRAND_COLOR; // Orange for unit
    if (!state.wifiConnected || !state.registered) {
      valueColor = TFT_DIM_COLOR; // Dimmed when offline/connecting
      unitColor = TFT_DIM_COLOR;
    }
    
    display->setForegroundColor(valueColor);
    Serial.printf("[TRACE] SCREEN formatting %.2f (smoothed)\n", smoothedHashrate);
    
    // HTML spec: 38px font, white value, orange unit (15px), gap 6px
    // Center the hashrate value (dominant hero element)
    String hashrateStr = formatHashrate(smoothedHashrate);
    String unitStr = "H/s";
    
    // Calculate combined width for centering
    int valueWidth = hashrateStr.length() * 24; // Approximate for size 6
    int unitWidth = unitStr.length() * 12; // Approximate for size 3
    int totalWidth = valueWidth + unitWidth + 6; // +6px gap
    int x = (320 - totalWidth) / 2;
    if (x < 14) x = 14;
    
    // Draw value (white, large)
    display->drawText(x, 95, hashrateStr, 6);
    
    // Draw unit (orange, smaller)
    display->setForegroundColor(unitColor);
    display->drawText(x + valueWidth + 6, 108, unitStr, 3);
    
    lastHashrate = smoothedHashrate;
  }
}

void MiningScreen::renderStats() {
  const DeviceState& state = DeviceStateManager::getState();
  
  // Worker name (column 1) - HTML: 12px, white
  String workerDisplay = state.workerName;
  if (workerDisplay.length() > 12) {
    workerDisplay = workerDisplay.substring(0, 12);
  }
  if (workerDisplay != lastWorker) {
    display->setBackgroundColor(TFT_SURFACE_COLOR);
    display->fillRect(18, 216, 92, 16);
    display->setForegroundColor(TFT_FG_COLOR);
    display->drawText(18, 216, workerDisplay, 2); // Size 2 for value
    lastWorker = workerDisplay;
  }
  
  // Shares (column 2) - HTML: 12px, orange
  String sharesDisplay = String(state.acceptedShares);
  if (state.acceptedShares != lastShares) {
    display->setBackgroundColor(TFT_SURFACE_COLOR);
    display->fillRect(110, 216, 92, 16);
    display->setForegroundColor(TFT_BRAND_COLOR); // Orange for shares
    display->drawText(110, 216, sharesDisplay, 2); // Size 2 for value
    lastShares = state.acceptedShares;
  }
  
  // Temperature (column 3) - HTML: 12px, white
  const float tempDisplay = 58.0f; // Placeholder
  if (fabs(tempDisplay - lastTemp) > 0.5f) {
    display->setBackgroundColor(TFT_SURFACE_COLOR);
    display->fillRect(202, 216, 92, 16);
    display->setForegroundColor(TFT_FG_COLOR);
    display->drawText(202, 216, String((int)tempDisplay) + "°C", 2); // Size 2 for value
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
