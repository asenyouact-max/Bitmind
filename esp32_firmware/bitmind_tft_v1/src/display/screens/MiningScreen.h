#ifndef MINING_SCREEN_H
#define MINING_SCREEN_H

#include "../Screen.h"

class MiningScreen : public Screen {
public:
  MiningScreen(DisplayManager* displayManager);
  void onEnter() override;
  void render() override;
  void update() override;
  
private:
  unsigned long lastUpdate;
};

#endif // MINING_SCREEN_H
