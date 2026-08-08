import { safeStorage } from "electron";

export function encryptSecret(plainText: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("İşletim sistemi seviyesinde güvenli depolama kullanılamıyor.");
  }
  return safeStorage.encryptString(plainText).toString("base64");
}

export function decryptSecret(encryptedBase64: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("İşletim sistemi seviyesinde güvenli depolama kullanılamıyor.");
  }
  const buffer = Buffer.from(encryptedBase64, "base64");
  return safeStorage.decryptString(buffer);
}

export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  return "•".repeat(Math.min(value.length, 12));
}
