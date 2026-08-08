import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { App } from "electron";
import path from "node:path";
import fs from "node:fs";
import * as schema from "@database/schema";

let sqlite: Database.Database | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "groups" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "name" text NOT NULL,
      "description" text,
      "created_at" text DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "credentials" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "name" text NOT NULL,
      "username" text NOT NULL,
      "encrypted_password" text,
      "encrypted_private_key" text,
      "encrypted_passphrase" text,
      "encrypted_enable_secret" text,
      "auth_method" text DEFAULT 'password' NOT NULL,
      "created_at" text DEFAULT CURRENT_TIMESTAMP,
      "updated_at" text DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "devices" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "name" text NOT NULL,
      "ip_address" text NOT NULL,
      "ssh_port" integer DEFAULT 22 NOT NULL,
      "vendor" text,
      "model" text,
      "os" text,
      "os_version" text,
      "device_type" text DEFAULT 'unknown' NOT NULL,
      "group_id" integer REFERENCES "groups"("id"),
      "credential_id" integer REFERENCES "credentials"("id"),
      "status" text DEFAULT 'unknown' NOT NULL,
      "last_seen" text,
      "notes" text,
      "is_favorite" integer DEFAULT 0 NOT NULL,
      "created_at" text DEFAULT CURRENT_TIMESTAMP,
      "updated_at" text DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "tags" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "name" text NOT NULL,
      "color" text DEFAULT '#3B82F6' NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "device_tags" (
      "device_id" integer NOT NULL REFERENCES "devices"("id"),
      "tag_id" integer NOT NULL REFERENCES "tags"("id")
    );
    CREATE TABLE IF NOT EXISTS "sessions" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "device_id" integer NOT NULL REFERENCES "devices"("id"),
      "started_at" text DEFAULT CURRENT_TIMESTAMP,
      "ended_at" text,
      "status" text DEFAULT 'active' NOT NULL,
      "output_path" text
    );
    CREATE TABLE IF NOT EXISTS "ai_messages" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "session_id" integer NOT NULL REFERENCES "sessions"("id"),
      "mode" text NOT NULL,
      "role" text NOT NULL,
      "content" text NOT NULL,
      "created_at" text DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "command_logs" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "session_id" integer NOT NULL REFERENCES "sessions"("id"),
      "device_id" integer NOT NULL REFERENCES "devices"("id"),
      "mode" text NOT NULL,
      "command" text NOT NULL,
      "result" text,
      "approved" integer DEFAULT 0 NOT NULL,
      "created_at" text DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "command_knowledge" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "vendor" text NOT NULL,
      "os" text NOT NULL,
      "intent" text NOT NULL,
      "command" text NOT NULL,
      "success_count" integer DEFAULT 1 NOT NULL,
      "last_used_at" text DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "cli_commands" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "vendor" text NOT NULL, "platform" text NOT NULL,
      "os_version_min" text, "os_version_max" text, "device_type" text DEFAULT 'unknown' NOT NULL,
      "intent" text NOT NULL, "title" text NOT NULL, "description" text DEFAULT '' NOT NULL,
      "command_template" text NOT NULL, "parameters" text DEFAULT '[]' NOT NULL,
      "execution_mode" text DEFAULT 'ask' NOT NULL, "risk_level" text DEFAULT 'safe' NOT NULL,
      "changes_configuration" integer DEFAULT 0 NOT NULL, "requires_confirmation" integer DEFAULT 0 NOT NULL,
      "success_count" integer DEFAULT 0 NOT NULL, "failure_count" integer DEFAULT 0 NOT NULL,
      "total_execution_count" integer DEFAULT 0 NOT NULL, "success_rate" integer DEFAULT 0 NOT NULL,
      "last_verified_at" text, "verified_versions" text DEFAULT '[]' NOT NULL,
      "verified_device_ids" text DEFAULT '[]' NOT NULL, "example_output" text,
      "expected_output_patterns" text DEFAULT '[]' NOT NULL, "failure_patterns" text DEFAULT '[]' NOT NULL,
      "output_parser" text, "source" text DEFAULT 'ai_suggestion' NOT NULL,
      "verification_status" text DEFAULT 'draft' NOT NULL, "rollback_template" text,
      "precheck_commands" text DEFAULT '[]' NOT NULL, "postcheck_commands" text DEFAULT '[]' NOT NULL,
      "tags" text DEFAULT '[]' NOT NULL, "embedding_text" text DEFAULT '' NOT NULL,
      "source_document_id" integer, "source_chunk_id" integer, "extracted_command_id" integer,
      "created_at" text DEFAULT CURRENT_TIMESTAMP, "updated_at" text DEFAULT CURRENT_TIMESTAMP,
      UNIQUE("platform", "command_template", "execution_mode")
    );
    CREATE TABLE IF NOT EXISTS "cli_command_parameters" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "command_id" integer NOT NULL REFERENCES "cli_commands"("id") ON DELETE CASCADE,
      "name" text NOT NULL, "label" text, "type" text NOT NULL, "required" integer DEFAULT 1 NOT NULL,
      "example" text, "validation_regex" text, UNIQUE("command_id", "name")
    );
    CREATE TABLE IF NOT EXISTS "cli_command_executions" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "command_id" integer REFERENCES "cli_commands"("id") ON DELETE SET NULL,
      "device_id" integer REFERENCES "devices"("id"), "session_id" integer REFERENCES "sessions"("id"),
      "rendered_command" text NOT NULL, "os_version" text, "exit_code" integer, "stdout" text, "stderr" text,
      "duration_ms" integer DEFAULT 0 NOT NULL, "status" text NOT NULL, "failure_pattern" text,
      "approved" integer DEFAULT 0 NOT NULL, "created_at" text DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "cli_command_verified_devices" (
      "command_id" integer NOT NULL REFERENCES "cli_commands"("id") ON DELETE CASCADE,
      "device_id" integer NOT NULL REFERENCES "devices"("id") ON DELETE CASCADE,
      "last_verified_at" text DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY("command_id", "device_id")
    );
    CREATE TABLE IF NOT EXISTS "cli_command_verified_versions" (
      "command_id" integer NOT NULL REFERENCES "cli_commands"("id") ON DELETE CASCADE,
      "os_version" text NOT NULL, "last_verified_at" text DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY("command_id", "os_version")
    );
    CREATE TABLE IF NOT EXISTS "cli_command_tags" (
      "command_id" integer NOT NULL REFERENCES "cli_commands"("id") ON DELETE CASCADE, "tag" text NOT NULL,
      PRIMARY KEY("command_id", "tag")
    );
    CREATE TABLE IF NOT EXISTS "cli_command_history" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "command_id" integer NOT NULL REFERENCES "cli_commands"("id") ON DELETE CASCADE,
      "action" text NOT NULL, "snapshot" text NOT NULL, "created_at" text DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "rag_documents" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "vendor" text DEFAULT 'Unknown' NOT NULL,
      "platform" text DEFAULT 'Unknown' NOT NULL, "device_family" text, "device_models" text DEFAULT '[]' NOT NULL,
      "document_type" text DEFAULT 'other' NOT NULL, "title" text NOT NULL, "description" text DEFAULT '' NOT NULL,
      "software_version" text, "version_exact" text, "version_min" text, "version_max" text, "release_date" text,
      "language" text DEFAULT 'en' NOT NULL, "source_type" text DEFAULT 'administrator_upload' NOT NULL, "source_url" text,
      "file_name" text NOT NULL, "file_path" text NOT NULL, "file_hash" text NOT NULL UNIQUE, "mime_type" text NOT NULL,
      "file_size" integer NOT NULL, "page_count" integer DEFAULT 0 NOT NULL,
      "processing_status" text DEFAULT 'queued' NOT NULL, "processing_error" text, "extraction_method" text,
      "embedding_model" text DEFAULT 'local-hash-v1' NOT NULL, "chunk_count" integer DEFAULT 0 NOT NULL,
      "extracted_command_count" integer DEFAULT 0 NOT NULL, "ocr_page_count" integer DEFAULT 0 NOT NULL,
      "approximate_tokens" integer DEFAULT 0 NOT NULL, "is_official" integer DEFAULT 0 NOT NULL,
      "is_active" integer DEFAULT 1 NOT NULL, "uploaded_by" text, "last_indexed_at" text,
      "created_at" text DEFAULT CURRENT_TIMESTAMP, "updated_at" text DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "rag_document_chunks" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "document_id" integer NOT NULL REFERENCES "rag_documents"("id") ON DELETE CASCADE,
      "chunk_index" integer NOT NULL, "section_title" text, "section_path" text DEFAULT '[]' NOT NULL,
      "page_start" integer, "page_end" integer, "content_type" text DEFAULT 'paragraph' NOT NULL, "command_name" text,
      "heading_level" integer,
      "content" text NOT NULL, "content_hash" text NOT NULL, "token_count" integer DEFAULT 0 NOT NULL,
      "keywords" text DEFAULT '[]' NOT NULL, "embedding" text DEFAULT '[]' NOT NULL,
      "is_deprecated" integer DEFAULT 0 NOT NULL, "metadata" text DEFAULT '{}' NOT NULL,
      "created_at" text DEFAULT CURRENT_TIMESTAMP, UNIQUE("document_id", "content_hash")
    );
    CREATE TABLE IF NOT EXISTS "rag_document_extracted_commands" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "document_id" integer NOT NULL REFERENCES "rag_documents"("id") ON DELETE CASCADE,
      "chunk_id" integer REFERENCES "rag_document_chunks"("id") ON DELETE CASCADE, "command_template" text NOT NULL,
      "source_page" integer, "extraction_confidence" integer DEFAULT 50 NOT NULL,
      "verification_status" text DEFAULT 'draft' NOT NULL, "metadata" text DEFAULT '{}' NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "rag_document_release_changes" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "document_id" integer NOT NULL REFERENCES "rag_documents"("id") ON DELETE CASCADE,
      "change_type" text NOT NULL, "command" text, "introduced_version" text, "deprecated_version" text,
      "removed_version" text, "replacement_command" text, "source_page" integer
    );
    CREATE TABLE IF NOT EXISTS "rag_document_processing_jobs" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "document_id" integer NOT NULL REFERENCES "rag_documents"("id") ON DELETE CASCADE,
      "status" text NOT NULL, "stage" text NOT NULL, "progress" integer DEFAULT 0 NOT NULL, "error" text,
      "created_at" text DEFAULT CURRENT_TIMESTAMP, "updated_at" text DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "rag_document_versions" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "document_id" integer NOT NULL REFERENCES "rag_documents"("id") ON DELETE CASCADE,
      "software_version" text, "version_min" text, "version_max" text, "file_hash" text NOT NULL,
      "created_at" text DEFAULT CURRENT_TIMESTAMP, UNIQUE("document_id", "file_hash")
    );
    CREATE TABLE IF NOT EXISTS "rag_document_metadata" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "document_id" integer NOT NULL REFERENCES "rag_documents"("id") ON DELETE CASCADE,
      "metadata_type" text NOT NULL, "metadata_key" text NOT NULL, "metadata_value" text NOT NULL,
      "source_page" integer, "confidence" integer DEFAULT 50 NOT NULL, UNIQUE("document_id", "metadata_type", "metadata_key", "source_page")
    );
    CREATE TABLE IF NOT EXISTS "rag_retrieval_logs" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "query" text NOT NULL, "filters" text DEFAULT '{}' NOT NULL,
      "results" text DEFAULT '[]' NOT NULL, "context_tokens" integer DEFAULT 0 NOT NULL, "created_at" text DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "rag_query_results" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "retrieval_log_id" integer NOT NULL REFERENCES "rag_retrieval_logs"("id") ON DELETE CASCADE,
      "chunk_id" integer NOT NULL REFERENCES "rag_document_chunks"("id") ON DELETE CASCADE,
      "rank" integer NOT NULL, "vector_score" integer DEFAULT 0 NOT NULL, "keyword_score" integer DEFAULT 0 NOT NULL,
      "exact_score" integer DEFAULT 0 NOT NULL, "version_score" integer DEFAULT 0 NOT NULL, "final_score" integer DEFAULT 0 NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "rag_embedding_cache" (
      "content_hash" text PRIMARY KEY NOT NULL, "embedding_model" text NOT NULL, "embedding" text NOT NULL,
      "created_at" text DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "ai_agent_runs" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "session_id" integer NOT NULL REFERENCES "sessions"("id"),
      "device_id" integer NOT NULL REFERENCES "devices"("id"),
      "instruction" text NOT NULL,
      "status" text DEFAULT 'running' NOT NULL,
      "summary" text DEFAULT '' NOT NULL,
      "steps" text DEFAULT '[]' NOT NULL,
      "observation_text" text DEFAULT '' NOT NULL,
      "executed_command_keys" text DEFAULT '[]' NOT NULL,
      "total_actions" integer DEFAULT 0 NOT NULL,
      "batch_number" integer DEFAULT 1 NOT NULL,
      "successful_change_count" integer DEFAULT 0 NOT NULL,
      "created_at" text DEFAULT CURRENT_TIMESTAMP,
      "updated_at" text DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS "idx_ai_agent_runs_resume" ON "ai_agent_runs"("session_id", "status", "updated_at");
    CREATE INDEX IF NOT EXISTS "idx_cli_commands_lookup" ON "cli_commands"("vendor", "platform", "device_type", "execution_mode", "verification_status");
    CREATE INDEX IF NOT EXISTS "idx_rag_documents_lookup" ON "rag_documents"("vendor", "platform", "document_type", "is_active");
    CREATE INDEX IF NOT EXISTS "idx_rag_chunks_document" ON "rag_document_chunks"("document_id", "is_deprecated");
    CREATE TABLE IF NOT EXISTS "custom_prompts" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "title" text NOT NULL,
      "prompt_text" text NOT NULL,
      "is_default" integer DEFAULT 0 NOT NULL,
      "created_at" text DEFAULT CURRENT_TIMESTAMP,
      "updated_at" text DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "playbooks" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "tag" text NOT NULL UNIQUE,
      "title" text NOT NULL,
      "description" text,
      "instructions" text NOT NULL,
      "created_at" text DEFAULT CURRENT_TIMESTAMP,
      "updated_at" text DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Existing installations predate the explicit OS version column.
  const deviceColumns = db.prepare("PRAGMA table_info(devices)").all() as Array<{ name: string }>;
  if (!deviceColumns.some((column) => column.name === "os_version")) {
    db.exec(`ALTER TABLE devices ADD COLUMN os_version text`);
  }
  const chunkColumns = db.prepare("PRAGMA table_info(rag_document_chunks)").all() as Array<{ name: string }>;
  if (!chunkColumns.some((column) => column.name === "heading_level")) {
    db.exec(`ALTER TABLE rag_document_chunks ADD COLUMN heading_level integer`);
  }

  // Backward-compatible one-time lift from the old five-column memory.
  db.exec(`
    INSERT OR IGNORE INTO cli_commands (
      vendor, platform, intent, title, description, command_template, execution_mode,
      risk_level, success_count, total_execution_count, success_rate, last_verified_at,
      source, verification_status, embedding_text
    )
    SELECT vendor, os, intent, intent, 'Eski komut hafızasından taşındı', command, 'ask',
      'safe', success_count, success_count, 100, last_used_at, 'successful_session',
      CASE WHEN success_count > 1 THEN 'tested' ELSE 'learned' END,
      vendor || ' ' || os || ' ' || intent || ' ' || command
    FROM command_knowledge;
  `);

  // Seed default playbooks if table is empty
  const count = db.prepare(`SELECT COUNT(*) as count FROM playbooks`).get() as { count: number };
  if (count.count === 0) {
    db.exec(`
      INSERT INTO playbooks (tag, title, description, instructions) VALUES
      ('FiberTroubleshoot', 'Fiber Optik SFP Sağlık Raporu', 'Fiber portların TX/RX ışık güçlerini, voltajı ve CRC paket kaybı sayaçlarını detaylıca inceler.', 'Sırasıyla tüm SFP fiber portlarının optik güç değerlerini (show interface transceiver detail veya show interface transceiver), port hata sayaçlarını (show interface counters) ve link durumlarını (show interface brief) kontrol et. TX/RX dBm değerlerini ve düşen paket sayaçlarını raporla.'),
      ('VlanAudit', 'VLAN ve Trunk Port Denetimi', 'VLAN tanımlarını, trunk port geçişlerini ve native VLAN çakışmalarını denetler.', 'Cihazdaki tüm VLAN tanımlarını (show vlan), port atamalarını ve trunk yapılandırmalarını (show interface brief) denetle. Eşleşmeyen veya eksik olan yapılandırmaları tespit et.'),
      ('ServerHealthCheck', 'Sunucu Kaynak & Log İncelemesi', 'Linux/Windows sunucularda CPU, RAM, Disk doluluğu ve kritik logları inceler.', 'Disk doluluğunu (df -h), bellek durumunu (free -m), sistem yükünü ve en son hata loglarını (journalctl -p 3 -n 50 veya dmesg | tail -n 30) çalıştırarak derin inceleme yap.');
    `);
  }

  // Seed default custom prompt if table is empty
  const promptCount = db.prepare(`SELECT COUNT(*) as count FROM custom_prompts`).get() as { count: number };
  if (promptCount.count === 0) {
    db.exec(`
      INSERT INTO custom_prompts (title, prompt_text, is_default) VALUES
      ('Kıdemli Ağ Mühendisi (Varsayılan)', 'Sen uzman ve kıdemli bir Ağ ve Sistem AI Mühendisinisin. Canlı SSH terminalinde çalıştırılan komut çıktılarını inceleyerek derin teşhisler koyarsın. Kullanıcıya asla "aşağıdaki komutları çalıştırıp paylaşın" gibi tembel önerilerde bulunmazsın; ihtiyaç duyduğun verileri kendin otonom olarak toplar ve bulgularını zengin Markdown tabloları ile sunarsın.', 1);
    `);
  }
}

export function getDb() {
  if (dbInstance) return dbInstance;

  const { app } = require("electron") as { app: App };
  const userDataPath = app.getPath("userData");
  const dataDir = path.join(userDataPath, "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "app.db");
  sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  initTables(sqlite);

  dbInstance = drizzle(sqlite, { schema });
  return dbInstance;
}

export function getSqlite(): Database.Database {
  if (!sqlite) getDb();
  if (!sqlite) throw new Error("Veritabanı başlatılamadı.");
  return sqlite;
}

export function closeDb() {
  sqlite?.close();
  sqlite = null;
  dbInstance = null;
}

