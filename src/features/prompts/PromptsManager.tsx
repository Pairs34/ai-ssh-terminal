import { useState, useEffect } from "react";
import { Plus, Check, Trash2, Edit2, Sparkles, Star } from "lucide-react";
import type { CustomPrompt } from "@/types/ipc";

export function PromptsManager() {
  const [prompts, setPrompts] = useState<CustomPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<CustomPrompt> | null>(null);

  const loadPrompts = async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.prompts.list();
      setPrompts(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrompts();
  }, []);

  const handleSave = async () => {
    if (!editing?.title || !editing?.promptText) return;
    await window.electronAPI.prompts.save({
      id: editing.id,
      title: editing.title,
      promptText: editing.promptText,
      isDefault: editing.isDefault || false
    });
    setEditing(null);
    loadPrompts();
  };

  const handleSetDefault = async (id: number) => {
    await window.electronAPI.prompts.setDefault(id);
    loadPrompts();
  };

  const handleDelete = async (id: number) => {
    if (confirm("Bu istemi silmek istediğinize emin misiniz?")) {
      await window.electronAPI.prompts.delete(id);
      loadPrompts();
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-150">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles size={20} className="text-ask" />
            Özel AI Sistem İstemleri (Prompts)
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            AI'ın ağ cihazlarında ve sunucularda teşhis yaparken kullanacağı varsayılan persona ve yönergeleri özelleştirin.
          </p>
        </div>
        <button
          onClick={() =>
            setEditing({
              title: "Yeni Sistem Prompt'u",
              promptText: "Sen uzman bir Kıdemli Ağ ve Ağ Güvenliği Mühendisinisin...",
              isDefault: false
            })
          }
          className="flex items-center gap-1.5 bg-ask hover:bg-ask/90 text-white font-semibold px-4 py-2 rounded-card text-xs transition-colors"
        >
          <Plus size={15} />
          Yeni Prompt Ekle
        </button>
      </div>

      {editing && (
        <div className="bg-base-panel border border-ask/40 rounded-card p-4 space-y-4 shadow-lg">
          <h2 className="text-sm font-semibold text-white">
            {editing.id ? "Sistem Prompt'unu Düzenle" : "Yeni Sistem Prompt'u Oluştur"}
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-muted-foreground mb-1">Başlık</label>
              <input
                value={editing.title || ""}
                onChange={(e) => setEditing((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Örn: Kıdemli Ağ Mühendisi (Default)"
                className="w-full bg-base-elevated border border-border rounded px-3 py-1.5 outline-none focus:border-ask text-white"
              />
            </div>

            <div>
              <label className="block text-muted-foreground mb-1">Sistem Prompt Yönerge Metni</label>
              <textarea
                rows={6}
                value={editing.promptText || ""}
                onChange={(e) => setEditing((prev) => ({ ...prev, promptText: e.target.value }))}
                placeholder="Sistem talimatlarını ve persona kurallarını yazın..."
                className="w-full bg-base-elevated border border-border rounded p-3 font-mono text-xs outline-none focus:border-ask text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={editing.isDefault || false}
                onChange={(e) => setEditing((prev) => ({ ...prev, isDefault: e.target.checked }))}
                className="rounded bg-base-elevated border-border text-ask"
              />
              <label htmlFor="isDefault" className="text-white cursor-pointer font-medium">
                Varsayılan Sistem Prompt'u Olarak Ayarla
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
            <button
              onClick={() => setEditing(null)}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-white border border-border rounded"
            >
              İptal
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-xs bg-ask hover:bg-ask/90 text-white font-semibold rounded flex items-center gap-1"
            >
              <Check size={14} /> Kaydet
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-muted-foreground text-center py-10">Prompt'lar yükleniyor...</div>
      ) : prompts.length === 0 ? (
        <div className="border border-dashed border-border rounded-card p-10 text-center text-xs text-muted-foreground">
          Henüz özel bir sistem prompt'u tanımlanmadı. Şu anki dahili varsayılan sistem prompt'u kullanılıyor.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {prompts.map((p) => (
            <div
              key={p.id}
              className={`border rounded-card p-4 bg-base-panel/90 space-y-3 relative transition-all ${
                p.isDefault ? "border-ask/60 shadow-ask/5 shadow-lg bg-ask/5" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-white">{p.title}</h3>
                  {p.isDefault && (
                    <span className="flex items-center gap-1 text-[10px] bg-ask/20 text-ask border border-ask/30 px-2 py-0.5 rounded font-bold uppercase">
                      <Star size={10} fill="currentColor" /> Varsayılan
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {!p.isDefault && (
                    <button
                      onClick={() => handleSetDefault(p.id)}
                      className="p-1 text-muted-foreground hover:text-ask transition-colors text-xs flex items-center gap-1 border border-border rounded px-2"
                      title="Varsayılan Yap"
                    >
                      <Star size={12} /> Varsayılan Yap
                    </button>
                  )}
                  <button
                    onClick={() => setEditing(p)}
                    className="p-1 text-muted-foreground hover:text-white rounded hover:bg-base-elevated"
                    title="Düzenle"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-1 text-muted-foreground hover:text-danger rounded hover:bg-danger/20"
                    title="Sil"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="bg-base-elevated/70 border border-border/60 rounded p-2.5 font-mono text-[11px] text-muted-foreground max-h-32 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {p.promptText}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
