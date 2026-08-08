import { contextBridge, ipcRenderer } from "electron";

const api = {
  devices: {
    list: () => ipcRenderer.invoke("devices:list"),
    create: (payload: unknown) => ipcRenderer.invoke("devices:create", payload),
    update: (id: number, payload: unknown) => ipcRenderer.invoke("devices:update", id, payload),
    delete: (id: number) => ipcRenderer.invoke("devices:delete", id),
    bulkCreate: (items: unknown[]) => ipcRenderer.invoke("devices:bulkCreate", items),
    checkStatus: (id: number) => ipcRenderer.invoke("devices:checkStatus", id)
  },
  credentials: {
    list: () => ipcRenderer.invoke("credentials:list"),
    create: (payload: unknown) => ipcRenderer.invoke("credentials:create", payload),
    update: (id: number, payload: unknown) => ipcRenderer.invoke("credentials:update", id, payload),
    delete: (id: number) => ipcRenderer.invoke("credentials:delete", id)
  },
  groups: {
    list: () => ipcRenderer.invoke("groups:list"),
    create: (payload: unknown) => ipcRenderer.invoke("groups:create", payload),
    delete: (id: number) => ipcRenderer.invoke("groups:delete", id)
  },
  sessions: {
    create: (deviceId: number) => ipcRenderer.invoke("sessions:create", deviceId),
    close: (sessionId: number) => ipcRenderer.invoke("sessions:close", sessionId),
    resume: (sessionId: number) => ipcRenderer.invoke("sessions:resume", sessionId),
    list: (deviceId?: number) => ipcRenderer.invoke("sessions:list", deviceId),
    get: (sessionId: number) => ipcRenderer.invoke("sessions:get", sessionId),
    export: (sessionId: number) => ipcRenderer.invoke("sessions:export", sessionId)
  },
  scan: {
    interfaces: () => ipcRenderer.invoke("scan:interfaces"),
    start: (cidr: string, ports: number[], concurrency: number, timeoutMs: number) =>
      ipcRenderer.invoke("scan:start", cidr, ports, concurrency, timeoutMs),
    stop: (scanId: string) => ipcRenderer.invoke("scan:stop", scanId),
    results: (scanId: string) => ipcRenderer.invoke("scan:results", scanId),
    onProgress: (callback: (scanId: string, progress: { completed: number; total: number; current: string }) => void) => {
      const listener = (_e: unknown, scanId: string, progress: { completed: number; total: number; current: string }) =>
        callback(scanId, progress);
      ipcRenderer.on("scan:progress", listener);
      return () => ipcRenderer.removeListener("scan:progress", listener);
    },
    onResult: (callback: (scanId: string, item: unknown) => void) => {
      const listener = (_e: unknown, scanId: string, item: unknown) => callback(scanId, item);
      ipcRenderer.on("scan:result", listener);
      return () => ipcRenderer.removeListener("scan:result", listener);
    },
    onDone: (callback: (scanId: string) => void) => {
      const listener = (_e: unknown, scanId: string) => callback(scanId);
      ipcRenderer.on("scan:done", listener);
      return () => ipcRenderer.removeListener("scan:done", listener);
    }
  },
  ai: {
    getConfig: () => ipcRenderer.invoke("ai:getConfig"),
    setConfig: (config: unknown) => ipcRenderer.invoke("ai:setConfig", config),
    ask: (request: unknown) => ipcRenderer.invoke("ai:ask", request),
    executeApproved: (request: unknown) => ipcRenderer.invoke("ai:executeApproved", request),
    cancel: (request: unknown) => ipcRenderer.invoke("ai:cancel", request),
    cancelSessionRequest: (sessionId: number) => ipcRenderer.invoke("ai:cancelSessionRequest", sessionId),
    clearHistory: (sessionId: number) => ipcRenderer.invoke("ai:clearHistory", sessionId),
    onStatus: (callback: (data: { sessionId: number; step: string; message: string }) => void) => {
      const listener = (_e: unknown, data: { sessionId: number; step: string; message: string }) => callback(data);
      ipcRenderer.on("ai:status", listener);
      return () => ipcRenderer.removeListener("ai:status", listener);
    }
  },
  prompts: {
    list: () => ipcRenderer.invoke("prompts:list"),
    save: (data: unknown) => ipcRenderer.invoke("prompts:save", data),
    setDefault: (id: number) => ipcRenderer.invoke("prompts:setDefault", id),
    delete: (id: number) => ipcRenderer.invoke("prompts:delete", id)
  },
  playbooks: {
    list: () => ipcRenderer.invoke("playbooks:list"),
    save: (data: unknown) => ipcRenderer.invoke("playbooks:save", data),
    delete: (id: number) => ipcRenderer.invoke("playbooks:delete", id)
  },
  rag: {
    list: () => ipcRenderer.invoke("rag:list"),
    save: (data: unknown) => ipcRenderer.invoke("rag:save", data),
    delete: (id: number) => ipcRenderer.invoke("rag:delete", id),
    testSearch: (query: string, filters: unknown) => ipcRenderer.invoke("rag:testSearch", query, filters)
  },
  documents: {
    selectAndImport: (metadata: unknown) => ipcRenderer.invoke("documents:selectAndImport", metadata),
    list: () => ipcRenderer.invoke("documents:list"),
    update: (id: number, metadata: unknown) => ipcRenderer.invoke("documents:update", id, metadata),
    reprocess: (id: number) => ipcRenderer.invoke("documents:reprocess", id),
    delete: (id: number) => ipcRenderer.invoke("documents:delete", id),
    openSource: (id: number) => ipcRenderer.invoke("documents:openSource", id),
    getChunks: (id: number) => ipcRenderer.invoke("documents:getChunks", id),
    getExtractedCommands: (id: number) => ipcRenderer.invoke("documents:getExtractedCommands", id)
  },
  history: {
    listSessions: () => ipcRenderer.invoke("history:listSessions"),
    getSessionMessages: (sessionId: number) => ipcRenderer.invoke("history:getSessionMessages", sessionId)
  },
  csv: {
    importDevices: () => ipcRenderer.invoke("csv:importDevices"),
    exportDevices: () => ipcRenderer.invoke("csv:exportDevices")
  },
  ssh: {
    connect: (deviceId: number, sessionId: string) => ipcRenderer.invoke("ssh:connect", deviceId, sessionId),
    write: (sessionId: string, data: string) => ipcRenderer.send("ssh:write", sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) => ipcRenderer.send("ssh:resize", sessionId, cols, rows),
    disconnect: (sessionId: string) => ipcRenderer.invoke("ssh:disconnect", sessionId),
    onData: (callback: (sessionId: string, data: string) => void) => {
      const listener = (_event: unknown, sessionId: string, data: string) => callback(sessionId, data);
      ipcRenderer.on("ssh:data", listener);
      return () => ipcRenderer.removeListener("ssh:data", listener);
    },
    onError: (callback: (sessionId: string, message: string) => void) => {
      const listener = (_event: unknown, sessionId: string, message: string) => callback(sessionId, message);
      ipcRenderer.on("ssh:error", listener);
      return () => ipcRenderer.removeListener("ssh:error", listener);
    },
    onClosed: (callback: (sessionId: string) => void) => {
      const listener = (_event: unknown, sessionId: string) => callback(sessionId);
      ipcRenderer.on("ssh:closed", listener);
      return () => ipcRenderer.removeListener("ssh:closed", listener);
    }
  }
};

contextBridge.exposeInMainWorld("electronAPI", api);

export type ElectronAPI = typeof api;
