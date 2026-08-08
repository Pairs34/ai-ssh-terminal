import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { DeviceList } from "@/features/devices/DeviceList";
import { CredentialList } from "@/features/credentials/CredentialList";
import { NetworkScan } from "@/features/scanner/NetworkScan";
import { Workspace } from "@/features/workspace/Workspace";
import { Settings } from "@/features/settings/Settings";
import { PromptsManager } from "@/features/prompts/PromptsManager";
import { PlaybooksManager } from "@/features/playbooks/PlaybooksManager";
import { AiHistory } from "@/features/history/AiHistory";
import { RagManager } from "@/features/rag/RagManager";
import type { Device, ResumeConversationRequest } from "@/types/ipc";

function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-6">
      <div className="border border-dashed border-border rounded-card p-10 text-center text-sm text-muted-foreground">
        {title} — sonraki iterasyonda genişletilecek.
      </div>
    </div>
  );
}

export default function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [activePage, setActivePage] = useState("dashboard");
  const [resumeConversation, setResumeConversation] = useState<ResumeConversationRequest | null>(null);

  useEffect(() => {
    window.electronAPI.devices.list().then(setDevices);
  }, []);

  return (
    <AppShell activePage={activePage} onNavigate={setActivePage}>
      {(page) => (
        <div className="h-full w-full relative">
          <div className={`h-full w-full ${page === "terminal" ? "block" : "hidden"}`}>
            <Workspace devices={devices} resumeConversation={resumeConversation} onResumeConsumed={() => setResumeConversation(null)} />
          </div>
          {page === "devices" && <DeviceList />}
          {page === "dashboard" && <Placeholder title="Dashboard" />}
          {page === "scan" && <NetworkScan />}
          {page === "prompts" && <PromptsManager />}
          {page === "playbooks" && <PlaybooksManager />}
          {page === "rag" && <RagManager />}
          {page === "history" && <AiHistory onResume={(request) => {
            setResumeConversation({ ...request, nonce: Date.now() });
            setActivePage("terminal");
          }} />}
          {page === "credentials" && <CredentialList />}
          {page === "settings" && <Settings />}
        </div>
      )}
    </AppShell>
  );
}
