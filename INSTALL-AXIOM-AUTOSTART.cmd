@echo off
setlocal
cd /d "%~dp0"

echo Installing permanent Axiom Realty AI Windows task...
schtasks /Create /TN "Axiom Realty AI" /SC ONLOGON /TR "%~dp0AXIOM-TASK-RUNNER.cmd" /F

if errorlevel 1 (
  echo.
  echo Windows task install was not available. Installing Startup shortcut instead...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$startup=[Environment]::GetFolderPath('Startup'); $target=(Resolve-Path '.\Open Axiom Realty AI.bat').Path; $shortcut=Join-Path $startup 'Axiom Realty AI.lnk'; $ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut($shortcut); $s.TargetPath=$target; $s.WorkingDirectory=(Get-Location).Path; $s.Description='Start Axiom Realty AI local website'; $s.Save(); Write-Host ('Installed startup shortcut: ' + $shortcut)"
  if errorlevel 1 (
    echo.
    echo Could not install the Startup shortcut.
    echo Try right-clicking this file and choosing "Run as administrator".
    echo.
    pause
    exit /b 1
  )
  echo.
  echo Startup shortcut installed.
  echo.
  pause
  exit /b 0
)

echo.
echo Starting Axiom Realty AI now...
schtasks /Run /TN "Axiom Realty AI"

echo.
echo Done. Axiom Realty AI is installed as a Windows logon task.
echo Use "Open Axiom Realty AI.bat" to open the admin page.
echo Use "REMOVE-AXIOM-AUTOSTART.cmd" to remove the task.
echo.
pause
