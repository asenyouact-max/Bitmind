#ifndef SCREEN_MANAGER_H
#define SCREEN_MANAGER_H

#include <Arduino.h>
#include "DisplayManager.h"
#include "Screen.h"
#include "DeviceState.h"

// Forward declarations of screen classes
class SplashScreen;
class SetupScreen;
class ConnectingScreen;
class RegisteringScreen;
class MiningScreen;
class ErrorScreen;

class ScreenManager {
public:
  ScreenManager(DisplayManager* displayManager);
  ~ScreenManager();
  
  // Initialization
  bool begin();
  void end();
  
  // Screen Management
  void update();
  void render();
  
  // Screen Transitions
  template<typename T>
  void transitionTo();
  
  // Get current screen
  Screen* getCurrentScreen();
  
private:
  DisplayManager* displayManager;
  Screen* currentScreen;
  Screen* previousScreen;
  bool renderDirty;  // Phase T2.7: Render only when screen changes
  
  // Screen instances
  SplashScreen* splashScreen;
  SetupScreen* setupScreen;
  ConnectingScreen* connectingScreen;
  RegisteringScreen* registeringScreen;
  MiningScreen* miningScreen;
  ErrorScreen* errorScreen;
  
  // Internal transition logic
  void switchScreen(Screen* newScreen);
};

#endif // SCREEN_MANAGER_H
