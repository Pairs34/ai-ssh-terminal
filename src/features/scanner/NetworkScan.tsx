import { useEffect, useState } from "react";
import type { ScanProgress, ScanResultItem } from "@/types/ipc";
import { Play, Square, PlusCircle } from "lucide-react";

const DEFAULT_PORTS = [22, 23, 80, 443, 161];

export function NetworkScan() {
  const [interfaces, setInterfaces] = useState<{ name: string; address: string; cidr: string }[]>([]);
  const [cidr, setCidr] = useState("");
  const [scanId, setScanId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [results, setResults] = useState<ScanResultItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    window.electronAPI.scan.interfaces().then((list) => {
      setInterfaces(list);
      if (list[0]) setCidr(list[0].cidr);
    });
  }, []);

  useEffect(() => {
    const offProgress = window.electronAPI.scan.onProgress((sid, p) => {
      if (sid === scanId) setProgress(p);
    });
    const offResult = window.electronAPI.scan.onResult((sid, item) => {
      if (sid === scanId) setResults((prev) => [...prev, item]);
    });
    const offDone = window.electronAPI.scan.onDone((sid) => {
      if (sid === scanId) setProgress((p) => (p ? { ...p, completed: p.total } : p));
    });
    return () => {
      offProgress();
      offResult();
      offDone();
    };
  }, [scanId]);

  const startScan = async () => {
    setResults([]);
    setSelected(new Set());
    const { scanId: id } = await window.electronAPI.scan.start(cidr, DEFAULT_PORTS, 50, 1500);
    setScanId(id);
  };

  const stopScan = async () => {
    if (scanId) await window.electronAPI.scan.stop(scanId);
  };

  const toggleSelect = (ip: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ip)) next.delete(ip);
      else next.add(ip);
      return next;
    });
  };

  const addSelectedToInventory = async () => {
    const items = results
      .filter((r) => selected.has(r.ip) && !r.isExisting)
      .map((r) => ({
        name: r.hostname ?? r.ip,
        ipAddress: r.ip,
        sshPort: 22,
        vendor: r.vendor,
        deviceType: (r.detectedType as never) ?? "unknown"
      }));
    if (items.length === 0) return;
    await window.electronAPI.devices.bulkCreate(items);
    setSelected(new Set());
  };

  return (
    <div className="p-6 space-y-4">
      <div className="border border-border rounded-card p-4 bg-base-panel space-y-3">
        <div className="flex items-center gap-3">
          <select
            className="bg-base-elevated border border-border rounded-card px-3 py-1.5 text-sm"
            onChange={(e) => setCidr(e.target.value)}
            value={cidr}
          >
            {interfaces.map((iface) => (
              <option key={iface.name} value={iface.cidr}>
                {iface.name} — {iface.cidr}
              </option>
            ))}
          </select>
          <input
            className="bg-base-elevated border border-border rounded-card px-3 py-1.5 text-sm flex-1"
            value={cidr}
            onChange={(e) => setCidr(e.target.value)}
            placeholder="10.100.0.0/24"
          />
          {!scanId || (progress && progress.completed === progress.total) ? (
            <button
              onClick={startScan}
              className="flex items-center gap-1.5 text-sm bg-ask text-white rounded-card px-3 py-1.5"
            >
              <Play size={14} />
              Taramayı Başlat
            </button>
          ) : (
            <button
              onClick={stopScan}
              className="flex items-center gap-1.5 text-sm bg-danger text-white rounded-card px-3 py-1.5"
            >
              <Square size={14} />
              Durdur
            </button>
          )}
        </div>
        {progress && (
          <div className="text-xs text-muted-foreground">
            {progress.completed}/{progress.total} tarandı — son: {progress.current}
            <div className="h-1 bg-base-elevated rounded-full mt-1 overflow-hidden">
              <div
                className="h-full bg-ask transition-all"
                style={{ width: `${(progress.completed / Math.max(progress.total, 1)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="border border-border rounded-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-base-panel border-b border-border">
            <span className="text-sm text-muted-foreground">{results.length} cihaz bulundu</span>
            <button
              onClick={addSelectedToInventory}
              disabled={selected.size === 0}
              className="flex items-center gap-1.5 text-sm bg-success text-white rounded-card px-3 py-1.5 disabled:opacity-40"
            >
              <PlusCircle size={14} />
              Envantere Ekle ({selected.size})
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-base-panel text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2"></th>
                <th className="text-left font-medium px-4 py-2">IP</th>
                <th className="text-left font-medium px-4 py-2">Hostname</th>
                <th className="text-left font-medium px-4 py-2">MAC</th>
                <th className="text-left font-medium px-4 py-2">Vendor</th>
                <th className="text-left font-medium px-4 py-2">Tür</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.ip} className="border-t border-border hover:bg-base-panel/60">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      disabled={r.isExisting}
                      checked={selected.has(r.ip)}
                      onChange={() => toggleSelect(r.ip)}
                    />
                  </td>
                  <td className="px-4 py-2 font-medium">{r.ip}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.hostname ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.macAddress ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.vendor ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {r.detectedType ?? "unknown"} {r.isExisting && "(envanterde)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
