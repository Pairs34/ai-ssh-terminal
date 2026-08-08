import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const groups = sqliteTable("groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`)
});

export const credentials = sqliteTable("credentials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  username: text("username").notNull(),
  encryptedPassword: text("encrypted_password"),
  encryptedPrivateKey: text("encrypted_private_key"),
  encryptedPassphrase: text("encrypted_passphrase"),
  encryptedEnableSecret: text("encrypted_enable_secret"),
  authMethod: text("auth_method", { enum: ["password", "private_key"] }).notNull().default("password"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

export const devices = sqliteTable("devices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  ipAddress: text("ip_address").notNull(),
  sshPort: integer("ssh_port").notNull().default(22),
  vendor: text("vendor"),
  model: text("model"),
  os: text("os"),
  osVersion: text("os_version"),
  deviceType: text("device_type", {
    enum: ["switch", "router", "firewall", "access_point", "linux_server", "windows_server", "storage", "hypervisor", "unknown"]
  }).notNull().default("unknown"),
  groupId: integer("group_id").references(() => groups.id),
  credentialId: integer("credential_id").references(() => credentials.id),
  status: text("status", { enum: ["online", "offline", "unknown"] }).notNull().default("unknown"),
  lastSeen: text("last_seen"),
  notes: text("notes"),
  isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#3B82F6")
});

export const deviceTags = sqliteTable("device_tags", {
  deviceId: integer("device_id").notNull().references(() => devices.id),
  tagId: integer("tag_id").notNull().references(() => tags.id)
});

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceId: integer("device_id").notNull().references(() => devices.id),
  startedAt: text("started_at").default(sql`CURRENT_TIMESTAMP`),
  endedAt: text("ended_at"),
  status: text("status", { enum: ["active", "closed", "error"] }).notNull().default("active"),
  outputPath: text("output_path")
});

export const aiMessages = sqliteTable("ai_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull().references(() => sessions.id),
  mode: text("mode", { enum: ["ask", "modify"] }).notNull(),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`)
});

export const commandLogs = sqliteTable("command_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull().references(() => sessions.id),
  deviceId: integer("device_id").notNull().references(() => devices.id),
  mode: text("mode", { enum: ["ask", "modify"] }).notNull(),
  command: text("command").notNull(),
  result: text("result"),
  approved: integer("approved", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`)
});

export const scanResults = sqliteTable("scan_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  scanId: text("scan_id").notNull(),
  ipAddress: text("ip_address").notNull(),
  hostname: text("hostname"),
  macAddress: text("mac_address"),
  vendor: text("vendor"),
  ports: text("ports"),
  detectedType: text("detected_type"),
  isExisting: integer("is_existing", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`)
});

export const commandKnowledge = sqliteTable("command_knowledge", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vendor: text("vendor").notNull(),
  os: text("os").notNull(),
  intent: text("intent").notNull(),
  command: text("command").notNull(),
  successCount: integer("success_count").notNull().default(1),
  lastUsedAt: text("last_used_at").default(sql`CURRENT_TIMESTAMP`)
});

// Verified Command Knowledge Base. JSON-shaped values stay as text because the
// application is intentionally local-first and uses SQLite rather than pgvector.
export const cliCommands = sqliteTable("cli_commands", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vendor: text("vendor").notNull(),
  platform: text("platform").notNull(),
  osVersionMin: text("os_version_min"),
  osVersionMax: text("os_version_max"),
  deviceType: text("device_type").notNull().default("unknown"),
  intent: text("intent").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  commandTemplate: text("command_template").notNull(),
  parameters: text("parameters").notNull().default("[]"),
  executionMode: text("execution_mode", { enum: ["ask", "modify"] }).notNull().default("ask"),
  riskLevel: text("risk_level", { enum: ["safe", "low", "medium", "high", "critical"] }).notNull().default("safe"),
  changesConfiguration: integer("changes_configuration", { mode: "boolean" }).notNull().default(false),
  requiresConfirmation: integer("requires_confirmation", { mode: "boolean" }).notNull().default(false),
  successCount: integer("success_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  totalExecutionCount: integer("total_execution_count").notNull().default(0),
  successRate: integer("success_rate").notNull().default(0),
  lastVerifiedAt: text("last_verified_at"),
  verifiedVersions: text("verified_versions").notNull().default("[]"),
  verifiedDeviceIds: text("verified_device_ids").notNull().default("[]"),
  exampleOutput: text("example_output"),
  expectedOutputPatterns: text("expected_output_patterns").notNull().default("[]"),
  failurePatterns: text("failure_patterns").notNull().default("[]"),
  outputParser: text("output_parser"),
  source: text("source").notNull().default("ai_suggestion"),
  verificationStatus: text("verification_status").notNull().default("draft"),
  rollbackTemplate: text("rollback_template"),
  precheckCommands: text("precheck_commands").notNull().default("[]"),
  postcheckCommands: text("postcheck_commands").notNull().default("[]"),
  tags: text("tags").notNull().default("[]"),
  embeddingText: text("embedding_text").notNull().default(""),
  sourceDocumentId: integer("source_document_id"),
  sourceChunkId: integer("source_chunk_id"),
  extractedCommandId: integer("extracted_command_id"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

export const cliCommandExecutions = sqliteTable("cli_command_executions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  commandId: integer("command_id").references(() => cliCommands.id),
  deviceId: integer("device_id").references(() => devices.id),
  sessionId: integer("session_id").references(() => sessions.id),
  renderedCommand: text("rendered_command").notNull(),
  osVersion: text("os_version"),
  exitCode: integer("exit_code"),
  stdout: text("stdout"),
  stderr: text("stderr"),
  durationMs: integer("duration_ms").notNull().default(0),
  status: text("status").notNull(),
  failurePattern: text("failure_pattern"),
  approved: integer("approved", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`)
});

