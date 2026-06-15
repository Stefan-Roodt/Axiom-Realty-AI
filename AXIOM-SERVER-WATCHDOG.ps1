$ErrorActionPreference = "Continue"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DataDir = Join-Path $ProjectDir "data"
$WatchdogPidFile = Join-Path $DataDir "axiom-watchdog.pid"
$OutLog = Join-Path $ProjectDir "server.out.log"
$ErrLog = Join-Path $ProjectDir "server.err.log"
$NodeExe = "C:\Program Files\nodejs\node.exe"

if (-not (Test-Path $DataDir)) {
  New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
}

Set-Content -Path $WatchdogPidFile -Value $PID
Set-Location $ProjectDir

if (-not (Test-Path $NodeExe)) {
  $nodeCommand = Get-Command "node.exe" -ErrorAction SilentlyContinue
  if ($nodeCommand) {
    $NodeExe = $nodeCommand.Source
  }
}

while ($true) {
  try {
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $OutLog -Value ""
    Add-Content -Path $OutLog -Value "[$stamp] Starting Axiom Realty AI server..."

    & $NodeExe server.js >> $OutLog 2>> $ErrLog
    $exitCode = $LASTEXITCODE

    $exitStamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $ErrLog -Value "[$exitStamp] Server stopped with exit code $exitCode. Watchdog will restart it in 5 seconds."
  } catch {
    $errorStamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $ErrLog -Value "[$errorStamp] Watchdog error: $($_.Exception.Message)"
  }

  Start-Sleep -Seconds 5
}
