export function toUserFacingError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/i, "")
    .trim() || "İşlem sırasında beklenmeyen bir hata oluştu.";
}
