const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

let serverProcess;

function pythonCandidates() {
  return [
    { command: "py", args: ["-3", "server.py"] },
    { command: "python", args: ["server.py"] },
  ];
}

function startServer() {
  const cwd = app.isPackaged ? process.resourcesPath : path.join(__dirname, "..");

  for (const candidate of pythonCandidates()) {
    try {
      serverProcess = spawn(candidate.command, candidate.args, {
        cwd,
        windowsHide: true,
        stdio: "ignore",
      });

      serverProcess.on("error", () => {});
      return;
    } catch {
      serverProcess = null;
    }
  }

  dialog.showErrorBox("Python not found", "Install Python 3 or use the PyInstaller executable build instead.");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  setTimeout(() => {
    win.loadURL("http://127.0.0.1:8765/");
  }, 1200);
}

app.whenReady().then(() => {
  startServer();
  createWindow();
});

app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});
