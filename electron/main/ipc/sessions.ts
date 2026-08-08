import { ipcMain, dialog } from "electron";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import { getDb } from "../database";
import { sessions, commandLogs, aiMessages } from "@database/schema";

export function registerSessionHandlers() {
  ipcMain.handle("sessions:create", async (_event, deviceId: number) => {
    const db = getDb();
    const result = db.insert(sessions).values({ deviceId, status: "active" }).run();
    return { id: Number(result.lastInsertRowid) };
  });

  ipcMain.handle("sessions:close", async (_event, sessionId: number) => {
    const db = getDb();
    db.update(sessions)
      .set({ status: "closed", endedAt: new Date().toISOString() })
      .where(eq(sessions.id, sessionId))
      .run();
    return { success: true };
  });

  ipcMain.handle("sessions:resume", async (_event, sessionId: number) => {
    const db = getDb();
    const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
    if (!session) throw new Error("Devam edilecek oturum bulunamadı.");
    db.update(sessions)
      .set({ status: "active", endedAt: null })
      .where(eq(sessions.id, sessionId))
      .run();
    return { ...session, status: "active", endedAt: null };
  });

  ipcMain.handle("sessions:list", async (_event, deviceId?: number) => {
    const db = getDb();
    const rows = db.select().from(sessions).all();
    return deviceId ? rows.filter((s) => s.deviceId === deviceId) : rows;
  });

  ipcMain.handle("sessions:get", async (_event, sessionId: number) => {
    const db = getDb();
    const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
    const commands = db.select().from(commandLogs).where(eq(commandLogs.sessionId, sessionId)).all();
    const messages = db.select().from(aiMessages).where(eq(aiMessages.sessionId, sessionId)).all();
    return { session, commands, messages };
  });

  ipcMain.handle("sessions:export", async (_event, sessionId: number) => {
    const db = getDb();
    const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
    const commands = db.select().from(commandLogs).where(eq(commandLogs.sessionId, sessionId)).all();

    const { filePath } = await dialog.showSaveDialog({
      defaultPath: `session-${sessionId}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (!filePath) return { success: false };

    fs.writeFileSync(filePath, JSON.stringify({ session, commands }, null, 2), "utf-8");
    return { success: true, filePath };
  });
}
