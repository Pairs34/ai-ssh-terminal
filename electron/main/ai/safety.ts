import type { ExecutionMode, RiskLevel } from "./commandKnowledge";

type ChangeImpact = "none" | "change" | "high_impact" | "blocked";

interface ChangeAnalysis {
  impact: ChangeImpact;
  reason?: string;
}

export type CommandAccessPolicy =
  | { kind: "auto_execute"; riskLevel: RiskLevel }
  | { kind: "approval_required"; riskLevel: RiskLevel; reason: string; elevated: boolean }
  | { kind: "blocked"; riskLevel: "critical"; reason: string };

const MUTATING_EXECUTABLES = new Set([
  "rm", "mv", "cp", "touch", "mkdir", "rmdir", "truncate", "chmod", "chown", "chgrp", "install", "unlink", "ln", "tee",
  "mkfs", "fdisk", "parted", "wipefs", "mount", "umount", "swapon", "swapoff", "kill", "pkill", "killall",
  "useradd", "userdel", "usermod", "groupadd", "groupdel", "groupmod", "passwd", "chpasswd",
  "iptables", "ip6tables", "nft", "firewall-cmd", "ufw", "sysctl",
  "configure", "config", "set", "unset", "no", "write", "copy", "delete", "clear"
]);

const HIGH_IMPACT_EXECUTABLES = new Set([
  "reboot", "reload", "shutdown", "halt", "poweroff", "factory-reset", "factoryreset", "format", "erase", "reset"
]);

const PACKAGE_MANAGERS = new Set(["apt", "apt-get", "dnf", "yum", "zypper", "pacman", "apk", "snap", "flatpak"]);
const PACKAGE_READ_ACTIONS = new Set(["list", "search", "show", "info", "check", "check-update", "policy", "depends", "rdepends"]);
const SYSTEMCTL_CHANGE_ACTIONS = new Set([
  "start", "stop", "restart", "reload", "try-restart", "reload-or-restart", "enable", "disable", "reenable", "preset",
  "mask", "unmask", "link", "revert", "edit", "set-property", "daemon-reload", "kill", "reset-failed", "isolate"
]);
const SYSTEMCTL_HIGH_IMPACT_ACTIONS = new Set(["reboot", "poweroff", "halt", "kexec", "suspend", "hibernate", "hybrid-sleep"]);
const SERVICE_CHANGE_ACTIONS = new Set(["start", "stop", "restart", "reload", "force-reload", "enable", "disable"]);
const IP_CHANGE_ACTIONS = new Set(["add", "append", "change", "delete", "del", "flush", "replace", "set"]);
const CONTAINER_CHANGE_ACTIONS = new Set([
  "run", "create", "start", "stop", "restart", "rm", "kill", "pause", "unpause", "update", "rename", "commit", "build", "pull", "push", "login", "logout", "network", "volume", "exec"
]);
const GIT_READ_ACTIONS = new Set(["status", "log", "diff", "show", "blame", "grep", "describe", "rev-parse", "ls-files", "ls-tree", "remote"]);
const RESTIC_READ_ACTIONS = new Set(["snapshots", "stats", "check", "list", "ls", "find", "cat", "version"]);
const BORG_READ_ACTIONS = new Set(["list", "info", "check", "diff", "version"]);
const RCLONE_READ_ACTIONS = new Set(["ls", "lsd", "lsl", "lsf", "tree", "size", "about", "check", "version"]);

function maxImpact(left: ChangeImpact, right: ChangeImpact): ChangeImpact {
  const order: ChangeImpact[] = ["none", "change", "high_impact", "blocked"];
  return order.indexOf(left) >= order.indexOf(right) ? left : right;
}

function splitShellSegments(command: string): string[] {
  const segments: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      current += character;
      escaped = true;
      continue;
    }
    if (quote) {
      current += character;
      if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      current += character;
      continue;
    }
    if (character === ";" || character === "\n" || character === "|" || character === "&") {
      if (current.trim()) segments.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim()) segments.push(current.trim());
  return segments;
}

