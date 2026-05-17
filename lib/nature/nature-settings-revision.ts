import { createHash } from "node:crypto";
import type { NatureSettingsV2 } from "./types";

/** 轻量指纹：RSC initial 与客户端刷新对齐，避免重复拉整份 settings。 */
export function natureSettingsRevision(s: NatureSettingsV2): string {
  const ids = s.videos.map((v) => v.id.trim()).filter(Boolean).join("\n");
  const amb = s.ambientClips.map((c) => c.id.trim()).filter(Boolean).join("\n");
  return createHash("sha256").update(`${ids}|${amb}|${s.videos.length}`).digest("hex").slice(0, 16);
}
