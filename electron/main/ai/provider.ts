import { app } from "electron";
import path from "node:path";
import fs from "node:fs";

export interface AiProviderConfig {
  provider?: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

let currentConfig: AiProviderConfig | null = null;

function getConfigFilePath(): string {
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "ai_config.json");
}

export function loadAiConfig(): AiProviderConfig | null {
  try {
    const filePath = getConfigFilePath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      currentConfig = JSON.parse(data);
      return currentConfig;
    }
  } catch (err) {
    console.error("AI config yüklenirken hata:", err);
  }
  return null;
}

export function setAiConfig(config: AiProviderConfig) {
  currentConfig = config;
  try {
    const filePath = getConfigFilePath();
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error("AI config kaydedilirken hata:", err);
  }
}

export function getAiConfig(): AiProviderConfig | null {
  if (!currentConfig) {
    loadAiConfig();
  }
  return currentConfig;
}

function normalizeAiText(content: string): string {
  let normalized = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (normalized.startsWith("```markdown")) {
    normalized = normalized.replace(/^```markdown\s*/i, "").replace(/\s*```$/, "").trim();
  }
  return normalized;
}

export async function callAiText(messages: AiChatMessage[]): Promise<string> {
  const config = getAiConfig();
  if (!config || !config.baseUrl || !config.model) {
    throw new Error("AI sağlayıcı yapılandırılmamış. Ayarlar bölümünden API bilgilerini ve modelinizi girin.");
  }

  const cleanBaseUrl = config.baseUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: 0.3
  };

  const response = await fetch(`${cleanBaseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI sağlayıcı hata döndürdü (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  let content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI yanıtı boş döndü.");

  return normalizeAiText(content);
}

export async function callAiTextStream(
  messages: AiChatMessage[],
  onToken?: (token: string) => void
): Promise<string> {
  const config = getAiConfig();
  if (!config || !config.baseUrl || !config.model) {
    throw new Error("AI sağlayıcı yapılandırılmamış. Ayarlar bölümünden API bilgilerini ve modelinizi girin.");
  }

  const cleanBaseUrl = config.baseUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: 0.3,
    stream: true
  };

  const response = await fetch(`${cleanBaseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok || !response.body) {
    return callAiText(messages);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) {
          content += token;
          onToken?.(token);
        }
      } catch {
      }
    }
  }

  if (!content.trim()) {
    return callAiText(messages);
  }

  return normalizeAiText(content);
}

export async function callAiJson<T>(messages: AiChatMessage[]): Promise<T> {
  const config = getAiConfig();
  if (!config || !config.baseUrl || !config.model) {
    throw new Error("AI sağlayıcı yapılandırılmamış. Ayarlar bölümünden API bilgilerini ve modelinizi girin.");
  }

  const cleanBaseUrl = config.baseUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: 0.2
  };

  if (!config.model.includes("reasoner")) {
    body["response_format"] = { type: "json_object" };
  }

  let response = await fetch(`${cleanBaseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok && body["response_format"]) {
    delete body["response_format"];
    response = await fetch(`${cleanBaseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI sağlayıcı hata döndürdü (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  let content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI yanıtı boş döndü.");

  content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  if (content.startsWith("```")) {
    content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  try {
    return JSON.parse(content) as T;
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as T;
      } catch {
        // Fallback below
      }
    }

    // EĞER JSON parse edilemezse ve metin şeklinde açıklama geldiyse esnek şekilde nesneye sarıyoruz
    if (content.length > 0) {
      // If asking for explanation, return it as explanation property!
      return ({ explanation: content, reasoning: content, command: content.split("\n")[0] } as unknown) as T;
    }

    throw new Error(`AI yanıtı geçerli JSON değil: ${content.slice(0, 100)}...`);
  }
}

