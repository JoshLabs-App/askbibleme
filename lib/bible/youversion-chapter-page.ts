import {
  buildYouVersionAudioPageUrl,
  resolveYouVersionAudioAbbreviation,
  resolveYouVersionAudioVersionId,
} from "./youversion-chapter-audio";
import type { RemoteChapterVerseRow } from "./providers/content-parser";

/** 文字章页版本信息（可无音频映射的译本也要能拼 URL）。 */
const YOUVERSION_TEXT_PAGE_VERSION_INFO: Record<string, { versionId: string; abbreviation?: string }> = {
  "cccbst-zh-hant": { versionId: "2361", abbreviation: "CCCBST" },
  "ccb-zh-hans": { versionId: "36", abbreviation: "CCB" },
  "ccb-zh-hant": { versionId: "1392", abbreviation: "CCB" },
  "cnv-zh-hant": { versionId: "40", abbreviation: "CNV" },
  "cnvs-zh-hans": { versionId: "41", abbreviation: "CNVS" },
  "csbs-zh-hans": { versionId: "43", abbreviation: "CSBS" },
  "csbt-zh-hant": { versionId: "312", abbreviation: "CSBT" },
  "cunp-zh-hant": { versionId: "46", abbreviation: "CUNP-Shen" },
  "cunp-zh-hant-god": { versionId: "414", abbreviation: "CUNP-Shangti" },
  "cunpss-zh-hant": { versionId: "47", abbreviation: "CUNPSS-Shangti" },
  // 48 = 简体神版；勿用 2224（高棉文）。
  "cunpss-zh-hans": { versionId: "48", abbreviation: "CUNPSS-Shen" },
  "rcuv-zh-hant": { versionId: "139", abbreviation: "RCUV" },
  "rcuvss-zh-hans": { versionId: "140", abbreviation: "RCUVSS" },
  "rcv-zh-hant": { versionId: "4230", abbreviation: "RCV" },
  "feb-zh-hans": { versionId: "3354", abbreviation: "FEB" },
  "mandarin-zh-hans": { versionId: "3780" },
  "tcv2019t-zh-hant": { versionId: "3283", abbreviation: "TCV2019T" },
  niv: { versionId: "111", abbreviation: "NIV" },
  nlt: { versionId: "116", abbreviation: "NLT" },
  nkjv: { versionId: "114", abbreviation: "NKJV" },
  kjv: { versionId: "1", abbreviation: "KJV" },
  esv: { versionId: "59", abbreviation: "ESV" },
};

