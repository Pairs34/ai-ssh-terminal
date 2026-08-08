import { ipcMain, type BrowserWindow } from "electron";
import { randomUUID } from "node:crypto";
import { getDb } from "../database";
import { scanResults, devices } from "@database/schema";
import { eq } from "drizzle-orm";
import { networkScanner, type ScanResultItem } from "../scanner";

export function registerScanHandlers(getWindow: () => BrowserWindow | null) {
  networkScanner.on("progress", (scanId: string, progress: unknown) => {
    getWindow()?.webContents.send("scan:progress", scanId, progress);
  });

  networkScanner.on("result", (scanId: string, item: ScanResultItem) => {
    const db = getDb();
    const existing = db.select().from(devices).where(eq(devices.ipAddress, item.ip)).get();
    db.insert(scanResults)
      .values({
        scanId,
        ipAddress: item.ip,
        hostname: item.hostname,
        macAddress: item.macAddress,
        vendor: item.vendor,
        ports: JSON.stringify(item.openPorts),
        detectedType: item.detectedType,
        isExisting: Boolean(existing)
      })
      .run();
    getWindow()?.webContents.send("scan:result", scanId, { ...item, isExisting: Boolean(existing) });
  });

  networkScanner.on("done", (scanId: string) => {
    getWindow()?.webContents.send("scan:done", scanId);
  });

  ipcMain.handle("scan:interfaces", async () => {
    return networkScanner.listLocalInterfaces();
  });

  ipcMain.handle(
    "scan:start",
    async (_event, cidr: string, ports: number[], concurrency: number, timeoutMs: number) => {
      const scanId = randomUUID();
      networkScanner.scan(scanId, cidr, ports, concurrency, timeoutMs).catch((err) => {
        getWindow()?.webContents.send("scan:error", scanId, (err as Error).message);
      });
      return { scanId };
    }
  );

  ipcMain.handle("scan:stop", async (_event, scanId: string) => {
    networkScanner.stop(scanId);
    return { success: true };
  });

  ipcMain.handle("scan:results", async (_event, scanId: string) => {
    const db = getDb();
    return db.select().from(scanResults).where(eq(scanResults.scanId, scanId)).all();
  });
}
