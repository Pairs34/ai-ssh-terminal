import { useState, useEffect, type ReactNode } from "react";
import { Search, Plus, TerminalSquare } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { GlobalSearchModal } from "./GlobalSearchModal";

interface AppShellProps {
  activePage: string;
  onNavigate: (page: string) => void;
  children: (activePage: string) => ReactNode;
}

export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-screen flex bg-base text-white overflow-hidden">
      <Sidebar active={activePage} onSelect={onNavigate} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border flex items-center gap-3 px-4 shrink-0">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 bg-base-panel hover:bg-base-elevated border border-border rounded-card px-3 py-1.5 w-72 text-left transition-colors group cursor-pointer"
          >
            <Search size={14} className="text-muted-foreground group-hover:text-ask" />
            <span className="text-xs text-muted-foreground flex-1">Cihaz veya Komut ara...</span>
            <kbd className="text-[10px] bg-base-elevated px-1.5 py-0.5 rounded border border-border font-mono text-muted-foreground">
              Ctrl+K
            </kbd>
          </button>

          <div className="flex-1" />
          <button
            onClick={() => onNavigate("terminal")}
            className="flex items-center gap-1.5 text-xs bg-base-elevated border border-border rounded-card px-3 py-1.5 hover:border-ask transition-colors font-medium"
          >
            <TerminalSquare size={14} />
            Yeni Terminal
          </button>
          <button
            onClick={() => onNavigate("scan")}
            className="flex items-center gap-1.5 text-xs bg-ask text-white rounded-card px-3 py-1.5 hover:opacity-90 transition-opacity font-semibold"
          >
            <Plus size={14} />
            Yeni Tarama
          </button>
        </header>
        <main className="flex-1 min-h-0 overflow-auto">{children(activePage)}</main>
      </div>

      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={onNavigate}
      />
    </div>
  );
}
