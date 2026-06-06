import { isMobileBundledOnly, isMobileOfflineFirst } from "../config/mobileBundledOnly";

function buildTimeEnabled(): boolean {
  const flag = process.env.EXPO_PUBLIC_MEMBER_REGISTER_ENABLED?.trim();
  return flag === "1" || flag?.toLowerCase() === "true";
}

let runtimeEnabled = buildTimeEnabled();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function getMemberRegisterEnabled(): boolean {
  return runtimeEnabled;
}

/** @deprecated 兼容旧名 */
export function isMemberRegisterEnabled(): boolean {
  return getMemberRegisterEnabled();
}

export function subscribeMemberRegisterEnabled(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyMemberRegisterEnabledFromServer(value: boolean): void {
  runtimeEnabled = buildTimeEnabled() || value;
  notify();
}

export async function hydrateMemberRegisterEnabled(): Promise<boolean> {
  if (buildTimeEnabled()) {
    runtimeEnabled = true;
    notify();
    return true;
  }
  if (isMobileOfflineFirst() || isMobileBundledOnly()) {
    runtimeEnabled = false;
    notify();
    return false;
  }
  try {
    const { fetchMobileContentManifest } = await import("../api/mobileContentManifest");
    const manifest = await fetchMobileContentManifest();
    applyMemberRegisterEnabledFromServer(Boolean(manifest.serverCapabilities?.memberRegisterEnabled));
  } catch {
    // keep previous value
  }
  return runtimeEnabled;
}
