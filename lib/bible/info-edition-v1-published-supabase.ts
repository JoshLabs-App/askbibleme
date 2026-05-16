import "server-only";
import {
  generationToPublishedChapter,
  infoEditionChapterKey,
  pickPublishedGeneration,
} from "@/lib/bible/info-edition-v1-publish";
import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";
import type { InfoEditionV1PublishedChapter } from "@/lib/bible/info-edition-v1-published-types";
import type { InfoEditionV1ReaderCacheResponse } from "@/lib/bible/info-edition-v1-reader-cache";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const TABLE = "info_edition_v1_reader_cache";
const PENDING_STALE_MS = 4 * 60 * 1000;

type CacheRow = {
  chapter_key: string;
  book_id: string;
  chapter: number;
  status: "ready" | "pending" | "failed";
  role_id: string | null;
  role_label: string | null;
  profile_id: string | null;
  profile_name: string | null;
  markdown: string | null;
  char_count: number | null;
  published_at: string | null;
  error: string | null;
  started_at: string | null;
  failed_at: string | null;
};

function rowToPublished(row: CacheRow): InfoEditionV1PublishedChapter | null {
  const markdown = row.markdown?.trim() ?? "";
  if (!markdown) return null;
  return {
    bookId: row.book_id.trim().toUpperCase(),
    chapter: row.chapter,
    roleId: row.role_id ?? "",
    roleLabel: row.role_label ?? "基础版",
    profileId: row.profile_id ?? "",
    profileName: row.profile_name ?? "DeepSeek",
    markdown,
    charCount: row.char_count ?? markdown.length,
    publishedAt: row.published_at ?? new Date().toISOString(),
  };
}

export async function getInfoEditionReaderCacheSupabase(
  bookId: string,
  chapter: number,
): Promise<InfoEditionV1ReaderCacheResponse> {
  const client = createSupabaseServiceClient();
  if (!client) return { status: "missing" };

  const key = infoEditionChapterKey(bookId, chapter);
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("chapter_key", key)
    .maybeSingle();

  if (error || !data) return { status: "missing" };
  const row = data as CacheRow;

  if (row.status === "ready") {
    const published = rowToPublished(row);
    if (published) return { status: "ready", published };
    return { status: "missing" };
  }

  if (row.status === "failed" && row.error?.trim()) {
    return { status: "failed", error: row.error.trim() };
  }

  if (row.status === "pending" && row.started_at) {
    const age = Date.now() - new Date(row.started_at).getTime();
    if (age < PENDING_STALE_MS) {
      return { status: "pending" };
    }
  }

  return { status: "missing" };
}

export async function tryBeginInfoEditionPendingSupabase(
  bookId: string,
  chapter: number,
): Promise<boolean> {
  const client = createSupabaseServiceClient();
  if (!client) return false;

  const key = infoEditionChapterKey(bookId, chapter);
  const normalizedBookId = bookId.trim().toUpperCase();
  const now = new Date().toISOString();

  const existing = await getInfoEditionReaderCacheSupabase(bookId, chapter);
  if (existing.status === "pending" || existing.status === "ready") return false;

  const { error } = await client.from(TABLE).upsert(
    {
      chapter_key: key,
      book_id: normalizedBookId,
      chapter,
      status: "pending",
      started_at: now,
      failed_at: null,
      error: null,
      updated_at: now,
    },
    { onConflict: "chapter_key" },
  );

  return !error;
}

export async function clearInfoEditionPendingSupabase(
  bookId: string,
  chapter: number,
): Promise<void> {
  const client = createSupabaseServiceClient();
  if (!client) return;

  const key = infoEditionChapterKey(bookId, chapter);
  const { data } = await client.from(TABLE).select("status").eq("chapter_key", key).maybeSingle();
  if (!data || (data as { status: string }).status !== "pending") return;

  await client.from(TABLE).delete().eq("chapter_key", key);
}

export async function setInfoEditionReaderFailedSupabase(
  bookId: string,
  chapter: number,
  error: string,
): Promise<void> {
  const client = createSupabaseServiceClient();
  if (!client) return;

  const key = infoEditionChapterKey(bookId, chapter);
  const now = new Date().toISOString();
  await client.from(TABLE).upsert(
    {
      chapter_key: key,
      book_id: bookId.trim().toUpperCase(),
      chapter,
      status: "failed",
      error: error.trim() || "生成失败",
      failed_at: now,
      started_at: null,
      updated_at: now,
    },
    { onConflict: "chapter_key" },
  );
}

export async function publishInfoEditionChapterSupabase(
  bookId: string,
  chapter: number,
  generations: InfoEditionV1Generation[],
): Promise<InfoEditionV1PublishedChapter | null> {
  const client = createSupabaseServiceClient();
  if (!client) return null;

  const picked = pickPublishedGeneration(generations);
  if (!picked) return null;

  const now = new Date().toISOString();
  const entry = generationToPublishedChapter(bookId, chapter, picked, now);
  const key = infoEditionChapterKey(bookId, chapter);

  const { error } = await client.from(TABLE).upsert(
    {
      chapter_key: key,
      book_id: entry.bookId,
      chapter: entry.chapter,
      status: "ready",
      role_id: entry.roleId,
      role_label: entry.roleLabel,
      profile_id: entry.profileId,
      profile_name: entry.profileName,
      markdown: entry.markdown,
      char_count: entry.charCount,
      published_at: entry.publishedAt,
      error: null,
      started_at: null,
      failed_at: null,
      updated_at: now,
    },
    { onConflict: "chapter_key" },
  );

  if (error) return null;
  return entry;
}
