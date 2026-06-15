@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$data=Join-Path (Get-Location) 'data'; $watchdog=Join-Path $data 'axiom-watchdog.pid'; if(Test-Path $watchdog){ $pidText=(Get-Content $watchdog -ErrorAction SilentlyContinue | Select-Object -First 1); if($pidText -match '^\d+$'){ Stop-Process -Id ([int]$pidText) -Force -ErrorAction SilentlyContinue }; Remove-Item -LiteralPath $watchdog -Force -ErrorAction SilentlyContinue }; Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Write-Host 'Axiom local server stopped.'"

pause
