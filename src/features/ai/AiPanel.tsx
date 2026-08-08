import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, RotateCcw, Send, ShieldAlert, X as XIcon, Zap } from "lucide-react";
import type { AiAskResult, AiCommandApproval } from "@/types/ipc";
import { toUserFacingError } from "@/lib/errors";
import { restoreConversationTimeline } from "./restoreHistory";

interface AiPanelProps {
  deviceId: number;
  sessionId: number;
  tabSessionId?: string;
}

interface ChatTimelineEntry {
  id: string;
  prompt: string;
  askResult?: AiAskResult | null;
  error?: string | null;
  historicalResponse?: string | null;
  approvalOutput?: string | null;
  approvalCanceled?: boolean;
  timestamp: string;
}

interface QueuedItem {
  id: string;
  prompt: string;
}

const RISK_STYLES: Record<AiCommandApproval["riskLevel"], string> = {
  safe: "text-success border-success/30 bg-success/10",
  low: "text-success border-success/30 bg-success/10",
  medium: "text-warning border-warning/30 bg-warning/10",
  high: "text-danger border-danger/30 bg-danger/10",
  critical: "text-danger border-danger/60 bg-danger/20"
};

function renderMarkdownWithTables(text: string) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let tableRows: string[][] = [];
  let tableKey = 0;

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const header = tableRows[0];
    const body = tableRows.slice(1).filter((row) => !row.every((cell) => cell.includes("---")));
    elements.push(
      <div key={`table-${tableKey++}`} className="my-2 overflow-x-auto rounded-card border border-border bg-base-panel/90">
        <table className="w-full border-collapse text-left text-xs">
          <thead><tr className="border-b border-border bg-base-elevated font-semibold text-ask">
            {header.map((column, index) => <th key={index} className="border-r border-border/50 p-2 last:border-0">{column.trim()}</th>)}
          </tr></thead>
          <tbody>{body.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border/30 hover:bg-base-elevated/40">
              {row.map((cell, cellIndex) => {
                const value = cell.trim();
                const isUp = /^(?:up|active|online|ok|success|successful|başarılı)$/i.test(value);
                const isDown = /^(?:down|offline|error|failed?|shutdown|başarısız)$/i.test(value);
                return <td key={cellIndex} className="border-r border-border/40 p-2 align-top font-mono text-[11px] last:border-0">
                  {isUp || isDown ? <span className={`inline-flex whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-semibold ${isUp ? "border-success/30 bg-success/20 text-success" : "border-danger/30 bg-danger/20 text-danger"}`}>{value}</span> : value}
                </td>;
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
    tableRows = [];
  };

  lines.forEach((line, index) => {
    const isTableRow = line.trim().startsWith("|") && line.trim().endsWith("|");
    if (isTableRow) {
      tableRows.push(line.trim().slice(1, -1).split("|"));
      return;
    }
    flushTable();
    if (line.startsWith("### ")) {
      elements.push(<h3 key={index} className="mb-1 mt-2 text-xs font-bold text-ask">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={index} className="mb-1 mt-2 text-sm font-bold text-white">{line.slice(3)}</h2>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(<li key={index} className="ml-3 my-0.5 list-disc text-xs leading-relaxed text-muted-foreground">{line.slice(2)}</li>);
    } else if (line.trim()) {
      elements.push(<p key={index} className="my-1 text-xs leading-relaxed text-muted-foreground">{line}</p>);
    }
  });
  flushTable();
  return elements;
}

export function AiPanel({ deviceId, sessionId, tabSessionId }: AiPanelProps) {
  const [inputText, setInputText] = useState("");
  const [timeline, setTimeline] = useState<ChatTimelineEntry[]>([]);
  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [availablePlaybooks, setAvailablePlaybooks] = useState<{ tag: string; title: string; description?: string | null }[]>([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { window.electronAPI.playbooks.list().then(setAvailablePlaybooks); }, []);

  useEffect(() => {
    let canceled = false;
    setTimeline([]);
    setQueue([]);
    window.electronAPI.history.getSessionMessages(sessionId).then((detail) => {
      if (canceled) return;
      setTimeline(restoreConversationTimeline(detail.messages).map((entry) => ({
        id: entry.id,
        prompt: entry.prompt,
        askResult: entry.askResult,
        historicalResponse: entry.historicalResponse,
        timestamp: entry.timestamp
      })));
    }).catch((error) => {
      if (!canceled) setTimeline([{
        id: `history-load-error-${sessionId}`,
        prompt: "Geçmiş konuşma yüklenemedi",
        error: toUserFacingError(error),
        timestamp: new Date().toLocaleTimeString()
      }]);
    });
    return () => { canceled = true; };
  }, [sessionId]);

  useEffect(() => window.electronAPI.ai.onStatus((data) => {
    if (data.sessionId === sessionId) setCurrentStatus(data.message);
  }), [sessionId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [timeline, queue, loading]);

  const executePrompt = async (item: QueuedItem) => {
    setLoading(true);
    setCurrentStatus("🔍 Teşhis başlatılıyor...");
    const timestamp = new Date().toLocaleTimeString();
    try {
      const askResult = await window.electronAPI.ai.ask({ deviceId, sessionId, tabSessionId, question: item.prompt });
      setTimeline((previous) => [...previous, { id: item.id, prompt: item.prompt, askResult, timestamp }]);
    } catch (error) {
      setTimeline((previous) => [...previous, { id: item.id, prompt: item.prompt, error: toUserFacingError(error), timestamp }]);
    } finally {
      setLoading(false);
      setCurrentStatus(null);
    }
  };

  useEffect(() => {
    if (!loading && queue.length > 0) {
      const next = queue[0];
      setQueue((previous) => previous.slice(1));
      void executePrompt(next);
    }
  }, [loading, queue]);

  const handleSend = () => {
    const prompt = inputText.trim();
    if (!prompt) return;
    setInputText("");
    setShowMentionPicker(false);
    const item = { id: `msg-${Date.now()}-${Math.random()}`, prompt };
    if (loading) setQueue((previous) => [...previous, item]);
    else void executePrompt(item);
  };

  const approveCommand = async (entry: ChatTimelineEntry, approval: AiCommandApproval) => {
    const elevatedConfirmation = approval.requiresElevatedConfirmation
      ? window.confirm("YÜKSEK ETKİLİ İŞLEM: Bu komut sistemi yeniden başlatabilir, durdurabilir veya önemli durum değişikliği yapabilir. Çalıştırmayı kesin olarak onaylıyor musunuz?")
      : false;
    if (approval.requiresElevatedConfirmation && !elevatedConfirmation) return;
    setLoading(true);
    setCurrentStatus("⚡ Onaylanan komut terminalde çalıştırılıyor...");
    try {
      const result = await window.electronAPI.ai.executeApproved({
        deviceId,
        sessionId,
        tabSessionId,
        command: approval.command,
        approvalToken: approval.approvalToken,
        elevatedConfirmation
      });
      const report = [
        result.precheckOutputs.length ? `PRECHECK\n${result.precheckOutputs.join("\n\n")}` : "",
        `UYGULAMA (${result.status})\n$ ${approval.command}\n${result.output}`,
        result.postcheckOutputs.length ? `POSTCHECK\n${result.postcheckOutputs.join("\n\n")}` : ""
      ].filter(Boolean).join("\n\n");
      setTimeline((previous) => previous.map((item) => item.id === entry.id ? { ...item, approvalOutput: report, error: null } : item));
    } catch (error) {
      setTimeline((previous) => previous.map((item) => item.id === entry.id ? { ...item, error: toUserFacingError(error) } : item));
    } finally {
      setLoading(false);
      setCurrentStatus(null);
    }
  };

  const cancelApproval = async (entry: ChatTimelineEntry, approval: AiCommandApproval) => {
    await window.electronAPI.ai.cancel({ deviceId, sessionId, command: approval.command });
    setTimeline((previous) => previous.map((item) => item.id === entry.id ? { ...item, approvalCanceled: true } : item));
  };

  const copyToClipboard = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyFullChat = () => {
    const text = timeline.map((entry) => {
      const answer = entry.askResult?.explanation || entry.historicalResponse || entry.error || "";
      return `[Kullanıcı Prompt - ${entry.timestamp}]:\n${entry.prompt}\n\n[AI Yanıtı]:\n${answer}`;
    }).join("\n-----------------------------------\n");
    copyToClipboard(text, "full");
  };

  const clearHistory = async () => {
    await window.electronAPI.ai.clearHistory(sessionId);
    setTimeline([]);
    setQueue([]);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInputText(value);
    const lastAt = value.lastIndexOf("@");
    if (lastAt >= 0 && (lastAt === 0 || value[lastAt - 1] === " ")) {
      const query = value.slice(lastAt + 1).toLowerCase();
      if (!query.includes(" ")) {
        setMentionFilter(query);
        setShowMentionPicker(true);
        return;
      }
    }
    setShowMentionPicker(false);
  };

  const filteredPlaybooks = availablePlaybooks.filter((playbook) =>
    playbook.tag.toLowerCase().includes(mentionFilter) || playbook.title.toLowerCase().includes(mentionFilter)
  );

  return <div className="flex h-full min-w-0 flex-col bg-base-panel">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-base-panel px-3 py-2">
      <div>
        <div className="text-xs font-semibold text-white">AI Sohbet</div>
        <div className="text-[10px] text-muted-foreground">Kontroller otomatik çalışır · Sistem değişiklikleri onay ister</div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={copyFullChat} disabled={timeline.length === 0} className="flex items-center gap-1.5 rounded-card border border-border bg-base-elevated/70 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-white disabled:opacity-40">
          {copiedIndex === "full" ? <Check size={12} className="text-success" /> : <Copy size={12} />} {copiedIndex === "full" ? "Kopyalandı" : "Tümünü Kopyala"}
        </button>
        <button onClick={clearHistory} className="flex items-center gap-1.5 rounded-card border border-border bg-base-elevated/70 px-2.5 py-1 text-[11px] text-muted-foreground hover:border-danger/40 hover:text-danger">
          <RotateCcw size={12} /> Temizle
        </button>
      </div>
    </div>

    <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
      {timeline.map((entry) => {
        const approval = entry.askResult?.pendingApproval;
        return <div key={entry.id} className="space-y-2 rounded-card border border-border/80 bg-base-panel/60 p-3">
          <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-1.5">
            <div className="min-w-0 break-words text-xs font-semibold text-white">{entry.prompt}</div>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{entry.timestamp}</span>
          </div>

          {entry.error && <div className="rounded-card border border-danger/30 bg-danger/10 p-2 text-xs text-danger">{entry.error}</div>}
          {entry.askResult && <div className="space-y-2 pt-1 text-xs">
            {entry.askResult.command && <div className="rounded-card border border-border bg-base-elevated p-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Terminalde çalıştırılan kontroller</div>
              <div className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-ask">{entry.askResult.command}</div>
            </div>}
            <div>{renderMarkdownWithTables(entry.askResult.explanation)}</div>
          </div>}
          {entry.historicalResponse && <div className="rounded-card border border-ask/30 bg-ask/10 p-3">{renderMarkdownWithTables(entry.historicalResponse)}</div>}

          {approval && !entry.approvalOutput && !entry.approvalCanceled && <div className="mt-2 space-y-2 rounded-card border border-warning/40 bg-warning/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-warning"><ShieldAlert size={13} /> Kullanıcı onayı gereken çözüm</div>
              <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${RISK_STYLES[approval.riskLevel]}`}>Risk: {approval.riskLevel.toUpperCase()}</span>
            </div>
            <div className="flex min-w-0 items-start gap-2 rounded-card border border-border bg-base-elevated p-2.5">
              <div className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-xs text-warning">$ {approval.command}</div>
              <button onClick={() => copyToClipboard(approval.command, `${entry.id}-approval`)} className="flex shrink-0 items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-white">
                {copiedIndex === `${entry.id}-approval` ? <Check size={11} className="text-success" /> : <Copy size={11} />} {copiedIndex === `${entry.id}-approval` ? "Kopyalandı" : "Kopyala"}
              </button>
            </div>
            <div className="text-xs leading-relaxed text-muted-foreground">{approval.reasoning}</div>
            {approval.requiresElevatedConfirmation && <div className="rounded border border-danger/40 bg-danger/10 p-2 text-xs font-medium text-danger">Bu yüksek etkili işlem ikinci bir kesin onay gerektirir.</div>}
            <div className="grid gap-2 text-[11px] md:grid-cols-2">
              <div className="rounded border border-border/60 p-2"><div className="mb-1 font-semibold text-muted-foreground">Ön kontrol</div>{approval.precheckCommands.map((command) => <div key={command} className="font-mono text-ask">$ {command}</div>)}</div>
              <div className="rounded border border-border/60 p-2"><div className="mb-1 font-semibold text-muted-foreground">Son kontrol</div>{approval.postcheckCommands.map((command) => <div key={command} className="font-mono text-ask">$ {command}</div>)}</div>
            </div>
            <div className="rounded border border-border/60 p-2 text-[11px]"><span className="font-semibold text-muted-foreground">Geri alma: </span><span className="font-mono text-white/80">{approval.rollbackTemplate}</span></div>
            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-2">
              <button onClick={() => void approveCommand(entry, approval)} className="flex items-center gap-1.5 rounded-card bg-success px-3 py-1.5 text-xs font-semibold text-white hover:bg-success/90"><Check size={13} /> Onayla ve terminalde çalıştır</button>
              <button onClick={() => void cancelApproval(entry, approval)} className="flex items-center gap-1.5 rounded-card border border-border bg-base-elevated px-3 py-1.5 text-xs text-muted-foreground hover:text-white"><XIcon size={13} /> Çalıştırma</button>
            </div>
          </div>}

          {entry.approvalCanceled && <div className="rounded border border-border bg-base-elevated p-2 text-xs text-muted-foreground">Önerilen değişiklik çalıştırılmadı. Komutu isterseniz kopyalayarak daha sonra kendiniz uygulayabilirsiniz.</div>}
          {entry.approvalOutput && <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-card border border-success/30 bg-success/5 p-3 font-mono text-[11px] text-white/80">{entry.approvalOutput}</pre>}
        </div>;
      })}

      {loading && <div className="flex items-center gap-2 rounded-card border border-ask/30 bg-ask-muted/20 p-3 text-xs font-medium text-ask">
        <Loader2 size={14} className="animate-spin" /> {currentStatus || "İşlem yürütülüyor..."}
      </div>}

      {queue.length > 0 && <div className="space-y-2 border-t border-border/60 pt-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground"><Zap size={12} className="text-ask" /> Bekleyen sorular ({queue.length})</div>
        {queue.map((item) => <div key={item.id} className="flex items-center justify-between rounded-card border border-border bg-base-elevated p-2.5 text-xs">
          <span className="min-w-0 flex-1 truncate text-white/90">{item.prompt}</span>
          <div className="ml-2 flex shrink-0 items-center gap-1.5">
            <button onClick={async () => { await window.electronAPI.ai.cancelSessionRequest(sessionId); setQueue((previous) => previous.filter((queued) => queued.id !== item.id)); void executePrompt(item); }} className="rounded bg-primary px-2 py-1 text-[11px] font-semibold text-white">Şimdi Gönder</button>
            <button onClick={() => setQueue((previous) => previous.filter((queued) => queued.id !== item.id))} className="rounded p-1 text-muted-foreground hover:bg-danger/20 hover:text-danger"><XIcon size={12} /></button>
          </div>
        </div>)}
      </div>}
    </div>

    {showMentionPicker && filteredPlaybooks.length > 0 && <div className="z-20 mx-2 mb-1 overflow-hidden rounded-card border border-ask/40 bg-base-elevated shadow-2xl">
      <div className="border-b border-border bg-ask/10 px-3 py-1.5 text-[11px] font-bold text-ask">Playbook seçin</div>
      <div className="max-h-44 divide-y divide-border/40 overflow-y-auto">{filteredPlaybooks.map((playbook) => <button key={playbook.tag} onClick={() => { const at = inputText.lastIndexOf("@"); setInputText(`${inputText.slice(0, at)}@${playbook.tag} `); setShowMentionPicker(false); }} className="flex w-full items-center justify-between p-2 text-left text-xs hover:bg-ask/10">
        <div><div className="font-mono font-bold text-ask">@{playbook.tag}</div><div className="font-medium text-white">{playbook.title}</div></div>
      </button>)}</div>
    </div>}

    <div className="relative flex items-center gap-2 border-t border-border bg-base-panel p-2.5">
      <input value={inputText} onChange={handleInputChange} onKeyDown={(event) => { if (event.key === "Enter" && !showMentionPicker) handleSend(); if (event.key === "Escape") setShowMentionPicker(false); }} placeholder="Sorununuzu yazın; güvenli kontroller otomatik çalıştırılır" className="flex-1 rounded-card border border-border bg-base-elevated px-3 py-1.5 text-sm outline-none transition-colors focus:border-ask" />
      <button onClick={handleSend} className="rounded-card bg-ask p-2 font-medium text-white hover:bg-ask/90"><Send size={14} /></button>
    </div>
  </div>;
}
