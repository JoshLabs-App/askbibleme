// TS 侧期望值：槽位与增益直接 import RN 的纯模块；文件名表所在的 ambientSceneAudioSource.ts 顶层拉了 expo 缓存，
// tsx 装不进来，这里按源码正则抽 AMBIENT_SCENE_AUDIO_FILES（表变了这里跟着变，不另抄一份）。
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as slotsNs from "../apps/askbible-mobile/src/nature/ambientSceneSlots";
import * as gainNs from "../apps/askbible-mobile/src/nature/ambientScenePlaybackGain";
const unwrap = (ns: any) => (ns && ns.default && typeof ns.default === "object" ? { ...ns.default, ...ns } : ns);
const slots: any = unwrap(slotsNs);
const gain: any = unwrap(gainNs);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(path.join(ROOT, "apps/askbible-mobile/src/nature/ambientSceneAudioSource.ts"), "utf8");
const files: Record<string, string> = {};
for (const m of src.matchAll(/"(scene-[a-z-]+)":\s*"([^"]+\.mp3)"/g)) files[m[1]] = m[2];
const base = src.match(/R2_PUBLIC_BASE = "([^"]+)"/)?.[1] ?? "";
const defaults: Record<string, string> = slots.NATURE_SCENE_DEFAULT_AMBIENT;
// 首页照片「晨光」对应的默认环境音
const morning = defaults["d86754f9-2c16-4896-a00f-31a29858b547"];
const out = {
  slots: slots.NATURE_AMBIENT_SCENE_SLOTS.map((s: any) => ({
    id: s.id, label: s.label, labelEn: s.labelEn, file: files[s.id] ?? null,
    gain: gain.ambientScenePlaybackGain(s.id), url: files[s.id] ? `${base}/audio/scenes/${files[s.id]}` : null,
  })),
  defaultSlotId: morning,
};
process.stdout.write(JSON.stringify(out));
