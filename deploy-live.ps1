param(
  [string]$Message = "",
  [string]$Branch = "main",
  [string]$Remote = "origin"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$repoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $repoDir

function Write-Step {
  param([string]$Text)
  Write-Host "==> $Text" -ForegroundColor Cyan
}

function Write-Info {
  param([string]$Text)
  Write-Host "    $Text" -ForegroundColor DarkGray
}

Write-Step "Axiom Realty AI deployment helper"
if (-not (Test-Path ".git")) {
  throw "This folder does not appear to be a git repository: $repoDir"
}

git remote get-url "$Remote" | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Remote '$Remote' is not configured. Set it first with: git remote add $Remote <repo-url>"
}
git config --global --add safe.directory "$repoDir" 2>$null

Write-Step "Syncing with origin"
$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($currentBranch -ne $Branch) {
  Write-Info "Switching from $currentBranch to $Branch..."
  git checkout $Branch
}

git fetch "$Remote" "$Branch" --prune
if ($LASTEXITCODE -ne 0) {
  throw "git fetch failed."
}

git pull --rebase "$Remote" "$Branch"

if (-not $?) {
  Write-Host ""
  Write-Host "Rebase failed with conflicts." -ForegroundColor Yellow
  Write-Host "Run 'git status' to resolve, then rerun: .\\Deploy.cmd"
  throw "Git rebase conflict"
}

if (Test-Path "package-lock.json") {
  Write-Step "Installing production dependencies (npm ci)"
  $env:PUPPETEER_SKIP_DOWNLOAD = "true"
  npm ci --omit=dev
  if (-not $?) {
    Write-Host "npm ci failed. Falling back to npm install --omit=dev" -ForegroundColor Yellow
    npm install --omit=dev
    if (-not $?) {
      throw "Dependency install failed. Run npm install --omit=dev manually."
    }
  }
} else {
  Write-Step "No package-lock.json found. Using npm install --omit=dev"
  $env:PUPPETEER_SKIP_DOWNLOAD = "true"
  npm install --omit=dev
  if (-not $?) {
    throw "Dependency install failed. Run npm install --omit=dev manually."
  }
}

Write-Step "Checking server syntax"
node --check server.js
if (-not $?) {
  throw "server.js syntax check failed"
}

Write-Step "Staging deployment files"
$deployPaths = @(
  ".github",
  ".env.example",
  "DEPLOYMENT.md",
  "README-SETUP.md",
  "LAUNCH-CHECKLIST.md",
  "package.json",
  "package-lock.json",
  "*.html",
  "*.css",
  "*.js",
  "*.svg",
  "*.csv",
  "*.cmd",
  "*.bat",
  "*.vbs",
  "modules",
  "scripts",
  "server",
  "deploy-live.ps1"
)

foreach ($path in $deployPaths) {
  if (Test-Path $path) {
    git add -- $path
  }
}

$status = (git status --short)
if ($status) {
  if ([string]::IsNullOrWhiteSpace($Message)) {
    $Message = "Deploy latest site $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
  }
  Write-Step "Committing deployment changes"
  git commit -m "$Message"
} else {
  Write-Info "No local code changes to commit."
}

Write-Step "Pushing to $Remote/$Branch"
git push "$Remote" "$Branch"
if (-not $?) {
  throw "git push failed. Re-run this script after resolving the push blocker."
}

$deployHook = $env:RENDER_DEPLOY_HOOK_URL
if ([string]::IsNullOrWhiteSpace($deployHook)) {
  Write-Info "Set RENDER_DEPLOY_HOOK_URL in your environment to trigger instant Render redeploy."
  Write-Info "Render will also auto-deploy on GitHub push once connected."
} else {
  Write-Step "Triggering Render deploy hook"
  Invoke-RestMethod -Method Post -Uri $deployHook -ContentType "application/json" -Body '{}' | Out-Null
}

Write-Host ""
Write-Host "Deployment complete." -ForegroundColor Green