export const aiAgentRuns = sqliteTable("ai_agent_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull().references(() => sessions.id),
  deviceId: integer("device_id").notNull().references(() => devices.id),
  instruction: text("instruction").notNull(),
  status: text("status", { enum: ["running", "paused", "completed", "blocked", "canceled", "needs_confirmation"] }).notNull().default("running"),
  summary: text("summary").notNull().default(""),
  steps: text("steps").notNull().default("[]"),
  observationText: text("observation_text").notNull().default(""),
  executedCommandKeys: text("executed_command_keys").notNull().default("[]"),
  totalActions: integer("total_actions").notNull().default(0),
  batchNumber: integer("batch_number").notNull().default(1),
  successfulChangeCount: integer("successful_change_count").notNull().default(0),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

export const ragDocuments = sqliteTable("rag_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vendor: text("vendor").notNull().default("Unknown"),
  platform: text("platform").notNull().default("Unknown"),
  deviceFamily: text("device_family"),
  deviceModels: text("device_models").notNull().default("[]"),
  documentType: text("document_type").notNull().default("other"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  softwareVersion: text("software_version"),
  versionExact: text("version_exact"),
  versionMin: text("version_min"),
  versionMax: text("version_max"),
  releaseDate: text("release_date"),
  language: text("language").notNull().default("en"),
  sourceType: text("source_type").notNull().default("administrator_upload"),
  sourceUrl: text("source_url"),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileHash: text("file_hash").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  pageCount: integer("page_count").notNull().default(0),
  processingStatus: text("processing_status").notNull().default("queued"),
  processingError: text("processing_error"),
  extractionMethod: text("extraction_method"),
  embeddingModel: text("embedding_model").notNull().default("local-hash-v1"),
  chunkCount: integer("chunk_count").notNull().default(0),
  extractedCommandCount: integer("extracted_command_count").notNull().default(0),
  ocrPageCount: integer("ocr_page_count").notNull().default(0),
  approximateTokens: integer("approximate_tokens").notNull().default(0),
  isOfficial: integer("is_official", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  uploadedBy: text("uploaded_by"),
  lastIndexedAt: text("last_indexed_at"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

export const ragDocumentChunks = sqliteTable("rag_document_chunks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  documentId: integer("document_id").notNull().references(() => ragDocuments.id),
  chunkIndex: integer("chunk_index").notNull(),
  sectionTitle: text("section_title"),
  sectionPath: text("section_path").notNull().default("[]"),
  pageStart: integer("page_start"),
  pageEnd: integer("page_end"),
  contentType: text("content_type").notNull().default("text"),
  commandName: text("command_name"),
  headingLevel: integer("heading_level"),
  content: text("content").notNull(),
  contentHash: text("content_hash").notNull(),
  tokenCount: integer("token_count").notNull().default(0),
  keywords: text("keywords").notNull().default("[]"),
  embedding: text("embedding").notNull().default("[]"),
  isDeprecated: integer("is_deprecated", { mode: "boolean" }).notNull().default(false),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`)
});

export const ragRetrievalLogs = sqliteTable("rag_retrieval_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  query: text("query").notNull(),
  filters: text("filters").notNull().default("{}"),
  results: text("results").notNull().default("[]"),
  contextTokens: integer("context_tokens").notNull().default(0),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`)
});

export const customPrompts = sqliteTable("custom_prompts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  promptText: text("prompt_text").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`)
});

export const playbooks = sqliteTable("playbooks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tag: text("tag").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  instructions: text("instructions").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`)
});
