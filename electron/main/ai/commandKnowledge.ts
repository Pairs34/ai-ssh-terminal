import { getSqlite } from "../database";

export type ExecutionMode = "ask" | "modify";
export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";
export type VerificationStatus = "draft" | "learned" | "tested" | "verified" | "trusted" | "deprecated";
export type CommandSource =
  | "manual"
  | "official_documentation"
  | "successful_session"
  | "ai_suggestion"
  | "imported"
  | "administrator_verified";

export interface CommandParameter {
  name: string;
  label?: string;
  type: string;
  required: boolean;
  example?: string;
  validationRegex?: string;
}

export interface CliCommandInput {
  id?: number;
  vendor: string;
  platform: string;
  osVersionMin?: string | null;
  osVersionMax?: string | null;
  deviceType?: string;
  intent: string;
  title: string;
  description?: string;
  commandTemplate: string;
  parameters?: CommandParameter[];
  executionMode: ExecutionMode;
  riskLevel: RiskLevel;
  changesConfiguration?: boolean;
  requiresConfirmation?: boolean;
  expectedOutputPatterns?: string[];
  failurePatterns?: string[];
  source: CommandSource;
  verificationStatus: VerificationStatus;
  rollbackTemplate?: string | null;
  precheckCommands?: string[];
  postcheckCommands?: string[];
  tags?: string[];
  exampleOutput?: string | null;
  sourceDocumentId?: number | null;
  sourceChunkId?: number | null;
}

export interface CliCommandRecord extends CliCommandInput {
  id: number;
  successCount: number;
  failureCount: number;
  totalExecutionCount: number;
  successRate: number;
  lastVerifiedAt: string | null;
  verifiedVersions: string[];
  verifiedDeviceIds: number[];
  embeddingText: string;
  createdAt: string | null;
  updatedAt: string | null;
}

const DEFAULT_FAILURE_PATTERNS = [
  "invalid input",
  "unknown command",
  "unknown action",
  "unrecognized command",
  "incomplete command",
  "permission denied",
  "not found",
  "syntax error",
  "command rejected",
  "unsupported command",
  "command parse error",
  "command fail",
  "return code -",
  "komut çalıştırma hatası",
  "uygulama hatası"
];

const PARAMETER_PATTERNS: Record<string, string> = {
  interface_name: "^[a-zA-Z0-9/._:-]+$",
  vlan_id: "^(?:[1-9]|[1-9][0-9]{1,2}|[1-3][0-9]{3}|40[0-8][0-9]|409[0-4])$",
  ip_address: "^(?:\\d{1,3}\\.){3}\\d{1,3}(?:/\\d{1,2})?$",
  hostname: "^[a-zA-Z0-9._-]+$",
  integer: "^-?\\d+$",
  service_name: "^[a-zA-Z0-9_.@-]+$",
  text: "^[a-zA-Z0-9 çğıöşüÇĞİÖŞÜ._:@/-]+$"
};

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToRecord(row: Record<string, unknown>): CliCommandRecord {
  return {
    id: Number(row.id),
    vendor: String(row.vendor),
    platform: String(row.platform),
    osVersionMin: row.os_version_min ? String(row.os_version_min) : null,
    osVersionMax: row.os_version_max ? String(row.os_version_max) : null,
    deviceType: String(row.device_type || "unknown"),
    intent: String(row.intent),
    title: String(row.title),
    description: String(row.description || ""),
    commandTemplate: String(row.command_template),
    parameters: parseJson<CommandParameter[]>(row.parameters, []),
    executionMode: String(row.execution_mode) as ExecutionMode,
    riskLevel: String(row.risk_level) as RiskLevel,
    changesConfiguration: Boolean(row.changes_configuration),
    requiresConfirmation: Boolean(row.requires_confirmation),
    successCount: Number(row.success_count || 0),
    failureCount: Number(row.failure_count || 0),
    totalExecutionCount: Number(row.total_execution_count || 0),
    successRate: Number(row.success_rate || 0),
    lastVerifiedAt: row.last_verified_at ? String(row.last_verified_at) : null,
    verifiedVersions: parseJson<string[]>(row.verified_versions, []),
    verifiedDeviceIds: parseJson<number[]>(row.verified_device_ids, []),
    expectedOutputPatterns: parseJson<string[]>(row.expected_output_patterns, []),
    failurePatterns: parseJson<string[]>(row.failure_patterns, []),
    source: String(row.source) as CommandSource,
    verificationStatus: String(row.verification_status) as VerificationStatus,
    rollbackTemplate: row.rollback_template ? String(row.rollback_template) : null,
    precheckCommands: parseJson<string[]>(row.precheck_commands, []),
    postcheckCommands: parseJson<string[]>(row.postcheck_commands, []),
    tags: parseJson<string[]>(row.tags, []),
    exampleOutput: row.example_output ? String(row.example_output) : null,
    sourceDocumentId: row.source_document_id ? Number(row.source_document_id) : null,
    sourceChunkId: row.source_chunk_id ? Number(row.source_chunk_id) : null,
    embeddingText: String(row.embedding_text || ""),
    createdAt: row.created_at ? String(row.created_at) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null
  };
}

