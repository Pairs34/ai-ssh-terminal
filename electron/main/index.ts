import { app, BrowserWindow, Menu } from "electron";
import path from "node:path";
import { registerDeviceHandlers } from "./ipc/devices";
import { registerCredentialHandlers } from "./ipc/credentials";
import { registerSshHandlers } from "./ipc/ssh";
import { registerScanHandlers } from "./ipc/scan";
import { registerGroupHandlers } from "./ipc/groups";
import { registerSessionHandlers } from "./ipc/sessions";
import { registerAiHandlers } from "./ipc/ai";
import { registerCsvHandlers } from "./ipc/csv";
import { registerKnowledgeHandlers } from "./ipc/knowledge";
import { initAutoUpdate } from "./updater";
import { closeDb } from "./database";

let mainWindow: BrowserWindow | null = null;

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// Mükerrer pencere / ikinci instance açılmasını engelleme (Single Instance Lock)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#0B0F17",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  mainWindow.show();
  mainWindow.focus();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (!gotTheLock) return;

  registerDeviceHandlers();
  registerCredentialHandlers();
  registerSshHandlers(() => mainWindow);
  registerScanHandlers(() => mainWindow);
  registerGroupHandlers();
  registerSessionHandlers();
  registerAiHandlers();
  registerKnowledgeHandlers();
  registerCsvHandlers();
  createWindow();
  initAutoUpdate(() => mainWindow);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  closeDb();
  if (process.platform !== "darwin") app.quit();
});

