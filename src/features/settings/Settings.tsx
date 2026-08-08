import { useState, useEffect } from "react";
import { Save, CheckCircle2, Cpu, Key, Globe, Sparkles } from "lucide-react";

interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  suggestedModels: string[];
  description: string;
}

const PROVIDERS: ProviderPreset[] = [
  {
    id: "deepseek",
    name: "DeepSeek AI",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-flash",
    suggestedModels: ["deepseek-v4-flash", "deepseek-v4-pro"],
    description: "DeepSeek V4-Flash ve V4-Pro modelleri (platform.deepseek.com)"
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    suggestedModels: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
    description: "OpenAI resmi API servisleri (platform.openai.com)"
  },
  {
    id: "ollama",
    name: "Ollama (Yerel AI)",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "deepseek-v4-flash",
    suggestedModels: ["deepseek-v4-flash", "llama3.2", "qwen2.5"],
    description: "Yerel bilgisayarınızda çalışan Ollama sunucusu (API key opsiyoneldir)"
  },
  {
    id: "custom",
    name: "Özel (Custom OpenAI Uyumlu)",
    baseUrl: "",
    defaultModel: "",
    suggestedModels: [],
    description: "Herhangi bir OpenAI uyumlu API adresi veya yerel LLM sunucusu"
  }
];

export function Settings() {
  const [provider, setProvider] = useState<string>("deepseek");
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("deepseek-v4-flash");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await window.electronAPI.ai.getConfig();
        if (config) {
          if (config.provider) setProvider(config.provider);
          if (config.baseUrl) setBaseUrl(config.baseUrl);
          if (config.apiKey) setApiKey(config.apiKey);
          if (config.model) setModel(config.model);
        }
      } catch (err) {
        console.error("AI ayarları yüklenemedi:", err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleProviderChange = (newProviderId: string) => {
    setProvider(newProviderId);
    const selected = PROVIDERS.find((p) => p.id === newProviderId);
    if (selected && selected.id !== "custom") {
      setBaseUrl(selected.baseUrl);
      setModel(selected.defaultModel);
    }
  };

  const save = async () => {
    await window.electronAPI.ai.setConfig({ provider, baseUrl, apiKey, model });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const currentProvider = PROVIDERS.find((p) => p.id === provider) || PROVIDERS[3];

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
        <Sparkles size={16} className="animate-spin text-ask" />
        Ayarlar yükleniyor...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="text-ask" size={20} />
          AI Yapılandırması
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Ağ komut analizi ve otomasyon için kullanmak istediğiniz AI sağlayıcısını seçin ve yapılandırın.
        </p>
      </div>

      <div className="border border-border rounded-card p-5 bg-base-panel space-y-5">
        {/* Provider Selector */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Cpu size={14} />
            AI Sağlayıcı Seçimi
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleProviderChange(p.id)}
                className={`p-3 text-left rounded-card border transition-all ${
                  provider === p.id
                    ? "border-ask bg-ask/10 text-white font-medium"
                    : "border-border bg-base-elevated hover:border-border/80 text-muted-foreground"
                }`}
              >
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-[11px] opacity-70 mt-0.5 line-clamp-1">{p.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Base URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Globe size={14} />
            Base URL
          </label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.deepseek.com"
            className="w-full bg-base-elevated border border-border rounded-card px-3 py-2 text-sm outline-none focus:border-ask font-mono"
          />
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Key size={14} />
            API Anahtarı (API Key)
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === "ollama" ? "Opsiyonel (Ollama için gerekli değil)" : "sk-..."}
            className="w-full bg-base-elevated border border-border rounded-card px-3 py-2 text-sm outline-none focus:border-ask font-mono"
          />
          <p className="text-[11px] text-muted-foreground">
            Credential bilgileri ve SSH şifreleriniz AI sunucusuna <strong>asla gönderilmez</strong>.
          </p>
        </div>

        {/* Model */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Cpu size={14} />
            Model Adı
          </label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="deepseek-chat"
            className="w-full bg-base-elevated border border-border rounded-card px-3 py-2 text-sm outline-none focus:border-ask font-mono"
          />

          {/* Model Presets */}
          {currentProvider.suggestedModels.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[11px] text-muted-foreground">Önerilen Modeller:</span>
              {currentProvider.suggestedModels.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModel(m)}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                    model === m
                      ? "bg-ask/20 border-ask text-white"
                      : "bg-base-elevated border-border text-muted-foreground hover:text-white"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-border/50 flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground">
            Seçili mod: <span className="text-white font-mono">{provider}</span> ({model || "Model belirtilmedi"})
          </div>
          <button
            onClick={save}
            className="flex items-center gap-2 text-sm bg-ask hover:bg-ask/90 text-white rounded-card px-4 py-2 font-medium transition-colors"
          >
            {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {saved ? "Kaydedildi!" : "Ayarları Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

