"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";
import { diskAuthHeaders } from "@/lib/disk-auth-headers";
import type { MediaLibraryBucketId, MediaLibraryKind } from "@/lib/admin/media-library";

function bucketLabel(t: (path: string, vars?: Record<string, string>) => string, id: MediaLibraryBucketId): string {
  switch (id) {
    case "nature_video":
      return t("admin.mediaLibrary.bucketNatureVideo");
    case "nature_audio":
      return t("admin.mediaLibrary.bucketNatureAudio");
    case "nature_thumb":
      return t("admin.mediaLibrary.bucketNatureThumb");
    case "nature_preview":
      return t("admin.mediaLibrary.bucketNaturePreview");
    case "music_audio":
      return t("admin.mediaLibrary.bucketMusicAudio");
    case "music_bg":
      return t("admin.mediaLibrary.bucketMusicBg");
    case "golden_verse_bg":
      return t("admin.mediaLibrary.bucketGoldenVerseBg");
    case "music_analysis":
      return t("admin.mediaLibrary.bucketMusicAnalysis");
  }
}

type ItemRow = {
  url: string;
  bucketId: MediaLibraryBucketId;
  filename: string;
  size: number;
  mtimeMs: number;
  kind: MediaLibraryKind;
  referenced: boolean;
};

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(ms: number): string {
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "—";
  }
}

async function fetchList(): Promise<ItemRow[]> {
  const res = await fetch("/api/admin/media-library", {
    headers: { ...diskAuthHeaders() },
  });
  const j = (await res.json()) as { items?: ItemRow[]; error?: string };
  if (!res.ok) throw new Error(j.error ?? `加载失败（${res.status}）`);
  return Array.isArray(j.items) ? j.items : [];
}

async function deleteUrls(urls: string[], force: boolean): Promise<{ ok: boolean; results: { url: string; ok: boolean; error?: string }[] }> {
  const res = await fetch("/api/admin/media-library", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...diskAuthHeaders(),
    },
    body: JSON.stringify({ urls, force }),
  });
  const j = (await res.json()) as {
    ok?: boolean;
    results?: { url: string; ok: boolean; error?: string }[];
    error?: string;
  };
  if (!res.ok) throw new Error(j.error ?? `删除失败（${res.status}）`);
  return { ok: Boolean(j.ok), results: j.results ?? [] };
}

