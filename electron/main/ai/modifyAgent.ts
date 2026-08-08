import { isCommandSafe, requiresElevatedApproval } from "./safety";

export type ModifyAgentAction = "execute" | "finish" | "blocked";

export interface ModifyAgentDecision {
  action: ModifyAgentAction;
  command: string;
  reasoning: string;
  precheckCommand: string;
  verificationCommand: string;
  rollbackCommand: string;
  summary: string;
}

export interface ModifyAgentCommandPolicy {
  kind: "read_only" | "auto_execute" | "manual_approval" | "blocked";
  reason?: string;
}

export function normalizeModifyAgentDecision(value: Partial<ModifyAgentDecision> | null | undefined): ModifyAgentDecision {
  const action = value?.action === "finish" || value?.action === "blocked" ? value.action : "execute";
  return {
    action,
    command: String(value?.command || "").trim(),
    reasoning: String(value?.reasoning || "").trim(),
    precheckCommand: String(value?.precheckCommand || "").trim(),
    verificationCommand: String(value?.verificationCommand || "").trim(),
    rollbackCommand: String(value?.rollbackCommand || "").trim(),
    summary: String(value?.summary || "").trim()
  };
}

export function classifyModifyAgentCommand(command: string): ModifyAgentCommandPolicy {
  const readOnly = isCommandSafe(command, "ask");
  if (readOnly.safe) return { kind: "read_only" };

  const modify = isCommandSafe(command, "modify");
  if (!modify.safe) return { kind: "blocked", reason: modify.reason };
  if (requiresElevatedApproval(command)) {
    return { kind: "manual_approval", reason: "Yüksek etkili işlem ek kullanıcı onayı gerektiriyor." };
  }
  return { kind: "auto_execute" };
}

export function validateAutoExecuteChecks(decision: ModifyAgentDecision): string | null {
  if (!decision.rollbackCommand) return "Durum değiştiren adım için rollback komutu eksik.";
  if (!decision.verificationCommand) return "Durum değiştiren adım için doğrulama komutu eksik.";
  const rollbackSafety = isCommandSafe(decision.rollbackCommand, "modify");
  if (!rollbackSafety.safe || requiresElevatedApproval(decision.rollbackCommand)) {
    return `Rollback komutu güvenli değil: ${rollbackSafety.reason || decision.rollbackCommand}`;
  }
  const verificationSafety = isCommandSafe(decision.verificationCommand, "ask");
  if (!verificationSafety.safe) return `Doğrulama komutu salt-okunur değil: ${verificationSafety.reason}`;
  if (decision.precheckCommand) {
    const precheckSafety = isCommandSafe(decision.precheckCommand, "ask");
    if (!precheckSafety.safe) return `Precheck komutu salt-okunur değil: ${precheckSafety.reason}`;
  }
  return null;
}

export function commandExecutionKey(command: string, successfulChangeCount: number): string {
  return `${successfulChangeCount}:${command.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US")}`;
}

export function shouldPauseForNoProgress(consecutiveNoProgress: number): boolean {
  return consecutiveNoProgress >= 6;
}
