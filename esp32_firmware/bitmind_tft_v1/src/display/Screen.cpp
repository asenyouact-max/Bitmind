#include "Screen.h"

Screen::Screen(DisplayManager* displayManager) 
  : display(displayManager) {
  Serial.printf("[LIFECYCLE] Screen::Screen() - this=%p, displayManager=%p\n", this, displayManager);
}
