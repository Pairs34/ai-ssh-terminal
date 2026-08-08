import { eq } from "drizzle-orm";
import { getDb } from "../database";
import { devices, credentials } from "@database/schema";
import { decryptSecret } from "../credentials/vault";

export interface ResolvedConnection {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export function resolveDeviceConnection(deviceId: number): ResolvedConnection {
  const db = getDb();
  const device = db.select().from(devices).where(eq(devices.id, deviceId)).get();
  if (!device) throw new Error("Cihaz bulunamadı.");
  if (!device.credentialId) throw new Error("Cihaza atanmış credential profili yok.");

  const credential = db.select().from(credentials).where(eq(credentials.id, device.credentialId)).get();
  if (!credential) throw new Error("Credential profili bulunamadı.");

  const isPrivateKey = credential.authMethod === "private_key";

  return {
    host: device.ipAddress,
    port: device.sshPort,
    username: credential.username,
    password: !isPrivateKey && credential.encryptedPassword ? decryptSecret(credential.encryptedPassword) : undefined,
    privateKey: isPrivateKey && credential.encryptedPrivateKey ? decryptSecret(credential.encryptedPrivateKey) : undefined,
    passphrase: isPrivateKey && credential.encryptedPassphrase ? decryptSecret(credential.encryptedPassphrase) : undefined
  };
}
