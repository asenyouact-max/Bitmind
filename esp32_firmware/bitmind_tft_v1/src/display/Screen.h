#ifndef SCREEN_H
#define SCREEN_H

#include <Arduino.h>
#include "DisplayManager.h"
#include "DeviceState.h"

// Base screen class
class Screen {
public:
  Screen(DisplayManager* displayManager);
  virtual ~Screen() = default;
  
  // Called when screen becomes active
  virtual void onEnter() {}
  
  // Called when screen becomes inactive
  virtual void onExit() {}
  
  // Render the screen
  virtual void render() = 0;
  
  // Update screen (called periodically)
  virtual void update() {}
  
protected:
  DisplayManager* display;
};

#endif // SCREEN_H
