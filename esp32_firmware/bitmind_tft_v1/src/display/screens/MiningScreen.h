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
  bool staticRendered;
  
  // Cached previous values for dirty-region detection
  float lastHashrate;
  
  // EMA smoothing for hashrate display
  float smoothedHashrate;
  static constexpr float EMA_ALPHA = 0.2f;
  
  String formatHashrate(float hashrateHps);
  void renderStatic();
  void renderHashrate();
};

#endif // MINING_SCREEN_H
