import { ipcMain } from "electron";
import { eq } from "drizzle-orm";
import { getDb } from "../database";
import { credentials } from "@database/schema";
import { encryptSecret, maskSecret } from "../credentials/vault";

interface CreateCredentialPayload {
  name: string;
  username: string;
  authMethod: "password" | "private_key";
  password?: string;
  privateKey?: string;
  passphrase?: string;
  enableSecret?: string;
}

function toSafeView(row: typeof credentials.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    authMethod: row.authMethod,
    password: maskSecret(row.encryptedPassword),
    privateKey: row.encryptedPrivateKey ? "••••• (kayıtlı)" : "",
    enableSecret: maskSecret(row.encryptedEnableSecret),
    createdAt: row.createdAt
  };
}

export function registerCredentialHandlers() {
  ipcMain.handle("credentials:list", async () => {
    const db = getDb();
    const rows = db.select().from(credentials).all();
    return rows.map(toSafeView);
  });

  ipcMain.handle("credentials:create", async (_event, payload: CreateCredentialPayload) => {
    const db = getDb();
    const result = db
      .insert(credentials)
      .values({
        name: payload.name,
        username: payload.username,
        authMethod: payload.authMethod,
        encryptedPassword: payload.password ? encryptSecret(payload.password) : null,
        encryptedPrivateKey: payload.privateKey ? encryptSecret(payload.privateKey) : null,
        encryptedPassphrase: payload.passphrase ? encryptSecret(payload.passphrase) : null,
        encryptedEnableSecret: payload.enableSecret ? encryptSecret(payload.enableSecret) : null
      })
      .run();
    return { id: Number(result.lastInsertRowid) };
  });

  ipcMain.handle("credentials:update", async (_event, id: number, payload: Partial<CreateCredentialPayload>) => {
    const db = getDb();
    const updateValues: Record<string, unknown> = {};
    if (payload.name !== undefined) updateValues.name = payload.name;
    if (payload.username !== undefined) updateValues.username = payload.username;
    if (payload.authMethod !== undefined) updateValues.authMethod = payload.authMethod;
    if (payload.password) {
      updateValues.encryptedPassword = encryptSecret(payload.password);
    }
    if (payload.privateKey) {
      updateValues.encryptedPrivateKey = encryptSecret(payload.privateKey);
    }
    if (payload.passphrase) {
      updateValues.encryptedPassphrase = encryptSecret(payload.passphrase);
    }
    if (payload.enableSecret) {
      updateValues.encryptedEnableSecret = encryptSecret(payload.enableSecret);
    }

    db.update(credentials).set(updateValues).where(eq(credentials.id, id)).run();
    return { success: true };
  });

  ipcMain.handle("credentials:delete", async (_event, id: number) => {
    const db = getDb();
    db.delete(credentials).where(eq(credentials.id, id)).run();
    return { success: true };
  });
}