export function compareVersions(left?: string | null, right?: string | null): number {
  if (!left || !right) return 0;
  const a = left.split(/[^0-9]+/).filter(Boolean).map(Number);
  const b = right.split(/[^0-9]+/).filter(Boolean).map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const delta = (a[i] || 0) - (b[i] || 0);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }
  return 0;
}

export function versionMatches(version: string | null | undefined, min?: string | null, max?: string | null): boolean {
  if (!version || (!min && !max)) return true;
  if (min && compareVersions(version, min) < 0) return false;
  if (max && compareVersions(version, max) > 0) return false;
  return true;
}

export function normalizeCommandTemplate(command: string): { template: string; parameters: CommandParameter[] } {
  let template = command.trim().replace(/\s+/g, " ");
  const parameters: CommandParameter[] = [];
  if (!template.includes("{{interface}}")) {
    const interfaceMatch = template.match(/\b(?:interface|neighbor|port)\s+([A-Za-z]*\d+(?:[/:._-]\d+)+)\b/i);
    if (interfaceMatch) {
      template = template.replace(interfaceMatch[1], "{{interface}}");
      parameters.push({
        name: "interface",
        label: "Arayüz",
        type: "interface_name",
        required: true,
        example: interfaceMatch[1],
        validationRegex: PARAMETER_PATTERNS.interface_name
      });
    }
  }
  if (!template.includes("{{ip_address}}")) {
    const ipMatch = template.match(/\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?\b/);
    if (ipMatch) {
      template = template.replace(ipMatch[0], "{{ip_address}}");
      parameters.push({
        name: "ip_address",
        label: "IP adresi",
        type: "ip_address",
        required: true,
        example: ipMatch[0],
        validationRegex: PARAMETER_PATTERNS.ip_address
      });
    }
  }
  return { template, parameters };
}

