import fs from "node:fs/promises";
import path from "node:path";
import {
  isHomeAtmospherePresetId,
  type HomeAtmospherePresetId,
} from "@/music-visual/presets/home-atmosphere";
import {
  DEFAULT_MUSIC_VISUAL_TUNING,
  normalizeMusicVisualTuning,
  type MusicVisualTuningV1,
} from "@/music-visual/tuning/schema";

const DATA_FILE = "music-visual-console.json";
const MAX_BYTES = 120_000;

export type VisualConsoleBundleV1 = {
  v: 1;
  tuning: MusicVisualTuningV1;
  homeAtmospherePresetId?: HomeAtmospherePresetId;
};

export function defaultVisualConsoleBundle(): VisualConsoleBundleV1 {
  return {
    v: 1,
    tuning: { ...DEFAULT_MUSIC_VISUAL_TUNING },
    homeAtmospherePresetId: "lagoon",
  };
}

function visualConsoleDataPath(cwd: string): string {
  return path.resolve(cwd, "data", DATA_FILE);
}

export function parseVisualConsoleBundle(raw: unknown): VisualConsoleBundleV1 {
  const d = defaultVisualConsoleBundle();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return d;
  const tuning = normalizeMusicVisualTuning(o.tuning);
  const hid = o.homeAtmospherePresetId;
  const homeAtmospherePresetId =
    typeof hid === "string" && isHomeAtmospherePresetId(hid) ? hid : d.homeAtmospherePresetId;
  return { v: 1, tuning, homeAtmospherePresetId };
}

export async function readMusicVisualConsoleBundle(cwd: string): Promise<VisualConsoleBundleV1 | null> {
  const target = visualConsoleDataPath(cwd);
  if (!target.startsWith(path.resolve(cwd, "data") + path.sep)) return null;
  try {
    const buf = await fs.readFile(target);
    if (buf.length > MAX_BYTES) return null;
    const raw = JSON.parse(buf.toString("utf-8")) as unknown;
    return parseVisualConsoleBundle(raw);
  } catch {
    return null;
  }
}

export async function writeMusicVisualConsoleBundle(
  cwd: string,
  bundle: VisualConsoleBundleV1,
): Promise<void> {
  const normalized = parseVisualConsoleBundle(bundle);
  const target = visualConsoleDataPath(cwd);
  if (!target.startsWith(path.resolve(cwd, "data") + path.sep)) {
    throw new Error("路径校验失败");
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  const body = JSON.stringify(normalized, null, 2);
  if (body.length > MAX_BYTES) {
    throw new Error("序列化后超过大小上限");
  }
  await fs.writeFile(target, `${body}\n`, "utf-8");
}
