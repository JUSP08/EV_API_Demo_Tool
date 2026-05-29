@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%start-dashboard.ps1"

if errorlevel 1 (
  echo.
  echo EV API Tester launcher failed. See the message above.
  pause
)