export function MediaLibraryClient() {
  const { t } = useLocale();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bucketFilter, setBucketFilter] = useState<MediaLibraryBucketId | "all">("all");
  const [kindFilter, setKindFilter] = useState<MediaLibraryKind | "all">("all");
  const [forceDelete, setForceDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const rows = await fetchList();
      setItems(rows);
      setSelected((prev) => {
        const next = new Set<string>();
        for (const u of prev) {
          if (rows.some((r) => r.url === u)) next.add(u);
        }
        return next;
      });
    } catch (e) {
      setItems([]);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (bucketFilter !== "all" && i.bucketId !== bucketFilter) return false;
      if (kindFilter !== "all" && i.kind !== kindFilter) return false;
      return true;
    });
  }, [items, bucketFilter, kindFilter]);

  const toggle = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected(new Set(filtered.map((i) => i.url)));
  };

  const clearSelection = () => setSelected(new Set());

  const onDelete = async () => {
    const urls = [...selected];
    if (!urls.length) return;
    setDeleteBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const { ok, results } = await deleteUrls(urls, forceDelete);
      const failed = results.filter((r) => !r.ok);
      const succeeded = results.filter((r) => r.ok).length;
      if (failed.length) {
        setErr(failed.map((r) => `${r.url}: ${r.error ?? "失败"}`).join("\n"));
      } else {
        setErr(null);
      }
      if (succeeded && !failed.length) {
        setMsg(t("admin.mediaLibrary.deleteDone", { count: String(succeeded) }));
      } else if (succeeded) {
        setMsg(t("admin.mediaLibrary.deletePartial"));
      }
      setSelected(new Set());
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <main className={`${ADMIN_MAIN_CLASS} text-adminFg`}>
      <header className="mb-8 border-b border-adminLine pb-6">
        <h1 className="text-[15px] font-medium tracking-tight text-adminFg">{t("admin.mediaLibrary.title")}</h1>
        <p className="mt-2 max-w-prose text-[11px] leading-relaxed text-adminMuted">{t("admin.mediaLibrary.intro")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="rounded border border-adminLine bg-adminPanel px-3 py-1.5 text-[12px] text-adminFg transition hover:bg-surface disabled:opacity-50"
          >
            {loading ? t("admin.mediaLibrary.loading") : t("admin.mediaLibrary.refresh")}
          </button>
        </div>
      </header>

      {err ? (
        <pre className="mb-6 whitespace-pre-wrap rounded-md border border-amber-600/30 bg-amber-50 px-3 py-2 text-[11px] text-amber-950">
          {err}
        </pre>
      ) : null}
      {msg ? (
        <p className="mb-6 rounded-md border border-emerald-600/25 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-950">{msg}</p>
      ) : null}

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-adminMuted">
          {t("admin.mediaLibrary.filterBucket")}
          <select
            value={bucketFilter}
            onChange={(e) => setBucketFilter(e.target.value as MediaLibraryBucketId | "all")}
            className="min-w-[10rem] rounded border border-border bg-adminPanel px-2 py-1.5 text-[12px] text-adminFg"
          >
            <option value="all">{t("admin.mediaLibrary.bucketAll")}</option>
            <option value="nature_video">{t("admin.mediaLibrary.bucketNatureVideo")}</option>
            <option value="nature_audio">{t("admin.mediaLibrary.bucketNatureAudio")}</option>
            <option value="nature_thumb">{t("admin.mediaLibrary.bucketNatureThumb")}</option>
            <option value="nature_preview">{t("admin.mediaLibrary.bucketNaturePreview")}</option>
            <option value="music_audio">{t("admin.mediaLibrary.bucketMusicAudio")}</option>
            <option value="music_bg">{t("admin.mediaLibrary.bucketMusicBg")}</option>
            <option value="golden_verse_bg">{t("admin.mediaLibrary.bucketGoldenVerseBg")}</option>
            <option value="music_analysis">{t("admin.mediaLibrary.bucketMusicAnalysis")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-adminMuted">
          {t("admin.mediaLibrary.filterKind")}
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as MediaLibraryKind | "all")}
            className="min-w-[8rem] rounded border border-border bg-adminPanel px-2 py-1.5 text-[12px] text-adminFg"
          >
            <option value="all">{t("admin.mediaLibrary.kindAll")}</option>
            <option value="image">{t("admin.mediaLibrary.kindImage")}</option>
            <option value="video">{t("admin.mediaLibrary.kindVideo")}</option>
            <option value="audio">{t("admin.mediaLibrary.kindAudio")}</option>
            <option value="document">{t("admin.mediaLibrary.kindDocument")}</option>
            <option value="other">{t("admin.mediaLibrary.kindOther")}</option>
          </select>
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-adminLine pb-4">
        <span className="text-[12px] text-adminMuted">
          {t("admin.mediaLibrary.selectedCount", { count: String(selected.size) })}
        </span>
        <button
          type="button"
          className="rounded border border-adminLine bg-adminPanel px-2.5 py-1 text-[11px] text-adminFg transition hover:bg-surface"
          onClick={selectAllFiltered}
          disabled={!filtered.length}
        >
          {t("admin.mediaLibrary.selectAllFiltered")}
        </button>
        <button
          type="button"
          className="rounded border border-adminLine bg-adminPanel px-2.5 py-1 text-[11px] text-adminFg transition hover:bg-surface"
          onClick={clearSelection}
          disabled={!selected.size}
        >
          {t("admin.mediaLibrary.clearSelection")}
        </button>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-adminMuted">
          <input
            type="checkbox"
            checked={forceDelete}
            onChange={(e) => setForceDelete(e.target.checked)}
            className="rounded border-border"
          />
          {t("admin.mediaLibrary.forceDelete")}
        </label>
        <button
          type="button"
          disabled={deleteBusy || !selected.size}
          onClick={() => void onDelete()}
          className="rounded border border-red-700/40 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-900 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleteBusy ? t("admin.mediaLibrary.deleting") : t("admin.mediaLibrary.deleteSelected")}
        </button>
      </div>

      {loading && !items.length ? (
        <p className="text-[12px] text-adminMuted">{t("admin.mediaLibrary.loading")}</p>
      ) : !filtered.length ? (
        <p className="text-[12px] text-adminMuted">{t("admin.mediaLibrary.empty")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((i) => {
            const on = selected.has(i.url);
            return (
              <li
                key={i.url}
                className={
                  "flex flex-col overflow-hidden rounded-xl border bg-adminPanel/40 shadow-sm transition " +
                  (on ? "border-adminFg/40 ring-1 ring-adminFg/20" : "border-adminLine hover:border-adminFg/20")
                }
              >
                <div className="flex items-start gap-2 border-b border-adminLine/80 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(i.url)}
                    className="mt-0.5 shrink-0"
                    aria-label={i.filename}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[10px] text-adminFg">{i.filename}</p>
                    <p className="mt-0.5 truncate text-[9px] text-adminMuted">{i.url}</p>
                  </div>
                </div>
                <div className="relative flex min-h-[8rem] items-center justify-center bg-black/40 px-2 py-3">
                  {i.kind === "image" ? (
                    <img src={i.url} alt="" className="max-h-28 max-w-full object-contain" />
                  ) : null}
                  {i.kind === "video" ? (
                    <video src={i.url} className="max-h-28 max-w-full object-contain" muted playsInline controls preload="metadata" />
                  ) : null}
                  {i.kind === "audio" ? (
                    <audio src={i.url} className="w-full max-w-xs" controls preload="metadata" />
                  ) : null}
                  {i.kind === "document" || i.kind === "other" ? (
                    <a
                      href={i.url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all px-2 text-center text-[11px] text-sky-700 underline-offset-2 hover:underline"
                    >
                      {t("admin.mediaLibrary.openFile")}
                    </a>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-2 text-[10px] text-adminMuted">
                  <span>{bucketLabel(t, i.bucketId)}</span>
                  <span>·</span>
                  <span>{formatBytes(i.size)}</span>
                  <span>·</span>
                  <span>{formatTime(i.mtimeMs)}</span>
                  {i.referenced ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-950">
                      {t("admin.mediaLibrary.referenced")}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