const YOUVERSION_PAGE_LOCALES: Record<string, string> = {
  "ccb-zh-hans": "zh-CN",
  "ccb-zh-hant": "zh-TW",
  "cnv-zh-hant": "zh-TW",
  "cnvs-zh-hans": "zh-CN",
  "csbs-zh-hans": "zh-CN",
  "csbt-zh-hant": "zh-TW",
  "cunp-zh-hant": "zh-TW",
  "cunp-zh-hant-god": "zh-TW",
  "cunpss-zh-hans": "zh-CN",
  "cunpss-zh-hant": "zh-CN",
  "rcuv-zh-hant": "zh-TW",
  "rcuvss-zh-hans": "zh-CN",
  "rcv-zh-hant": "zh-TW",
  "feb-zh-hans": "zh-CN",
  "mandarin-zh-hans": "zh-CN",
};

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function decodeYouVersionHtmlEntities(raw: string): string {
  return String(raw || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => {
      const code = Number.parseInt(n, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
}

export function stripYouVersionHtml(raw: string): string {
  return String(raw || "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|h[1-6]|li|tr|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Flight / RSC 尾巴：末节常把 pageProps 拼进经文。 */
export function truncateYouVersionRscTail(raw: string): string {
  const source = String(raw || "");
  if (!source) return "";
  const markers = [
    /\d+:\["\$"/,
    /\["\$","\$L/,
    /\["\$","meta"/,
    /\["\$","link"/,
    /"analyticsUsfmRef"/,
    /"pageProps"/,
    /"audioVersionInfo"/,
    /self\.__next_f/,
  ];
  let cut = source.length;
  for (const re of markers) {
    const m = re.exec(source);
    if (m && m.index >= 40 && m.index < cut) cut = m.index;
  }
  return source.slice(0, cut);
}

/** 去掉脚注/交叉引用节点，避免 `#ver. 13` / `#Neh. 2:1` 进正文。 */
export function stripYouVersionNoteNodes(raw: string): string {
  let source = String(raw || "");
  for (let i = 0; i < 40; i += 1) {
    const next = source.replace(
      /<(span|div)[^>]*class="[^"]*(?:__note|\bnote\b|__x\b)[^"]*"[^>]*>[\s\S]*?<\/\1>/gi,
      "",
    );
    if (next === source) break;
    source = next;
  }
  return source;
}

function extractYouVersionVersePlainText(block: string): string {
  const truncated = truncateYouVersionRscTail(block);
  const withoutNotes = stripYouVersionNoteNodes(truncated);
  // 优先只取 content 节点（脚注一般在其外）。
  const contentChunks: string[] = [];
  const contentRe =
    /<(?:span|div)[^>]*class="[^"]*(?:__content|_content|\bcontent\b)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/gi;
  for (let match = contentRe.exec(withoutNotes); match; match = contentRe.exec(withoutNotes)) {
    const piece = decodeYouVersionHtmlEntities(stripYouVersionHtml(match[1] || ""))
      .replace(/\s+/g, " ")
      .trim();
    if (piece) contentChunks.push(piece);
  }
  let text =
    contentChunks.length > 0
      ? contentChunks.join(" ")
      : decodeYouVersionHtmlEntities(stripYouVersionHtml(withoutNotes));
  text = text.replace(/\s+/g, " ").trim();
  // 残留交叉引用标签（无 HTML 包裹时）。
  text = text
    .replace(/#(?:ver|ch|vv?)\.\s*\d+(?:\s*[-–]\s*\d+)?/gi, " ")
    .replace(/#[A-Z][a-z]{0,4}\.?\s*\d+:\d+(?:\s*[-–]\s*\d+)?/g, " ")
    .replace(/\b\d+:Tb\d+,?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

function looksLikeYouVersionGarbageText(text: string): boolean {
  const t = String(text || "");
  if (!t) return true;
  if (t.includes('["$,"') || t.includes('["$","')) return true;
  if (t.includes("analyticsUsfmRef") || t.includes("pageProps")) return true;
  if (t.includes("self.__next_f") || t.includes("fb:app_id")) return true;
  if (t.includes("youversionapi.com") || t.includes("web-assets.youversion.com")) return true;
  if (/https?:\/\/www\.bible\.com\//i.test(t) && t.length > 180) return true;
  if (t.length > 2800 && /[\[\{]/.test(t)) return true;
  return false;
}

function collectYouVersionVerseRows(
  source: string,
  verseStartRe: RegExp,
): RemoteChapterVerseRow[] {
  const clipped = truncateYouVersionRscTail(source);
  const starts: Array<{ verse: number; index: number }> = [];
  for (let match = verseStartRe.exec(clipped); match; match = verseStartRe.exec(clipped)) {
    const verse = Number(match[1]);
    if (!Number.isInteger(verse) || verse < 1) continue;
    starts.push({ verse, index: match.index });
  }
  if (!starts.length) return [];

  const rows: RemoteChapterVerseRow[] = [];
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i]!;
    const next = starts[i + 1];
    const block = clipped.slice(start.index, next?.index ?? clipped.length);
    let text = extractYouVersionVersePlainText(block);
    text = text.replace(new RegExp(`^\\s*${start.verse}\\s*`), "").trim();
    if (!text || looksLikeYouVersionGarbageText(text)) continue;
    const hit = rows.find((row) => row.verse === start.verse);
    if (hit) {
      if (!hit.text.includes(text) && !looksLikeYouVersionGarbageText(text)) {
        hit.text = `${hit.text} ${text}`.replace(/\s+/g, " ").trim();
      }
      continue;
    }
    rows.push({ verse: start.verse, text });
  }
  return rows.sort((a, b) => a.verse - b.verse);
}

export function parseYouVersionChapterContent(html: string): RemoteChapterVerseRow[] {
  const source = String(html || "");
  // 经典：class="verse v1"；新版 CSS modules：*verse* + data-usfm（属性顺序不固定）。
  const patterns = [
    /<span class="verse v(\d+)"[^>]*data-usfm="[^"]+">/gi,
    /<(?:span|div)[^>]*data-usfm="[A-Z0-9]+\.\d+\.(\d+)"[^>]*class="[^"]*verse[^"]*"[^>]*>/gi,
    /<(?:span|div)[^>]*class="[^"]*verse[^"]*"[^>]*data-usfm="[A-Z0-9]+\.\d+\.(\d+)"[^>]*>/gi,
  ];
  for (const pattern of patterns) {
    const rows = collectYouVersionVerseRows(source, pattern);
    if (rows.length) return rows;
  }
  return [];
}

export function buildYouVersionChapterPageUrls(args: {
  translationId: string;
  bookId: string;
  chapter: number;
  remoteId?: string | null;
}): string[] {
  const translationId = String(args.translationId || "").trim().toLowerCase();
  const bookId = String(args.bookId || "").trim().toUpperCase();
  const chapter = Number(args.chapter);
  if (!translationId || !bookId || !Number.isInteger(chapter) || chapter < 1) return [];

  const urls: string[] = [];
  const push = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed || urls.includes(trimmed)) return;
    urls.push(trimmed);
  };
  const withLocales = (url: string) => {
    push(url);
    const locale = YOUVERSION_PAGE_LOCALES[translationId];
    if (locale) {
      push(url.replace("https://www.bible.com/", `https://www.bible.com/${locale}/`));
    }
  };

  const audioPageUrl = buildYouVersionAudioPageUrl({
    translationId,
    bookId,
    chapter,
  });
  if (audioPageUrl) withLocales(audioPageUrl);

  const textInfo = YOUVERSION_TEXT_PAGE_VERSION_INFO[translationId];
  const versionId =
    String(args.remoteId || "").trim() ||
    textInfo?.versionId ||
    resolveYouVersionAudioVersionId(translationId) ||
    "";
  const abbreviation =
    textInfo?.abbreviation ||
    resolveYouVersionAudioAbbreviation(translationId) ||
    undefined;

  if (versionId) {
    const base = `https://www.bible.com/bible/${encodeURIComponent(versionId)}/${bookId}.${chapter}`;
    if (abbreviation) withLocales(`${base}.${abbreviation}`);
    withLocales(base);
  }

  return urls;
}

async function fetchYouVersionChapterPageHtmlOnce(
  url: string,
  headers: Record<string, string>,
): Promise<string | null> {
  const controller = typeof AbortController === "undefined" ? null : new AbortController();
  const timeout = controller ? setTimeout(() => controller.abort(), 20_000) : null;
  try {
    const res = await fetch(url, {
      headers,
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text?.trim() ? text : null;
  } catch {
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function fetchYouVersionChapterPageHtml(url: string): Promise<string | null> {
  // RN/OkHttp 常禁止改 User-Agent；先不带 UA，失败再带浏览器 UA（Node/服务端）。
  const baseHeaders = {
    Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "zh-TW,zh-CN,zh;q=0.9,en;q=0.8",
  };
  const first = await fetchYouVersionChapterPageHtmlOnce(url, baseHeaders);
  if (first && first.length > 4_000) return first;
  const second = await fetchYouVersionChapterPageHtmlOnce(url, {
    ...baseHeaders,
    "User-Agent": BROWSER_UA,
  });
  return second || first;
}

/** 不依赖整页巨型正则：按 push 标记切片再 JSON.parse，避免 Hermes 回溯卡死。 */
function extractYouVersionFlightPayloads(html: string): string[] {
  const payloads: string[] = [];
  const marker = "self.__next_f.push([1,";
  let from = 0;
  while (from < html.length) {
    const start = html.indexOf(marker, from);
    if (start < 0) break;
    const quoteAt = start + marker.length;
    if (html[quoteAt] !== '"') {
      from = quoteAt;
      continue;
    }
    let i = quoteAt + 1;
    let escaped = false;
    while (i < html.length) {
      const ch = html[i]!;
      if (escaped) {
        escaped = false;
        i += 1;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        i += 1;
        continue;
      }
      if (ch === '"') break;
      i += 1;
    }
    if (i >= html.length || html[i] !== '"') {
      from = quoteAt + 1;
      continue;
    }
    const literal = html.slice(quoteAt, i + 1);
    try {
      const payload = JSON.parse(literal) as unknown;
      if (typeof payload === "string" && payload) payloads.push(payload);
    } catch {
      /* ignore malformed flight chunk */
    }
    from = i + 1;
  }
  return payloads;
}

function youVersionRowsAreUsable(rows: RemoteChapterVerseRow[]): boolean {
  if (!rows.length) return false;
  if (rows.some((row) => looksLikeYouVersionGarbageText(row.text))) return false;
  return true;
}

export function parseYouVersionChapterPageHtml(html: string): RemoteChapterVerseRow[] {
  const source = String(html || "");
  if (!source.trim()) return [];

  for (const payload of extractYouVersionFlightPayloads(source)) {
    if (!payload.includes("verse") || !payload.includes("data-usfm")) continue;
    const rows = parseYouVersionChapterContent(truncateYouVersionRscTail(payload));
    if (youVersionRowsAreUsable(rows)) return rows;
  }

  // 部分响应把经文章节以转义形式嵌在整页 HTML 里。
  if (source.includes('class=\\"verse') || source.includes("data-usfm=\\")) {
    try {
      const loosened = source
        .replace(/\\"/g, '"')
        .replace(/\\n/g, "\n")
        .replace(/\\u003c/gi, "<")
        .replace(/\\u003e/gi, ">");
      const rows = parseYouVersionChapterContent(loosened);
      if (youVersionRowsAreUsable(rows)) return rows;
    } catch {
      /* fall through */
    }
  }

  const direct = parseYouVersionChapterContent(source);
  if (youVersionRowsAreUsable(direct)) return direct;

  const marker = '<script id="__NEXT_DATA__" type="application/json">';
  const start = source.indexOf(marker);
  if (start < 0) return [];
  const end = source.indexOf("</script>", start + marker.length);
  if (end < 0) return [];

  try {
    const data = JSON.parse(source.slice(start + marker.length, end)) as {
      props?: {
        pageProps?: {
          chapterInfo?: {
            content?: string;
          };
        };
      };
    };
    const content = data?.props?.pageProps?.chapterInfo?.content;
    if (!content) return [];
    const rows = parseYouVersionChapterContent(content);
    return youVersionRowsAreUsable(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function canLoadYouVersionChapterFromPage(meta: {
  id?: string | null;
  provider?: string | null;
  remoteId?: string | null;
  delivery?: string | null;
}): boolean {
  const id = String(meta.id || "")
    .trim()
    .toLowerCase();
  if (meta.provider === "youversion") return true;
  if (meta.delivery === "chapter-api" && (meta.remoteId || YOUVERSION_TEXT_PAGE_VERSION_INFO[id])) {
    return true;
  }
  return Boolean(YOUVERSION_TEXT_PAGE_VERSION_INFO[id] || String(meta.remoteId || "").trim());
}

export async function loadYouVersionChapterRowsFromPage(args: {
  translationId: string;
  bookId: string;
  chapter: number;
  remoteId?: string | null;
}): Promise<RemoteChapterVerseRow[] | null> {
  const pageUrls = buildYouVersionChapterPageUrls(args);
  if (!pageUrls.length) return null;

  for (const pageUrl of pageUrls) {
    const html = await fetchYouVersionChapterPageHtml(pageUrl);
    if (!html) continue;
    const rows = parseYouVersionChapterPageHtml(html);
    if (rows.length > 0) return rows;
  }
  return null;
}
