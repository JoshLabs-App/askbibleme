const START_AT = Date.now();

function formatMs(ms: number): string {
  return `${ms.toFixed(0)}ms`;
}

export function logStartupTiming(scope: string, event: string, detail?: string): void {
  if (!__DEV__) return;
  const elapsed = Date.now() - START_AT;
  const suffix = detail ? ` ${detail}` : "";
  console.log(`[StartupTiming] +${formatMs(elapsed)} ${scope}:${event}${suffix}`);
}

