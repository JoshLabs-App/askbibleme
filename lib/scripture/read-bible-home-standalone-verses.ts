import fs from "node:fs";
import path from "node:path";
import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import { READ_SCRIPTURE_ABOUT_VERSES_BY_LOCALE } from "@/lib/i18n/read-scripture-about-verses";
import { resolveVerseRefToHomeEntry } from "@/lib/bible/resolve-verse-range-for-display";
import type { VerseRef } from "@/lib/bible/verse-ref";
import { buildVerseRefsFromThemeSubcategoryKeys } from "@/lib/scripture/build-home-verse-refs-from-theme-selection";
import { getReaderVerseThemesDatabase } from "@/lib/scripture/reader-verse-themes-db";

const CONFIG_REL = path.join("data", "scripture", "read-bible-home-verse-theme.json");
const KEY_RE = /^\d+-\d+$/;

/** 与后台「待定」标签墙一致：默认按子标签中文名解析；可在 JSON 里写死 `selectedSubcategoryKey`。 */
export const READ_BIBLE_HOME_THEME_DEFAULT_SUBCATEGORY_NAME = "圣经的启示";

/** `/read` 首页轮播：单标签下解析条数上限（与全站金句轮播上限分离）。 */
export const READ_BIBLE_HOME_THEME_MAX_REFS = 160;

export type ReadBibleHomeVerseThemeFile = {
  version: number;
  /** 若匹配 `^\\d+-\\d+$`，优先使用，不再按名解析 */
  selectedSubcategoryKey: string | null;
  /** 与 `subcategory.name` / `title` 去首尾空白后精确匹配 */
  subcategoryName: string | null;
};

export function readReadBibleHomeVerseThemeConfigSync(cwd: string): ReadBibleHomeVerseThemeFile {
  const abs = path.join(cwd, CONFIG_REL);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf8")) as unknown;
  } catch {
    return {
      version: 1,
      selectedSubcategoryKey: null,
      subcategoryName: READ_BIBLE_HOME_THEME_DEFAULT_SUBCATEGORY_NAME,
    };
  }
  if (!raw || typeof raw !== "object") {
    return {
      version: 1,
      selectedSubcategoryKey: null,
      subcategoryName: READ_BIBLE_HOME_THEME_DEFAULT_SUBCATEGORY_NAME,
    };
  }
  const o = raw as Record<string, unknown>;
  const keyRaw = o.selectedSubcategoryKey;
  const key = typeof keyRaw === "string" && KEY_RE.test(keyRaw.trim()) ? keyRaw.trim() : null;
  const nameRaw = o.subcategoryName;
  const name =
    typeof nameRaw === "string" && nameRaw.trim()
      ? nameRaw.trim()
      : READ_BIBLE_HOME_THEME_DEFAULT_SUBCATEGORY_NAME;
  return {
    version: typeof o.version === "number" ? o.version : 1,
    selectedSubcategoryKey: key,
    subcategoryName: key ? null : name,
  };
}

async function resolveReadBibleHomeSubcategoryKey(cwd: string): Promise<string | null> {
  const cfg = readReadBibleHomeVerseThemeConfigSync(cwd);
  if (cfg.selectedSubcategoryKey) return cfg.selectedSubcategoryKey;

  const label = (cfg.subcategoryName ?? READ_BIBLE_HOME_THEME_DEFAULT_SUBCATEGORY_NAME).trim();
  if (!label) return null;

  const db = await getReaderVerseThemesDatabase(cwd);
  if (!db) return null;

  const stmt = db.prepare(
    `SELECT category_id, id FROM subcategory
     WHERE trim(name) = ? OR trim(COALESCE(title, '')) = ?
     LIMIT 1`,
  );
  stmt.bind([label, label]);
  let row: Record<string, unknown> | null = null;
  if (stmt.step()) row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();
  if (!row) return null;
  const c = Number(row.category_id);
  const s = Number(row.id);
  if (!Number.isFinite(c) || !Number.isFinite(s)) return null;
  return `${c}-${s}`;
}

async function entriesForLocale(cwd: string, locale: AppLocale, refs: VerseRef[]): Promise<HomeVerseEntry[]> {
  const out: HomeVerseEntry[] = [];
  for (const ref of refs) {
    const row = await resolveVerseRefToHomeEntry(cwd, ref, locale);
    if (row) out.push(row);
  }
  return out;
}

/**
 * `/read` 圣经首页轮播：仅从 `reader-verse-themes.sqlite` 中配置的单一子标签取句；
 * 与首页祷告经文池、`external-home-verse-rotation`、金句静态轮播均无关。
 * 库缺失 / 标签无句 / 解析过少时回退 `READ_SCRIPTURE_ABOUT_VERSES_BY_LOCALE`。
 */
export async function buildReadBibleHomeStandaloneVersesByLocale(
  cwd: string,
): Promise<Record<AppLocale, HomeVerseEntry[]>> {
  const key = await resolveReadBibleHomeSubcategoryKey(cwd);
  if (!key) return READ_SCRIPTURE_ABOUT_VERSES_BY_LOCALE;

  const refs = await buildVerseRefsFromThemeSubcategoryKeys(cwd, [key], {
    maxRefs: READ_BIBLE_HOME_THEME_MAX_REFS,
    shuffle: false,
  });
  if (refs.length < 4) return READ_SCRIPTURE_ABOUT_VERSES_BY_LOCALE;

  const zh = await entriesForLocale(cwd, "zh-CN", refs);
  const en = await entriesForLocale(cwd, "en", refs);
  if (zh.length < 4 || en.length < 4) return READ_SCRIPTURE_ABOUT_VERSES_BY_LOCALE;

  return { "zh-CN": zh, en };
}
