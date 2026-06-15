@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=C:\Progra~1\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
set "AXIOM_URL=http://127.0.0.1:8080/?admin=1#admin"

title Axiom Realty AI - LIVE SERVER

:server_loop
cls
echo ============================================================
echo  Axiom Realty AI - LIVE SERVER
echo ============================================================
echo.
echo  Live admin: %AXIOM_URL%
echo.
echo  This window is the website engine.
echo  If this window closes, 127.0.0.1:8080 stops.
echo  If the server exits, this launcher restarts it automatically.
echo.

start "Axiom browser opener" /min powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='%AXIOM_URL%'; for($i=0;$i -lt 45;$i++){ try { Invoke-WebRequest -Uri 'http://127.0.0.1:8080/' -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process $url; exit 0 } catch { Start-Sleep -Seconds 1 } }; Start-Process $url"

"%NODE_EXE%" server.js
set "EXIT_CODE=%ERRORLEVEL%"

echo.
echo ============================================================
echo  Axiom Realty AI stopped with exit code %EXIT_CODE%.
echo  Restarting in 3 seconds...
echo ============================================================
timeout /t 3 /nobreak >nul
goto server_loop
