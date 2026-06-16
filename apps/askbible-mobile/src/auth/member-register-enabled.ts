import { InteractionManager } from "react-native";

type BuildFlag = "force-on" | "force-off" | "default";

function readBuildFlag(): BuildFlag {
  const flag = process.env.EXPO_PUBLIC_MEMBER_REGISTER_ENABLED?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return "force-off";
  if (flag === "1" || flag === "true" || flag === "on") return "force-on";
  return "default";
}

function buildTimeForceOn(): boolean {
  return readBuildFlag() === "force-on";
}

function buildTimeForceOff(): boolean {
  return readBuildFlag() === "force-off";
}

/** 默认开放；仅 env 显式 `0` 或远端 manifest 关闭时才隐藏。 */
let runtimeEnabled = !buildTimeForceOff();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function getMemberRegisterEnabled(): boolean {
  if (buildTimeForceOff()) return false;
  if (buildTimeForceOn()) return true;
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
  if (buildTimeForceOff()) {
    runtimeEnabled = false;
  } else if (buildTimeForceOn() || value) {
    runtimeEnabled = true;
  }
  // 远端 manifest 返回 false 时暂不把默认开放的入口关掉（线上 manifest 待服务端修复后再同步）
  notify();
}

export async function hydrateMemberRegisterEnabled(): Promise<boolean> {
  if (buildTimeForceOff()) {
    runtimeEnabled = false;
  } else if (buildTimeForceOn()) {
    runtimeEnabled = true;
  }
  notify();
  return getMemberRegisterEnabled();
}

/** 启动不阻塞：交互完成后再拉 manifest 同步开关（与离线优先/纯本地包无关）。 */
export function scheduleMemberRegisterEnabledRemoteHydrate(): void {
  if (buildTimeForceOff()) return;
  if (buildTimeForceOn()) {
    runtimeEnabled = true;
    notify();
    return;
  }
  InteractionManager.runAfterInteractions(() => {
    void (async () => {
      try {
        const { fetchMobileContentManifest } = await import("../api/mobileContentManifest");
        const manifest = await fetchMobileContentManifest();
        applyMemberRegisterEnabledFromServer(Boolean(manifest.serverCapabilities?.memberRegisterEnabled));
      } catch {
        // 保持默认开放
      }
    })();
  });
}
