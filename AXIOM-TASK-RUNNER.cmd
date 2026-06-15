@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0AXIOM-SERVER-WATCHDOG.ps1"