export function validateAndRenderTemplate(
  template: string,
  definitions: CommandParameter[],
  values: Record<string, string>
): string {
  const placeholders = [...template.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]);
  let rendered = template;
  for (const name of placeholders) {
    const definition = definitions.find((item) => item.name === name);
    const value = values[name];
    if (!value && definition?.required !== false) throw new Error(`Zorunlu parametre eksik: ${name}`);
    if (/[;&|`$><\r\n\\]/.test(value || "")) throw new Error(`Parametre güvenli değil: ${name}`);
    const pattern = definition?.validationRegex || PARAMETER_PATTERNS[definition?.type || "text"];
    if (pattern && !new RegExp(pattern).test(value || "")) throw new Error(`Parametre biçimi geçersiz: ${name}`);
    rendered = rendered.replaceAll(`{{${name}}}`, value || "");
  }
  return rendered;
}

export function validateCommandOutput(
  output: string,
  expectedPatterns: string[] = [],
  customFailurePatterns: string[] = [],
  exitCode: number | null = null
): { status: "success" | "failure" | "uncertain"; failurePattern?: string; reason?: string } {
  const clean = output.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "").trim();
  if (exitCode !== null && exitCode !== 0) return { status: "failure", reason: `Komut ${exitCode} exit code ile tamamlandı.` };
  if (!clean) return exitCode === 0
    ? { status: "success" }
    : { status: "failure", reason: "Cihazdan çıktı alınamadı." };
  const lower = clean.toLocaleLowerCase("en-US");
  const failure = [...DEFAULT_FAILURE_PATTERNS, ...customFailurePatterns].find((pattern) => lower.includes(pattern.toLocaleLowerCase("en-US")));
  if (failure) return { status: "failure", failurePattern: failure, reason: `Hata kalıbı bulundu: ${failure}` };
  if (expectedPatterns.length > 0 && !expectedPatterns.some((pattern) => new RegExp(pattern, "i").test(clean))) {
    return { status: "uncertain", reason: "Beklenen çıktı kalıplarından hiçbiri bulunamadı." };
  }
  return { status: "success" };
}

function tokenize(value: string): Set<string> {
  return new Set(value.toLocaleLowerCase("tr-TR").split(/[^a-z0-9çğıöşü._/-]+/i).filter((token) => token.length > 1));
}

function lexicalScore(query: string, text: string): number {
  const q = tokenize(query);
  const t = tokenize(text);
  if (q.size === 0 || t.size === 0) return 0;
  let hits = 0;
  q.forEach((token) => { if (t.has(token)) hits += 1; });
  return hits / Math.sqrt(q.size * t.size);
}

export function buildEmbeddingText(input: CliCommandInput): string {
  const parameterText = (input.parameters || []).map((parameter) => `${parameter.label || parameter.name}: ${parameter.type}`).join(", ");
  return [input.vendor, input.platform, input.deviceType, input.intent, input.title, input.description, input.commandTemplate, parameterText, ...(input.tags || [])]
    .filter(Boolean)
    .join(". ");
}

export function listCommands(): CliCommandRecord[] {
  const rows = getSqlite().prepare("SELECT * FROM cli_commands ORDER BY updated_at DESC, id DESC").all() as Record<string, unknown>[];
  return rows.map(rowToRecord);
}

export function saveCommand(rawInput: CliCommandInput): { id: number; deduplicated: boolean } {
  const db = getSqlite();
  const normalized = normalizeCommandTemplate(rawInput.commandTemplate);
  const input: CliCommandInput = {
    ...rawInput,
    commandTemplate: normalized.template,
    parameters: rawInput.parameters?.length ? rawInput.parameters : normalized.parameters,
    requiresConfirmation: rawInput.executionMode === "modify" ? true : Boolean(rawInput.requiresConfirmation),
    changesConfiguration: rawInput.executionMode === "modify" ? true : Boolean(rawInput.changesConfiguration),
    verificationStatus: rawInput.source === "ai_suggestion" ? "draft" : rawInput.verificationStatus
  };
  if (input.executionMode === "modify" && (!input.rollbackTemplate || !(input.precheckCommands?.length) || !(input.postcheckCommands?.length))) {
    throw new Error("Modify komutlarında precheck, postcheck ve rollback zorunludur.");
  }
  const embeddingText = buildEmbeddingText(input);
  const existing = db.prepare(
    "SELECT id FROM cli_commands WHERE lower(platform)=lower(?) AND lower(command_template)=lower(?) AND execution_mode=?"
  ).get(input.platform, input.commandTemplate, input.executionMode) as { id: number } | undefined;
  const targetId = rawInput.id || existing?.id;
  const values = [
    input.vendor, input.platform, input.osVersionMin || null, input.osVersionMax || null, input.deviceType || "unknown",
    input.intent, input.title, input.description || "", input.commandTemplate, JSON.stringify(input.parameters || []),
    input.executionMode, input.riskLevel, Number(Boolean(input.changesConfiguration)), Number(Boolean(input.requiresConfirmation)),
    input.exampleOutput || null, JSON.stringify(input.expectedOutputPatterns || []), JSON.stringify(input.failurePatterns || []),
    input.source, input.verificationStatus, input.rollbackTemplate || null, JSON.stringify(input.precheckCommands || []),
    JSON.stringify(input.postcheckCommands || []), JSON.stringify(input.tags || []), embeddingText,
    input.sourceDocumentId || null, input.sourceChunkId || null
  ];
  if (targetId) {
    const previous = db.prepare("SELECT * FROM cli_commands WHERE id=?").get(targetId);
    db.prepare(`UPDATE cli_commands SET vendor=?, platform=?, os_version_min=?, os_version_max=?, device_type=?, intent=?,
      title=?, description=?, command_template=?, parameters=?, execution_mode=?, risk_level=?, changes_configuration=?,
      requires_confirmation=?, example_output=?, expected_output_patterns=?, failure_patterns=?, source=?, verification_status=?,
      rollback_template=?, precheck_commands=?, postcheck_commands=?, tags=?, embedding_text=?, source_document_id=?,
      source_chunk_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(...values, targetId);
    db.prepare("INSERT INTO cli_command_history (command_id, action, snapshot) VALUES (?, ?, ?)")
      .run(targetId, existing && !rawInput.id ? "deduplicated" : "updated", JSON.stringify(previous || {}));
    return { id: targetId, deduplicated: Boolean(existing && !rawInput.id) };
  }
  const result = db.prepare(`INSERT INTO cli_commands (vendor, platform, os_version_min, os_version_max, device_type, intent,
    title, description, command_template, parameters, execution_mode, risk_level, changes_configuration,
    requires_confirmation, example_output, expected_output_patterns, failure_patterns, source, verification_status,
    rollback_template, precheck_commands, postcheck_commands, tags, embedding_text, source_document_id, source_chunk_id)
    VALUES (${values.map(() => "?").join(",")})`).run(...values);
  return { id: Number(result.lastInsertRowid), deduplicated: false };
}

export function deleteCommand(id: number): void {
  getSqlite().prepare("DELETE FROM cli_commands WHERE id=?").run(id);
}

export interface CommandSearchContext {
  vendor?: string | null;
  platform?: string | null;
  deviceType?: string | null;
  osVersion?: string | null;
  executionMode: ExecutionMode;
  includeLearned?: boolean;
}

export function rankCommandCandidates(
  commands: CliCommandRecord[],
  query: string,
  context: CommandSearchContext,
  limit = 8
): Array<CliCommandRecord & { finalScore: number }> {
  const allowed = context.includeLearned ? ["learned", "tested", "verified", "trusted"] : ["verified", "trusted"];
  return commands
    .filter((command) => command.executionMode === context.executionMode)
    .filter((command) => command.verificationStatus !== "deprecated" && allowed.includes(command.verificationStatus))
    .filter((command) => !context.platform || command.platform.toLowerCase() === context.platform.toLowerCase())
    .filter((command) => !context.vendor || command.vendor.toLowerCase().includes(context.vendor.toLowerCase()) || context.vendor.toLowerCase().includes(command.vendor.toLowerCase()))
    .filter((command) => !context.deviceType || command.deviceType === "unknown" || command.deviceType === context.deviceType)
    .filter((command) => versionMatches(context.osVersion, command.osVersionMin, command.osVersionMax))
    .map((command) => {
      const semantic = lexicalScore(query, command.embeddingText);
      const verificationScores: Partial<Record<VerificationStatus, number>> = { learned: 0.08, tested: 0.16, verified: 0.24, trusted: 0.32 };
      const verification = verificationScores[command.verificationStatus] || 0;
      const success = (command.successRate / 100) * 0.2;
      const recency = command.lastVerifiedAt && Date.now() - Date.parse(command.lastVerifiedAt) < 180 * 86400000 ? 0.08 : 0;
      const riskPenalty = context.executionMode === "modify" ? { safe: 0, low: 0.03, medium: 0.08, high: 0.16, critical: 1 }[command.riskLevel] : 0;
      const failurePenalty = command.totalExecutionCount ? (command.failureCount / command.totalExecutionCount) * 0.2 : 0;
      return { ...command, finalScore: semantic + 0.3 + verification + success + recency - riskPenalty - failurePenalty };
    })
    .filter((command) => command.finalScore > 0.3)
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, limit);
}

