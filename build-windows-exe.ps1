$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

python -m pip install -r requirements-dev.txt
python -m PyInstaller `
  --noconfirm `
  --clean `
  --name "EV API Tester" `
  --add-data "index.html;." `
  --add-data "app.js;." `
  --add-data "styles.css;." `
  --add-data "server.py;." `
  ev_api_tester.py

Write-Host ""
Write-Host "Built executable at:"
Write-Host "$ProjectRoot\dist\EV API Tester\EV API Tester.exe"
