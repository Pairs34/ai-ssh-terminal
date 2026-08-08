import test from "node:test";
import assert from "node:assert/strict";
import { restoreConversationTimeline } from "../src/features/ai/restoreHistory";
import type { AiHistoryMessage } from "../src/types/ipc";

test("geçmiş Ask ve Modify mesajları devam edilebilir zaman çizelgesine dönüştürülür", () => {
  const messages: AiHistoryMessage[] = [
    { id: 1, sessionId: 7, mode: "ask", role: "user", content: "Yedekleme hatasını incele", createdAt: "2026-08-03T07:00:00Z" },
    { id: 2, sessionId: 7, mode: "ask", role: "assistant", content: "Disk doluluğu normal.", createdAt: "2026-08-03T07:00:01Z" },
    { id: 3, sessionId: 7, mode: "modify", role: "user", content: "Mount sorununu düzelt", createdAt: "2026-08-03T07:01:00Z" },
    { id: 4, sessionId: 7, mode: "modify", role: "assistant", content: "Önerilen Değişiklik: mount /mnt/backup", createdAt: "2026-08-03T07:01:01Z" }
  ];
  const timeline = restoreConversationTimeline(messages);
  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].prompt, "Yedekleme hatasını incele");
  assert.equal(timeline[0].askResult?.explanation, "Disk doluluğu normal.");
  assert.equal(timeline[1].prompt, "Mount sorununu düzelt");
  assert.match(timeline[1].historicalResponse || "", /mount \/mnt\/backup/);
});

