#include "ConnectingScreen.h"
#include "../DeviceState.h"

ConnectingScreen::ConnectingScreen(DisplayManager* displayManager)
  : Screen(displayManager) {
  Serial.printf("[LIFECYCLE] ConnectingScreen::ConnectingScreen() - this=%p\n", this);
}

void ConnectingScreen::onEnter() {
  Serial.println("[SCREEN] Connecting screen entered");
}

void ConnectingScreen::render() {
  Serial.println("[DEBUG] ConnectingScreen::render: start");
  const DeviceState& state = DeviceStateManager::getState();
  
  Serial.println("[DEBUG] ConnectingScreen::render: calling fillScreen");
  display->fillScreen(TFT_BG_COLOR);
  
  // Header - CONNECTING (centered, size 3, white)
  Serial.println("[DEBUG] ConnectingScreen::render: setting foreground color to white");
  display->setForegroundColor(TFT_FG_COLOR);
  Serial.println("[DEBUG] ConnectingScreen::render: calling drawTextCentered for CONNECTING");
  display->drawTextCentered(20, "CONNECTING", 3);
  
  // Separator line
  Serial.println("[DEBUG] ConnectingScreen::render: setting foreground color to gray");
  display->setForegroundColor(TFT_GRAY_COLOR);
  Serial.println("[DEBUG] ConnectingScreen::render: calling fillRect for separator");
  display->fillRect(10, 50, 300, 2);
  
  // Connecting to WiFi... (centered, size 2, white)
  Serial.println("[DEBUG] ConnectingScreen::render: setting foreground color to white");
  display->setForegroundColor(TFT_FG_COLOR);
  Serial.println("[DEBUG] ConnectingScreen::render: calling drawTextCentered for WiFi message");
  display->drawTextCentered(80, "Connecting to WiFi...", 2);
  
  // WiFi icon + SSID (Bitcoin Orange)
  Serial.println("[DEBUG] ConnectingScreen::render: setting foreground color to brand orange");
  display->setForegroundColor(TFT_BRAND_COLOR);
  Serial.println("[DEBUG] ConnectingScreen::render: calling drawText for WiFi SSID");
  display->drawText(20, 120, "● " + state.wifiSSID, 2);
  
  // Connecting to backend... (centered, size 2, white)
  Serial.println("[DEBUG] ConnectingScreen::render: setting foreground color to white");
  display->setForegroundColor(TFT_FG_COLOR);
  Serial.println("[DEBUG] ConnectingScreen::render: calling drawTextCentered for backend message");
  display->drawTextCentered(160, "Connecting to backend...", 2);
  
  // Server icon + hostname (Bitcoin Orange)
  Serial.println("[DEBUG] ConnectingScreen::render: setting foreground color to brand orange");
  display->setForegroundColor(TFT_BRAND_COLOR);
  Serial.println("[DEBUG] ConnectingScreen::render: calling drawText for server hostname");
  display->drawText(20, 200, "● getbitmind.com", 2);
  
  // Please wait... (centered, size 2, light gray)
  Serial.println("[DEBUG] ConnectingScreen::render: setting foreground color to gray");
  display->setForegroundColor(TFT_GRAY_COLOR);
  Serial.println("[DEBUG] ConnectingScreen::render: calling drawTextCentered for wait message");
  display->drawTextCentered(240, "Please wait...", 2);
  
  // Progress bar (Bitcoin Orange)
  Serial.println("[DEBUG] ConnectingScreen::render: setting foreground color to brand orange");
  display->setForegroundColor(TFT_BRAND_COLOR);
  Serial.println("[DEBUG] ConnectingScreen::render: calling fillRect for progress bar");
  display->fillRect(20, 270, 280, 10);
  
  Serial.println("[DEBUG] ConnectingScreen::render: completed");
}
