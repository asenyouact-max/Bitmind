#ifndef SETUP_SCREEN_H
#define SETUP_SCREEN_H

#include "../Screen.h"

class SetupScreen : public Screen {
public:
  SetupScreen(DisplayManager* displayManager);
  void onEnter() override;
  void render() override;
};

#endif // SETUP_SCREEN_H
