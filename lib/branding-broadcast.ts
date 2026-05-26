/** 同源各窗口（含后台手机预览 iframe）在品牌资源变更后同步刷新。 */

export const SITE_BRANDING_BROADCAST = "selah-site-branding-v1";

export type SiteBrandingBroadcastMessage = {
  type: "branding-updated";
  /** 便于以后细分；当前仅用于调试日志 */
  reason?: "logo" | "logo-background" | "splash" | "app-icons" | "colors";
};

export function notifySiteBrandingUpdated(reason?: SiteBrandingBroadcastMessage["reason"]): void {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const bc = new BroadcastChannel(SITE_BRANDING_BROADCAST);
    bc.postMessage({ type: "branding-updated", reason } satisfies SiteBrandingBroadcastMessage);
    bc.close();
  } catch {
    /* ignore */
  }
}

export function subscribeSiteBrandingUpdated(onUpdate: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  let closed = false;
  const bc = new BroadcastChannel(SITE_BRANDING_BROADCAST);
  bc.onmessage = () => {
    if (!closed) onUpdate();
  };
  return () => {
    closed = true;
    bc.close();
  };
}
