# EV API Tester

EV API Tester is a local dashboard for writing and reading BELIMO Energy Valve API datapoints.

It is designed for lab use where the valve is reachable from the PC by a local or link-local IP address such as `169.254.1.1` or `192.168.x.x`.

## Run Locally

Double-click:

```text
Start EV API Tester.bat
```

Or run manually:

```powershell
python server.py
```

Then open:

```text
http://127.0.0.1:8765
```

## Dashboard Features

- Writes Energy Valve override datapoints through the local backend.
- Uses Windows `curl.exe` behind the scenes with `-k`, `--basic`, and `--noproxy "*"` behavior.
- Supports an optional second valve IP address for duplicate writes.
- Polls output-state endpoints from the primary IP.
- Includes a sinusoidal ramp for `OverrideAbsoluteWaterFlow` / MP `2106`.

## Windows Executable Option

This creates a local Windows executable using PyInstaller.

```powershell
.\build-windows-exe.ps1
```

Output:

```text
dist\EV API Tester\EV API Tester.exe
```

This option is the simplest deployable desktop-style build because it packages the Python server and opens the browser automatically.

## Electron Option

This wraps the local dashboard in an Electron desktop window.

```powershell
npm install
npm run electron
```

To create an installer/build:

```powershell
npm run electron:dist
```

The Electron option still requires Python to be available unless you later bundle the PyInstaller server executable into the Electron package.
