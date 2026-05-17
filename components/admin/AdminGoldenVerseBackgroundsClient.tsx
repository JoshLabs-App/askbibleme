"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { diskAuthHeaders } from "@/lib/disk-auth-headers";
import type { GoldenVerseBackgroundItem } from "@/lib/golden-verses/background-uploads";

async function fetchBackgrounds(): Promise<GoldenVerseBackgroundItem[]> {
  const res = await fetch("/api/admin/golden-verses/backgrounds", {
    headers: { ...diskAuthHeaders() },
  });
  const j = (await res.json()) as { backgrounds?: GoldenVerseBackgroundItem[]; error?: string };
  if (!res.ok) throw new Error(j.error ?? `加载失败（${res.status}）`);
  return Array.isArray(j.backgrounds) ? j.backgrounds : [];
}

async function uploadBackground(file: File): Promise<GoldenVerseBackgroundItem[]> {
  const form = new FormData();
  form.set("file", file);
  const res = await fetch("/api/admin/golden-verses/backgrounds", {
    method: "POST",
    headers: { ...diskAuthHeaders() },
    body: form,
  });
  const j = (await res.json()) as { backgrounds?: GoldenVerseBackgroundItem[]; error?: string };
  if (!res.ok) throw new Error(j.error ?? `上传失败（${res.status}）`);
  return Array.isArray(j.backgrounds) ? j.backgrounds : await fetchBackgrounds();
}

async function deleteBackgrounds(ids: string[]): Promise<GoldenVerseBackgroundItem[]> {
  const res = await fetch("/api/admin/golden-verses/backgrounds", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...diskAuthHeaders(),
    },
    body: JSON.stringify({ ids }),
  });
  const j = (await res.json()) as { backgrounds?: GoldenVerseBackgroundItem[]; error?: string };
  if (!res.ok) throw new Error(j.error ?? `删除失败（${res.status}）`);
  return Array.isArray(j.backgrounds) ? j.backgrounds : [];
}

export function AdminGoldenVerseBackgroundsClient() {
  const { t } = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<GoldenVerseBackgroundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      setItems(await fetchBackgrounds());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadBusy(true);
    setErr(null);
    setMsg(null);
    try {
      setItems(await uploadBackground(file));
      setMsg(t("admin.versePageBackgrounds.uploadDone"));
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally {
      setUploadBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm(t("admin.versePageBackgrounds.deleteConfirm"))) return;
    setDeleteBusy(id);
    setErr(null);
    setMsg(null);
    try {
      setItems(await deleteBackgrounds([id]));
      setMsg(t("admin.versePageBackgrounds.deleteDone"));
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally {
      setDeleteBusy(null);
    }
  };

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => void onFileChange(e)}
        />
        <button
          type="button"
          disabled={uploadBusy || loading}
          onClick={() => fileRef.current?.click()}
          className="rounded-md border border-adminLine bg-adminFg px-3 py-1.5 text-[12px] font-medium text-adminBg transition hover:opacity-90 disabled:opacity-50"
        >
          {uploadBusy ? t("admin.versePageBackgrounds.uploading") : t("admin.versePageBackgrounds.upload")}
        </button>
        <Link
          href="/verse"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] text-adminFg underline underline-offset-2"
        >
          {t("admin.versePageBackgrounds.openVersePage")}
        </Link>
      </div>

      {err ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-900">{err}</p>
      ) : null}
      {msg ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
          {msg}
        </p>
      ) : null}

      {loading ? (
        <p className="text-[13px] text-adminMuted">{t("admin.versePageBackgrounds.loading")}</p>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-adminMuted">{t("admin.versePageBackgrounds.empty")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="overflow-hidden rounded-lg border border-adminLine bg-adminBg/40"
            >
              <div className="relative aspect-[4/3] bg-adminLine/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              </div>
              <div className="space-y-2 p-3">
                <p className="truncate font-mono text-[10px] text-adminMuted" title={item.url}>
                  {item.filename}
                </p>
                <button
                  type="button"
                  disabled={deleteBusy === item.id}
                  onClick={() => void onDelete(item.id)}
                  className="text-[12px] text-red-800 underline underline-offset-2 disabled:opacity-50"
                >
                  {deleteBusy === item.id
                    ? t("admin.versePageBackgrounds.deleting")
                    : t("admin.versePageBackgrounds.delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
