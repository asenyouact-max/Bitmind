#ifndef SPLASH_SCREEN_H
#define SPLASH_SCREEN_H

#include "../Screen.h"

class SplashScreen : public Screen {
public:
  SplashScreen(DisplayManager* displayManager);
  void onEnter() override;
  void render() override;
};

#endif // SPLASH_SCREEN_H
