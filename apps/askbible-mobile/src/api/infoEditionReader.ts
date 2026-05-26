import { loadBundledInfoEditionChapter } from "../bible/bundled-info-edition";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { t } from "../i18n/site-copy";
import type {
  InfoEditionReaderCachePayload,
  InfoEditionReaderVariant,
  InfoEditionV1PublishedChapter,
} from "../bible/info-edition-types";

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_MS = 4 * 60 * 1000;

async function parseJson(res: Response): Promise<InfoEditionReaderCachePayload> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as InfoEditionReaderCachePayload;
  } catch {
    return {};
  }
}

function apiFailureMessage(j: InfoEditionReaderCachePayload, res: Response): string | undefined {
  if (typeof j.error === "string" && j.error.trim()) return j.error.trim();
  if (j.ok === false && typeof j.message === "string") return j.message.trim();
  if (!res.ok) return `HTTP ${res.status}`;
  if (j.ok === false) return t("pages.read.infoEditionLoadFailed");
  return undefined;
}

function editionQuery(
  variant: InfoEditionReaderVariant,
  roleId?: string | null,
): string {
  const q = [`edition=${encodeURIComponent(variant)}`];
  if (roleId?.trim()) {
    q.push(`roleId=${encodeURIComponent(roleId.trim())}`);
  }
  return q.join("&");
}

function cacheUrl(
  bookId: string,
  chapter: number,
  variant: InfoEditionReaderVariant,
  roleId?: string | null,
): string {
  const base = getAskBibleBaseUrl();
  return `${base}/api/read/info-edition-v1?bookId=${encodeURIComponent(bookId)}&chapter=${chapter}&${editionQuery(variant, roleId)}`;
}

function bundledCachePayload(
  bookId: string,
  chapter: number,
  variant: InfoEditionReaderVariant,
  roleId?: string | null,
): InfoEditionReaderCachePayload {
  const published = loadBundledInfoEditionChapter(bookId, chapter, variant, { roleId });
  if (published) {
    return { ok: true, status: "ready", published };
  }
  return { ok: false, status: "missing", error: t("pages.read.infoEditionLoadFailed") };
}

export async function fetchInfoEditionCache(
  bookId: string,
  chapter: number,
  variant: InfoEditionReaderVariant,
  roleId?: string | null,
): Promise<InfoEditionReaderCachePayload> {
  const bundled = bundledCachePayload(bookId, chapter, variant, roleId);
  if (bundled.status === "ready" || isMobileBundledOnly()) {
    return bundled;
  }

  const res = await fetch(cacheUrl(bookId, chapter, variant, roleId), {
    headers: { Accept: "application/json" },
  });
  const j = await parseJson(res);
  if (!res.ok || j.ok === false) {
    return { ok: false, status: "failed", error: apiFailureMessage(j, res) };
  }
  return { ok: true, ...j };
}

export async function postInfoEditionGenerate(
  bookId: string,
  chapter: number,
  variant: InfoEditionReaderVariant,
  roleId?: string | null,
): Promise<InfoEditionReaderCachePayload> {
  const bundled = bundledCachePayload(bookId, chapter, variant, roleId);
  if (bundled.status === "ready" || isMobileBundledOnly()) {
    return bundled;
  }

  const base = getAskBibleBaseUrl();
  const res = await fetch(`${base}/api/read/info-edition-v1`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ bookId, chapter, edition: variant, roleId }),
  });
  const j = await parseJson(res);
  if (!res.ok || j.ok === false) {
    return { ok: false, status: j.status ?? "failed", error: apiFailureMessage(j, res) };
  }
  return { ok: true, ...j };
}

export function publishedFromPayload(
  j: InfoEditionReaderCachePayload,
): InfoEditionV1PublishedChapter | null {
  if (j.status === "ready" && j.published?.markdown?.trim()) return j.published;
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollInfoEditionUntilReady(
  bookId: string,
  chapter: number,
  variant: InfoEditionReaderVariant,
  roleId?: string | null,
): Promise<InfoEditionReaderCachePayload> {
  const bundled = bundledCachePayload(bookId, chapter, variant, roleId);
  if (bundled.status === "ready" || isMobileBundledOnly()) {
    return bundled;
  }

  const started = Date.now();
  while (Date.now() - started < POLL_MAX_MS) {
    await delay(POLL_INTERVAL_MS);
    const j = await fetchInfoEditionCache(bookId, chapter, variant, roleId);
    if (j.status === "ready" || j.status === "failed") return j;
  }
  return { ok: false, status: "failed", error: "timeout" };
}

export async function loadOrGenerateInfoEdition(
  bookId: string,
  chapter: number,
  variant: InfoEditionReaderVariant,
  roleId?: string | null,
): Promise<InfoEditionReaderCachePayload> {
  const bundled = bundledCachePayload(bookId, chapter, variant, roleId);
  if (bundled.status === "ready" || isMobileBundledOnly()) {
    return bundled;
  }

  const initial = await fetchInfoEditionCache(bookId, chapter, variant, roleId);
  if (initial.status === "ready" || initial.status === "failed") return initial;
  if (initial.status === "pending") {
    return pollInfoEditionUntilReady(bookId, chapter, variant, roleId);
  }

  const posted = await postInfoEditionGenerate(bookId, chapter, variant, roleId);
  if (posted.status === "ready" || posted.status === "failed") return posted;
  if (posted.status === "pending") {
    return pollInfoEditionUntilReady(bookId, chapter, variant, roleId);
  }
  return posted;
}
