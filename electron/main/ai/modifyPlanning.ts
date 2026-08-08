export function extractLinuxPaths(value: string): string[] {
  const normalized = value.replace(/\\([/_])/g, "$1");
  const paths = [...normalized.matchAll(/(?:^|[\s('"`])((?:\/[A-Za-z0-9._@:+-]+)+)/g)]
    .map((match) => match[1])
    .filter((item) => item.startsWith("/") && item.length <= 4096);
  return [...new Set(paths)];
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function linuxPathPreflightCommands(instruction: string): string[] {
  const targetPath = extractLinuxPaths(instruction)[0];
  if (!targetPath) return [];
  const quotedPath = shellQuote(targetPath);
  return [
    `findmnt --mountpoint ${quotedPath} -o TARGET,SOURCE,FSTYPE,OPTIONS`,
    `grep -F -- ${quotedPath} /etc/fstab`,
    `stat -c '%A %a %U %G %n' ${quotedPath}`,
    `namei -l ${quotedPath}`,
    `df -hT ${quotedPath}`,
    `test -w ${quotedPath} && echo WRITABLE || echo NOT_WRITABLE`
  ];
}

export function linuxPathAgentBootstrapCommands(instruction: string): string[] {
  const targetPath = extractLinuxPaths(instruction)[0];
  if (!targetPath) return [];
  const quotedPath = shellQuote(targetPath);
  const isBackupRequest = /(?:backup|yedek|vzdump|dump|synology)/i.test(instruction);
  if (!isBackupRequest) return linuxPathPreflightCommands(instruction);

  const dumpPath = `${targetPath.replace(/\/$/, "")}/dump`;
  const quotedDumpPath = shellQuote(dumpPath);
  return [
    `findmnt -T ${quotedPath} -o TARGET,SOURCE,FSTYPE,OPTIONS`,
    `stat -c '%A %a %U %G %n' ${quotedPath}`,
    `namei -l ${quotedPath}`,
    `test -w ${quotedPath} && echo TARGET_WRITABLE || echo TARGET_NOT_WRITABLE`,
    `test -d ${quotedDumpPath} && echo DUMP_EXISTS || echo DUMP_MISSING`,
    `if test -d ${quotedDumpPath}; then stat -c '%A %a %U %G %n' ${quotedDumpPath}; namei -l ${quotedDumpPath}; test -w ${quotedDumpPath} && echo DUMP_WRITABLE || echo DUMP_NOT_WRITABLE; fi`
  ];
}
