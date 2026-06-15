@echo off
setlocal
cd /d "%~dp0"

set "APP_NAME=axiom-realty-ai"
set "AXIOM_URL=http://127.0.0.1:8080/?admin=1#admin"
set "PM2_HOME=%~dp0.pm2"

title Axiom Realty AI Permanent Launcher

where pm2 >nul 2>nul
if errorlevel 1 (
  echo Installing the Axiom process manager...
  call npm install -g pm2
)

echo Starting Axiom Realty AI under PM2...
call pm2 describe %APP_NAME% >nul 2>nul
if errorlevel 1 (
  call pm2 start server.js --name %APP_NAME% --cwd "%~dp0"
) else (
  call pm2 restart %APP_NAME% --update-env
)

echo Waiting for the website to answer...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='%AXIOM_URL%'; for($i=0;$i -lt 45;$i++){ try { Invoke-WebRequest -Uri 'http://127.0.0.1:8080/' -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process $url; exit 0 } catch { Start-Sleep -Seconds 1 } }; Start-Process $url; exit 1"

echo.
echo Axiom Realty AI should now be running at:
echo %AXIOM_URL%
echo.
call pm2 status
echo.
echo This PM2 process keeps running after this window closes.
pause
