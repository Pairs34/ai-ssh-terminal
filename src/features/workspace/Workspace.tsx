import { useEffect, useRef, useState } from "react";
import { X, Plus, Bot, Terminal as TerminalIcon } from "lucide-react";
import { SshTerminal } from "@/features/terminal/Terminal";
import { AiPanel } from "@/features/ai/AiPanel";
import type { Device, ResumeConversationRequest } from "@/types/ipc";

interface WorkspaceTab {
  id: string;
  device: Device;
  dbSessionId: number | null;
}

interface WorkspaceProps {
  devices: Device[];
  resumeConversation?: ResumeConversationRequest | null;
  onResumeConsumed?: () => void;
}

export function Workspace({ devices: initialDevices, resumeConversation, onResumeConsumed }: WorkspaceProps) {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [deviceList, setDeviceList] = useState<Device[]>(initialDevices);
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [aiWidth, setAiWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const handledResumeNonce = useRef<number | null>(null);

  useEffect(() => {
    if (!resumeConversation || handledResumeNonce.current === resumeConversation.nonce) return;
    handledResumeNonce.current = resumeConversation.nonce;
    void (async () => {
      try {
        setResumeError("");
        const existing = tabs.find((tab) => tab.dbSessionId === resumeConversation.sessionId);
        if (existing) {
          await window.electronAPI.sessions.resume(resumeConversation.sessionId);
          setActiveTab(existing.id);
          setShowAiPanel(true);
          return;
        }
        const latestDevices = await window.electronAPI.devices.list();
        setDeviceList(latestDevices);
        const device = latestDevices.find((item) => item.id === resumeConversation.deviceId);
        if (!device) throw new Error("Geçmiş konuşmanın bağlı olduğu cihaz artık envanterde bulunmuyor.");
        await window.electronAPI.sessions.resume(resumeConversation.sessionId);
        const id = `resume-${resumeConversation.sessionId}-${Date.now()}`;
        setTabs((previous) => [...previous, { id, device, dbSessionId: resumeConversation.sessionId }]);
        setActiveTab(id);
        setShowAiPanel(true);
      } catch (error) {
        setResumeError(error instanceof Error ? error.message : "Geçmiş konuşma yeniden açılamadı.");
      } finally {
        onResumeConsumed?.();
      }
    })();
  }, [resumeConversation, onResumeConsumed, tabs]);

  const fetchLatestDevices = async () => {
    const latest = await window.electronAPI.devices.list();
    setDeviceList(latest);
  };

  const handleOpenPicker = () => {
    fetchLatestDevices();
    setPicking(true);
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = aiWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const viewportMax = Math.max(360, window.innerWidth - 420);
      const newWidth = Math.min(Math.max(startWidth + delta, 360), Math.min(760, viewportMax));
      setAiWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const openTab = async (device: Device) => {
    const id = `${device.id}-${Date.now()}`;
    setTabs((prev) => [...prev, { id, device, dbSessionId: null }]);
    setActiveTab(id);
    setPicking(false);
    const { id: dbSessionId } = await window.electronAPI.sessions.create(device.id);
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, dbSessionId } : t)));
  };

  const closeTab = (id: string) => {
    const tab = tabs.find((t) => t.id === id);
    if (tab?.dbSessionId) window.electronAPI.sessions.close(tab.dbSessionId);
    setTabs((prev) => prev.filter((t) => t.id !== id));
    setActiveTab((current) => (current === id ? tabs.find((t) => t.id !== id)?.id ?? null : current));
  };

  const active = tabs.find((t) => t.id === activeTab) ?? null;

  return (
    <div className={`h-full flex flex-col ${isResizing ? "select-none" : ""}`}>
      {/* Top Bar / Tab Bar */}
      <div className="flex items-center border-b border-border bg-base-panel/80 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-r border-border transition-colors ${
              activeTab === tab.id
                ? "bg-base text-white border-b-2 border-b-primary"
                : "text-muted-foreground hover:text-white hover:bg-base-elevated/40"
            }`}
          >
            <TerminalIcon size={13} className="text-primary" />
            {tab.device.name}
            <X
              size={12}
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="hover:text-danger ml-1 p-0.5 rounded"
            />
          </button>
        ))}
        <button
          onClick={handleOpenPicker}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-white transition-colors"
        >
          <Plus size={14} />
          Yeni Sekme
        </button>
        <div className="flex-1" />
        {active && (
          <button
            onClick={() => setShowAiPanel((v) => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 my-1 mr-2 rounded-card border transition-colors ${
              showAiPanel
                ? "bg-ask/10 text-ask border-ask/30"
                : "bg-base-elevated text-muted-foreground border-border hover:text-white"
            }`}
          >
            <Bot size={13} />
            AI Chat {showAiPanel ? "Kapat" : "Aç"}
          </button>
        )}
      </div>

      {resumeError && (
        <div className="border-b border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{resumeError}</div>
      )}

      {picking && (
        <div className="border-b border-border bg-base-panel p-3 flex flex-wrap gap-2 animate-in fade-in duration-150">
          <div className="w-full text-xs text-muted-foreground mb-1 font-medium">Bağlanmak istediğiniz cihazı seçin:</div>
          {deviceList.map((d) => (
            <button
              key={d.id}
              onClick={() => openTab(d)}
              className="flex items-center gap-2 text-xs bg-base-elevated border border-border rounded-card px-3 py-1.5 hover:border-primary hover:text-white transition-all"
            >
              <span className="font-semibold">{d.name}</span>
              <span className="text-muted-foreground font-mono">({d.ipAddress})</span>
            </button>
          ))}
          {deviceList.length === 0 && (
            <div className="text-xs text-muted-foreground">Kayıtlı cihaz bulunamadı. Lütfen önce "Cihazlar" menüsünden cihaz ekleyin.</div>
          )}
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Terminal Area */}
        <div className="flex-1 min-w-0 relative bg-[#0B0F17]">
          {tabs.length === 0 && !picking && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <TerminalIcon size={40} className="text-border" />
              <div>SSH Terminali açmak için yukarıdaki <span className="text-white font-medium">"Yeni Sekme"</span> butonuna tıklayın.</div>
            </div>
          )}
          {tabs.map((tab) => (
            <div key={tab.id} className={`absolute inset-0 ${activeTab === tab.id ? "block" : "hidden"}`}>
              <SshTerminal sessionId={tab.id} deviceId={tab.device.id} />
            </div>
          ))}
        </div>

        {/* AI Sidebar Splitter & Panel */}
        {active && active.dbSessionId && showAiPanel && (
          <>
            {/* Draggable Divider */}
            <div
              onMouseDown={startResizing}
              className="w-1.5 hover:w-2 bg-border/60 hover:bg-primary cursor-col-resize shrink-0 transition-all z-10"
              title="Panel genişliğini ayarlamak için sürükleyin"
            />

            {/* AI Panel */}
            <div style={{ width: `${aiWidth}px` }} className="shrink-0 flex flex-col bg-base-panel/95 border-l border-border min-h-0">
              <AiPanel
                deviceId={active.device.id}
                sessionId={active.dbSessionId}
                tabSessionId={active.id}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
