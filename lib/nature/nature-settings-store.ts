import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  NatureAmbientClipEntry,
  NatureSettingsV2,
  NatureVideoEntry,
  NatureVideoMixLayer,
} from "./types";

const DATA_FILE = "nature-settings.json";
const MAX_VIDEOS = 24;
const MAX_AMBIENT_CLIPS = 48;
const MAX_MIX_LAYERS_PER_VIDEO = 48;
const MAX_SRC_LEN = 2000;
const MAX_TITLE_LEN = 200;
const MAX_JSON_BYTES = 512_000;

function clampRate(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(4, Math.max(0.25, n));
}

function clampVolume(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

export function defaultNatureSettingsV2(): NatureSettingsV2 {
  return {
    version: 2,
    videos: [],
    ambientClips: [],
    activeVideoId: "",
    playbackRate: 1,
  };
}

function collectAmbientClipEntries(raw: unknown): NatureAmbientClipEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: NatureAmbientClipEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const src = typeof o.src === "string" ? o.src.trim() : "";
    if (!id || !src || id.length > 128 || src.length > MAX_SRC_LEN) continue;
    const titleRaw = typeof o.title === "string" ? o.title.trim() : "";
    const title = titleRaw && titleRaw.length <= MAX_TITLE_LEN ? titleRaw : undefined;
    out.push({ id, src, ...(title ? { title } : {}) });
  }
  return out;
}

function collectMixLayers(
  raw: unknown,
  validClipIds: Set<string>,
  mode: "loose" | "strict",
): NatureVideoMixLayer[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: NatureVideoMixLayer[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const clipId = typeof o.clipId === "string" ? o.clipId.trim() : "";
    const volume = clampVolume(typeof o.volume === "number" ? o.volume : 1);
    if (!id || !clipId || id.length > 128 || clipId.length > 128) continue;
    if (!validClipIds.has(clipId)) {
      if (mode === "strict") throw err(`混音层引用了不存在的素材 id：${clipId}`);
      continue;
    }
    out.push({ id, clipId, volume });
    if (out.length >= MAX_MIX_LAYERS_PER_VIDEO) break;
  }
  return out.length ? out : undefined;
}

function collectVideoEntries(
  raw: unknown,
  validClipIds: Set<string>,
  mode: "loose" | "strict",
): NatureVideoEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: NatureVideoEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const src = typeof o.src === "string" ? o.src.trim() : "";
    if (!id || !src || id.length > 128 || src.length > MAX_SRC_LEN) continue;
    const titleRaw = typeof o.title === "string" ? o.title.trim() : "";
    const title = titleRaw && titleRaw.length <= MAX_TITLE_LEN ? titleRaw : undefined;
    const thumbRaw = typeof o.thumbSrc === "string" ? o.thumbSrc.trim() : "";
    const thumbSrc =
      thumbRaw.startsWith("/nature/thumbs/") && thumbRaw.length <= MAX_SRC_LEN ? thumbRaw : undefined;
    const mix = collectMixLayers(o.mix, validClipIds, mode);
    out.push({
      id,
      src,
      ...(title ? { title } : {}),
      ...(thumbSrc ? { thumbSrc } : {}),
      ...(mix ? { mix } : {}),
    });
  }
  return out;
}

