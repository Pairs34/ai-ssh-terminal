import { useState, useEffect } from "react";
import { History as HistoryIcon, Search, MessageSquare, Terminal, Calendar, Cpu, Copy, Check, PlayCircle } from "lucide-react";
import type { AiHistoryCommand, AiHistoryMessage, AiHistorySession } from "@/types/ipc";

interface AiHistoryProps {
  onResume: (request: { sessionId: number; deviceId: number }) => void;
}

interface SessionDetail {
  messages: AiHistoryMessage[];
  commands: AiHistoryCommand[];
}

export function AiHistory({ onResume }: AiHistoryProps) {
  const [sessions, setSessions] = useState<AiHistorySession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copySessionReport = () => {
    if (!sessionDetail) return;
    let full = `=== OTURUM #${selectedSessionId} TEŞHİS VE KONTROL RAPORU ===\n\n`;
    if (sessionDetail.commands.length > 0) {
      full += `--- ÇALIŞTIRILAN CLI KOMUTLARI ---\n`;
      sessionDetail.commands.forEach((c) => {
        full += `$ ${c.command}\n${c.result || ""}\n\n`;
      });
    }
    if (sessionDetail.messages.length > 0) {
      full += `--- AI MESAJLAŞMA GEÇMİŞİ ---\n`;
      sessionDetail.messages.forEach((m) => {
        full += `[${m.role === "user" ? "KULLANICI" : "AI"}]: ${m.content}\n\n`;
      });
    }
    navigator.clipboard.writeText(full);
    setCopiedId("session-report");
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    window.electronAPI.history.listSessions().then((res) => {
      setSessions(res);
      setLoading(false);
    });
  }, []);

  const loadDetail = async (id: number) => {
    setSelectedSessionId(id);
    const detail = await window.electronAPI.history.getSessionMessages(id);
    setSessionDetail(detail);
  };

  const resumeSelectedConversation = () => {
    if (!selectedSessionId || !sessionDetail) return;
    const selected = sessions.find((session) => session.sessionId === selectedSessionId);
    if (!selected) return;
    onResume({ sessionId: selected.sessionId, deviceId: selected.deviceId });
  };

  const filteredSessions = sessions
    .filter(
      (s) =>
        s.deviceName?.toLowerCase().includes(search.toLowerCase()) ||
        s.deviceIp?.toLowerCase().includes(search.toLowerCase()) ||
        s.os?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => b.sessionId - a.sessionId);

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto space-y-4 animate-in fade-in duration-150">
      <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <HistoryIcon size={20} className="text-ask" />
            AI Oturum ve Teşhis Geçmişi
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Geçmiş SSH terminal oturumlarında yapılan tüm AI analizlerini ve çalıştırılan komut kayıtlarını inceleyin.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-base-panel border border-border rounded-card px-3 py-1.5 w-64">
          <Search size={14} className="text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cihaz veya IP ara..."
            className="bg-transparent outline-none text-xs w-full text-white placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
        {/* Left: Session List */}
        <div className="w-80 shrink-0 border border-border rounded-card bg-base-panel/90 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-border text-xs font-semibold text-muted-foreground bg-base-elevated/40">
            Geçmiş Oturumlar ({filteredSessions.length})
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {loading ? (
              <div className="text-xs text-muted-foreground p-4 text-center">Yükleniyor...</div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-xs text-muted-foreground p-4 text-center">Kayıtlı oturum bulunamadı.</div>
            ) : (
              filteredSessions.map((s) => (
                <button
                  key={s.sessionId}
                  onClick={() => loadDetail(s.sessionId)}
                  className={`w-full text-left p-3 hover:bg-base-elevated/60 transition-colors space-y-1 ${
                    selectedSessionId === s.sessionId ? "bg-ask/10 border-l-2 border-ask" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-white">{s.deviceName || `Oturum #${s.sessionId}`}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{s.deviceIp}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Cpu size={10} /> {s.os || s.vendor || "Bilinmiyor"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={10} /> {s.startedAt ? new Date(s.startedAt).toLocaleDateString() : "-"}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Selected Session Details */}
        <div className="flex-1 border border-border rounded-card bg-base-panel/90 flex flex-col overflow-hidden">
          {sessionDetail ? (
            <div className="flex-1 flex flex-col min-h-0 p-4 space-y-4 overflow-y-auto">
              <div className="border-b border-border pb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <MessageSquare size={16} className="text-ask" />
                  Oturum Detayı (Oturum #{selectedSessionId})
                </h2>

                <div className="flex items-center gap-2">
                  <button
                    onClick={resumeSelectedConversation}
                    className="flex items-center gap-1.5 rounded-card border border-ask/40 bg-ask/10 px-3 py-1.5 text-xs font-semibold text-ask transition-colors hover:bg-ask/20"
                    title="Terminali ve AI sohbetini yeniden açarak bu konuşmaya devam et"
                  >
                    <PlayCircle size={13} />
                    Sohbete Devam Et
                  </button>
                  <button
                    onClick={copySessionReport}
                    className="flex items-center gap-1.5 text-xs bg-base-elevated hover:bg-base-elevated/80 border border-border px-3 py-1.5 rounded-card text-muted-foreground hover:text-white transition-colors"
                    title="Tüm oturum raporunu ve komut çıktılarını kopyala"
                  >
                    {copiedId === "session-report" ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                    {copiedId === "session-report" ? "Kopyalandı!" : "Tüm Raporu Kopyala"}
                  </button>
                </div>
              </div>

              {/* Commands Log */}
              {sessionDetail.commands.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-ask flex items-center gap-1">
                    <Terminal size={14} /> Oturumda Çalıştırılan CLI Komutları ({sessionDetail.commands.length})
                  </h3>
                  <div className="space-y-2">
                    {sessionDetail.commands.map((cmd) => (
                      <div key={cmd.id} className="bg-base-elevated border border-border rounded-card p-3 space-y-1 font-mono text-xs">
                        <div className="flex items-center justify-between text-ask font-semibold">
                          <span>$ {cmd.command}</span>
                          <button
                            onClick={() => copyToClipboard(`$ ${cmd.command}\n${cmd.result || ""}`, `cmd-${cmd.id}`)}
                            className="text-[11px] text-muted-foreground hover:text-white p-1 rounded hover:bg-base-panel flex items-center gap-1"
                          >
                            {copiedId === `cmd-${cmd.id}` ? <Check size={11} className="text-success" /> : <Copy size={11} />}
                            {copiedId === `cmd-${cmd.id}` ? "Kopyalandı" : "Kopyala"}
                          </button>
                        </div>
                        {cmd.result && (
                          <div className="text-[11px] text-muted-foreground max-h-32 overflow-y-auto whitespace-pre-wrap bg-base-panel p-2 rounded">
                            {cmd.result}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages Timeline */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-white flex items-center gap-1">
                  <MessageSquare size={14} className="text-ask" /> AI Mesajlaşma Geçmişi ({sessionDetail.messages.length})
                </h3>
                {sessionDetail.messages.length === 0 ? (
                  <div className="text-xs text-muted-foreground bg-base-elevated/40 border border-border/50 rounded-card p-3 font-mono">
                    Bu oturum için ayrı bir AI mesaj kaydı bulunmuyor (aktif UI temizlenmiş olabilir). Yukarıdaki CLI komut çıktılarını inceleyebilirsiniz.
                  </div>
                ) : (
                  sessionDetail.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-card text-xs space-y-2 border ${
                        msg.role === "user"
                          ? "bg-base-elevated border-border text-white"
                          : "bg-ask/10 border-ask/30 text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-border/30 pb-1.5 font-semibold">
                        <span className={`flex items-center gap-1.5 ${msg.role === "user" ? "text-primary" : "text-ask"}`}>
                          {msg.role === "user" ? "👤 Kullanıcı Prompt" : "🤖 AI Yanıtı & Teşhis Raporu"}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ""}
                          </span>
                          <button
                            onClick={() => copyToClipboard(msg.content, `msg-${msg.id}`)}
                            className="text-[11px] text-muted-foreground hover:text-white p-1 rounded hover:bg-base-panel flex items-center gap-1"
                            title="Bu mesajı kopyala"
                          >
                            {copiedId === `msg-${msg.id}` ? <Check size={11} className="text-success" /> : <Copy size={11} />}
                            {copiedId === `msg-${msg.id}` ? "Kopyalandı" : "Kopyala"}
                          </button>
                        </div>
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed font-sans text-xs text-muted-foreground">
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              Sol listeden incelemek istediğiniz bir oturum seçin.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
