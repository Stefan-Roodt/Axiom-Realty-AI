@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=C:\Progra~1\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
set "AXIOM_URL=http://127.0.0.1:8080/?admin=1#admin"

title Axiom Realty AI - DEVELOPMENT SERVER

echo Freeing port 8080 if an old Axiom server is still running...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$lines = netstat -ano | Select-String ':8080'; foreach ($line in $lines) { $parts = ($line.ToString() -split '\s+') | Where-Object { $_ }; if ($parts.Count -ge 5 -and $parts[1] -like '*:8080') { $pidValue = [int]$parts[-1]; try { $process = Get-Process -Id $pidValue -ErrorAction Stop; if ($process.ProcessName -eq 'node') { Stop-Process -Id $pidValue -Force } } catch {} } }"

:server_loop
cls
echo ============================================================
echo  Axiom Realty AI - DEVELOPMENT SERVER
echo ============================================================
echo.
echo  Live admin: %AXIOM_URL%
echo.
echo  Keep this window open while developing.
echo  Server code changes restart automatically.
echo  Browser changes appear when you refresh the page.
echo  If the server exits, this launcher starts it again.
echo.

start "Axiom browser opener" /min powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='%AXIOM_URL%'; for($i=0;$i -lt 45;$i++){ try { Invoke-WebRequest -Uri 'http://127.0.0.1:8080/' -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process $url; exit 0 } catch { Start-Sleep -Seconds 1 } }; Start-Process $url"

"%NODE_EXE%" --watch server.js
set "EXIT_CODE=%ERRORLEVEL%"

echo.
echo ============================================================
echo  Axiom Realty AI stopped with exit code %EXIT_CODE%.
echo  Restarting in 3 seconds...
echo ============================================================
timeout /t 3 /nobreak >nul
goto server_loop
