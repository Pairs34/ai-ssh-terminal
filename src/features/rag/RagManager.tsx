import { useEffect, useMemo, useState } from "react";
import {
  BookOpen, Check, Cpu, Database, Edit2, ExternalLink, FileSearch, Filter, Plus,
  RefreshCw, Search, ShieldCheck, TestTube2, Trash2, Upload, X
} from "lucide-react";
import type { RagCommand, RagDocument } from "@/types/ipc";

type Tab = "commands" | "documents" | "test";

const EMPTY_COMMAND: Partial<RagCommand> = {
  vendor: "Aruba", platform: "ArubaOS-CX", deviceType: "switch", intent: "diagnose",
  title: "", description: "", commandTemplate: "", parameters: [], executionMode: "ask",
  riskLevel: "safe", changesConfiguration: false, requiresConfirmation: false,
  expectedOutputPatterns: [], failurePatterns: [], source: "manual", verificationStatus: "draft",
  precheckCommands: [], postcheckCommands: [], rollbackTemplate: "", tags: []
};

const DOCUMENT_TYPES = [
  "datasheet", "cli_reference", "command_reference", "configuration_guide", "administration_guide",
  "troubleshooting_guide", "installation_guide", "api_reference", "release_notes", "security_advisory",
  "upgrade_guide", "user_manual", "knowledge_base_article", "other"
];

const badge = "inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-4";

function jsonList(value?: string[]): string {
  return (value || []).join(", ");
}

