export function logSwallowedError(scope: string, error: unknown): void {
  if (!__DEV__) return;
  console.warn(`[SwallowedError] ${scope}:`, error);
}
