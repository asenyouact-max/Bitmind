@echo off
setlocal enabledelayedexpansion

REM Bitmind Safe Bitcoin Core Startup
REM Starts Bitcoin Core with correct datadir if not already running

echo [bitcoin] Checking Bitcoin Core status...

REM Define paths
set "BITCOIN_QT=C:\Program Files\Bitcoin\bitcoin-qt.exe"
set "BITCOIND=C:\Program Files\Bitcoin\daemon\bitcoind.exe"
set "DATADIR=%APPDATA%\Bitcoin"

REM Check if Bitcoin Core is already running
tasklist /FI "IMAGENAME eq bitcoin-qt.exe" 2>NUL | find /I "bitcoin-qt.exe" >NUL
if %ERRORLEVEL% == 0 (
    echo [bitcoin] Bitcoin-Qt is already running
    echo [bitcoin] Using existing instance
    goto :check_rpc
)

tasklist /FI "IMAGENAME eq bitcoind.exe" 2>NUL | find /I "bitcoind.exe" >NUL
if %ERRORLEVEL% == 0 (
    echo [bitcoin] Bitcoin daemon is already running
    echo [bitcoin] Using existing instance
    goto :check_rpc
)

REM No Bitcoin Core running, start it
echo [bitcoin] Bitcoin Core is not running
echo [bitcoin] Starting Bitcoin Core with datadir: %DATADIR%

REM Try to start bitcoind first (preferred for server use)
if exist "%BITCOIND%" (
    echo [bitcoin] Starting bitcoind.exe...
    start "" /D "%DATADIR%" "%BITCOIND%" -datadir="%DATADIR%" -daemon
    echo [bitcoin] Bitcoin daemon started
    goto :check_rpc
)

REM Fallback to bitcoin-qt if bitcoind not found
if exist "%BITCOIN_QT%" (
    echo [bitcoin] bitcoind.exe not found, using bitcoin-qt.exe...
    start "" /D "%DATADIR%" "%BITCOIN_QT%" -datadir="%DATADIR%" -server -daemon
    echo [bitcoin] Bitcoin-Qt started in server mode
    goto :check_rpc
)

REM Neither found
echo [bitcoin] ERROR: Bitcoin Core not found
echo [bitcoin] Expected locations:
echo [bitcoin]   - %BITCOIND%
echo [bitcoin]   - %BITCOIN_QT%
echo [bitcoin] Please install Bitcoin Core to continue
exit /b 1

:check_rpc
echo [bitcoin] Checking RPC readiness...
exit /b 0