function parseList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function RagManager() {
  const [tab, setTab] = useState<Tab>("commands");
  const [commands, setCommands] = useState<RagCommand[]>([]);
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Partial<RagCommand> | null>(null);
  const [detail, setDetail] = useState<RagCommand | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ vendor: "", platform: "", deviceType: "", executionMode: "", riskLevel: "", verificationStatus: "", source: "", minSuccess: "" });
  const [uploadMeta, setUploadMeta] = useState({ vendor: "", platform: "", softwareVersion: "", documentType: "command_reference", language: "en", isOfficial: true });
  const [documentDetail, setDocumentDetail] = useState<{ document: RagDocument; chunks: Array<Record<string, unknown>>; extracted: Array<Record<string, unknown>> } | null>(null);
  const [testQuery, setTestQuery] = useState("");
  const [testFilters, setTestFilters] = useState({ vendor: "", platform: "", softwareVersion: "", documentType: "", tokenBudget: "4000" });
  const [testResult, setTestResult] = useState<{ firstCandidates: Array<Record<string, unknown>>; results: Array<Record<string, unknown>>; contextTokens: number } | null>(null);

  const loadAll = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [commandRows, documentRows] = await Promise.all([window.electronAPI.rag.list(), window.electronAPI.documents.list()]);
      setCommands(commandRows);
      setDocuments(documentRows);
      setError("");
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => { void loadAll(); }, []);
  useEffect(() => {
    if (!documents.some((document) => !["completed", "completed_with_warnings", "failed"].includes(document.processingStatus))) return;
    const timer = window.setInterval(() => void loadAll(true), 1800);
    return () => window.clearInterval(timer);
  }, [documents]);

  const filteredCommands = useMemo(() => commands.filter((command) => {
    const haystack = `${command.vendor} ${command.platform} ${command.intent} ${command.title} ${command.description} ${command.commandTemplate} ${command.tags.join(" ")}`.toLocaleLowerCase("tr-TR");
    if (search && !haystack.includes(search.toLocaleLowerCase("tr-TR"))) return false;
    if (filters.vendor && command.vendor !== filters.vendor) return false;
    if (filters.platform && command.platform !== filters.platform) return false;
    if (filters.deviceType && command.deviceType !== filters.deviceType) return false;
    if (filters.executionMode && command.executionMode !== filters.executionMode) return false;
    if (filters.riskLevel && command.riskLevel !== filters.riskLevel) return false;
    if (filters.verificationStatus && command.verificationStatus !== filters.verificationStatus) return false;
    if (filters.source && command.source !== filters.source) return false;
    if (filters.minSuccess && command.successRate < Number(filters.minSuccess)) return false;
    return true;
  }), [commands, filters, search]);

  const saveEditing = async () => {
    if (!editing?.vendor || !editing.platform || !editing.intent || !editing.title || !editing.commandTemplate || !editing.executionMode || !editing.riskLevel || !editing.source || !editing.verificationStatus) {
      setError("Zorunlu komut alanlarını doldurun.");
      return;
    }
    try {
      const result = await window.electronAPI.rag.save(editing as Parameters<typeof window.electronAPI.rag.save>[0]);
      setEditing(null);
      setError(result.deduplicated ? "Aynı şablon bulundu; mevcut kayıt birleştirildi." : "");
      await loadAll(true);
    } catch (saveError) {
      setError((saveError as Error).message);
    }
  };

  const deleteCommand = async (id: number) => {
    if (!window.confirm("Bu komut kaydını ve yürütme ilişkilerini silmek istiyor musunuz?")) return;
    await window.electronAPI.rag.delete(id);
    await loadAll(true);
  };

  const uploadDocument = async () => {
    try {
      const result = await window.electronAPI.documents.selectAndImport(uploadMeta);
      if (!result.canceled) {
        const duplicates = result.imported.filter((item) => item.duplicate).length;
        setError(duplicates ? `${duplicates} dosya aynı içerik hash'i nedeniyle tekrar eklenmedi.` : "");
        await loadAll(true);
      }
    } catch (uploadError) {
      setError((uploadError as Error).message);
    }
  };

  const showDocument = async (document: RagDocument) => {
    const [chunks, extracted] = await Promise.all([
      window.electronAPI.documents.getChunks(document.id),
      window.electronAPI.documents.getExtractedCommands(document.id)
    ]);
    setDocumentDetail({ document, chunks, extracted });
  };

  const runTest = async () => {
    if (!testQuery.trim()) return;
    const result = await window.electronAPI.rag.testSearch(testQuery, {
      vendor: testFilters.vendor || undefined,
      platform: testFilters.platform || undefined,
      softwareVersion: testFilters.softwareVersion || undefined,
      documentType: testFilters.documentType || undefined,
      tokenBudget: Number(testFilters.tokenBudget) || 4000
    });
    setTestResult(result);
  };

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-white"><Database size={20} className="text-ask" />Bilgi Hafızası</h1>
            <p className="mt-1 text-xs text-muted-foreground">Doğrulanmış komutlar ve kaynaklı dokümanlar ayrı katmanlarda yönetilir.</p>
          </div>
          <div className="flex rounded-card border border-border bg-base-panel p-1">
            {([['commands', 'Komut Hafızası', Cpu], ['documents', 'Doküman Hafızası', BookOpen], ['test', 'RAG Testi', TestTube2]] as const).map(([key, label, Icon]) => (
              <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold ${tab === key ? "bg-ask text-white" : "text-muted-foreground hover:text-white"}`}><Icon size={13} />{label}</button>
            ))}
          </div>
        </div>

        {error && <div className="flex items-start justify-between rounded-card border border-modify/40 bg-modify/10 p-3 text-xs text-modify"><span>{error}</span><button onClick={() => setError("")}><X size={14} /></button></div>}
        {loading && <div className="py-12 text-center text-xs text-muted-foreground">Bilgi tabanı yükleniyor...</div>}

        {!loading && tab === "commands" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-base-panel p-3">
              <div className="flex min-w-60 flex-1 items-center gap-2 rounded border border-border bg-base-elevated px-3 py-2"><Search size={14} className="text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Metin veya semantik alanlarda ara..." className="w-full bg-transparent text-xs outline-none" /></div>
              <Filter size={14} className="text-muted-foreground" />
              {([
                ["vendor", "Vendor", [...new Set(commands.map((item) => item.vendor))]],
                ["platform", "Platform", [...new Set(commands.map((item) => item.platform))]],
                ["deviceType", "Cihaz", [...new Set(commands.map((item) => item.deviceType))]],
                ["executionMode", "Mod", ["ask", "modify"]],
                ["riskLevel", "Risk", ["safe", "low", "medium", "high", "critical"]],
                ["verificationStatus", "Durum", ["draft", "learned", "tested", "verified", "trusted", "deprecated"]],
                ["source", "Kaynak", ["manual", "official_documentation", "successful_session", "ai_suggestion", "imported", "administrator_verified"]]
              ] as Array<[keyof typeof filters, string, string[]]>).map(([key, label, options]) => (
                <select key={key} value={filters[key]} onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))} className="rounded border border-border bg-base-elevated px-2 py-1.5 text-[11px] outline-none"><option value="">{label}: Tümü</option>{options.filter(Boolean).map((option) => <option key={option}>{option}</option>)}</select>
              ))}
              <input type="number" min="0" max="100" value={filters.minSuccess} onChange={(event) => setFilters((current) => ({ ...current, minSuccess: event.target.value }))} placeholder="Min başarı %" className="w-24 rounded border border-border bg-base-elevated px-2 py-1.5 text-[11px] outline-none" />
              <button onClick={() => setEditing({ ...EMPTY_COMMAND })} className="ml-auto flex shrink-0 items-center gap-1.5 rounded bg-ask px-3 py-2 text-xs font-semibold text-white"><Plus size={14} />Komut Ekle</button>
            </div>

            <div className="overflow-x-auto rounded-card border border-border bg-base-panel">
              <table className="w-full min-w-[1200px] border-collapse text-left text-xs">
                <thead className="bg-base-elevated text-ask"><tr>{["Marka & OS", "Amaç", "Komut şablonu", "Mod", "Risk", "Doğrulama", "Başarı oranı", "Son doğrulama", "Kaynak", "İşlem"].map((title) => <th key={title} className="border-r border-border/50 p-3 last:border-0">{title}</th>)}</tr></thead>
                <tbody>{filteredCommands.map((command) => (
                  <tr key={command.id} className="border-t border-border/40 align-top hover:bg-base-elevated/30">
                    <td className="p-3"><div className="font-semibold text-white">{command.platform}</div><div className="text-[10px] text-muted-foreground">{command.vendor} · {command.deviceType}</div><div className="text-[10px] text-muted-foreground">{command.osVersionMin || "*"}–{command.osVersionMax || "*"}</div></td>
                    <td className="max-w-52 p-3"><div className="font-semibold text-white">{command.title}</div><div className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{command.intent}</div></td>
                    <td className="max-w-sm p-3 font-mono text-ask"><button onClick={() => setDetail(command)} className="break-all text-left hover:underline">$ {command.commandTemplate}</button></td>
                    <td className="p-3"><span className={`${badge} ${command.executionMode === "ask" ? "border-ask/30 bg-ask/10 text-ask" : "border-modify/30 bg-modify/10 text-modify"}`}>{command.executionMode}</span></td>
                    <td className="p-3"><span className={`${badge} ${command.riskLevel === "safe" || command.riskLevel === "low" ? "border-success/30 bg-success/10 text-success" : command.riskLevel === "medium" ? "border-modify/30 bg-modify/10 text-modify" : "border-danger/30 bg-danger/10 text-danger"}`}>{command.riskLevel}</span></td>
                    <td className="p-3"><span className={`${badge} border-border bg-base-elevated text-white`}>{command.verificationStatus}</span></td>
                    <td className="p-3"><div className="font-semibold text-white">%{command.successRate}</div><div className="whitespace-nowrap text-[10px] text-muted-foreground">{command.successCount} başarılı / {command.totalExecutionCount} deneme</div><div className="text-[10px] text-danger">{command.failureCount} başarısız</div></td>
                    <td className="whitespace-nowrap p-3 text-[10px] text-muted-foreground">{formatDate(command.lastVerifiedAt)}<div>{command.verifiedDeviceIds.length} cihaz · {command.verifiedVersions.at(-1) || "sürüm yok"}</div></td>
                    <td className="p-3"><span className={`${badge} border-border text-muted-foreground`}>{command.source}</span></td>
                    <td className="p-3"><div className="flex gap-1"><button onClick={() => setDetail(command)} className="rounded p-1 text-muted-foreground hover:bg-base-elevated hover:text-white" title="Detay"><FileSearch size={14} /></button><button onClick={() => setEditing(command)} className="rounded p-1 text-muted-foreground hover:bg-base-elevated hover:text-white" title="Düzenle"><Edit2 size={14} /></button><button onClick={() => void deleteCommand(command.id)} className="rounded p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger" title="Sil"><Trash2 size={14} /></button></div></td>
                  </tr>
                ))}</tbody>
              </table>
              {!filteredCommands.length && <div className="p-10 text-center text-xs text-muted-foreground">Filtrelerle eşleşen komut yok.</div>}
            </div>
          </div>
        )}

        {!loading && tab === "documents" && (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-card border border-border bg-base-panel p-4 md:grid-cols-3 xl:grid-cols-6">
              <input value={uploadMeta.vendor} onChange={(event) => setUploadMeta((current) => ({ ...current, vendor: event.target.value }))} placeholder="Vendor" className="rounded border border-border bg-base-elevated px-3 py-2 text-xs outline-none" />
              <input value={uploadMeta.platform} onChange={(event) => setUploadMeta((current) => ({ ...current, platform: event.target.value }))} placeholder="Platform" className="rounded border border-border bg-base-elevated px-3 py-2 text-xs outline-none" />
              <input value={uploadMeta.softwareVersion} onChange={(event) => setUploadMeta((current) => ({ ...current, softwareVersion: event.target.value }))} placeholder="Sürüm" className="rounded border border-border bg-base-elevated px-3 py-2 text-xs outline-none" />
              <select value={uploadMeta.documentType} onChange={(event) => setUploadMeta((current) => ({ ...current, documentType: event.target.value }))} className="rounded border border-border bg-base-elevated px-3 py-2 text-xs outline-none">{DOCUMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
              <label className="flex items-center gap-2 rounded border border-border px-3 py-2 text-xs"><input type="checkbox" checked={uploadMeta.isOfficial} onChange={(event) => setUploadMeta((current) => ({ ...current, isOfficial: event.target.checked }))} />Resmî kaynak</label>
              <button onClick={() => void uploadDocument()} className="flex items-center justify-center gap-1.5 rounded bg-ask px-3 py-2 text-xs font-semibold text-white"><Upload size={14} />Dosya Seç ve İşle</button>
              <p className="md:col-span-3 xl:col-span-6 text-[10px] text-muted-foreground">PDF, TXT, Markdown, HTML ve DOCX · 50 MB sınırı · aynı içerik SHA-256 ile tekrar eklenmez · embedding yalnızca ilk işlemede üretilir.</p>
            </div>
            <div className="overflow-x-auto rounded-card border border-border bg-base-panel">
              <table className="w-full min-w-[1150px] text-left text-xs"><thead className="bg-base-elevated text-ask"><tr>{["Doküman", "Vendor / Platform", "Sürüm / Tip", "Kaynak", "Sayfa / Chunk / Komut", "İşlem durumu", "Yükleme / İndeks", "İşlem"].map((title) => <th key={title} className="p-3">{title}</th>)}</tr></thead>
                <tbody>{documents.map((document) => <tr key={document.id} className="border-t border-border/40 align-top hover:bg-base-elevated/30">
                  <td className="max-w-xs p-3"><div className="font-semibold text-white">{document.title}</div><div className="truncate text-[10px] text-muted-foreground">{document.fileName}</div></td>
                  <td className="p-3"><div>{document.vendor}</div><div className="text-muted-foreground">{document.platform}</div></td>
                  <td className="p-3"><div>{document.softwareVersion || "—"}</div><div className="text-[10px] text-muted-foreground">{document.documentType}</div></td>
                  <td className="p-3"><span className={`${badge} ${Boolean(document.isOfficial) ? "border-success/30 bg-success/10 text-success" : "border-border text-muted-foreground"}`}>{Boolean(document.isOfficial) ? "resmî" : "yüklenen"}</span><div className="mt-1 text-[10px]">{Boolean(document.isActive) ? "aktif" : "devre dışı"}</div></td>
                  <td className="whitespace-nowrap p-3">{document.pageCount} / {document.chunkCount} / {document.extractedCommandCount}<div className="text-[10px] text-muted-foreground">~{document.approximateTokens} token</div></td>
                  <td className="max-w-xs p-3"><span className={`${badge} ${document.processingStatus === "failed" ? "border-danger/30 bg-danger/10 text-danger" : document.processingStatus.startsWith("completed") ? "border-success/30 bg-success/10 text-success" : "border-ask/30 bg-ask/10 text-ask"}`}>{document.processingStatus}</span>{document.processingError && <div className="mt-1 text-[10px] text-modify">{document.processingError}</div>}</td>
                  <td className="whitespace-nowrap p-3 text-[10px] text-muted-foreground">{formatDate(document.createdAt)}<div>{formatDate(document.lastIndexedAt)}</div></td>
                  <td className="p-3"><div className="flex gap-1"><button onClick={() => void showDocument(document)} title="Chunk ve komutlar" className="rounded p-1 hover:bg-base-elevated"><FileSearch size={14} /></button><button onClick={() => void window.electronAPI.documents.openSource(document.id)} title="Kaynağı görüntüle" className="rounded p-1 hover:bg-base-elevated"><ExternalLink size={14} /></button><button onClick={async () => { await window.electronAPI.documents.reprocess(document.id); await loadAll(true); }} title="Yeniden işle" className="rounded p-1 hover:bg-base-elevated"><RefreshCw size={14} /></button><button onClick={async () => { await window.electronAPI.documents.update(document.id, { isActive: !Boolean(document.isActive) }); await loadAll(true); }} title="Etkinleştir/devre dışı bırak" className="rounded p-1 hover:bg-base-elevated"><ShieldCheck size={14} /></button><button onClick={async () => { if (window.confirm("Doküman, chunk ve embeddingleri kalıcı olarak silinsin mi?")) { await window.electronAPI.documents.delete(document.id); await loadAll(true); } }} title="Sil" className="rounded p-1 hover:bg-danger/10 hover:text-danger"><Trash2 size={14} /></button></div></td>
                </tr>)}</tbody>
              </table>
              {!documents.length && <div className="p-10 text-center text-xs text-muted-foreground">Henüz doküman yüklenmedi.</div>}
            </div>
          </div>
        )}

        {!loading && tab === "test" && (
          <div className="space-y-4">
            <div className="rounded-card border border-border bg-base-panel p-4">
              <div className="grid gap-2 md:grid-cols-5"><input value={testFilters.vendor} onChange={(event) => setTestFilters((current) => ({ ...current, vendor: event.target.value }))} placeholder="Vendor filtresi" className="rounded border border-border bg-base-elevated px-3 py-2 text-xs" /><input value={testFilters.platform} onChange={(event) => setTestFilters((current) => ({ ...current, platform: event.target.value }))} placeholder="Platform filtresi" className="rounded border border-border bg-base-elevated px-3 py-2 text-xs" /><input value={testFilters.softwareVersion} onChange={(event) => setTestFilters((current) => ({ ...current, softwareVersion: event.target.value }))} placeholder="Sürüm" className="rounded border border-border bg-base-elevated px-3 py-2 text-xs" /><select value={testFilters.documentType} onChange={(event) => setTestFilters((current) => ({ ...current, documentType: event.target.value }))} className="rounded border border-border bg-base-elevated px-3 py-2 text-xs"><option value="">Tüm doküman tipleri</option>{DOCUMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select><input value={testFilters.tokenBudget} onChange={(event) => setTestFilters((current) => ({ ...current, tokenBudget: event.target.value }))} placeholder="Token bütçesi" className="rounded border border-border bg-base-elevated px-3 py-2 text-xs" /></div>
              <div className="mt-3 flex gap-2"><textarea value={testQuery} onChange={(event) => setTestQuery(event.target.value)} placeholder="RAG test sorusu..." className="min-h-20 flex-1 resize-y rounded border border-border bg-base-elevated p-3 text-xs outline-none focus:border-ask" /><button onClick={() => void runTest()} className="flex items-center gap-1.5 self-end rounded bg-ask px-4 py-2 text-xs font-semibold text-white"><Search size={14} />Test Et</button></div>
            </div>
            {testResult && <div className="space-y-3"><div className="rounded border border-border bg-base-panel p-3 text-xs"><b className="text-white">İlk aday:</b> {testResult.firstCandidates.length} · <b className="text-white">Rerank sonrası:</b> {testResult.results.length} · <b className="text-white">Context:</b> {testResult.contextTokens} token</div>{testResult.results.map((result, index) => <div key={String(result.id)} className="rounded-card border border-border bg-base-panel p-4 text-xs"><div className="flex flex-wrap justify-between gap-2"><div className="font-semibold text-white">#{index + 1} {String(result.documentTitle)} · {String(result.sectionTitle || "")}</div><div className="font-mono text-[10px] text-ask">vector {Number(result.vectorScore).toFixed(3)} · keyword {Number(result.keywordScore).toFixed(3)} · exact {Number(result.exactScore).toFixed(3)} · version {Number(result.versionScore).toFixed(3)} · final {Number(result.finalScore).toFixed(3)}</div></div><div className="mt-1 text-[10px] text-muted-foreground">Sayfa {String(result.pageStart || "—")} · Doküman #{String(result.documentId)}</div><pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded bg-base-elevated p-3 text-[11px] text-muted-foreground">{String(result.content)}</pre></div>)}</div>}
          </div>
        )}
      </div>

      {editing && <CommandEditor value={editing} onChange={setEditing} onClose={() => setEditing(null)} onSave={() => void saveEditing()} />}
      {detail && <CommandDetail command={detail} onClose={() => setDetail(null)} />}
      {documentDetail && <DocumentDetail value={documentDetail} onClose={() => setDocumentDetail(null)} />}
    </div>
  );
}

function CommandEditor({ value, onChange, onClose, onSave }: { value: Partial<RagCommand>; onChange: (value: Partial<RagCommand>) => void; onClose: () => void; onSave: () => void }) {
  const set = <K extends keyof RagCommand>(key: K, next: RagCommand[K]) => onChange({ ...value, [key]: next });
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-card border border-border bg-base-panel p-5 shadow-2xl">
    <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-white">{value.id ? "Komut Kaydını Düzenle" : "Yeni Komut Kaydı"}</h2><button onClick={onClose}><X size={16} /></button></div>
    <div className="grid gap-3 text-xs md:grid-cols-4">
      {([['vendor','Vendor'],['platform','Platform'],['deviceType','Cihaz tipi'],['intent','Intent'],['title','Başlık'],['osVersionMin','Min OS sürümü'],['osVersionMax','Max OS sürümü']] as Array<[keyof RagCommand,string]>).map(([key,label]) => <label key={key} className={key === 'title' ? 'md:col-span-2' : ''}><span className="mb-1 block text-muted-foreground">{label}</span><input value={String(value[key] || "")} onChange={(event) => set(key, event.target.value as never)} className="w-full rounded border border-border bg-base-elevated px-3 py-2 outline-none focus:border-ask" /></label>)}
      <label><span className="mb-1 block text-muted-foreground">Mod</span><select value={value.executionMode} onChange={(event) => { const mode = event.target.value as RagCommand['executionMode']; onChange({ ...value, executionMode: mode, changesConfiguration: mode === 'modify', requiresConfirmation: mode === 'modify', riskLevel: mode === 'modify' && value.riskLevel === 'safe' ? 'medium' : value.riskLevel }); }} className="w-full rounded border border-border bg-base-elevated px-3 py-2"><option>ask</option><option>modify</option></select></label>
      <label><span className="mb-1 block text-muted-foreground">Risk</span><select value={value.riskLevel} onChange={(event) => set('riskLevel', event.target.value as RagCommand['riskLevel'])} className="w-full rounded border border-border bg-base-elevated px-3 py-2">{['safe','low','medium','high','critical'].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span className="mb-1 block text-muted-foreground">Doğrulama</span><select value={value.verificationStatus} onChange={(event) => set('verificationStatus', event.target.value as RagCommand['verificationStatus'])} className="w-full rounded border border-border bg-base-elevated px-3 py-2">{['draft','learned','tested','verified','trusted','deprecated'].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span className="mb-1 block text-muted-foreground">Kaynak</span><select value={value.source} onChange={(event) => set('source', event.target.value)} className="w-full rounded border border-border bg-base-elevated px-3 py-2">{['manual','official_documentation','successful_session','ai_suggestion','imported','administrator_verified'].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="md:col-span-4"><span className="mb-1 block text-muted-foreground">Açıklama</span><textarea value={value.description || ""} onChange={(event) => set('description', event.target.value)} className="w-full rounded border border-border bg-base-elevated p-3" /></label>
      <label className="md:col-span-4"><span className="mb-1 block text-muted-foreground">Komut şablonu</span><input value={value.commandTemplate || ""} onChange={(event) => set('commandTemplate', event.target.value)} placeholder="show lldp neighbor {{interface}}" className="w-full rounded border border-border bg-base-elevated px-3 py-2 font-mono text-ask" /></label>
      {([['tags','Etiketler'],['expectedOutputPatterns','Beklenen çıktı desenleri'],['failurePatterns','Hata desenleri'],['precheckCommands','Precheck komutları'],['postcheckCommands','Postcheck komutları']] as Array<[keyof RagCommand,string]>).map(([key,label]) => <label key={key} className="md:col-span-2"><span className="mb-1 block text-muted-foreground">{label} (virgülle)</span><input value={jsonList(value[key] as string[])} onChange={(event) => set(key, parseList(event.target.value) as never)} className="w-full rounded border border-border bg-base-elevated px-3 py-2" /></label>)}
      <label className="md:col-span-2"><span className="mb-1 block text-muted-foreground">Rollback şablonu</span><input value={value.rollbackTemplate || ""} onChange={(event) => set('rollbackTemplate', event.target.value)} className="w-full rounded border border-border bg-base-elevated px-3 py-2 font-mono" /></label>
      <label className="md:col-span-2"><span className="mb-1 block text-muted-foreground">Parametreler (JSON)</span><textarea value={JSON.stringify(value.parameters || [], null, 2)} onChange={(event) => { try { set('parameters', JSON.parse(event.target.value) as RagCommand['parameters']); } catch { /* keep last valid JSON */ } }} className="min-h-24 w-full rounded border border-border bg-base-elevated p-3 font-mono text-[11px]" /></label>
    </div>
    <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4"><button onClick={onClose} className="rounded border border-border px-3 py-2 text-xs">İptal</button><button onClick={onSave} className="flex items-center gap-1 rounded bg-ask px-4 py-2 text-xs font-semibold text-white"><Check size={14} />Kaydet</button></div>
  </div></div>;
}

function CommandDetail({ command, onClose }: { command: RagCommand; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/60"><div className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-base-panel p-5"><div className="flex items-center justify-between"><h2 className="font-semibold text-white">{command.title}</h2><button onClick={onClose}><X size={16} /></button></div><p className="mt-3 text-xs text-muted-foreground">{command.description}</p><pre className="mt-4 overflow-x-auto rounded border border-border bg-base-elevated p-3 text-xs text-ask">$ {command.commandTemplate}</pre><div className="mt-4 grid grid-cols-2 gap-3 text-xs">{[['Mod',command.executionMode],['Risk',command.riskLevel],['Doğrulama',command.verificationStatus],['Kaynak',command.source],['Başarı',`${command.successCount}/${command.totalExecutionCount} (%${command.successRate})`],['Son doğrulama',formatDate(command.lastVerifiedAt)],['Cihazlar',command.verifiedDeviceIds.join(', ') || '—'],['Sürümler',command.verifiedVersions.join(', ') || '—']].map(([label,value]) => <div key={label} className="rounded border border-border p-3"><div className="text-[10px] text-muted-foreground">{label}</div><div className="mt-1 text-white">{value}</div></div>)}</div>{[['Parametreler',JSON.stringify(command.parameters,null,2)],['Precheck',command.precheckCommands.join('\n')],['Postcheck',command.postcheckCommands.join('\n')],['Rollback',command.rollbackTemplate || '—'],['Beklenen desenler',command.expectedOutputPatterns.join('\n')],['Hata desenleri',command.failurePatterns.join('\n')]].map(([label,value]) => <div key={label} className="mt-4"><h3 className="mb-1 text-xs font-semibold text-white">{label}</h3><pre className="whitespace-pre-wrap rounded border border-border bg-base-elevated p-3 text-[11px] text-muted-foreground">{value}</pre></div>)}</div></div>;
}

function DocumentDetail({ value, onClose }: { value: { document: RagDocument; chunks: Array<Record<string, unknown>>; extracted: Array<Record<string, unknown>> }; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-card border border-border bg-base-panel p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-white">{value.document.title}</h2><p className="text-[10px] text-muted-foreground">{value.chunks.length} chunk · {value.extracted.length} komut adayı · çıkarılan komutlar daima draft</p></div><button onClick={onClose}><X size={16} /></button></div><h3 className="mb-2 mt-5 text-xs font-semibold text-ask">Çıkarılan komut adayları</h3><div className="space-y-2">{value.extracted.map((command) => <div key={String(command.id)} className="rounded border border-border bg-base-elevated p-3 text-xs"><code className="text-ask">$ {String(command.commandTemplate)}</code><div className="mt-1 text-[10px] text-muted-foreground">Sayfa {String(command.sourcePage || '—')} · güven %{String(command.extractionConfidence)} · {String(command.verificationStatus)}</div></div>)}{!value.extracted.length && <div className="text-xs text-muted-foreground">Komut adayı çıkarılmadı.</div>}</div><h3 className="mb-2 mt-5 text-xs font-semibold text-ask">Chunklar</h3><div className="space-y-2">{value.chunks.map((chunk) => <details key={String(chunk.id)} className="rounded border border-border bg-base-elevated p-3 text-xs"><summary className="cursor-pointer font-semibold text-white">#{String(chunk.chunkIndex)} {String(chunk.sectionTitle || '')} · sayfa {String(chunk.pageStart || '—')}–{String(chunk.pageEnd || '—')}</summary><pre className="mt-3 whitespace-pre-wrap text-[11px] text-muted-foreground">{String(chunk.content)}</pre></details>)}</div></div></div>;
}
