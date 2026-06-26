#include "SplashScreen.h"

SplashScreen::SplashScreen(DisplayManager* displayManager)
  : Screen(displayManager) {
  Serial.printf("[LIFECYCLE] SplashScreen::SplashScreen() - this=%p\n", this);
}

void SplashScreen::onEnter() {
  Serial.println("[SCREEN] Splash screen entered");
}

void SplashScreen::render() {
  display->fillScreen(TFT_BG_COLOR);
  
  // Branding - BITMIND (centered, size 4, white)
  display->setForegroundColor(TFT_FG_COLOR);
  display->drawTextCentered(80, "BITMIND", 4);
  
  // Subtitle - Mining Device (centered, size 3, Bitcoin Orange)
  display->setForegroundColor(TFT_BRAND_COLOR);
  display->drawTextCentered(130, "Mining Device", 3);
  
  // Status - Initializing... (centered, size 2, white)
  display->setForegroundColor(TFT_FG_COLOR);
  display->drawTextCentered(180, "Initializing...", 2);
  
  // Loading animation placeholder (simple progress bar)
  display->setForegroundColor(TFT_BRAND_COLOR);
  display->fillRect(60, 220, 200, 10);
}
