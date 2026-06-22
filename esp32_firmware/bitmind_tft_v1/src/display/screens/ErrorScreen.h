#ifndef ERROR_SCREEN_H
#define ERROR_SCREEN_H

#include "../Screen.h"

class ErrorScreen : public Screen {
public:
  ErrorScreen(DisplayManager* displayManager);
  void onEnter() override;
  void render() override;
};

#endif // ERROR_SCREEN_H
