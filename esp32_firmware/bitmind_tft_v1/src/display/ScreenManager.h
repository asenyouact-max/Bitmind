#ifndef SCREEN_MANAGER_H
#define SCREEN_MANAGER_H

#include <Arduino.h>
#include <type_traits>
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
  void transitionTo() {
    if (std::is_same<T, SplashScreen>::value) {
      switchScreen(splashScreen);
    } else if (std::is_same<T, SetupScreen>::value) {
      switchScreen(setupScreen);
    } else if (std::is_same<T, ConnectingScreen>::value) {
      switchScreen(connectingScreen);
    } else if (std::is_same<T, RegisteringScreen>::value) {
      switchScreen(registeringScreen);
    } else if (std::is_same<T, MiningScreen>::value) {
      switchScreen(miningScreen);
    } else if (std::is_same<T, ErrorScreen>::value) {
      switchScreen(errorScreen);
    }
  }
  
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
