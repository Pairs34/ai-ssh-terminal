import type { AiAskResult, AiHistoryMessage } from "@/types/ipc";

export interface RestoredChatEntry {
  id: string;
  mode: "ask" | "modify";
  prompt: string;
  askResult?: AiAskResult | null;
  historicalResponse?: string | null;
  timestamp: string;
}

export function restoreConversationTimeline(messages: AiHistoryMessage[]): RestoredChatEntry[] {
  const restored: RestoredChatEntry[] = [];
  for (const message of messages) {
    const timestamp = message.createdAt ? new Date(message.createdAt).toLocaleTimeString() : "";
    if (message.role === "user") {
      restored.push({ id: `history-user-${message.id}`, mode: message.mode, prompt: message.content, timestamp });
      continue;
    }
    const target = [...restored].reverse().find((entry) =>
      entry.mode === message.mode && !entry.askResult && !entry.historicalResponse
    );
    if (target) {
      if (message.mode === "ask") target.askResult = { command: "", output: "", explanation: message.content };
      else target.historicalResponse = message.content;
    } else {
      restored.push({
        id: `history-${message.role}-${message.id}`,
        mode: message.mode,
        prompt: message.role === "system" ? "Sistem kaydı" : "Geçmiş AI yanıtı",
        historicalResponse: message.content,
        timestamp
      });
    }
  }
  return restored;
}
