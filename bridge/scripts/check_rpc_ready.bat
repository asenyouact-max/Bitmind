@echo off
setlocal enabledelayedexpansion

REM Bitmind RPC Readiness Check
REM Checks if Bitcoin Core RPC is ready on port 8332

echo [bitcoin] Waiting for RPC to become available...

set "RPC_PORT=8332"
set "MAX_WAIT=60"
set "WAIT_INTERVAL=3"
set "elapsed=0"

:wait_loop
REM Check if RPC port is listening using PowerShell
powershell -Command "try { $tcp = New-Object System.Net.Sockets.TcpClient; $tcp.Connect('127.0.0.1', %RPC_PORT%); $tcp.Close(); exit 0 } catch { exit 1 }" >nul 2>&1

if %ERRORLEVEL% == 0 (
    echo [bitcoin] RPC ONLINE
    echo [bitcoin] Port %RPC_PORT% is ready
    goto :rpc_ready
)

REM RPC not ready yet
set /a elapsed+=%WAIT_INTERVAL%
echo [bitcoin] RPC not ready (waited %elapsed% seconds, max %MAX_WAIT% seconds)

if %elapsed% geq %MAX_WAIT% (
    echo [bitcoin] ERROR: RPC did not become ready within %MAX_WAIT% seconds
    echo [bitcoin] Please check Bitcoin Core status and configuration
    exit /b 1
)

REM Wait and try again
timeout /t %WAIT_INTERVAL% /nobreak >nul
goto :wait_loop

:rpc_ready
echo [bitcoin] RPC service is ready for connections
echo [bitcoin] Backend can now start safely
exit /b 0
