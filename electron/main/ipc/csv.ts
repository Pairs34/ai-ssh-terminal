import { ipcMain, dialog } from "electron";
import fs from "node:fs";
import { getDb } from "../database";
import { devices } from "@database/schema";

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = values[i] ?? ""));
    return row;
  });
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => String(row[h] ?? "")).join(","));
  }
  return lines.join("\n");
}

export function registerCsvHandlers() {
  ipcMain.handle("csv:importDevices", async () => {
    const { filePaths } = await dialog.showOpenDialog({
      filters: [{ name: "CSV", extensions: ["csv"] }],
      properties: ["openFile"]
    });
    if (!filePaths[0]) return { imported: 0 };

    const content = fs.readFileSync(filePaths[0], "utf-8");
    const rows = parseCsv(content);
    const db = getDb();

    let imported = 0;
    for (const row of rows) {
      if (!row.name || !row.ip) continue;
      db.insert(devices)
        .values({
          name: row.name,
          ipAddress: row.ip,
          sshPort: row.port ? Number(row.port) : 22,
          vendor: row.vendor || null,
          deviceType: (row.device_type as typeof devices.$inferInsert.deviceType) || "unknown"
        })
        .run();
      imported++;
    }
    return { imported };
  });

  ipcMain.handle("csv:exportDevices", async () => {
    const db = getDb();
    const rows = db.select().from(devices).all();
    const csv = toCsv(rows);

    const { filePath } = await dialog.showSaveDialog({
      defaultPath: "devices-export.csv",
      filters: [{ name: "CSV", extensions: ["csv"] }]
    });
    if (!filePath) return { success: false };

    fs.writeFileSync(filePath, csv, "utf-8");
    return { success: true, filePath };
  });
}
