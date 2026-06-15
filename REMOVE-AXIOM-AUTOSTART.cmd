@echo off
setlocal
cd /d "%~dp0"

echo Removing Axiom Realty AI Windows task...
schtasks /End /TN "Axiom Realty AI" >nul 2>nul
schtasks /Delete /TN "Axiom Realty AI" /F
powershell -NoProfile -ExecutionPolicy Bypass -Command "$shortcut=Join-Path ([Environment]::GetFolderPath('Startup')) 'Axiom Realty AI.lnk'; if(Test-Path $shortcut){ Remove-Item -LiteralPath $shortcut -Force; Write-Host ('Removed startup shortcut: ' + $shortcut) }"

call "%~dp0STOP-AXIOM.cmd"
