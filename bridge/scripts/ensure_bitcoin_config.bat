@echo off
setlocal enabledelayedexpansion

REM Bitmind Bitcoin Core Configuration Ensurer
REM Ensures bitcoin.conf exists with correct RPC settings

echo [bitcoin] Checking configuration...

REM Define paths
set "BITCOIN_DIR=%APPDATA%\Bitcoin"
set "CONFIG_FILE=%BITCOIN_DIR%\bitcoin.conf"

REM Check if Bitcoin directory exists
if not exist "%BITCOIN_DIR%" (
    echo [bitcoin] Creating Bitcoin directory: %BITCOIN_DIR%
    mkdir "%BITCOIN_DIR%"
)

REM Check if config file exists
if not exist "%CONFIG_FILE%" (
    echo [bitcoin] Creating configuration file: %CONFIG_FILE%
    
    REM Create the config file with required settings
    (
        echo server=1
        echo rpcuser=bitcoin
        echo rpcpassword=123456
        echo rpcport=8332
        echo rpcbind=127.0.0.1
        echo rpcallowip=127.0.0.1
    ) > "%CONFIG_FILE%"
    
    echo [bitcoin] Configuration file created successfully
    echo [bitcoin] RPC settings:
    echo [bitcoin]   - User: bitcoin
    echo [bitcoin]   - Port: 8332
    echo [bitcoin]   - Bind: 127.0.0.1
    
) else (
    echo [bitcoin] Configuration file already exists
    echo [bitcoin] Location: %CONFIG_FILE%
    
    REM Verify required settings exist
    findstr /C:"server=1" "%CONFIG_FILE%" >nul
    if errorlevel 1 (
        echo [bitcoin] WARNING: server=1 not found in config
    )
    
    findstr /C:"rpcuser=bitcoin" "%CONFIG_FILE%" >nul
    if errorlevel 1 (
        echo [bitcoin] WARNING: rpcuser=bitcoin not found in config
    )
    
    findstr /C:"rpcpassword=123456" "%CONFIG_FILE%" >nul
    if errorlevel 1 (
        echo [bitcoin] WARNING: rpcpassword not found in config
    )
    
    findstr /C:"rpcport=8332" "%CONFIG_FILE%" >nul
    if errorlevel 1 (
        echo [bitcoin] WARNING: rpcport=8332 not found in config
    )
)

echo [bitcoin] Configuration check complete
exit /b 0
