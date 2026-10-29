import { useState, useEffect } from "react";
import { Plus, Check, Trash2, Edit2, BookOpen, AtSign, Power } from "lucide-react";
import type { Playbook } from "@/types/ipc";

export function PlaybooksManager() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Playbook> | null>(null);

  const loadPlaybooks = async () => {
    setLoading(true);
    try {
      const res = await window.electronAPI.playbooks.list();
      setPlaybooks(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlaybooks();
  }, []);

  const handleSave = async () => {
    if (!editing?.tag || !editing?.title || !editing?.instructions) return;
    await window.electronAPI.playbooks.save({
      id: editing.id,
      tag: editing.tag,
      title: editing.title,
      description: editing.description || "",
      instructions: editing.instructions,
      enabled: Boolean(editing.enabled)
    });
    setEditing(null);
    loadPlaybooks();
  };

  const handleToggleEnabled = async (playbook: Playbook) => {
    await window.electronAPI.playbooks.setEnabled(playbook.id, !playbook.enabled);
    loadPlaybooks();
  };

  const handleDelete = async (id: number) => {
    if (confirm("Bu skill'i silmek istediğinize emin misiniz?")) {
      await window.electronAPI.playbooks.delete(id);
      loadPlaybooks();
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-150">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen size={20} className="text-modify" />
            Skills (Prompt Playbooks)
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Adlandırılmış teşhis senaryoları. Sohbette <span className="text-modify font-mono">@SkillAdı</span> ile seçin veya her zaman aktif işaretleyerek tüm isteklere bağlayın.
          </p>
        </div>
        <button
          onClick={() =>
            setEditing({
              tag: "FiberTroubleshoot",
              title: "Fiber Optik SFP Sağlık Raporu",
              description: "Fiber portlarının optik güçlerini (TX/RX dBm) ve hata sayaçlarını inceler.",
              instructions: "Sırasıyla tüm SFP portlarının transceiver detaylarını, hata sayaçlarını ve port durumlarını kontrol et.",
              enabled: false
            })
          }
          className="flex items-center gap-1.5 bg-modify hover:bg-modify/90 text-white font-semibold px-4 py-2 rounded-card text-xs transition-colors"
        >
          <Plus size={15} />
          Yeni Skill
        </button>
      </div>

      {editing && (
        <div className="bg-base-panel border border-modify/40 rounded-card p-4 space-y-4 shadow-lg">
          <h2 className="text-sm font-semibold text-white">
            {editing.id ? "Skill Düzenle" : "Yeni Skill Oluştur"}
          </h2>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-muted-foreground mb-1">Skill Etiketi (@Mention)</label>
                <div className="flex items-center bg-base-elevated border border-border rounded px-3 py-1.5 focus-within:border-modify">
                  <AtSign size={13} className="text-modify mr-1" />
                  <input
                    value={editing.tag || ""}
                    onChange={(e) => setEditing((prev) => ({ ...prev, tag: e.target.value.replace(/[^a-zA-Z0-9_-]/g, "") }))}
                    placeholder="Örn: FiberTroubleshoot"
                    className="w-full bg-transparent outline-none text-white font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Başlık</label>
                <input
                  value={editing.title || ""}
                  onChange={(e) => setEditing((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Örn: Fiber SFP Sağlık ve Hata Analizi"
                  className="w-full bg-base-elevated border border-border rounded px-3 py-1.5 outline-none focus:border-modify text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-muted-foreground mb-1">Açıklama (Kısa)</label>
              <input
                value={editing.description || ""}
                onChange={(e) => setEditing((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Örn: Optik güç seviyelerini, voltaj ve CRC sayaçlarını inceler."
                className="w-full bg-base-elevated border border-border rounded px-3 py-1.5 outline-none focus:border-modify text-white"
              />
            </div>

            <div>
              <label className="block text-muted-foreground mb-1">Talimatlar / Playbook Adımları</label>
              <textarea
                rows={5}
                value={editing.instructions || ""}
                onChange={(e) => setEditing((prev) => ({ ...prev, instructions: e.target.value }))}
                placeholder="AI'ın bu skill çağrıldığında canlı terminalde izlemesini istediğiniz adımları yazın..."
                className="w-full bg-base-elevated border border-border rounded p-3 font-mono text-xs outline-none focus:border-modify text-white leading-relaxed"
              />
            </div>

            <label className="flex items-center gap-2 text-white cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={Boolean(editing.enabled)}
                onChange={(e) => setEditing((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="rounded bg-base-elevated border-border text-modify"
              />
              Her zaman aktif (mention olmadan da bağlama ekle)
            </label>
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
              className="px-4 py-1.5 text-xs bg-modify hover:bg-modify/90 text-white font-semibold rounded flex items-center gap-1"
            >
              <Check size={14} /> Kaydet
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-muted-foreground text-center py-10">Skill'ler yükleniyor...</div>
      ) : playbooks.length === 0 ? (
        <div className="border border-dashed border-border rounded-card p-10 text-center text-xs text-muted-foreground">
          Henüz skill tanımlanmadı.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {playbooks.map((pb) => (
            <div key={pb.id} className={`border rounded-card p-4 bg-base-panel/90 space-y-3 relative transition-all ${pb.enabled ? "border-modify/50" : "border-border"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="flex items-center gap-0.5 text-xs font-mono font-bold bg-modify/20 text-modify border border-modify/30 px-2 py-0.5 rounded">
                    @{pb.tag}
                  </span>
                  <h3 className="font-semibold text-sm text-white truncate">{pb.title}</h3>
                  <span className={`text-[10px] border px-2 py-0.5 rounded font-bold uppercase ${pb.enabled ? "border-success/30 bg-success/10 text-success" : "border-border text-muted-foreground"}`}>
                    {pb.enabled ? "Her zaman" : "@mention"}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggleEnabled(pb)}
                    className="p-1 text-muted-foreground hover:text-modify rounded hover:bg-base-elevated"
                    title={pb.enabled ? "Yalnızca @mention" : "Her zaman aktif"}
                  >
                    <Power size={13} />
                  </button>
                  <button
                    onClick={() => setEditing(pb)}
                    className="p-1 text-muted-foreground hover:text-white rounded hover:bg-base-elevated"
                    title="Düzenle"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(pb.id)}
                    className="p-1 text-muted-foreground hover:text-danger rounded hover:bg-danger/20"
                    title="Sil"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {pb.description && <p className="text-xs text-muted-foreground">{pb.description}</p>}

              <div className="bg-base-elevated/70 border border-border/60 rounded p-2.5 font-mono text-[11px] text-muted-foreground max-h-32 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {pb.instructions}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
