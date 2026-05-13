import fs from "node:fs/promises";
import path from "node:path";

const REL = path.join("data", "golden-verses-settings.json");

export type GoldenVersesSettingsV1 = {
  v: 1;
  /** 同源路径，如 `/golden-verses/bg-uploads/xxx.webp`；null 表示不显示背景图 */
  backgroundImageUrl: string | null;
};

const DEFAULT: GoldenVersesSettingsV1 = { v: 1, backgroundImageUrl: null };

const URL_PREFIX = "/golden-verses/bg-uploads/";

function isAllowedBackgroundUrl(s: string): boolean {
  const t = s.trim();
  if (!t.startsWith(URL_PREFIX)) return false;
  const rest = t.slice(URL_PREFIX.length);
  if (!rest || rest.includes("/") || rest.includes("..")) return false;
  return /^[\w.-]+$/.test(rest);
}

export function parseGoldenVersesSettings(raw: unknown): GoldenVersesSettingsV1 {
  if (!raw || typeof raw !== "object") return { ...DEFAULT };
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return { ...DEFAULT };
  const url = o.backgroundImageUrl;
  if (url === null) return { v: 1, backgroundImageUrl: null };
  if (typeof url === "string" && isAllowedBackgroundUrl(url)) {
    return { v: 1, backgroundImageUrl: url.trim() };
  }
  return { ...DEFAULT };
}

export async function readGoldenVersesSettings(cwd: string): Promise<GoldenVersesSettingsV1> {
  const p = path.resolve(cwd, REL);
  try {
    const text = await fs.readFile(p, "utf-8");
    return parseGoldenVersesSettings(JSON.parse(text) as unknown);
  } catch {
    return { ...DEFAULT };
  }
}

export async function writeGoldenVersesSettings(cwd: string, next: GoldenVersesSettingsV1): Promise<void> {
  const p = path.resolve(cwd, REL);
  const dir = path.dirname(p);
  await fs.mkdir(dir, { recursive: true });
  const body = `${JSON.stringify(next, null, 2)}\n`;
  await fs.writeFile(p, body, "utf-8");
}
