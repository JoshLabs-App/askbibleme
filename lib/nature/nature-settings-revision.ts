import type { NatureSettingsV2 } from "./types";

/** FNV-1a 32-bit → 8 hex（非加密，仅作 settings 指纹） */
function fnv1aHex(input: string, seed: number): string {
  let h = seed;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** 轻量指纹：RSC initial 与客户端刷新对齐，避免重复拉整份 settings。 */
export function natureSettingsRevision(s: NatureSettingsV2): string {
  const ids = s.videos.map((v) => v.id.trim()).filter(Boolean).join("\n");
  const amb = s.ambientClips.map((c) => c.id.trim()).filter(Boolean).join("\n");
  const payload = `${ids}|${amb}|${s.videos.length}`;
  return fnv1aHex(payload, 0x811c9dc5) + fnv1aHex(payload, 0x050c5d1f);
}
