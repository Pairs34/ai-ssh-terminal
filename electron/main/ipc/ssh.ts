import { ipcMain, type BrowserWindow } from "electron";
import { sshManager } from "../ssh/manager";
import { resolveDeviceConnection } from "../ssh/resolveConnection";

export function registerSshHandlers(getWindow: () => BrowserWindow | null) {
  sshManager.on("data", (sessionId: string, data: string) => {
    getWindow()?.webContents.send("ssh:data", sessionId, data);
  });

  sshManager.on("error", (sessionId: string, message: string) => {
    getWindow()?.webContents.send("ssh:error", sessionId, message);
  });

  sshManager.on("closed", (sessionId: string) => {
    getWindow()?.webContents.send("ssh:closed", sessionId);
  });

  ipcMain.handle("ssh:connect", async (_event, deviceId: number, sessionId: string) => {
    const connection = resolveDeviceConnection(deviceId);
    await sshManager.connect({ sessionId, ...connection });
    return { success: true };
  });

  ipcMain.on("ssh:write", (_event, sessionId: string, data: string) => {
    sshManager.write(sessionId, data);
  });

  ipcMain.on("ssh:resize", (_event, sessionId: string, cols: number, rows: number) => {
    sshManager.resize(sessionId, cols, rows);
  });

  ipcMain.handle("ssh:disconnect", async (_event, sessionId: string) => {
    sshManager.disconnect(sessionId);
    return { success: true };
  });
}
