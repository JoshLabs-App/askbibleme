import fs from "node:fs/promises";
import path from "node:path";
import type { RelaxSettingsV1 } from "./types";

const DATA_FILE = "relax-settings.json";

export function defaultRelaxSettings(): RelaxSettingsV1 {
  return {
    version: 1,
    videoSrc: "",
    playbackRate: 1,
  };
}

function clampRate(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(4, Math.max(0.25, n));
}

export function parseRelaxSettings(raw: unknown): RelaxSettingsV1 {
  const d = defaultRelaxSettings();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return d;
  const videoSrc = typeof o.videoSrc === "string" ? o.videoSrc.trim() : "";
  const posterSrc =
    typeof o.posterSrc === "string" && o.posterSrc.trim() ? o.posterSrc.trim() : undefined;
  const playbackRate =
    typeof o.playbackRate === "number" && Number.isFinite(o.playbackRate)
      ? clampRate(o.playbackRate)
      : 1;
  return {
    version: 1,
    videoSrc,
    playbackRate,
    ...(posterSrc ? { posterSrc } : {}),
  };
}

export async function readRelaxSettings(cwd: string): Promise<RelaxSettingsV1> {
  const target = path.resolve(cwd, "data", DATA_FILE);
  try {
    const raw = await fs.readFile(target, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return parseRelaxSettings(parsed);
  } catch {
    const next = defaultRelaxSettings();
    try {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, JSON.stringify(next, null, 2), "utf-8");
    } catch {
      /* ignore */
    }
    return next;
  }
}
