import net from "node:net";
import dns from "node:dns/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { EventEmitter } from "node:events";
import { guessVendorFromMac } from "./oui";

const execAsync = promisify(exec);

export interface ScanTarget {
  ip: string;
}

export interface ScanResultItem {
  ip: string;
  online: boolean;
  hostname: string | null;
  macAddress: string | null;
  vendor: string | null;
  openPorts: number[];
  detectedType: string | null;
}

function expandCidr(cidr: string): string[] {
  const [base, prefixStr] = cidr.split("/");
  const prefix = Number(prefixStr ?? 24);
  const parts = base.split(".").map(Number);
  const baseInt = (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  const hostBits = 32 - prefix;
  const count = Math.pow(2, hostBits);
  const ips: string[] = [];
  for (let i = 1; i < count - 1 && i < 4096; i++) {
    const ipInt = baseInt + i;
    const ip = [
      (ipInt >>> 24) & 255,
      (ipInt >>> 16) & 255,
      (ipInt >>> 8) & 255,
      ipInt & 255
    ].join(".");
    ips.push(ip);
  }
  return ips;
}

function checkPort(ip: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (result: boolean) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, ip);
  });
}

async function resolveHostname(ip: string): Promise<string | null> {
  try {
    const names = await dns.reverse(ip);
    return names[0] ?? null;
  } catch {
    return null;
  }
}

async function lookupMacFromArp(ip: string): Promise<string | null> {
  try {
    const cmd = process.platform === "win32" ? `arp -a ${ip}` : `arp -n ${ip}`;
    const { stdout } = await execAsync(cmd);
    const match = stdout.match(/([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}/);
    return match ? match[0].replace(/-/g, ":").toUpperCase() : null;
  } catch {
    return null;
  }
}

function guessDeviceType(openPorts: number[]): string | null {
  if (openPorts.includes(161)) return "switch";
  if (openPorts.includes(443) && openPorts.includes(22) && !openPorts.includes(80)) return "firewall";
  if (openPorts.includes(22) && openPorts.length === 1) return "linux_server";
  if (openPorts.includes(3389)) return "windows_server";
  return null;
}

class NetworkScanner extends EventEmitter {
  private stopped = new Set<string>();

  async listLocalInterfaces() {
    const os = await import("node:os");
    const interfaces = os.networkInterfaces();
    const result: { name: string; address: string; cidr: string }[] = [];
    for (const [name, addrs] of Object.entries(interfaces)) {
      for (const addr of addrs ?? []) {
        if (addr.family === "IPv4" && !addr.internal) {
          result.push({ name, address: addr.address, cidr: addr.cidr ?? `${addr.address}/24` });
        }
      }
    }
    return result;
  }

  async scan(scanId: string, cidr: string, ports: number[], concurrency: number, timeoutMs: number) {
    const ips = expandCidr(cidr);
    let cursor = 0;
    let completed = 0;

    const worker = async () => {
      while (cursor < ips.length) {
        if (this.stopped.has(scanId)) return;
        const ip = ips[cursor++];

        const portChecks = await Promise.all(ports.map((p) => checkPort(ip, p, timeoutMs)));
        const openPorts = ports.filter((_, idx) => portChecks[idx]);
        const online = openPorts.length > 0;

        let hostname: string | null = null;
        let mac: string | null = null;
        if (online) {
          [hostname, mac] = await Promise.all([resolveHostname(ip), lookupMacFromArp(ip)]);
        }

        const item: ScanResultItem = {
          ip,
          online,
          hostname,
          macAddress: mac,
          vendor: guessVendorFromMac(mac),
          openPorts,
          detectedType: online ? guessDeviceType(openPorts) : null
        };

        completed++;
        this.emit("progress", scanId, { completed, total: ips.length, current: ip });
        if (online) this.emit("result", scanId, item);
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, ips.length) }, () => worker());
    await Promise.all(workers);
    this.stopped.delete(scanId);
    this.emit("done", scanId);
  }

  stop(scanId: string) {
    this.stopped.add(scanId);
  }
}

export const networkScanner = new NetworkScanner();