function shellTokens(segment: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;
  const flush = () => {
    if (current) tokens.push(current);
    current = "";
  };
  for (const character of segment.trim()) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === "\\" && quote !== "'") {
      escaped = true;
    } else if (quote) {
      if (character === quote) quote = null;
      else current += character;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (/\s/.test(character)) {
      flush();
    } else {
      current += character;
    }
  }
  flush();
  return tokens;
}

function unwrapCommand(tokens: string[]): { executable: string; args: string[] } {
  let remaining = [...tokens];
  while (remaining[0] && /^[A-Za-z_][A-Za-z0-9_]*=/.test(remaining[0])) remaining.shift();
  if (remaining[0] === "env") {
    remaining.shift();
    while (remaining[0] && (remaining[0].startsWith("-") || /^[A-Za-z_][A-Za-z0-9_]*=/.test(remaining[0]))) remaining.shift();
  }
  if (remaining[0] === "sudo") {
    remaining.shift();
    const optionsWithValue = new Set(["-u", "-g", "-h", "-p", "-C", "-T", "-R", "-D"]);
    while (remaining[0]?.startsWith("-")) {
      const option = remaining.shift()!;
      if (optionsWithValue.has(option)) remaining.shift();
    }
  }
  if (["command", "nohup"].includes(remaining[0])) remaining.shift();
  if (remaining[0] === "timeout") {
    remaining.shift();
    while (remaining[0]?.startsWith("-")) remaining.shift();
    remaining.shift();
  }
  if (remaining[0] === "nice") {
    remaining.shift();
    while (remaining[0]?.startsWith("-")) remaining.shift();
  }
  const rawExecutable = remaining.shift() || "";
  return { executable: rawExecutable.replace(/.*[\\/]/, "").toLowerCase(), args: remaining };
}

function hasPersistentOutputRedirection(command: string): boolean {
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character !== ">") continue;
    let cursor = index + (command[index + 1] === ">" ? 2 : 1);
    while (/\s/.test(command[cursor] || "")) cursor += 1;
    const target = command.slice(cursor).match(/^[^\s;&|]+/)?.[0] || "";
    if (/^&\d+$/.test(target) || target === "/dev/null") continue;
    return true;
  }
  return false;
}

