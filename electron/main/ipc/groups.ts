import { ipcMain } from "electron";
import { eq } from "drizzle-orm";
import { getDb } from "../database";
import { groups } from "@database/schema";

export function registerGroupHandlers() {
  ipcMain.handle("groups:list", async () => {
    const db = getDb();
    return db.select().from(groups).all();
  });

  ipcMain.handle("groups:create", async (_event, payload: { name: string; description?: string }) => {
    const db = getDb();
    const result = db.insert(groups).values(payload).run();
    return { id: result.lastInsertRowid };
  });

  ipcMain.handle("groups:delete", async (_event, id: number) => {
    const db = getDb();
    db.delete(groups).where(eq(groups.id, id)).run();
    return { success: true };
  });
}
