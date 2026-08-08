export interface Device {
  id: number;
  name: string;
  ipAddress: string;
  sshPort: number;
  vendor: string | null;
  model: string | null;
  os: string | null;
  osVersion: string | null;
  deviceType: "switch" | "router" | "firewall" | "access_point" | "linux_server" | "windows_server" | "storage" | "hypervisor" | "unknown";
  groupId: number | null;
  credentialId: number | null;
  status: "online" | "offline" | "unknown";
  lastSeen: string | null;
  notes: string | null;
  isFavorite: boolean;
}

export interface CredentialView {
  id: number;
  name: string;
  username: string;
  authMethod: "password" | "private_key";
  password: string;
  privateKey: string;
  enableSecret: string;
  createdAt: string | null;
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
}

export interface ScanProgress {
  completed: number;
  total: number;
  current: string;
}

export interface ScanResultItem {
  ip: string;
  hostname: string | null;
  macAddress: string | null;
  vendor: string | null;
  ports: string;
  detectedType: string | null;
  isExisting: boolean;
}

export interface AiAskResult {
  command: string;
  output: string;
  explanation: string;
  pendingApproval?: AiCommandApproval | null;
}

export interface AiCommandApproval {
  command: string;
  reasoning: string;
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  readOnly: boolean;
  approvalToken: string;
  precheckCommands: string[];
  postcheckCommands: string[];
  rollbackTemplate: string;
  requiresElevatedConfirmation: boolean;
}

export type AiModifyPreview = AiCommandApproval;

export interface AiModifyAgentStep {
  index: number;
  command: string;
  reasoning: string;
  readOnly: boolean;
  output: string;
  exitCode: number | null;
  status: "success" | "failure" | "blocked";
  verificationCommand?: string;
  verificationOutput?: string;
  rollbackCommand?: string;
  rollbackOutput?: string;
}

export interface AiModifyAgentResult {
  runId: number;
  outcome: "completed" | "blocked" | "needs_confirmation" | "paused" | "canceled";
  summary: string;
  steps: AiModifyAgentStep[];
  pendingApproval: AiModifyPreview | null;
  resumable: boolean;
  instruction?: string;
}

export interface AiHistorySession {
  sessionId: number;
  deviceId: number;
  deviceName: string | null;
  deviceIp: string | null;
  vendor: string | null;
  os: string | null;
  startedAt: string | null;
  endedAt: string | null;
  status: "active" | "closed" | "error";
}

export interface AiHistoryMessage {
  id: number;
  sessionId: number;
  mode: "ask" | "modify";
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string | null;
}

export interface AiHistoryCommand {
  id: number;
  sessionId: number;
  deviceId: number;
  mode: "ask" | "modify";
  command: string;
  result: string | null;
  createdAt: string | null;
}

export interface ResumeConversationRequest {
  sessionId: number;
  deviceId: number;
  nonce: number;
}