export function retrieveCommands(query: string, context: CommandSearchContext, limit = 8): Array<CliCommandRecord & { finalScore: number }> {
  return rankCommandCandidates(listCommands(), query, context, limit);
}

export interface ExecutionEvidence {
  commandId?: number | null;
  deviceId: number;
  sessionId: number;
  renderedCommand: string;
  osVersion?: string | null;
  output: string;
  durationMs: number;
  approved: boolean;
  exitCode?: number | null;
  expectedPatterns?: string[];
  failurePatterns?: string[];
}

export function recordExecution(evidence: ExecutionEvidence): ReturnType<typeof validateCommandOutput> {
  const db = getSqlite();
  const validation = validateCommandOutput(evidence.output, evidence.expectedPatterns, evidence.failurePatterns, evidence.exitCode);
  const exitCode = evidence.exitCode ?? (validation.status === "failure" ? 1 : validation.status === "success" ? 0 : null);
  db.prepare(`INSERT INTO cli_command_executions (command_id, device_id, session_id, rendered_command, os_version,
    exit_code, stdout, stderr, duration_ms, status, failure_pattern, approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(evidence.commandId || null, evidence.deviceId, evidence.sessionId, evidence.renderedCommand, evidence.osVersion || null,
      exitCode, validation.status === "failure" ? null : evidence.output.slice(0, 20000), validation.status === "failure" ? evidence.output.slice(0, 20000) : null,
      evidence.durationMs, validation.status, validation.failurePattern || null, Number(evidence.approved));
  if (evidence.commandId) {
    const row = db.prepare("SELECT success_count, failure_count, verification_status, verified_versions, verified_device_ids FROM cli_commands WHERE id=?")
      .get(evidence.commandId) as Record<string, unknown> | undefined;
    if (row) {
      const successCount = Number(row.success_count || 0) + (validation.status === "success" ? 1 : 0);
      const failureCount = Number(row.failure_count || 0) + (validation.status === "success" ? 0 : 1);
      const total = successCount + failureCount;
      const versions = new Set(parseJson<string[]>(row.verified_versions, []));
      const deviceIds = new Set(parseJson<number[]>(row.verified_device_ids, []));
      if (validation.status === "success") {
        if (evidence.osVersion) versions.add(evidence.osVersion);
        deviceIds.add(evidence.deviceId);
      }
      const currentStatus = String(row.verification_status) as VerificationStatus;
      const nextStatus = validation.status === "success" && currentStatus === "draft" ? "learned" : currentStatus;
      db.prepare(`UPDATE cli_commands SET success_count=?, failure_count=?, total_execution_count=?, success_rate=?,
        last_verified_at=CASE WHEN ?='success' THEN CURRENT_TIMESTAMP ELSE last_verified_at END,
        verified_versions=?, verified_device_ids=?, verification_status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(successCount, failureCount, total, Math.round(successCount / Math.max(total, 1) * 100), validation.status,
          JSON.stringify([...versions]), JSON.stringify([...deviceIds]), nextStatus, evidence.commandId);
      if (validation.status === "success") {
        db.prepare("INSERT OR REPLACE INTO cli_command_verified_devices (command_id, device_id, last_verified_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
          .run(evidence.commandId, evidence.deviceId);
        if (evidence.osVersion) db.prepare("INSERT OR REPLACE INTO cli_command_verified_versions (command_id, os_version, last_verified_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
          .run(evidence.commandId, evidence.osVersion);
      }
    }
  }
  return validation;
}

export function learnExecutedCommand(input: {
  vendor: string; platform: string; deviceType: string; command: string; intent: string; deviceId: number; sessionId: number;
  osVersion?: string | null; output: string; durationMs: number;
}): { command: CliCommandRecord; validation: ReturnType<typeof validateCommandOutput> } {
  const normalized = normalizeCommandTemplate(input.command);
  const saved = saveCommand({
    vendor: input.vendor || "Unknown", platform: input.platform || "Unknown", deviceType: input.deviceType,
    intent: input.intent || "diagnose", title: input.intent || "Öğrenilmiş teşhis komutu",
    description: "Başarılı cihaz oturumundan öğrenildi.", commandTemplate: normalized.template, parameters: normalized.parameters,
    executionMode: "ask", riskLevel: "safe", source: "successful_session", verificationStatus: "draft",
    expectedOutputPatterns: [], failurePatterns: DEFAULT_FAILURE_PATTERNS, tags: [input.intent || "diagnose"]
  });
  const validation = recordExecution({ commandId: saved.id, deviceId: input.deviceId, sessionId: input.sessionId,
    renderedCommand: input.command, osVersion: input.osVersion, output: input.output, durationMs: input.durationMs, approved: true });
  const command = listCommands().find((item) => item.id === saved.id);
  if (!command) throw new Error("Öğrenilen komut kaydı bulunamadı.");
  return { command, validation };
}

export function getDefaultFailurePatterns(): string[] {
  return [...DEFAULT_FAILURE_PATTERNS];
}
