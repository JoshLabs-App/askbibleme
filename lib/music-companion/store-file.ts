import fs from "node:fs/promises";
import path from "node:path";
import type { LocalizedField } from "@/lib/i18n/localized-text";
import type {
  AudioTrack,
  BackgroundVisual,
  MusicCompanionStore,
  Scene,
} from "./types";

const DATA_FILE = "music-companion.json";
const MAX_JSON_BYTES = 2_000_000;
const MAX_TITLE = 200;
const MAX_REMARK = 500;
const MAX_SRC = 2000;
const MAX_ITEMS = 120;

const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export function defaultMusicCompanionStore(): MusicCompanionStore {
  return {
    version: 1,
    audioTracks: [
      {
        id: "track-demo",
        title: "你们要休息，要知道我是神",
        src: "",
        remark: "诗篇 46:10",
      },
    ],
    backgroundVisuals: [
      {
        id: "bg-demo",
        type: "gradient",
        cssGradient:
          "linear-gradient(165deg, #6a5846 0%, #45382E 35%, #2E261C 70%, #1a1510 100%)",
        blur: false,
      },
    ],
    scenes: [
      {
        id: "scene-default",
        title: "默认场景",
        audioTrackId: "track-demo",
        backgroundVisualId: "bg-demo",
        order: 0,
      },
    ],
    defaultSceneId: "scene-default",
  };
}

function err(msg: string): Error {
  return new Error(msg);
}

function assertId(id: string, label: string) {
  if (!ID_RE.test(id)) {
    throw err(`${label} id 非法：仅字母数字下划线连字符，长度 1–64`);
  }
}

function normRef(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function parseRequiredLocalized(raw: unknown, max: number, label: string): LocalizedField {
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) throw err(`${label} 不能为空`);
    if (t.length > max) throw err(`${label} 过长`);
    return t;
  }
  if (!raw || typeof raw !== "object") throw err(`${label} 格式错误`);
  const o = raw as Record<string, unknown>;
  const zh = typeof o["zh-CN"] === "string" ? o["zh-CN"].trim() : "";
  const enRaw = o.en;
  const en = typeof enRaw === "string" && enRaw.trim() ? enRaw.trim() : undefined;
  if (!zh) throw err(`${label} 须包含非空 zh-CN`);
  if (zh.length > max || (en && en.length > max)) throw err(`${label} 过长`);
  return en ? { "zh-CN": zh, en } : zh;
}

function parseOptionalLocalized(raw: unknown, max: number, label: string): LocalizedField | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return undefined;
    if (t.length > max) throw err(`${label} 过长`);
    return t;
  }
  if (!raw || typeof raw !== "object") throw err(`${label} 格式错误`);
  const o = raw as Record<string, unknown>;
  const zh = typeof o["zh-CN"] === "string" ? o["zh-CN"].trim() : "";
  const enRaw = o.en;
  const en = typeof enRaw === "string" && enRaw.trim() ? enRaw.trim() : undefined;
  if (!zh && !en) return undefined;
  if (!zh) throw err(`${label} 须有 zh-CN`);
  if (zh.length > max || (en && en.length > max)) throw err(`${label} 过长`);
  return en ? { "zh-CN": zh, en } : zh;
}

function assertLocalizedLen(v: LocalizedField, max: number, label: string) {
  if (typeof v === "string") {
    if (!v.trim()) throw err(`${label} 不能为空`);
    if (v.length > max) throw err(`${label} 过长`);
    return;
  }
  const zh = v["zh-CN"]?.trim() ?? "";
  if (!zh) throw err(`${label} zh-CN 不能为空`);
  if (zh.length > max || (v.en && v.en.length > max)) throw err(`${label} 过长`);
}

