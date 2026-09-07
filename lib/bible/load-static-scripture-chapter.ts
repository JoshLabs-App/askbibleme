import { loadedChapterVerseFromRow, type LoadedChapterVerse } from "@/lib/bible/loaded-chapter-verse";
import {
  isSafeStaticScriptureIds,
  staticScriptureBookRelPath,
  staticScriptureBookUrlPath,
  type StaticScriptureBookFile,
  type StaticScriptureVerse,
} from "@/lib/bible/static-scripture-shape";

/**
 * 读按卷静态经文（由 scripts/build-static-scripture.ts 生成）。
 *
 * 两条取数路径，好让同一份代码在迁移前后都能跑：
 * - 有 `fs`（本机 dev / Render / Vercel）直接读文件，没有网络往返；
 * - 没有 `fs`（Cloudflare Workers 一类边缘运行时）改用 fetch 取同域静态资源。
 *
 * 取不到时返回 null，由调用方回落 sqlite——迁移期间两套并存，不至于一处没备好就白屏。
 */

/** 一卷约 100KB，缓存整卷可让同一卷连续翻章不再重复取。 */
const MAX_CACHED_BOOKS = 8;
const bookCache = new Map<string, StaticScriptureBookFile>();

function rememberBook(key: string, file: StaticScriptureBookFile): void {
  if (bookCache.size >= MAX_CACHED_BOOKS) {
    const oldest = bookCache.keys().next().value;
    if (oldest !== undefined) bookCache.delete(oldest);
  }
  bookCache.set(key, file);
}

function parseBookFile(raw: string): StaticScriptureBookFile | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StaticScriptureBookFile>;
    /** 版本不认识就当没有，交给 sqlite 回落，好过按旧形状静默错读。 */
    if (parsed?.v !== 1 || !parsed.c || typeof parsed.c !== "object") return null;
    return { v: 1, c: parsed.c as StaticScriptureBookFile["c"] };
  } catch {
    return null;
  }
}

async function readViaFs(cwd: string, translationId: string, bookId: string): Promise<string | null> {
  try {
    const [{ default: fs }, { default: path }] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);
    const abs = path.join(cwd, staticScriptureBookRelPath(translationId, bookId));
    return await fs.readFile(abs, "utf8");
  } catch {
    return null;
  }
}

/**
 * 无 fs 时的同域取法。绝对地址优先取显式配置，其次取平台注入的部署域名；
 * 都没有就放弃（返回 null → 回落 sqlite），不猜域名以免打到别人站点上。
 */
function staticScriptureOrigin(): string | null {
  const explicit =
    process.env.STATIC_SCRIPTURE_BASE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return null;
}

async function readViaFetch(translationId: string, bookId: string): Promise<string | null> {
  const origin = staticScriptureOrigin();
  if (!origin) return null;
  try {
    const res = await fetch(`${origin}${staticScriptureBookUrlPath(translationId, bookId)}`, {
      /** 内容只随部署变化，可长期缓存。 */
      cache: "force-cache",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function loadBookFile(
  cwd: string,
  translationId: string,
  bookId: string,
): Promise<StaticScriptureBookFile | null> {
  const key = `${translationId}/${bookId}`;
  const cached = bookCache.get(key);
  if (cached) return cached;

  const raw = (await readViaFs(cwd, translationId, bookId)) ?? (await readViaFetch(translationId, bookId));
  if (!raw) return null;
  const parsed = parseBookFile(raw);
  if (!parsed) return null;
  rememberBook(key, parsed);
  return parsed;
}

function toLoadedVerse(entry: StaticScriptureVerse, index: number): LoadedChapterVerse | null {
  const row =
    typeof entry === "string"
      ? { verse: index + 1, text: entry }
      : {
          verse: index + 1,
          text: entry.t,
          speech_spans: entry.s ?? null,
          theme_repeat_count: entry.r ?? 0,
        };
  return loadedChapterVerseFromRow(row);
}

export async function loadStaticScriptureChapterVerses(
  cwd: string,
  translationId: string,
  bookId: string,
  chapter: number,
): Promise<LoadedChapterVerse[] | null> {
  if (!isSafeStaticScriptureIds(translationId, bookId)) return null;
  if (!Number.isInteger(chapter) || chapter < 1) return null;

  const file = await loadBookFile(cwd, translationId, bookId);
  const entries = file?.c[String(chapter)];
  if (!entries || entries.length === 0) return null;

  const verses: LoadedChapterVerse[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry === undefined || entry === null) continue;
    const v = toLoadedVerse(entry, i);
    if (v) verses.push(v);
  }
  return verses.length > 0 ? verses : null;
}
