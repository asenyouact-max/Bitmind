# TFT Firmware Testing Procedures

## Validation Test Sketches

The project includes validation test sketches for testing specific phases:

- `src/test_storage_identity.ino` - Phase T3.1 validation (storage + device identity)
- `src/test_runtime_state_machine.ino` - Phase T3.2 validation (runtime state machine)

**Note:** Test sketches are removed from production `src/` after validation. Use the procedures below to recreate them if needed.

## How to Run Validation Tests

### Step 1: Backup Main Firmware
```bash
cd esp32_firmware/bitmind_tft_v1/src
cp bitmind_tft_v1.ino bitmind_tft_v1.ino.backup
```

### Step 2: Replace Main Firmware with Test Sketch
```bash
# For T3.1 validation
cp test_storage_identity.ino bitmind_tft_v1.ino

# OR for T3.2 validation
cp test_runtime_state_machine.ino bitmind_tft_v1.ino
```

### Step 3: Build and Upload
```bash
cd ..
pio run
pio run --target upload
```

### Step 4: Monitor Serial Output
```bash
pio device monitor
```

### Step 5: Restore Main Firmware
```bash
cd src
cp bitmind_tft_v1.ino.backup bitmind_tft_v1.ino
```

## Expected Results

### T3.1 Validation (test_storage_identity.ino)
- Device identity: Same `esp32-xxxx` format every boot
- Storage persistence: Configuration data matches after reboot
- Factory reset: All fields cleared (empty strings, registered = false)

### T3.2 Validation (test_runtime_state_machine.ino)
- State machine initializes to BOOT
- State transitions follow expected flow (BOOT → CHECK_CONFIG → AP_MODE or WIFI_CONNECTING)
- DeviceStateManager status is updated on state changes
- DeviceStateManager deviceId is set from DeviceIdentity

### T3.3 Validation (WiFi and Backend Connectivity)
**Prerequisites:**
- Device must have valid WiFi credentials stored in NV storage
- Backend server must be accessible at configured host/port

**Validation Steps:**
1. Ensure configuration is stored (use T3.1 test to save credentials if needed)
2. Upload main firmware to device
3. Monitor serial output at 115200 baud
4. Verify state progression: BOOT → CHECK_CONFIG → WIFI_CONNECTING → WIFI_CONNECTED → BACKEND_CONNECTING → REGISTERING
5. Verify WiFi connection succeeds (IP address assigned)
6. Verify DeviceStateManager receives WiFi status updates
7. Verify backend connection attempt is made
8. Verify DeviceStateManager receives backend status updates
9. Test disconnect handling (power off WiFi router, observe reconnection logic)

**Expected Results:**
- Device boots and loads stored credentials
- WiFi connection succeeds within timeout
- DeviceStateManager WiFi status updates to CONNECTED
- Backend connection attempt is made
- DeviceStateManager backend status updates
- No display layer modifications required
- Main loop remains responsive (no blocking)

## Notes

- Test sketches are standalone and do not require display hardware
- Test sketches use Serial output at 115200 baud
- Test sketches are for validation only, not for production use
- Always restore main firmware after validation testing