function validateTrack(t: AudioTrack) {
  assertId(t.id, "曲目");
  assertLocalizedLen(t.title, MAX_TITLE, "曲目 title");
  if (typeof t.src !== "string" || t.src.length > MAX_SRC) {
    throw err("曲目 src 无效或过长");
  }
  if (t.artist !== undefined) assertLocalizedLen(t.artist, MAX_TITLE, "曲目 artist");
  if (t.remark !== undefined) assertLocalizedLen(t.remark, MAX_REMARK, "曲目 remark");
}

function validateBackground(b: BackgroundVisual) {
  assertId(b.id, "背景");
  if (b.type !== "image" && b.type !== "gradient") {
    throw err("背景 type 须为 image 或 gradient");
  }
  if (b.type === "image") {
    if (!b.imageSrc || b.imageSrc.length > MAX_SRC) {
      throw err("image 类型背景须提供 imageSrc");
    }
  }
  if (b.type === "gradient") {
    if (!b.cssGradient || b.cssGradient.length > MAX_SRC) {
      throw err("gradient 类型背景须提供 cssGradient");
    }
  }
  if (b.title !== undefined) assertLocalizedLen(b.title, MAX_TITLE, "背景 title");
  if (b.credit !== undefined) assertLocalizedLen(b.credit, MAX_TITLE, "背景 credit");
}

function validateScene(s: Scene, tracks: Set<string>, backgrounds: Set<string>) {
  assertId(s.id, "场景");
  if (typeof s.order !== "number" || !Number.isFinite(s.order)) {
    throw err("场景 order 须为数字");
  }
  const check = (id: string | null, set: Set<string>, name: string) => {
    if (id === null) return;
    if (!set.has(id)) throw err(`场景 ${s.id} 引用了不存在的 ${name}: ${id}`);
  };
  check(s.audioTrackId, tracks, "曲目");
  check(s.backgroundVisualId, backgrounds, "背景");
  if (s.title !== undefined) assertLocalizedLen(s.title, MAX_TITLE, "场景 title");
}