export interface CustomPrompt {
  id: number;
  title: string;
  promptText: string;
  isDefault: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface Playbook {
  id: number;
  tag: string;
  title: string;
  description?: string | null;
  instructions: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CommandParameter {
  name: string;
  label?: string;
  type: string;
  required: boolean;
  example?: string;
  validationRegex?: string;
}

export interface RagCommand {
  id: number;
  vendor: string;
  platform: string;
  osVersionMin?: string | null;
  osVersionMax?: string | null;
  deviceType: string;
  intent: string;
  title: string;
  description: string;
  commandTemplate: string;
  parameters: CommandParameter[];
  executionMode: "ask" | "modify";
  riskLevel: AiModifyPreview["riskLevel"];
  changesConfiguration: boolean;
  requiresConfirmation: boolean;
  successCount: number;
  failureCount: number;
  totalExecutionCount: number;
  successRate: number;
  lastVerifiedAt: string | null;
  verifiedVersions: string[];
  verifiedDeviceIds: number[];
  expectedOutputPatterns: string[];
  failurePatterns: string[];
  source: string;
  verificationStatus: "draft" | "learned" | "tested" | "verified" | "trusted" | "deprecated";
  rollbackTemplate?: string | null;
  precheckCommands: string[];
  postcheckCommands: string[];
  tags: string[];
  exampleOutput?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RagDocument {
  id: number;
  vendor: string;
  platform: string;
  deviceFamily?: string | null;
  deviceModels: string;
  documentType: string;
  title: string;
  description: string;
  softwareVersion?: string | null;
  fileName: string;
  pageCount: number;
  chunkCount: number;
  extractedCommandCount: number;
  processingStatus: string;
  processingError?: string | null;
  approximateTokens: number;
  isOfficial: boolean | number;
  isActive: boolean | number;
  lastIndexedAt?: string | null;
  createdAt: string;
}

declare global {
  interface Window {
    electronAPI: {
      devices: {
        list: () => Promise<Device[]>;
        create: (payload: Partial<Device>) => Promise<{ id: number }>;
        update: (id: number, payload: Partial<Device>) => Promise<{ success: boolean }>;
        delete: (id: number) => Promise<{ success: boolean }>;
        bulkCreate: (items: Partial<Device>[]) => Promise<{ ids: number[] }>;
        checkStatus: (id: number) => Promise<{ status: Device["status"] }>;
      };
      credentials: {
        list: () => Promise<CredentialView[]>;
        create: (payload: unknown) => Promise<{ id: number }>;
        update: (id: number, payload: unknown) => Promise<{ success: boolean }>;
        delete: (id: number) => Promise<{ success: boolean }>;
      };
      groups: {
        list: () => Promise<Group[]>;
        create: (payload: { name: string; description?: string }) => Promise<{ id: number }>;
        delete: (id: number) => Promise<{ success: boolean }>;
      };
      prompts: {
        list: () => Promise<CustomPrompt[]>;
        save: (data: { id?: number; title: string; promptText: string; isDefault?: boolean }) => Promise<{ success: boolean }>;
        setDefault: (id: number) => Promise<{ success: boolean }>;
        delete: (id: number) => Promise<{ success: boolean }>;
      };
      playbooks: {
        list: () => Promise<Playbook[]>;
        save: (data: { id?: number; tag: string; title: string; description?: string; instructions: string }) => Promise<{ success: boolean }>;
        delete: (id: number) => Promise<{ success: boolean }>;
      };
      rag: {
        list: () => Promise<RagCommand[]>;
        save: (data: Partial<RagCommand> & Pick<RagCommand, "vendor" | "platform" | "intent" | "title" | "commandTemplate" | "executionMode" | "riskLevel" | "source" | "verificationStatus">) => Promise<{ success: boolean; id: number; deduplicated: boolean }>;
        delete: (id: number) => Promise<{ success: boolean }>;
        testSearch: (query: string, filters: Record<string, unknown>) => Promise<{ filters: Record<string, unknown>; firstCandidates: Array<Record<string, unknown>>; results: Array<Record<string, unknown>>; contextTokens: number }>;
      };
      documents: {
        selectAndImport: (metadata: Record<string, unknown>) => Promise<{ canceled: boolean; imported: Array<{ id: number; duplicate: boolean; warnings: string[] }> }>;
        list: () => Promise<RagDocument[]>;
        update: (id: number, metadata: Record<string, unknown>) => Promise<{ success: boolean }>;
        reprocess: (id: number) => Promise<{ success: boolean }>;
        delete: (id: number) => Promise<{ success: boolean }>;
        openSource: (id: number) => Promise<{ success: boolean }>;
        getChunks: (id: number) => Promise<Array<Record<string, unknown>>>;
        getExtractedCommands: (id: number) => Promise<Array<Record<string, unknown>>>;
      };
      history: {
        listSessions: () => Promise<AiHistorySession[]>;
        getSessionMessages: (sessionId: number) => Promise<{ messages: AiHistoryMessage[]; commands: AiHistoryCommand[] }>;
      };
      sessions: {
        create: (deviceId: number) => Promise<{ id: number }>;
        close: (sessionId: number) => Promise<{ success: boolean }>;
        resume: (sessionId: number) => Promise<{ id: number; deviceId: number; status: "active"; endedAt: null }>;
        list: (deviceId?: number) => Promise<unknown[]>;
        get: (sessionId: number) => Promise<unknown>;
        export: (sessionId: number) => Promise<{ success: boolean; filePath?: string }>;
      };
      scan: {
        interfaces: () => Promise<{ name: string; address: string; cidr: string }[]>;
        start: (cidr: string, ports: number[], concurrency: number, timeoutMs: number) => Promise<{ scanId: string }>;
        stop: (scanId: string) => Promise<{ success: boolean }>;
        results: (scanId: string) => Promise<ScanResultItem[]>;
        onProgress: (callback: (scanId: string, progress: ScanProgress) => void) => () => void;
        onResult: (callback: (scanId: string, item: ScanResultItem) => void) => () => void;
        onDone: (callback: (scanId: string) => void) => () => void;
      };
      ai: {
        getConfig: () => Promise<{ provider?: string; baseUrl: string; apiKey: string; model: string } | null>;
        setConfig: (config: { provider?: string; baseUrl: string; apiKey: string; model: string }) => Promise<{ success: boolean }>;
        ask: (request: { deviceId: number; sessionId: number; tabSessionId?: string; question: string }) => Promise<AiAskResult>;
        executeApproved: (request: { deviceId: number; sessionId: number; tabSessionId?: string; command: string; approvalToken: string; elevatedConfirmation?: boolean }) => Promise<{ output: string; status: string; precheckOutputs: string[]; postcheckOutputs: string[]; rollbackTemplate: string; agentRunId?: number }>;
        cancel: (request: { deviceId: number; sessionId: number; command: string }) => Promise<{ success: boolean }>;
        cancelSessionRequest: (sessionId: number) => Promise<{ success: boolean }>;
        clearHistory: (sessionId: number) => Promise<{ success: boolean }>;
        onStatus: (callback: (data: { sessionId: number; step: string; message: string }) => void) => () => void;
      };
      csv: {
        importDevices: () => Promise<{ imported: number }>;
        exportDevices: () => Promise<{ success: boolean; filePath?: string }>;
      };
      ssh: {
        connect: (deviceId: number, sessionId: string) => Promise<{ success: boolean }>;
        write: (sessionId: string, data: string) => void;
        resize: (sessionId: string, cols: number, rows: number) => void;
        disconnect: (sessionId: string) => Promise<{ success: boolean }>;
        onData: (callback: (sessionId: string, data: string) => void) => () => void;
        onError: (callback: (sessionId: string, message: string) => void) => () => void;
        onClosed: (callback: (sessionId: string) => void) => () => void;
      };
    };
  }
}

export {};
