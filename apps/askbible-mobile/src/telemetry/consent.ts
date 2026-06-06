/**
 * 移动端已停用客户端采集。同意状态始终返回 denied / 未授权。
 */

export type TelemetryConsent = "unknown" | "granted" | "denied";

export function getTelemetryConsent(): TelemetryConsent {
  return "denied";
}

export function isTelemetryConsentGranted(): boolean {
  return false;
}

export async function hydrateTelemetryConsent(): Promise<TelemetryConsent> {
  return "denied";
}

export async function setTelemetryConsent(
  _next: Exclude<TelemetryConsent, "unknown">,
): Promise<void> {}

export function subscribeTelemetryConsent(listener: () => void): () => void {
  return () => {};
}
