import { useEffect, useState } from "react";
import type { Device, CredentialView } from "@/types/ipc";
import { Wifi, WifiOff, HelpCircle, Download, Upload, Plus, Trash2, RefreshCw, X, Star, Pencil } from "lucide-react";

const STATUS_STYLES: Record<Device["status"], { icon: typeof Wifi; className: string }> = {
  online: { icon: Wifi, className: "text-success" },
  offline: { icon: WifiOff, className: "text-danger" },
  unknown: { icon: HelpCircle, className: "text-muted-foreground" }
};

const DEVICE_TYPES = [
  { value: "switch", label: "Switch (Anahtar)" },
  { value: "router", label: "Router (Yönlendirici)" },
  { value: "firewall", label: "Firewall (Güvenlik Duvarı)" },
  { value: "access_point", label: "Access Point" },
  { value: "linux_server", label: "Linux Sunucu" },
  { value: "windows_server", label: "Windows Sunucu" },
  { value: "storage", label: "Depolama (NAS / SAN)" },
  { value: "hypervisor", label: "Hypervisor (ESXi / Proxmox)" },
  { value: "unknown", label: "Diğer / Bilinmiyor" }
];

export function DeviceList() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [credentials, setCredentials] = useState<CredentialView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [checkingIds, setCheckingIds] = useState<Set<number>>(new Set());

  // Form states for device
  const [name, setName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [sshPort, setSshPort] = useState(22);
  const [deviceType, setDeviceType] = useState<Device["deviceType"]>("switch");
  const [vendor, setVendor] = useState("");
  const [model, setModel] = useState("");
  const [credentialId, setCredentialId] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Quick Credential Modal states
  const [showQuickCredModal, setShowQuickCredModal] = useState(false);
  const [quickCredName, setQuickCredName] = useState("");
  const [quickUsername, setQuickUsername] = useState("");
  const [quickPassword, setQuickPassword] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);

  const handleCreateQuickCred = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCredName.trim() || !quickUsername.trim()) return;
    setQuickSaving(true);
    try {
      const res = await window.electronAPI.credentials.create({
        name: quickCredName.trim(),
        authMethod: "password",
        username: quickUsername.trim(),
        password: quickPassword
      });
      await reload();
      setCredentialId(res.id);
      setShowQuickCredModal(false);
      setQuickCredName("");
      setQuickUsername("");
      setQuickPassword("");
    } finally {
      setQuickSaving(false);
    }
  };

  const reload = async () => {
    try {
      const [devList, credList] = await Promise.all([
        window.electronAPI.devices.list(),
        window.electronAPI.credentials.list()
      ]);
      setDevices(devList);
      setCredentials(credList);
    } catch (err) {
      console.error("Veriler yüklenirken hata:", err);
    }
  };

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const handleImport = async () => {
    const { imported } = await window.electronAPI.csv.importDevices();
    if (imported > 0) reload();
  };

  const handleExport = () => window.electronAPI.csv.exportDevices();

  const openAddModal = () => {
    setEditingDevice(null);
    setName("");
    setIpAddress("");
    setSshPort(22);
    setDeviceType("switch");
    setVendor("");
    setModel("");
    setCredentialId(undefined);
    setNotes("");
    setErrorMsg("");
    setShowModal(true);
  };

  const openEditModal = (device: Device) => {
    setEditingDevice(device);
    setName(device.name);
    setIpAddress(device.ipAddress);
    setSshPort(device.sshPort || 22);
    setDeviceType(device.deviceType);
    setVendor(device.vendor || "");
    setModel(device.model || "");
    setCredentialId(device.credentialId || undefined);
    setNotes(device.notes || "");
    setErrorMsg("");
    setShowModal(true);
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ipAddress.trim()) {
      setErrorMsg("Lütfen Cihaz Adı ve IP Adresi alanlarını doldurun.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const payload = {
        name: name.trim(),
        ipAddress: ipAddress.trim(),
        sshPort: Number(sshPort) || 22,
        deviceType,
        vendor: vendor.trim() || undefined,
        model: model.trim() || undefined,
        credentialId: credentialId ? Number(credentialId) : undefined,
        notes: notes.trim() || undefined
      };

      if (editingDevice) {
        await window.electronAPI.devices.update(editingDevice.id, payload);
      } else {
        await window.electronAPI.devices.create({
          ...payload,
          status: "unknown"
        });
      }

      setShowModal(false);
      setEditingDevice(null);
      reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Cihaz kaydedilirken bir hata oluştu.";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, deviceName: string) => {
    if (confirm(`"${deviceName}" cihazını silmek istediğinize emin misiniz?`)) {
      await window.electronAPI.devices.delete(id);
      reload();
    }
  };

  const handleCheckStatus = async (id: number) => {
    setCheckingIds((prev) => new Set(prev).add(id));
    try {
      await window.electronAPI.devices.checkStatus(id);
      await reload();
    } finally {
      setCheckingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleToggleFavorite = async (device: Device) => {
    await window.electronAPI.devices.update(device.id, {
      isFavorite: !device.isFavorite
    });
    reload();
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Cihazlar yükleniyor...</div>;
  }

  const actionBar = (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div>
        <h2 className="text-base font-semibold">Cihaz Envanteri</h2>
        <p className="text-xs text-muted-foreground">Kayıtlı ağ cihazları ve sunucular ({devices.length})</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 text-xs bg-ask hover:bg-ask/90 text-white rounded-card px-3 py-1.5 font-medium transition-colors"
        >
          <Plus size={14} />
          Yeni Cihaz Ekle
        </button>
        <button
          onClick={handleImport}
          className="flex items-center gap-1.5 text-xs bg-base-elevated border border-border rounded-card px-3 py-1.5 hover:border-ask transition-colors"
        >
          <Upload size={12} />
          CSV İçe Aktar
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 text-xs bg-base-elevated border border-border rounded-card px-3 py-1.5 hover:border-ask transition-colors"
        >
          <Download size={12} />
          CSV Dışa Aktar
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {actionBar}

      {/* Device List Table */}
      {devices.length === 0 ? (
        <div className="border border-dashed border-border rounded-card p-12 text-center bg-base-panel/30">
          <p className="text-sm font-medium">Henüz cihaz eklenmemiş.</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Yukarıdaki "Yeni Cihaz Ekle" butonuna tıklayarak manuel ekleyebilir, ağ taraması yapabilir veya CSV içe aktarabilirsiniz.
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 inline-flex items-center gap-1.5 text-xs bg-ask text-white rounded-card px-4 py-2 font-medium"
          >
            <Plus size={14} />
            İlk Cihazını Ekle
          </button>
        </div>
      ) : (
        <div className="border border-border rounded-card overflow-hidden bg-base-panel">
          <table className="w-full text-sm">
            <thead className="bg-base-elevated text-muted-foreground text-xs uppercase tracking-wide border-b border-border">
              <tr>
                <th className="w-8 px-3 py-2.5 text-center"></th>
                <th className="text-left font-medium px-4 py-2.5">Cihaz Adı</th>
                <th className="text-left font-medium px-4 py-2.5">IP Adresi : Port</th>
                <th className="text-left font-medium px-4 py-2.5">Tür</th>
                <th className="text-left font-medium px-4 py-2.5">Üretici / Model</th>
                <th className="text-left font-medium px-4 py-2.5">Durum</th>
                <th className="text-right font-medium px-4 py-2.5">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => {
                const { icon: StatusIcon, className } = STATUS_STYLES[device.status];
                const isChecking = checkingIds.has(device.id);

                return (
                  <tr key={device.id} className="border-t border-border/60 hover:bg-base-elevated/50 transition-colors">
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => handleToggleFavorite(device)}
                        className={`transition-colors ${device.isFavorite ? "text-yellow-400" : "text-muted-foreground/30 hover:text-muted-foreground"}`}
                        title={device.isFavorite ? "Favorilerden Çıkar" : "Favorilere Ekle"}
                      >
                        <Star size={14} fill={device.isFavorite ? "currentColor" : "none"} />
                      </button>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-white">{device.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">
                      {device.ipAddress}:{device.sshPort}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground capitalize">
                      {DEVICE_TYPES.find((t) => t.value === device.deviceType)?.label.split(" ")[0] ?? device.deviceType}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {device.vendor ? `${device.vendor} ${device.model ?? ""}` : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <StatusIcon size={14} className={className} />
                        <span className="text-xs capitalize text-muted-foreground">{device.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(device)}
                          className="p-1.5 hover:bg-base-elevated rounded text-muted-foreground hover:text-white transition-colors"
                          title="Cihazı Düzenle"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleCheckStatus(device.id)}
                          disabled={isChecking}
                          className="p-1.5 hover:bg-base-elevated rounded text-muted-foreground hover:text-white transition-colors"
                          title="Erişilebilirlik Kontrolü Et (Ping/TCP)"
                        >
                          <RefreshCw size={13} className={isChecking ? "animate-spin" : ""} />
                        </button>
                        <button
                          onClick={() => handleDelete(device.id, device.name)}
                          className="p-1.5 hover:bg-danger/20 rounded text-muted-foreground hover:text-danger transition-colors"
                          title="Cihazı Sil"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Device Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-base-panel border border-border rounded-card w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-base-elevated">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                {editingDevice ? <Pencil size={16} className="text-ask" /> : <Plus size={16} className="text-ask" />}
                {editingDevice ? "Cihaz Bilgilerini Düzenle" : "Yeni Cihaz Ekle"}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingDevice(null);
                }}
                className="text-muted-foreground hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveDevice} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-danger/10 border border-danger/30 rounded text-xs text-danger">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Cihaz Adı *</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Örn: Core Switch 01"
                    className="w-full bg-base-elevated border border-border rounded-card px-3 py-1.5 text-sm outline-none focus:border-ask"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Cihaz Türü</label>
                  <select
                    value={deviceType}
                    onChange={(e) => setDeviceType(e.target.value as Device["deviceType"])}
                    className="w-full bg-base-elevated border border-border rounded-card px-3 py-1.5 text-sm outline-none focus:border-ask"
                  >
                    {DEVICE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">IP Adresi *</label>
                  <input
                    required
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    placeholder="192.168.1.1"
                    className="w-full bg-base-elevated border border-border rounded-card px-3 py-1.5 text-sm outline-none focus:border-ask font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">SSH Port</label>
                  <input
                    type="number"
                    value={sshPort}
                    onChange={(e) => setSshPort(Number(e.target.value))}
                    placeholder="22"
                    className="w-full bg-base-elevated border border-border rounded-card px-3 py-1.5 text-sm outline-none focus:border-ask font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Üretici (Vendor)</label>
                  <input
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="Örn: Cisco, MikroTik"
                    className="w-full bg-base-elevated border border-border rounded-card px-3 py-1.5 text-sm outline-none focus:border-ask"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Model</label>
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Örn: Catalyst 2960"
                    className="w-full bg-base-elevated border border-border rounded-card px-3 py-1.5 text-sm outline-none focus:border-ask"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Bağlı Kimlik Bilgisi (Credential)</label>
                  <button
                    type="button"
                    onClick={() => setShowQuickCredModal(true)}
                    className="text-[11px] text-ask hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Plus size={12} /> Hızlı Credential Ekle
                  </button>
                </div>
                <select
                  value={credentialId ?? ""}
                  onChange={(e) => setCredentialId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full bg-base-elevated border border-border rounded-card px-3 py-1.5 text-sm outline-none focus:border-ask"
                >
                  <option value="">-- Varsayılan / Yok --</option>
                  {credentials.map((cred) => (
                    <option key={cred.id} value={cred.id}>
                      {cred.name} ({cred.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Notlar (Opsiyonel)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Lokasyon, raf numarası veya açıklamalar..."
                  className="w-full bg-base-elevated border border-border rounded-card px-3 py-1.5 text-sm outline-none focus:border-ask resize-none"
                />
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingDevice(null);
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
                  {submitting ? "Kaydediliyor..." : editingDevice ? "Değişiklikleri Kaydet" : "Cihazı Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQuickCredModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-base-panel border border-ask/40 rounded-card w-full max-w-md p-4 space-y-3 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus size={16} className="text-ask" /> Hızlı Kimlik Bilgisi (Credential) Ekle
              </h3>
              <button onClick={() => setShowQuickCredModal(false)} className="text-muted-foreground hover:text-white">
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateQuickCred} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1">Profil Adı *</label>
                <input
                  required
                  value={quickCredName}
                  onChange={(e) => setQuickCredName(e.target.value)}
                  placeholder="Örn: Kat Sw Şifresi"
                  className="w-full bg-base-elevated border border-border rounded px-3 py-1.5 outline-none focus:border-ask text-white"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Kullanıcı Adı *</label>
                <input
                  required
                  value={quickUsername}
                  onChange={(e) => setQuickUsername(e.target.value)}
                  placeholder="Örn: admin"
                  className="w-full bg-base-elevated border border-border rounded px-3 py-1.5 outline-none focus:border-ask font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Şifre / Parola *</label>
                <input
                  type="password"
                  required
                  value={quickPassword}
                  onChange={(e) => setQuickPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-base-elevated border border-border rounded px-3 py-1.5 outline-none focus:border-ask font-mono text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowQuickCredModal(false)}
                  className="px-3 py-1.5 text-muted-foreground hover:text-white border border-border rounded"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={quickSaving}
                  className="px-4 py-1.5 bg-ask hover:bg-ask/90 text-white font-semibold rounded disabled:opacity-50"
                >
                  {quickSaving ? "Kaydediliyor..." : "Kaydet ve Seç"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

