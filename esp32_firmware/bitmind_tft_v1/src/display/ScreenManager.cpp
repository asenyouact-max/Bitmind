#include "ScreenManager.h"
#include "screens/SplashScreen.h"
#include "screens/SetupScreen.h"
#include "screens/ConnectingScreen.h"
#include "screens/RegisteringScreen.h"
#include "screens/MiningScreen.h"
#include "screens/ErrorScreen.h"

ScreenManager::ScreenManager(DisplayManager* displayManager)
  : displayManager(displayManager),
    currentScreen(nullptr),
    previousScreen(nullptr),
    splashScreen(nullptr),
    setupScreen(nullptr),
    connectingScreen(nullptr),
    registeringScreen(nullptr),
    miningScreen(nullptr),
    errorScreen(nullptr) {
}

ScreenManager::~ScreenManager() {
  end();
}

bool ScreenManager::begin() {
  Serial.println("[SCREEN_MANAGER] Initializing...");
  
  // Create screen instances
  splashScreen = new SplashScreen(displayManager);
  setupScreen = new SetupScreen(displayManager);
  connectingScreen = new ConnectingScreen(displayManager);
  registeringScreen = new RegisteringScreen(displayManager);
  miningScreen = new MiningScreen(displayManager);
  errorScreen = new ErrorScreen(displayManager);
  
  // Start with splash screen
  currentScreen = splashScreen;
  currentScreen->onEnter();
  
  Serial.println("[SCREEN_MANAGER] Initialized");
  return true;
}

void ScreenManager::end() {
  if (currentScreen) {
    currentScreen->onExit();
  }
  
  delete splashScreen;
  delete setupScreen;
  delete connectingScreen;
  delete registeringScreen;
  delete miningScreen;
  delete errorScreen;
  
  currentScreen = nullptr;
  previousScreen = nullptr;
  splashScreen = nullptr;
  setupScreen = nullptr;
  connectingScreen = nullptr;
  registeringScreen = nullptr;
  miningScreen = nullptr;
  errorScreen = nullptr;
  
  Serial.println("[SCREEN_MANAGER] Deinitialized");
}

void ScreenManager::update() {
  const DeviceState& state = DeviceStateManager::getState();
  
  // Determine which screen should be active based on state
  Screen* targetScreen = nullptr;
  
  if (state.apMode) {
    targetScreen = setupScreen;
  } else if (state.status == "ERROR") {
    targetScreen = errorScreen;
  } else if (!state.wifiConnected) {
    targetScreen = connectingScreen;
  } else if (!state.registered) {
    targetScreen = registeringScreen;
  } else if (state.miningActive) {
    targetScreen = miningScreen;
  } else {
    targetScreen = splashScreen;
  }
  
  // Transition if needed
  if (targetScreen && targetScreen != currentScreen) {
    switchScreen(targetScreen);
  }
  
  // Update current screen
  if (currentScreen) {
    currentScreen->update();
  }
}

void ScreenManager::render() {
  if (currentScreen && displayManager->isInitialized()) {
    displayManager->clear();
    currentScreen->render();
    displayManager->refresh();
  }
}

template<typename T>
void ScreenManager::transitionTo() {
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

Screen* ScreenManager::getCurrentScreen() {
  return currentScreen;
}

void ScreenManager::switchScreen(Screen* newScreen) {
  if (newScreen == currentScreen) {
    return;
  }
  
  if (currentScreen) {
    currentScreen->onExit();
  }
  
  previousScreen = currentScreen;
  currentScreen = newScreen;
  
  if (currentScreen) {
    currentScreen->onEnter();
  }
  
  Serial.println("[SCREEN_MANAGER] Transitioned to screen");
}
