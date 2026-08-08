import { useState, useEffect } from "react";
import { Search, Server, BookOpen, Sparkles, Database, X } from "lucide-react";
import type { Device, RagCommand } from "@/types/ipc";

interface SearchResultItem {
  id: string;
  type: "device" | "playbook" | "prompt" | "rag";
  title: string;
  subtitle: string;
  page: string;
  data?: unknown;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string, extraData?: unknown) => void;
}

export function GlobalSearchModal({ isOpen, onClose, onNavigate }: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      return;
    }

    const fetchAll = async () => {
      setLoading(true);
      try {
        const [devs, pbooks, prmpts, ragCmds] = await Promise.all([
          window.electronAPI.devices.list(),
          window.electronAPI.playbooks.list(),
          window.electronAPI.prompts.list(),
          window.electronAPI.rag.list()
        ]);

        const items: SearchResultItem[] = [];

        // 1. Devices
        (devs as Device[]).forEach((d) => {
          items.push({
            id: `dev-${d.id}`,
            type: "device",
            title: d.name,
            subtitle: `${d.ipAddress} (${d.os || d.vendor || "Bilinmiyor"})`,
            page: "terminal",
            data: d
          });
        });

        // 2. Playbooks
        (pbooks as { id: number; tag: string; title: string; description?: string }[]).forEach((p) => {
          items.push({
            id: `pb-${p.id}`,
            type: "playbook",
            title: `@${p.tag} - ${p.title}`,
            subtitle: p.description || "Playbook teşhis senaryosu",
            page: "playbooks"
          });
        });

        // 3. Prompts
        (prmpts as { id: number; title: string; promptText: string }[]).forEach((pr) => {
          items.push({
            id: `pr-${pr.id}`,
            type: "prompt",
            title: pr.title,
            subtitle: pr.promptText.substring(0, 70) + "...",
            page: "prompts"
          });
        });

        // 4. RAG Commands
        (ragCmds as RagCommand[]).forEach((r) => {
          items.push({
            id: `rag-${r.id}`,
            type: "rag",
            title: `$ ${r.commandTemplate}`,
            subtitle: `RAG Komutu (${r.platform} - ${r.intent || "diag"})`,
            page: "rag"
          });
        });

        setResults(items);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = results.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (item: SearchResultItem) => {
    onNavigate(item.page, item.data);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 p-4 animate-in fade-in duration-150">
      <div className="bg-base-panel border border-ask/40 rounded-card w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
        {/* Search Header */}
        <div className="p-3 border-b border-border flex items-center gap-3 bg-base-elevated/60">
          <Search size={18} className="text-ask" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cihaz, IP, Playbook (@tag), Custom Prompt veya RAG Komutu ara..."
            className="w-full bg-transparent text-sm text-white placeholder:text-muted-foreground outline-none"
          />
          <button onClick={onClose} className="text-muted-foreground hover:text-white p-1">
            <X size={16} />
          </button>
        </div>

        {/* Results Stream */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-border/30">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Sistem ögeleri aranıyor...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Aramanızla eşleşen öge bulunamadı.</div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className="w-full text-left p-2.5 hover:bg-base-elevated rounded-card flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  {item.type === "device" && <Server size={16} className="text-primary" />}
                  {item.type === "playbook" && <BookOpen size={16} className="text-ask" />}
                  {item.type === "prompt" && <Sparkles size={16} className="text-warning" />}
                  {item.type === "rag" && <Database size={16} className="text-success" />}

                  <div>
                    <div className="text-xs font-semibold text-white group-hover:text-ask transition-colors">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{item.subtitle}</div>
                  </div>
                </div>

                <span className="text-[10px] text-muted-foreground uppercase font-mono px-2 py-0.5 rounded bg-base-panel border border-border">
                  {item.page}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