function analyzeSegment(segment: string): ChangeAnalysis {
  const tokens = shellTokens(segment);
  const { executable, args } = unwrapCommand(tokens);
  const normalizedArgs = args.map((item) => item.toLowerCase());
  const firstAction = normalizedArgs.find((item) => !item.startsWith("-")) || "";
  if (!executable) return { impact: "none" };

  if (executable === "rm" && normalizedArgs.some((arg) => arg.includes("r")) && normalizedArgs.includes("/")) {
    return { impact: "blocked", reason: "Kök dosya sistemini özyinelemeli silme komutu hiçbir modda çalıştırılamaz." };
  }
  if (executable === "wipefs" || executable === "mkfs" || executable.startsWith("mkfs.")) return { impact: "blocked", reason: `${executable} komutu hiçbir modda çalıştırılamaz.` };
  if (executable === "dd" && normalizedArgs.some((arg) => /^of=\/dev\//.test(arg))) {
    return { impact: "blocked", reason: "Blok aygıtına doğrudan yazan dd komutu hiçbir modda çalıştırılamaz." };
  }
  if (["fsck", "e2fsck", "fsck.ext2", "fsck.ext3", "fsck.ext4", "xfs_repair"].includes(executable)) {
    const readOnlyCheck = normalizedArgs.some((arg) => arg === "-n" || arg === "--no-modify");
    return readOnlyCheck
      ? { impact: "none" }
      : { impact: "high_impact", reason: `${executable} dosya sistemi üzerinde onarım/değişiklik yapabilir.` };
  }
  if (executable === "btrfs" && normalizedArgs.includes("check") && normalizedArgs.includes("--repair")) {
    return { impact: "blocked", reason: "btrfs check --repair otomatik veya onaylı uzaktan çalıştırmaya uygun değildir." };
  }
  if (["tune2fs", "xfs_admin"].includes(executable)) {
    return { impact: "high_impact", reason: `${executable} dosya sistemi metadata bilgisini değiştirebilir.` };
  }
  if (HIGH_IMPACT_EXECUTABLES.has(executable)) return { impact: "high_impact", reason: `${executable} yüksek etkili sistem işlemidir.` };
  if (executable === "write" && normalizedArgs.includes("erase")) return { impact: "high_impact", reason: "write erase başlangıç yapılandırmasını siler." };
  if (executable === "delete" && normalizedArgs.some((arg) => /startup-config|startup_config/.test(arg))) return { impact: "high_impact", reason: "Başlangıç yapılandırmasını silme işlemi yüksek etkilidir." };
  if (executable === "systemctl") {
    if (normalizedArgs.some((arg) => SYSTEMCTL_HIGH_IMPACT_ACTIONS.has(arg))) return { impact: "high_impact", reason: "systemctl güç/oturum işlemi yüksek etkilidir." };
    if (normalizedArgs.some((arg) => SYSTEMCTL_CHANGE_ACTIONS.has(arg))) return { impact: "change", reason: "systemctl servis veya sistem durumunu değiştirir." };
    return { impact: "none" };
  }
  if (executable === "service") return normalizedArgs.some((arg) => SERVICE_CHANGE_ACTIONS.has(arg))
    ? { impact: "change", reason: "service komutu servis durumunu değiştirir." } : { impact: "none" };
  if (executable === "journalctl") return normalizedArgs.some((arg) => /^(?:--vacuum|--rotate|--flush|--sync|--relinquish-var)/.test(arg))
    ? { impact: "change", reason: "journalctl bakım seçeneği günlük durumunu değiştirir." } : { impact: "none" };
  if (executable === "dmesg") return normalizedArgs.some((arg) => arg === "-c" || arg === "--clear")
    ? { impact: "change", reason: "dmesg clear çekirdek günlüğünü temizler." } : { impact: "none" };
  if (executable === "ip") return normalizedArgs.some((arg) => IP_CHANGE_ACTIONS.has(arg))
    ? { impact: "change", reason: "ip komutu ağ durumunu değiştirir." } : { impact: "none" };
  if (["docker", "podman"].includes(executable)) {
    const composeChange = normalizedArgs.includes("compose") && normalizedArgs.some((arg) => ["up", "down", "create", "start", "stop", "restart", "rm", "kill", "pause", "unpause", "build", "pull", "push"].includes(arg));
    return CONTAINER_CHANGE_ACTIONS.has(firstAction) || composeChange
      ? { impact: "change", reason: `${executable} container durumunu değiştirebilir.` } : { impact: "none" };
  }
  if (PACKAGE_MANAGERS.has(executable)) return PACKAGE_READ_ACTIONS.has(firstAction)
    ? { impact: "none" } : { impact: "change", reason: `${executable} paket durumunu değiştirebilir.` };
  if (executable === "git") return GIT_READ_ACTIONS.has(firstAction)
    ? { impact: "none" } : { impact: "change", reason: `git ${firstAction || "işlemi"} çalışma alanını veya uzak depoyu değiştirebilir.` };
  if (executable === "crontab") return normalizedArgs.includes("-l")
    ? { impact: "none" } : { impact: "change", reason: "crontab zamanlanmış görevleri değiştirebilir." };
  if (["sed", "perl"].includes(executable) && normalizedArgs.some((arg) => /^-.*i/.test(arg))) {
    return { impact: "change", reason: `${executable} yerinde düzenleme seçeneği dosyayı değiştirir.` };
  }
  if (executable === "find" && normalizedArgs.some((arg) => ["-delete", "-exec", "-execdir", "-ok", "-okdir"].includes(arg))) {
    if (normalizedArgs.includes("-delete")) return { impact: "change", reason: "find -delete dosya sistemini değiştirir." };
    const executeIndex = normalizedArgs.findIndex((arg) => ["-exec", "-execdir", "-ok", "-okdir"].includes(arg));
    const nested = analyzeCommandChange(args.slice(executeIndex + 1).join(" "), 1);
    return nested.impact === "none" ? nested : { ...nested, reason: `find alt komutu: ${nested.reason}` };
  }
  if (["bash", "sh", "zsh", "fish"].includes(executable)) {
    const commandIndex = normalizedArgs.findIndex((arg) => arg === "-c");
    if (commandIndex >= 0 && args[commandIndex + 1]) return analyzeCommandChange(args[commandIndex + 1], 1);
    return { impact: "change", reason: "İçeriği belirtilmeyen shell çalıştırması durum değiştirebilir." };
  }
  if (["eval", "source", "."].includes(executable)) return { impact: "change", reason: `${executable} başka komutlar çalıştırabilir.` };
  if (executable === "xargs") {
    const nestedStart = args.findIndex((arg) => !arg.startsWith("-"));
    if (nestedStart < 0) return { impact: "change", reason: "xargs alt komutu belirlenemedi." };
    return analyzeCommandChange(args.slice(nestedStart).join(" "), 1);
  }
  if (executable === "awk" && normalizedArgs.some((arg) => /\bsystem\s*\(/.test(arg))) return { impact: "change", reason: "awk system() başka komut çalıştırabilir." };
  if (executable === "curl" && normalizedArgs.some((arg) => ["-o", "--output", "-t", "--upload-file", "-d", "--data", "--data-raw", "--data-binary"].includes(arg) || /^(?:post|put|patch|delete)$/.test(arg) || /^-(?:x)?(?:post|put|patch|delete)$/.test(arg) || /^--request=(?:post|put|patch|delete)$/.test(arg))) {
    return { impact: "change", reason: "curl seçeneği dosya veya uzak sistem durumunu değiştirebilir." };
  }
  if (executable === "wget" && !normalizedArgs.some((arg) => arg === "-qo-" || arg === "-o-")) {
    return { impact: "change", reason: "wget varsayılan olarak dosya yazar." };
  }
  if (executable === "execute") {
    if (normalizedArgs.some((arg) => /factory-?reset|reboot|shutdown/.test(arg))) return { impact: "high_impact", reason: "Cihaz reset/reboot işlemi yüksek etkilidir." };
    if (!["log", "ping", "traceroute"].includes(firstAction)) return { impact: "change", reason: "execute komutunun durum değiştirmediği doğrulanamadı." };
  }
  if (executable === "diagnose" && normalizedArgs.some((arg) => arg === "debug" || arg === "kill")) {
    return { impact: "change", reason: "diagnose debug/kill cihaz durumunu değiştirebilir." };
  }
  if (executable === "restic") {
    const mutation = normalizedArgs.find((arg) => ["backup", "forget", "prune", "restore", "copy", "init", "key", "unlock", "tag", "recover", "repair", "rewrite"].includes(arg));
    if (mutation || (!RESTIC_READ_ACTIONS.has(firstAction) && !normalizedArgs.some((arg) => RESTIC_READ_ACTIONS.has(arg)))) return { impact: "change", reason: `restic ${mutation || firstAction || "işlemi"} yedek deposunu değiştirebilir.` };
  }
  if (executable === "borg") {
    const mutation = normalizedArgs.find((arg) => ["create", "delete", "prune", "compact", "extract", "recreate", "mount", "umount", "key", "break-lock", "transfer", "rename"].includes(arg));
    if (mutation || (!BORG_READ_ACTIONS.has(firstAction) && !normalizedArgs.some((arg) => BORG_READ_ACTIONS.has(arg)))) return { impact: "change", reason: `borg ${mutation || firstAction || "işlemi"} yedek deposunu değiştirebilir.` };
  }
  if (executable === "rclone") {
    const mutation = normalizedArgs.find((arg) => ["copy", "copyto", "sync", "move", "moveto", "delete", "deletefile", "purge", "mkdir", "rmdir", "mount", "serve", "cleanup", "dedupe"].includes(arg));
    if (mutation || (!RCLONE_READ_ACTIONS.has(firstAction) && !normalizedArgs.some((arg) => RCLONE_READ_ACTIONS.has(arg)))) return { impact: "change", reason: `rclone ${mutation || firstAction || "işlemi"} uzak veriyi değiştirebilir.` };
  }
  if (executable === "vzdump") return { impact: "change", reason: "vzdump yeni bir yedek oluşturur." };
  if (MUTATING_EXECUTABLES.has(executable)) return { impact: "change", reason: `${executable} durum değiştirebilen bir komuttur.` };
  return { impact: "none" };
}

function analyzeCommandChange(command: string, depth = 0): ChangeAnalysis {
  if (depth > 3) return { impact: "change", reason: "İç içe komut yapısı güvenli biçimde çözümlenemedi." };
  if (/\0/.test(command)) return { impact: "blocked", reason: "Komutta NUL karakteri bulundu." };
  if (/\:\(\)\s*\{[\s\S]*\}\s*;\s*\:/.test(command)) return { impact: "blocked", reason: "Fork bomb kalıbı hiçbir modda çalıştırılamaz." };
  if (hasPersistentOutputRedirection(command)) return { impact: "change", reason: "Dosyaya çıktı yönlendirmesi sistem durumunu değiştirir." };

  let result: ChangeAnalysis = { impact: "none" };
  const nestedCommands = [
    ...[...command.matchAll(/\$\(([^()]*)\)/g)].map((match) => match[1]),
    ...[...command.matchAll(/`([^`]*)`/g)].map((match) => match[1])
  ];
  for (const nested of nestedCommands) {
    const nestedResult = analyzeCommandChange(nested, depth + 1);
    if (maxImpact(result.impact, nestedResult.impact) !== result.impact) result = nestedResult;
  }
  for (const segment of splitShellSegments(command)) {
    const segmentResult = analyzeSegment(segment);
    if (maxImpact(result.impact, segmentResult.impact) !== result.impact) result = segmentResult;
  }
  return result;
}

export function requiresExplicitApproval(mode: ExecutionMode): boolean {
  return mode === "modify";
}

export function requiresElevatedApproval(command: string): boolean {
  return analyzeCommandChange(command).impact === "high_impact";
}

export function classifyCommandAccess(command: string): CommandAccessPolicy {
  if (!command.trim()) return { kind: "blocked", riskLevel: "critical", reason: "Boş komut çalıştırılamaz." };
  const analysis = analyzeCommandChange(command);
  if (analysis.impact === "blocked") {
    return { kind: "blocked", riskLevel: "critical", reason: analysis.reason || "Komut hiçbir koşulda güvenli değil." };
  }
  if (analysis.impact === "none") return { kind: "auto_execute", riskLevel: "safe" };
  return {
    kind: "approval_required",
    riskLevel: analysis.impact === "high_impact" ? "critical" : "high",
    reason: analysis.reason || "Komut sistem durumunu değiştirebilir.",
    elevated: analysis.impact === "high_impact"
  };
}

export function isCommandSafe(command: string, mode?: ExecutionMode): { safe: boolean; reason?: string; riskLevel?: RiskLevel } {
  if (!command.trim()) return { safe: false, reason: "Boş komut çalıştırılamaz.", riskLevel: "critical" };
  const analysis = analyzeCommandChange(command);
  if (analysis.impact === "blocked") return { safe: false, reason: analysis.reason, riskLevel: "critical" };
  if (mode === "ask" && analysis.impact !== "none") {
    return { safe: false, reason: `Otomatik salt-okunur akışta durum değiştirebilen komut çalıştırılmaz: ${analysis.reason || command}`, riskLevel: analysis.impact === "high_impact" ? "critical" : "high" };
  }
  return { safe: true, riskLevel: classifyRisk(mode === "ask", command) };
}

export function classifyRisk(readOnly: boolean, command: string): RiskLevel {
  const analysis = analyzeCommandChange(command);
  if (analysis.impact === "blocked" || analysis.impact === "high_impact") return "critical";
  if (analysis.impact === "change") return readOnly ? "high" : "high";
  return readOnly ? "safe" : "medium";
}
