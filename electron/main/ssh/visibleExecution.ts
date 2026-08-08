export interface VisibleExecutionParseResult {
  complete: boolean;
  exitCode: number | null;
  output: string;
}

export function buildVisibleExecutionCommand(command: string, marker: string): string {
  const singleLineCommand = command.replace(/\r?\n/g, "; ").trim();
  return `( ${singleLineCommand} ); __ai_ssh_exit=$?; printf '\\n${marker}:%s\\n' "$__ai_ssh_exit"`;
}

export function parseVisibleExecutionOutput(output: string, marker: string): VisibleExecutionParseResult {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escapedMarker}:(-?\\d+)\\r?\\n`).exec(output);
  if (!match || match.index === undefined) {
    return { complete: false, exitCode: null, output };
  }

  return {
    complete: true,
    exitCode: Number.parseInt(match[1], 10),
    output: `${output.slice(0, match.index)}${output.slice(match.index + match[0].length)}`.trim()
  };
}
