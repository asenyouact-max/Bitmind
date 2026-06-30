/*
 * Phase T3.2 Validation Test
 * Tests RuntimeStateMachine foundation
 * 
 * This is a standalone test sketch for validating T3.2 implementation.
 * Use this to verify:
 * 1. State machine initializes correctly
 * 2. State transitions work (BOOT -> CHECK_CONFIG -> AP_MODE or WIFI_CONNECTING)
 * 3. DeviceStateManager receives updated state
 * 4. Display layer remains unchanged
 * 5. No compilation errors
 */

#include <Arduino.h>
#include "runtime/RuntimeStateMachine.h"
#include "storage/ConfigManager.h"
#include "identity/DeviceIdentity.h"
#include "display/DeviceState.h"

RuntimeStateMachine rsm;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("========================================");
  Serial.println("Phase T3.2 Validation Test");
  Serial.println("RuntimeStateMachine Foundation");
  Serial.println("========================================");
  Serial.println();
  
  // Test 1: State Machine Initialization
  Serial.println("[TEST 1] State Machine Initialization");
  Serial.println("----------------------------------------");
  rsm.begin();
  RuntimeState initialState = rsm.getCurrentState();
  Serial.println("Initial state: " + rsm.getStateName(initialState));
  
  if (initialState == RuntimeState::BOOT) {
    Serial.println("[PASS] State machine initialized to BOOT");
  } else {
    Serial.println("[FAIL] State machine not initialized to BOOT");
  }
  Serial.println();
  
  // Test 2: State Transitions
  Serial.println("[TEST 2] State Transitions");
  Serial.println("----------------------------------------");
  
  // Run state machine through multiple update cycles
  Serial.println("Running state machine updates...");
  for (int i = 0; i < 5; i++) {
    Serial.println("Update cycle " + String(i + 1));
    rsm.update();
    delay(100);
  }
  
  RuntimeState finalState = rsm.getCurrentState();
  Serial.println("Final state: " + rsm.getStateName(finalState));
  
  // Verify state progression
  Serial.println("[INFO] Expected progression: BOOT -> CHECK_CONFIG -> AP_MODE or WIFI_CONNECTING");
  Serial.println("[INFO] Actual progression logged above");
  Serial.println();
  
  // Test 3: DeviceStateManager Integration
  Serial.println("[TEST 3] DeviceStateManager Integration");
  Serial.println("----------------------------------------");
  
  const DeviceState& state = DeviceStateManager::getState();
  Serial.println("DeviceStateManager status: " + state.status);
  Serial.println("DeviceStateManager deviceId: " + state.deviceId);
  
  if (!state.status.isEmpty()) {
    Serial.println("[PASS] DeviceStateManager status updated");
  } else {
    Serial.println("[FAIL] DeviceStateManager status not updated");
  }
  
  if (!state.deviceId.isEmpty()) {
    Serial.println("[PASS] DeviceStateManager deviceId set");
  } else {
    Serial.println("[FAIL] DeviceStateManager deviceId not set");
  }
  Serial.println();
  
  // Test 4: Forced State Transition
  Serial.println("[TEST 4] Forced State Transition");
  Serial.println("----------------------------------------");
  
  Serial.println("Forcing transition to MINING state");
  rsm.transitionTo(RuntimeState::MINING);
  
  RuntimeState forcedState = rsm.getCurrentState();
  Serial.println("Current state after forced transition: " + rsm.getStateName(forcedState));
  
  if (forcedState == RuntimeState::MINING) {
    Serial.println("[PASS] Forced state transition successful");
  } else {
    Serial.println("[FAIL] Forced state transition failed");
  }
  
  const DeviceState& stateAfterForce = DeviceStateManager::getState();
  Serial.println("DeviceStateManager status after forced transition: " + stateAfterForce.status);
  
  if (stateAfterForce.status == "MINING") {
    Serial.println("[PASS] DeviceStateManager updated after forced transition");
  } else {
    Serial.println("[FAIL] DeviceStateManager not updated after forced transition");
  }
  Serial.println();
  
  // Test 5: Configuration Check
  Serial.println("[TEST 5] Configuration Check");
  Serial.println("----------------------------------------");
  
  ConfigManager configManager;
  bool hasConfig = configManager.hasConfiguration();
  Serial.println("Has configuration: " + String(hasConfig ? "Yes" : "No"));
  
  if (!hasConfig) {
    Serial.println("[INFO] No configuration found, state machine should transition to AP_MODE");
  } else {
    Serial.println("[INFO] Configuration found, state machine should transition to WIFI_CONNECTING");
  }
  Serial.println();
  
  Serial.println("========================================");
  Serial.println("Validation Test Complete");
  Serial.println("========================================");
  Serial.println();
  Serial.println("Instructions:");
  Serial.println("1. Upload this sketch to the device");
  Serial.println("2. Monitor serial output at 115200 baud");
  Serial.println("3. Verify all tests pass");
  Serial.println("4. Verify state transitions follow expected flow");
  Serial.println("5. Verify DeviceStateManager is updated correctly");
  Serial.println("6. Replace with main firmware after validation");
}

void loop() {
  // Continue running state machine
  rsm.update();
  delay(1000);
}
