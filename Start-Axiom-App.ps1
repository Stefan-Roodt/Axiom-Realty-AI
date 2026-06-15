$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 8080
$BaseUrl = "http://127.0.0.1:$Port"
$AdminUrl = "$BaseUrl/?admin=1#admin"
$TaskName = "Axiom Realty AI"
$TaskRunner = Join-Path $ProjectDir "AXIOM-TASK-RUNNER.cmd"
$FallbackWatchdog = Join-Path $ProjectDir "AXIOM-SERVER-WATCHDOG.ps1"

Set-Location $ProjectDir

function Test-AxiomOnline {
  try {
    Invoke-WebRequest -Uri "$BaseUrl/" -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Ensure-AxiomScheduledTask {
  if (-not (Test-Path $TaskRunner)) {
    throw "Missing AXIOM-TASK-RUNNER.cmd in $ProjectDir"
  }

  $existing = schtasks.exe /Query /TN $TaskName 2>$null
  if ($LASTEXITCODE -eq 0) {
    return $true
  }

  $create = schtasks.exe /Create /TN $TaskName /SC ONLOGON /TR $TaskRunner /F 2>&1
  if ($LASTEXITCODE -ne 0) {
    Add-Content -Path (Join-Path $ProjectDir "server.err.log") -Value "Could not create scheduled task: $create"
    return $false
  }
  return $true
}

function Start-AxiomBackground {
  if (Ensure-AxiomScheduledTask) {
    schtasks.exe /Run /TN $TaskName | Out-Null
    return
  }

  if (-not (Test-Path $FallbackWatchdog)) {
    throw "Missing AXIOM-SERVER-WATCHDOG.ps1 in $ProjectDir"
  }

  Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$FallbackWatchdog`"") `
    -WorkingDirectory $ProjectDir `
    -WindowStyle Hidden
}

if (-not (Test-AxiomOnline)) {
  Start-AxiomBackground

  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-AxiomOnline) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    Write-Host "Axiom Realty AI did not answer on $BaseUrl." -ForegroundColor Red
    Write-Host "Open these logs for the reason:"
    Write-Host "  $ProjectDir\server.out.log"
    Write-Host "  $ProjectDir\server.err.log"
    Read-Host "Press Enter to close"
    exit 1
  }
}

Start-Process $AdminUrl