function migrateFromV1(o: Record<string, unknown>): NatureSettingsV2 {
  const videoSrc = typeof o.videoSrc === "string" ? o.videoSrc.trim() : "";
  const posterSrc =
    typeof o.posterSrc === "string" && o.posterSrc.trim() ? o.posterSrc.trim() : undefined;
  const playbackRate =
    typeof o.playbackRate === "number" && Number.isFinite(o.playbackRate)
      ? clampRate(o.playbackRate)
      : 1;
  if (!videoSrc) {
    return {
      version: 2,
      videos: [],
      ambientClips: [],
      activeVideoId: "",
      playbackRate,
      ...(posterSrc ? { posterSrc } : {}),
    };
  }
  const id = `v1-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  return {
    version: 2,
    videos: [{ id, src: videoSrc, title: "（自旧版迁移）" }],
    ambientClips: [],
    activeVideoId: id,
    playbackRate,
    ...(posterSrc ? { posterSrc } : {}),
  };
}

function normalizeV2(o: Record<string, unknown>): NatureSettingsV2 {
  const ambientClips = collectAmbientClipEntries(o.ambientClips).slice(0, MAX_AMBIENT_CLIPS);
  const clipIds = new Set(ambientClips.map((c) => c.id));
  const videos = collectVideoEntries(o.videos, clipIds, "loose").slice(0, MAX_VIDEOS);
  let activeVideoId = typeof o.activeVideoId === "string" ? o.activeVideoId.trim() : "";
  if (activeVideoId && !videos.some((v) => v.id === activeVideoId)) {
    activeVideoId = "";
  }
  if (!activeVideoId && videos.length > 0) {
    activeVideoId = videos[0]?.id ?? "";
  }
  const playbackRate =
    typeof o.playbackRate === "number" && Number.isFinite(o.playbackRate)
      ? clampRate(o.playbackRate)
      : 1;
  const posterSrc =
    typeof o.posterSrc === "string" && o.posterSrc.trim()
      ? o.posterSrc.trim().slice(0, MAX_SRC_LEN)
      : undefined;
  return {
    version: 2,
    videos,
    ambientClips,
    activeVideoId,
    playbackRate,
    ...(posterSrc ? { posterSrc } : {}),
  };
}

/** 解析磁盘或请求体；任意非法形态回退默认 v2 */
export function parseRawNatureSettings(raw: unknown): NatureSettingsV2 {
  if (!raw || typeof raw !== "object") return defaultNatureSettingsV2();
  const o = raw as Record<string, unknown>;
  if (o.version === 2) return normalizeV2(o);
  if (o.version === 1) return migrateFromV1(o);
  return defaultNatureSettingsV2();
}

function err(msg: string): Error {
  return new Error(msg);
}

/** 写入前校验（后台 POST）；抛出带中文说明的 Error */
export function assertValidNatureSettingsForWrite(raw: unknown): NatureSettingsV2 {
  if (!raw || typeof raw !== "object") throw err("请求体须为 JSON 对象");
  const o = raw as Record<string, unknown>;
  if (o.version !== 2) throw err("仅支持 version: 2");
  if (!Array.isArray(o.videos)) throw err("videos 须为数组");
  if (!Array.isArray(o.ambientClips)) throw err("ambientClips 须为数组");
  const ambientClips = collectAmbientClipEntries(o.ambientClips);
  if (ambientClips.length > MAX_AMBIENT_CLIPS) {
    throw err(`环境声素材过多（上限 ${MAX_AMBIENT_CLIPS}）`);
  }
  const clipIds = new Set(ambientClips.map((c) => c.id));
  let videos: NatureVideoEntry[];
  try {
    videos = collectVideoEntries(o.videos, clipIds, "strict");
  } catch (e) {
    if (e instanceof Error) throw e;
    throw err("视频或混音数据无效");
  }
  if (videos.length > MAX_VIDEOS) throw err(`视频条目过多（上限 ${MAX_VIDEOS}）`);
  let activeVideoId = typeof o.activeVideoId === "string" ? o.activeVideoId.trim() : "";
  if (activeVideoId && !videos.some((v) => v.id === activeVideoId)) {
    activeVideoId = videos[0]?.id ?? "";
  }
  if (!activeVideoId && videos.length > 0) activeVideoId = videos[0]?.id ?? "";
  const playbackRate =
    typeof o.playbackRate === "number" && Number.isFinite(o.playbackRate)
      ? clampRate(o.playbackRate)
      : 1;
  const posterSrc =
    typeof o.posterSrc === "string" && o.posterSrc.trim()
      ? o.posterSrc.trim().slice(0, MAX_SRC_LEN)
      : undefined;
  return {
    version: 2,
    videos,
    ambientClips,
    activeVideoId,
    playbackRate,
    ...(posterSrc ? { posterSrc } : {}),
  };
}

export async function readNatureSettings(cwd: string): Promise<NatureSettingsV2> {
  const target = path.resolve(cwd, "data", DATA_FILE);
  try {
    const rawText = await fs.readFile(target, "utf-8");
    if (rawText.length > MAX_JSON_BYTES) return defaultNatureSettingsV2();
    const parsed = JSON.parse(rawText) as unknown;
    return parseRawNatureSettings(parsed);
  } catch {
    const next = defaultNatureSettingsV2();
    try {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, JSON.stringify(next, null, 2), "utf-8");
    } catch {
      /* ignore */
    }
    return next;
  }
}

export async function writeNatureSettings(cwd: string, data: NatureSettingsV2): Promise<void> {
  const target = path.resolve(cwd, "data", DATA_FILE);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(data, null, 2), "utf-8");
}
