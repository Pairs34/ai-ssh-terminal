import { LayoutDashboard, Server, ScanSearch, TerminalSquare, History, KeyRound, Settings, Sparkles, BookOpen, Database } from "lucide-react";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "devices", label: "Devices", icon: Server },
  { key: "scan", label: "Network Scan", icon: ScanSearch },
  { key: "terminal", label: "Terminal", icon: TerminalSquare },
  { key: "prompts", label: "Custom Prompts", icon: Sparkles },
  { key: "playbooks", label: "Playbooks", icon: BookOpen },
  { key: "rag", label: "Bilgi Hafızası", icon: Database },
  { key: "history", label: "AI History", icon: History },
  { key: "credentials", label: "Credentials", icon: KeyRound },
  { key: "settings", label: "Settings", icon: Settings }
] as const;

interface SidebarProps {
  active: string;
  onSelect: (key: string) => void;
}

export function Sidebar({ active, onSelect }: SidebarProps) {
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-base-panel/60 backdrop-blur-sm flex flex-col">
      <div className="h-14 flex items-center px-4 border-b border-border">
        <span className="font-semibold tracking-tight text-sm">AI SSH Terminal</span>
      </div>
      <nav className="flex-1 py-3 px-2 space-y-1">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`w-full flex items-center gap-3 rounded-card px-3 py-2 text-sm transition-colors ${
              active === key
                ? "bg-base-elevated text-white"
                : "text-muted-foreground hover:text-white hover:bg-base-elevated/60"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
