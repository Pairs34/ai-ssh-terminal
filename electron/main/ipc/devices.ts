import { ipcMain } from "electron";
import { eq } from "drizzle-orm";
import net from "node:net";
import { getDb } from "../database";
import { devices } from "@database/schema";

function checkTcp(ip: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (result: boolean) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, ip);
  });
}

export function registerDeviceHandlers() {
  ipcMain.handle("devices:bulkCreate", async (_event, items: (typeof devices.$inferInsert)[]) => {
    const db = getDb();
    const inserted: number[] = [];
    for (const item of items) {
      const result = db.insert(devices).values(item).run();
      inserted.push(Number(result.lastInsertRowid));
    }
    return { ids: inserted };
  });

  ipcMain.handle("devices:checkStatus", async (_event, id: number) => {
    const db = getDb();
    const device = db.select().from(devices).where(eq(devices.id, id)).get();
    if (!device) throw new Error("Cihaz bulunamadı.");
    const online = await checkTcp(device.ipAddress, device.sshPort);
    db.update(devices)
      .set({ status: online ? "online" : "offline", lastSeen: new Date().toISOString() })
      .where(eq(devices.id, id))
      .run();
    return { status: online ? "online" : "offline" };
  });

  ipcMain.handle("devices:list", async () => {
    const db = getDb();
    return db.select().from(devices).all();
  });

  ipcMain.handle("devices:create", async (_event, payload) => {
    const db = getDb();
    const result = db.insert(devices).values(payload).run();
    return { id: Number(result.lastInsertRowid) };
  });

  ipcMain.handle("devices:update", async (_event, id: number, payload) => {
    const db = getDb();
    db.update(devices).set(payload).where(eq(devices.id, id)).run();
    return { success: true };
  });

  ipcMain.handle("devices:delete", async (_event, id: number) => {
    const db = getDb();
    db.delete(devices).where(eq(devices.id, id)).run();
    return { success: true };
  });
}
