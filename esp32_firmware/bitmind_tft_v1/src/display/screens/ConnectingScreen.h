#ifndef CONNECTING_SCREEN_H
#define CONNECTING_SCREEN_H

#include "../Screen.h"

class ConnectingScreen : public Screen {
public:
  ConnectingScreen(DisplayManager* displayManager);
  void onEnter() override;
  void render() override;
};

#endif // CONNECTING_SCREEN_H
