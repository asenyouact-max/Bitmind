# TFT Firmware Testing Procedures

## Validation Test Sketches

The project includes validation test sketches for testing specific phases:

- `src/test_storage_identity.ino` - Phase T3.1 validation (storage + device identity)
- `src/test_runtime_state_machine.ino` - Phase T3.2 validation (runtime state machine)

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

## Notes

- Test sketches are standalone and do not require display hardware
- Test sketches use Serial output at 115200 baud
- Test sketches are for validation only, not for production use
- Always restore main firmware after validation testing
