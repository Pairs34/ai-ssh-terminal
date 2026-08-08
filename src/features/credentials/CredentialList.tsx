import { useEffect, useState } from "react";
import type { CredentialView } from "@/types/ipc";
import { Key, Plus, Trash2, X, Shield, Lock, Eye, EyeOff, FileKey, Pencil } from "lucide-react";

export function CredentialList() {
  const [credentials, setCredentials] = useState<CredentialView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCred, setEditingCred] = useState<CredentialView | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [authMethod, setAuthMethod] = useState<"password" | "private_key">("password");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [enableSecret, setEnableSecret] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const reload = async () => {
    try {
      const list = await window.electronAPI.credentials.list();
      setCredentials(list);
    } catch (err) {
      console.error("Kimlik bilgileri yüklenemedi:", err);
    }
  };

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const openAddModal = () => {
    setEditingCred(null);
    setName("");
    setUsername("");
    setAuthMethod("password");
    setPassword("");
    setPrivateKey("");
    setPassphrase("");
    setEnableSecret("");
    setShowPassword(false);
    setErrorMsg("");
    setShowModal(true);
  };

  const openEditModal = (cred: CredentialView) => {
    setEditingCred(cred);
    setName(cred.name);
    setUsername(cred.username);
    setAuthMethod(cred.authMethod);
    setPassword(""); // Şifre alanını boş bırak, doldurulursa güncelleyeceğiz
    setPrivateKey("");
    setPassphrase("");
    setEnableSecret("");
    setShowPassword(false);
    setErrorMsg("");
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim()) {
      setErrorMsg("Lütfen Başlık ve Kullanıcı Adı alanlarını doldurun.");
      return;
    }

    if (!editingCred && authMethod === "password" && !password) {
      setErrorMsg("Şifre seçeneği için şifre girilmesi zorunludur.");
      return;
    }

    if (!editingCred && authMethod === "private_key" && !privateKey.trim()) {
      setErrorMsg("Özel anahtar (Private Key) metni zorunludur.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      if (editingCred) {
        await window.electronAPI.credentials.update(editingCred.id, {
          name: name.trim(),
          username: username.trim(),
          authMethod,
          password: password ? password : undefined,
          privateKey: privateKey.trim() ? privateKey.trim() : undefined,
          passphrase: passphrase.trim() ? passphrase.trim() : undefined,
          enableSecret: enableSecret.trim() ? enableSecret.trim() : undefined
        });
      } else {
        await window.electronAPI.credentials.create({
          name: name.trim(),
          username: username.trim(),
          authMethod,
          password: authMethod === "password" ? password : undefined,
          privateKey: authMethod === "private_key" ? privateKey.trim() : undefined,
          passphrase: passphrase.trim() || undefined,
          enableSecret: enableSecret.trim() || undefined
        });
      }

      setShowModal(false);
      setEditingCred(null);
      reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Kimlik bilgisi kaydedilirken hata oluştu.";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, credName: string) => {
    if (confirm(`"${credName}" kimlik bilgisini silmek istediğinize emin misiniz?`)) {
      await window.electronAPI.credentials.delete(id);
      reload();
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Kimlik bilgileri yükleniyor...</div>;
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Shield className="text-ask" size={18} />
            SSH Kimlik Bilgileri (Credentials)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cihazlara bağlanırken kullanılan SSH şifreleri ve özel anahtarlar AES-256 ile kasada şifrelenir.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 text-xs bg-ask hover:bg-ask/90 text-white rounded-card px-3.5 py-2 font-medium transition-colors"
        >
          <Plus size={14} />
          Yeni Kimlik Ekle
        </button>
      </div>

      {/* List Table */}
      {credentials.length === 0 ? (
        <div className="border border-dashed border-border rounded-card p-12 text-center bg-base-panel/30">
          <Lock className="mx-auto text-muted-foreground mb-2" size={32} />
          <p className="text-sm font-medium">Kayıtlı kimlik bilgisi bulunmuyor.</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            SSH bağlantılarında tekrar şifre girmemek için kullanıcı adı ve şifrelerinizi güvenle kaydedebilirsiniz.
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 inline-flex items-center gap-1.5 text-xs bg-ask text-white rounded-card px-4 py-2 font-medium"
          >
            <Plus size={14} />
            İlk Kimlik Bilgisini Ekle
          </button>
        </div>
      ) : (
        <div className="border border-border rounded-card overflow-hidden bg-base-panel">
          <table className="w-full text-sm">
            <thead className="bg-base-elevated text-muted-foreground text-xs uppercase tracking-wide border-b border-border">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Kimlik Adı</th>
                <th className="text-left font-medium px-4 py-2.5">Kullanıcı Adı</th>
                <th className="text-left font-medium px-4 py-2.5">Doğrulama Türü</th>
                <th className="text-left font-medium px-4 py-2.5">Şifre / Key Durumu</th>
                <th className="text-left font-medium px-4 py-2.5">Enable Secret</th>
                <th className="text-right font-medium px-4 py-2.5">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((cred) => (
                <tr key={cred.id} className="border-t border-border/60 hover:bg-base-elevated/50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-white flex items-center gap-2">
                    <Key size={14} className="text-ask" />
                    {cred.name}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{cred.username}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    <span className="inline-flex items-center gap-1 text-xs bg-base-elevated border border-border px-2 py-0.5 rounded">
                      {cred.authMethod === "private_key" ? (
                        <>
                          <FileKey size={12} className="text-ask" /> Özel Anahtar
                        </>
                      ) : (
                        <>
                          <Lock size={12} className="text-success" /> Şifre
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {cred.authMethod === "private_key" ? cred.privateKey || "Kayıtlı Key" : cred.password || "••••••••"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {cred.enableSecret || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditModal(cred)}
                        className="p-1.5 hover:bg-base-elevated rounded text-muted-foreground hover:text-white transition-colors"
                        title="Kimliği Düzenle"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(cred.id, cred.name)}
                        className="p-1.5 hover:bg-danger/20 rounded text-muted-foreground hover:text-danger transition-colors"
                        title="Kimliği Sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Credential Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-base-panel border border-border rounded-card w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-base-elevated">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                {editingCred ? <Pencil size={16} className="text-ask" /> : <Plus size={16} className="text-ask" />}
                {editingCred ? "Kimlik Bilgisini Düzenle" : "Yeni Kimlik Bilgisi (Credential) Ekle"}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingCred(null);
                }}
                className="text-muted-foreground hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-danger/10 border border-danger/30 rounded text-xs text-danger">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Kimlik Başlığı *</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Örn: Root Sunucu Şifresi"
                    className="w-full bg-base-elevated border border-border rounded-card px-3 py-1.5 text-sm outline-none focus:border-ask"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Kullanıcı Adı (Username) *</label>
                  <input
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Örn: root, admin, cisco"
                    className="w-full bg-base-elevated border border-border rounded-card px-3 py-1.5 text-sm outline-none focus:border-ask font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Doğrulama Yöntemi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAuthMethod("password")}
                    className={`p-2.5 text-xs text-left rounded-card border font-medium flex items-center gap-2 transition-all ${
                      authMethod === "password"
                        ? "border-ask bg-ask/10 text-white"
                        : "border-border bg-base-elevated text-muted-foreground"
                    }`}
                  >
                    <Lock size={14} /> Şifre (Password)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMethod("private_key")}
                    className={`p-2.5 text-xs text-left rounded-card border font-medium flex items-center gap-2 transition-all ${
                      authMethod === "private_key"
                        ? "border-ask bg-ask/10 text-white"
                        : "border-border bg-base-elevated text-muted-foreground"
                    }`}
                  >
                    <FileKey size={14} /> Private Key (SSH Anahtarı)
                  </button>
                </div>
              </div>

              {authMethod === "password" ? (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {editingCred ? "Yeni SSH Şifresi (Değiştirmek istemiyorsanız boş bırakın)" : "SSH Şifresi *"}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required={!editingCred}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={editingCred ? "Değiştirilmedi (Mevcut şifre korunur)" : "••••••••"}
                      className="w-full bg-base-elevated border border-border rounded-card pl-3 pr-9 py-1.5 text-sm outline-none focus:border-ask font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2 text-muted-foreground hover:text-white"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {editingCred ? "Yeni Private Key (Değiştirmek istemiyorsanız boş bırakın)" : "Private Key Metni (PEM/OpenSSH) *"}
                    </label>
                    <textarea
                      rows={4}
                      required={!editingCred}
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      placeholder={editingCred ? "Değiştirilmedi (Mevcut key korunur)" : "-----BEGIN OPENSSH PRIVATE KEY-----..."}
                      className="w-full bg-base-elevated border border-border rounded-card p-2.5 text-xs outline-none focus:border-ask font-mono resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Anahtar Parolası (Passphrase - Opsiyonel)</label>
                    <input
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="Key şifrelenmiş ise girin"
                      className="w-full bg-base-elevated border border-border rounded-card px-3 py-1.5 text-sm outline-none focus:border-ask font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Enable Şifresi (Cisco vb. - Opsiyonel)</label>
                <input
                  type="password"
                  value={enableSecret}
                  onChange={(e) => setEnableSecret(e.target.value)}
                  placeholder="Ağ cihazlarında enable moduna geçiş şifresi"
                  className="w-full bg-base-elevated border border-border rounded-card px-3 py-1.5 text-sm outline-none focus:border-ask font-mono"
                />
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCred(null);
                  }}
                  className="text-xs bg-base-elevated hover:bg-base-elevated/80 text-muted-foreground px-3 py-2 rounded-card"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="text-xs bg-ask hover:bg-ask/90 text-white font-medium px-4 py-2 rounded-card transition-colors disabled:opacity-50"
                >
                  {submitting ? "Kaydediliyor..." : editingCred ? "Değişiklikleri Kaydet" : "Kimlik Bilgisini Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