export function parseAndValidateMusicStore(raw: unknown): MusicCompanionStore {
  if (!raw || typeof raw !== "object") {
    throw err("根对象须为 JSON 对象");
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) {
    throw err("version 须为 1");
  }
  const at = o.audioTracks;
  const bv = o.backgroundVisuals;
  const scenes = o.scenes;
  const def = o.defaultSceneId;
  const legacySc = o.scriptureCards;
  if (legacySc !== undefined && legacySc !== null && !Array.isArray(legacySc)) {
    throw err("scriptureCards 须为数组或省略（经文卡片已移除）");
  }
  if (!Array.isArray(at) || !Array.isArray(bv) || !Array.isArray(scenes)) {
    throw err("audioTracks / backgroundVisuals / scenes 须为数组");
  }
  if (at.length > MAX_ITEMS || bv.length > MAX_ITEMS || scenes.length > MAX_ITEMS) {
    throw err("数组项数超出上限");
  }
  const tracks: AudioTrack[] = [];
  const backgrounds: BackgroundVisual[] = [];
  const sceneList: Scene[] = [];
  for (const x of at) {
    if (!x || typeof x !== "object") throw err("曲目项格式错误");
    const r = x as Record<string, unknown>;
    const tagsRaw = r.tags;
    const tags =
      Array.isArray(tagsRaw) && tagsRaw.length > 0
        ? tagsRaw.filter((t): t is string => typeof t === "string").slice(0, 40)
        : undefined;
    const track: AudioTrack = {
      id: typeof r.id === "string" ? r.id.trim() : "",
      title: parseRequiredLocalized(r.title, MAX_TITLE, "曲目 title"),
      artist: parseOptionalLocalized(r.artist, MAX_TITLE, "曲目 artist"),
      src: typeof r.src === "string" ? r.src : "",
      durationSec:
        typeof r.durationSec === "number" && Number.isFinite(r.durationSec)
          ? r.durationSec
          : undefined,
      tags,
      remark: parseOptionalLocalized(r.remark, MAX_REMARK, "曲目 remark"),
    };
    validateTrack(track);
    tracks.push(track);
  }
  for (const x of bv) {
    if (!x || typeof x !== "object") throw err("背景项格式错误");
    const r = x as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    const typ = r.type === "image" ? "image" : r.type === "gradient" ? "gradient" : null;
    if (!typ) throw err("背景 type 须为 image 或 gradient");
    const bg: BackgroundVisual = {
      id,
      type: typ,
      imageSrc: typeof r.imageSrc === "string" ? r.imageSrc : undefined,
      title: parseOptionalLocalized(r.title, MAX_TITLE, "背景 title"),
      cssGradient: typeof r.cssGradient === "string" ? r.cssGradient : undefined,
      blur: Boolean(r.blur),
      credit: parseOptionalLocalized(r.credit, MAX_TITLE, "背景 credit"),
    };
    validateBackground(bg);
    backgrounds.push(bg);
  }
  const trackIds = new Set(tracks.map((t) => t.id));
  const bgIds = new Set(backgrounds.map((b) => b.id));
  for (const x of scenes) {
    if (!x || typeof x !== "object") throw err("场景项格式错误");
    const raw = x as Record<string, unknown>;
    if (typeof raw.id !== "string" || !raw.id.trim()) {
      throw err("场景项缺少 id");
    }
    let audioTrackId = normRef(raw.audioTrackId);
    let backgroundVisualId = normRef(raw.backgroundVisualId);
    /** 列表已删素材但场景仍引用 id 时，读盘自愈为 null，避免整份 JSON 无法加载 */
    if (audioTrackId !== null && !trackIds.has(audioTrackId)) audioTrackId = null;
    if (backgroundVisualId !== null && !bgIds.has(backgroundVisualId)) backgroundVisualId = null;
    const scene: Scene = {
      id: raw.id.trim(),
      title: parseOptionalLocalized(raw.title, MAX_TITLE, "场景 title"),
      order: typeof raw.order === "number" ? raw.order : 0,
      audioTrackId,
      backgroundVisualId,
    };
    validateScene(scene, trackIds, bgIds);
    sceneList.push(scene);
  }
  let defaultSceneId: string | null = null;
  if (def === null) {
    defaultSceneId = null;
  } else if (typeof def === "string") {
    if (def !== "" && !sceneList.some((s) => s.id === def)) {
      throw err("defaultSceneId 指向不存在的场景");
    }
    defaultSceneId = def === "" ? null : def;
  } else {
    throw err("defaultSceneId 须为字符串或 null");
  }
  return {
    version: 1,
    audioTracks: tracks,
    backgroundVisuals: backgrounds,
    scenes: sceneList,
    defaultSceneId,
  };
}

export function musicCompanionDataPath(cwd: string): string {
  return path.resolve(cwd, "data", DATA_FILE);
}

export async function readMusicCompanionStore(cwd: string): Promise<MusicCompanionStore> {
  const target = musicCompanionDataPath(cwd);
  let raw: string;
  try {
    raw = await fs.readFile(target, "utf-8");
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      const d = defaultMusicCompanionStore();
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, JSON.stringify(d, null, 2), "utf-8");
      return d;
    }
    throw e;
  }
  if (raw.length > MAX_JSON_BYTES) {
    throw err("数据文件过大");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw err("JSON 解析失败");
  }
  return parseAndValidateMusicStore(parsed);
}

export async function writeMusicCompanionStore(
  cwd: string,
  store: MusicCompanionStore,
): Promise<void> {
  const validated = parseAndValidateMusicStore(store);
  const target = musicCompanionDataPath(cwd);
  const dir = path.dirname(target);
  await fs.mkdir(dir, { recursive: true });
  const body = JSON.stringify(validated, null, 2);
  if (body.length > MAX_JSON_BYTES) {
    throw err("序列化后超过大小上限");
  }
  if (!target.startsWith(path.resolve(cwd, "data") + path.sep)) {
    throw err("路径校验失败");
  }
  await fs.writeFile(target, body, "utf-8");
}
