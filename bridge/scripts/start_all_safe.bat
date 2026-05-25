@echo off
setlocal enabledelayedexpansion

REM Bitmind Master Startup Script
REM Ensures stable startup of Bitcoin Core and backend

echo ========================================
echo     BITMIND SAFE STARTUP SYSTEM
echo ========================================
echo.
echo [system] Starting Bitmind mining system...
echo [system] Timestamp: %date% %time%
echo.

REM Change to the scripts directory
cd /d "%~dp0"

REM Step 1: Ensure Bitcoin Core configuration exists
echo [system] Step 1: Ensuring Bitcoin Core configuration...
call ensure_bitcoin_config.bat
if %ERRORLEVEL% neq 0 (
    echo [system] ERROR: Configuration setup failed
    goto :error_exit
)
echo.

REM Step 2: Start Bitcoin Core safely
echo [system] Step 2: Starting Bitcoin Core...
call start_bitcoin.bat
if %ERRORLEVEL% neq 0 (
    echo [system] ERROR: Bitcoin Core startup failed
    goto :error_exit
)
echo.

REM Step 3: Wait for RPC readiness
echo [system] Step 3: Waiting for RPC readiness...
call check_rpc_ready.bat
if %ERRORLEVEL% neq 0 (
    echo [system] ERROR: RPC readiness check failed
    goto :error_exit
)
echo.

REM Step 4: Start backend
echo [system] Step 4: Starting backend...
cd /d "%~dp0..\"
echo [backend] Starting Bitmind backend server...
echo [backend] Location: %CD%

REM Check if backend is already running
netstat -an | findstr ":3001" >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo [backend] Backend appears to be already running on port 3001
    echo [backend] Checking if it's responsive...
    
    REM Test if backend is responding
    powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3001/health' -TimeoutSec 5; if ($response.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
    
    if %ERRORLEVEL% == 0 (
        echo [backend] Backend is already running and responsive
        goto :system_ready
    ) else (
        echo [backend] Port 3001 is in use but backend is not responding
        echo [backend] Please check for conflicting services
        goto :error_exit
    )
)

REM Start the backend in new window
echo [backend] Launching server...
start "Bitmind Backend" cmd /k "cd /d %~dp0..\ && node src\app.js"

REM Wait a moment for startup
timeout /t 3 /nobreak >nul

REM Check if backend started successfully
echo [backend] Waiting for backend health check...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3001/health' -TimeoutSec 15; if ($response.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1

if %ERRORLEVEL% == 0 (
    echo [backend] Backend started successfully
) else (
    echo [backend] WARNING: Backend may still be starting
    echo [backend] Please check the backend window for status
)

REM Step 5: Wait for Stratum server (port 3333) to be ready
echo [system] Step 5: Waiting for Stratum server on port 3333...
call :wait_for_stratum
if %ERRORLEVEL% neq 0 (
    echo [system] ERROR: Stratum server failed to start
    goto :error_exit
)
echo.

REM Check if frontend exists and start it
if exist "%~dp0..\frontend\index.html" (
    echo [frontend] Starting frontend...
    start "Bitmind Frontend" cmd /k "cd /d %~dp0..\frontend && echo [frontend] Frontend URL: file:///%CD:/=\%/frontend/index.html && echo [frontend] Backend URL: http://localhost:3001 && echo [frontend] Press Ctrl+C to close frontend window && pause"
)

:system_ready
echo.
echo ========================================
echo     SYSTEM READY
echo ========================================
echo.
echo [system] Bitmind mining system is ready!
echo [system] Bitcoin Core: Running with RPC enabled
echo [system] Backend: Running on http://localhost:3001
echo [system] Stratum Server: Running on 0.0.0.0:3333
echo [system] Mining Dashboard: http://localhost:3001/frontend
echo [system] WebSocket: ws://localhost:3001/ws/mining
echo.
echo [system] Access points:
echo [system]   - Backend API: http://localhost:3001/
echo [system]   - Health Check: http://localhost:3001/health
echo [system]   - Mining Jobs: http://localhost:3001/mining/job
echo [system]   - Device Status: http://localhost:3001/mining/devices
echo [system]   - Monitoring: http://localhost:3001/monitoring/health
echo [system]   - Dashboard: frontend/index.html
echo.
echo [system] ESP32 miners can now connect to:
echo [system]   - Stratum: 192.168.1.12:3333
echo [system]   - Backend: http://192.168.1.12:3001
echo.
echo [system] All services started successfully
echo [system] Check separate windows for backend and frontend
exit /b 0

REM Function to wait for Stratum server to be ready
:wait_for_stratum
echo [stratum] Checking if Stratum server is listening on port 3333...
set /a max_attempts=30
set /a attempt=1

:wait_loop
REM Check if port 3333 is listening
netstat -an | findstr ":3333" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo [stratum] ✅ Stratum server is listening on port 3333
    echo [stratum] Testing connectivity...
    
    REM Test connectivity to Stratum server
    powershell -Command "try { $tcpClient = New-Object System.Net.Sockets.TcpClient; $tcpClient.Connect('localhost', 3333); $tcpClient.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
    
    if %ERRORLEVEL% == 0 (
        echo [stratum] ✅ Stratum server connectivity confirmed
        exit /b 0
    ) else (
        echo [stratum] ⚠️  Stratum server is listening but not responding
        if %attempt% geq %max_attempts% (
            echo [stratum] ❌ Stratum server failed to respond after %max_attempts% attempts
            exit /b 1
        )
    )
) else (
    if %attempt% geq %max_attempts% (
        echo [stratum] ❌ Stratum server failed to start after %max_attempts% attempts
        echo [stratum] Please check the backend window for errors
        exit /b 1
    )
)

echo [stratum] Attempt %attempt%/%max_attempts% - waiting for Stratum server...
timeout /t 2 /nobreak >nul
set /a attempt+=1
goto wait_loop

:error_exit
echo.
echo ========================================
echo     STARTUP FAILED
echo ========================================
echo.
echo [system] Bitmind startup encountered an error
echo [system] Please check the messages above
echo [system] Common issues:
echo [system]   - Bitcoin Core not installed
echo [system]   - Bitcoin Core configuration issues
echo [system]   - Port conflicts (3001 or 8332)
echo [system]   - Missing dependencies
echo.
echo [system] Press any key to exit...
pause >nul
exit /b 1
