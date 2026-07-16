#include "MiningScreen.h"
#include "../DeviceState.h"

MiningScreen::MiningScreen(DisplayManager* displayManager)
  : Screen(displayManager), lastUpdate(0), staticRendered(false), 
    lastHashrate(0.0f), lastWorker(""), lastShares(0), lastTemp(0.0f),
    smoothedHashrate(0.0f), lastParticleUpdate(0) {
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
  
  // Header row: Logo + Status pill
  // Logo: ₿ glyph + BITMIND text
  display->setForegroundColor(TFT_BRAND_COLOR);
  display->drawText(14, 14, "₿", 2); // Bitcoin glyph
  
  display->setForegroundColor(TFT_FG_COLOR);
  display->drawText(38, 14, "BIT", 2);
  display->setForegroundColor(TFT_BRAND_COLOR);
  display->drawText(78, 14, "MIND", 2);
  
  // Status pill (ONLINE)
  display->setForegroundColor(TFT_BRAND_COLOR);
  display->drawText(250, 16, "●", 1);
  display->setForegroundColor(TFT_FG_COLOR);
  display->drawText(260, 16, "ONLINE", 1);
  
  // Divider line (gradient effect simulated with solid line)
  display->setForegroundColor(TFT_GRAY_COLOR);
  display->fillRect(14, 40, 292, 1);
  
  // Hero section label
  display->setForegroundColor(TFT_GRAY_COLOR);
  display->drawText(160, 70, "HASHRATE", 1);
  
  // Bottom statistics row background
  display->setForegroundColor(0x1a1f26); // Dark gray background
  display->fillRect(14, 180, 292, 40);
  
  // Bottom stat labels
  display->setForegroundColor(0x4a5361); // Darker gray for labels
  display->drawText(30, 188, "WORKER", 1);
  display->drawText(130, 188, "SHARES", 1);
  display->drawText(230, 188, "TEMP", 1);
  
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
    display->setBackgroundColor(TFT_BG_COLOR);
    display->fillRect(14, 90, 292, 50); // Clear hero region
    
    display->setForegroundColor(TFT_FG_COLOR);
    Serial.printf("[TRACE] SCREEN formatting %.2f (smoothed)\n", smoothedHashrate);
    
    // Center the hashrate value
    String hashrateStr = formatHashrate(smoothedHashrate);
    int textWidth = hashrateStr.length() * 24; // Approximate width for size 4
    int x = (320 - textWidth) / 2;
    if (x < 14) x = 14;
    
    display->drawText(x, 100, hashrateStr, 4);
    
    lastHashrate = smoothedHashrate;
  }
}

void MiningScreen::renderStats() {
  const DeviceState& state = DeviceStateManager::getState();
  
  // Worker name
  String workerDisplay = state.workerName;
  if (workerDisplay.length() > 12) {
    workerDisplay = workerDisplay.substring(0, 12);
  }
  if (workerDisplay != lastWorker) {
    display->setBackgroundColor(0x1a1f26); // Clear with background color
    display->fillRect(30, 200, 80, 14);
    display->setForegroundColor(TFT_FG_COLOR);
    display->drawText(30, 200, workerDisplay, 1);
    lastWorker = workerDisplay;
  }
  
  // Shares (using accepted shares from state)
  if (state.acceptedShares != lastShares) {
    display->setBackgroundColor(0x1a1f26);
    display->fillRect(130, 200, 80, 14);
    display->setForegroundColor(TFT_BRAND_COLOR);
    display->drawText(130, 200, String(state.acceptedShares), 1);
    lastShares = state.acceptedShares;
  }
  
  // Temperature (placeholder - not available in current state)
  // Using a fixed value for now since temp isn't in DeviceState
  const float tempDisplay = 58.0f; // Placeholder
  if (fabs(tempDisplay - lastTemp) > 0.5f) {
    display->setBackgroundColor(0x1a1f26);
    display->fillRect(230, 200, 80, 14);
    display->setForegroundColor(TFT_FG_COLOR);
    display->drawText(230, 200, String((int)tempDisplay) + "°C", 1);
    lastTemp = tempDisplay;
  }
}

void MiningScreen::render() {
  if (!staticRendered) {
    renderStatic();
  }
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
