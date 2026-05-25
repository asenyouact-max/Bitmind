# Bitmind Startup System

## Overview

This startup system ensures Bitcoin Core always runs with the correct configuration and RPC enabled, providing a stable foundation for the Bitmind mining system.

## Files

- **`ensure_bitcoin_config.bat`** - Creates/verifies Bitcoin Core configuration
- **`start_bitcoin.bat`** - Safely starts Bitcoin Core with correct datadir
- **`check_rpc_ready.bat`** - Waits for RPC service to be available
- **`start_all_safe.bat`** - Master startup script (run this one)
- **`quick_start.bat`** - Quick launcher for the master script

## Usage

### Quick Start
```bash
cd scripts
quick_start.bat
```

### Manual Start
```bash
cd scripts
start_all_safe.bat
```

## What It Does

1. **Configuration Check**
   - Ensures `%APPDATA%\Bitcoin` directory exists
   - Creates `bitcoin.conf` with required RPC settings if missing
   - Verifies existing configuration has required settings

2. **Safe Bitcoin Core Startup**
   - Checks if Bitcoin Core is already running
   - If running: uses existing instance
   - If not running: starts with correct datadir (`%APPDATA%\Bitcoin`)
   - Prefers `bitcoind.exe`, falls back to `bitcoin-qt.exe`

3. **RPC Readiness Check**
   - Waits for port 8332 to become available
   - Maximum wait time: 60 seconds
   - Checks every 3 seconds

4. **Backend Startup**
   - Starts Bitmind backend only after RPC is confirmed ready
   - Checks if backend is already running
   - Verifies backend responsiveness

## Configuration

The system creates this Bitcoin Core configuration:

```ini
server=1
rpcuser=bitcoin
rpcpassword=123456
rpcport=8332
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
```

## Troubleshooting

### Bitcoin Core Not Found
- Install Bitcoin Core to `C:\Program Files\Bitcoin\`
- Ensure either `bitcoin-qt.exe` or `bitcoind.exe` exists

### Port Conflicts
- Check if port 3001 is in use by another service
- Check if port 8332 is blocked by firewall

### RPC Not Ready
- Verify Bitcoin Core configuration file exists
- Check Bitcoin Core logs for RPC errors
- Ensure Bitcoin Core has sufficient time to start

## System Requirements

- Windows OS
- Bitcoin Core installed
- Network access to localhost
- PowerShell available (for RPC checks)

## Logging Format

The system uses clear, structured logging:
```
[bitcoin] Checking configuration...
[bitcoin] RPC ONLINE
[backend] Starting Bitmind backend server...
[system] SYSTEM READY
```

## Safety Features

- **No process killing**: Never kills existing Bitcoin Core instances
- **Configuration verification**: Checks existing config before creating
- **Graceful fallback**: Uses bitcoin-qt.exe if bitcoind.exe not found
- **Error handling**: Clear error messages and troubleshooting hints
- **Port conflict detection**: Checks for existing services before starting
