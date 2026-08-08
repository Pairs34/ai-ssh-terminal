import { autoUpdater } from "electron-updater";
import type { BrowserWindow } from "electron";

export function initAutoUpdate(getWindow: () => BrowserWindow | null) {
  if (process.env.VITE_DEV_SERVER_URL) return;

  autoUpdater.on("update-available", () => {
    getWindow()?.webContents.send("updater:available");
  });
  autoUpdater.on("update-downloaded", () => {
    getWindow()?.webContents.send("updater:downloaded");
  });
  autoUpdater.on("error", (err) => {
    getWindow()?.webContents.send("updater:error", err.message);
  });

  autoUpdater.checkForUpdatesAndNotify().catch(() => undefined);
}
