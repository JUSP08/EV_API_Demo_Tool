param(
  [switch]$NoOpen
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Url = "http://127.0.0.1:8765/"

function Test-Dashboard {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Resolve-Python {
  $candidates = @()
  $codexPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

  if (Test-Path $codexPython) {
    $candidates += [pscustomobject]@{ FilePath = $codexPython; Arguments = @("server.py") }
  }

  $pyLauncher = Get-Command py.exe -ErrorAction SilentlyContinue
  if ($pyLauncher) {
    $candidates += [pscustomobject]@{ FilePath = $pyLauncher.Source; Arguments = @("-3", "server.py") }
  }

  $python = Get-Command python.exe -ErrorAction SilentlyContinue
  if ($python) {
    $candidates += [pscustomobject]@{ FilePath = $python.Source; Arguments = @("server.py") }
  }

  if ($candidates.Count -eq 0) {
    throw "Python was not found. Install Python 3, then run this launcher again."
  }

  return $candidates[0]
}

if (-not (Test-Dashboard)) {
  $python = Resolve-Python
  Start-Process -FilePath $python.FilePath -ArgumentList $python.Arguments -WorkingDirectory $ProjectRoot -WindowStyle Hidden

  $ready = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Dashboard) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    throw "The EV API Tester backend did not start on $Url. Try running python server.py from this folder to see the detailed error."
  }
}

if (-not $NoOpen) {
  Start-Process $Url
}

Write-Host "EV API Tester is running at $Url"
