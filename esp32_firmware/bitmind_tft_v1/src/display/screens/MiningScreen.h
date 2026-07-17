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
  String lastWorker;
  uint32_t lastShares;
  float lastTemp;
  String lastStatusState; // Track state changes for status pill
  
  // EMA smoothing for hashrate display
  float smoothedHashrate;
  static constexpr float EMA_ALPHA = 0.2f;
  
  // Particle system (ambient background)
  static constexpr int NUM_PARTICLES = 8;
  struct Particle {
    int x, y;
    int vx, vy;
    uint16_t color;
    float alpha;
    float pulse;
  };
  Particle particles[NUM_PARTICLES];
  unsigned long lastParticleUpdate;
  
  String formatHashrate(float hashrateHps);
  void renderStatic();
  void renderHashrate();
  void renderStats();
  void renderStatusPill();
  void renderParticles();
  void initParticles();
  void updateParticles();
  String getCurrentStateKey();
};

#endif // MINING_SCREEN_H
