#ifndef REGISTERING_SCREEN_H
#define REGISTERING_SCREEN_H

#include "../Screen.h"

class RegisteringScreen : public Screen {
public:
  RegisteringScreen(DisplayManager* displayManager);
  void onEnter() override;
  void render() override;
};

#endif // REGISTERING_SCREEN_H
