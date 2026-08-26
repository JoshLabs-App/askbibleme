import { loadBundledInfoEditionChapter } from "../bible/bundled-info-edition";
import { t } from "../i18n/site-copy";
import type {
  InfoEditionReaderCachePayload,
  InfoEditionReaderVariant,
  InfoEditionV1PublishedChapter,
} from "../bible/info-edition-types";

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

/** 只读安装包内已发布导读；不再请求主站现场生成。 */
export async function fetchInfoEditionCache(
  bookId: string,
  chapter: number,
  variant: InfoEditionReaderVariant,
  roleId?: string | null,
): Promise<InfoEditionReaderCachePayload> {
  return bundledCachePayload(bookId, chapter, variant, roleId);
}

export function publishedFromPayload(
  j: InfoEditionReaderCachePayload,
): InfoEditionV1PublishedChapter | null {
  if (j.status === "ready" && j.published?.markdown?.trim()) return j.published;
  return null;
}

/** @deprecated 现场生成已下线；等同 fetchInfoEditionCache。 */
export async function loadOrGenerateInfoEdition(
  bookId: string,
  chapter: number,
  variant: InfoEditionReaderVariant,
  roleId?: string | null,
): Promise<InfoEditionReaderCachePayload> {
  return fetchInfoEditionCache(bookId, chapter, variant, roleId);
}
