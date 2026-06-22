#include "SplashScreen.h"

SplashScreen::SplashScreen(DisplayManager* displayManager)
  : Screen(displayManager) {
}

void SplashScreen::onEnter() {
  Serial.println("[SCREEN] Splash screen entered");
}

void SplashScreen::render() {
  display->drawTextCentered(0, "BITMIND", 2);
  display->drawTextCentered(24, "OLED Miner", 1);
  display->drawTextCentered(48, "v1.0.0", 1);
  display->drawTextCentered(56, "Initializing...", 1);
}
