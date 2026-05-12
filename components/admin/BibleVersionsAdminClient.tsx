"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";
import { diskAuthHeaders } from "@/lib/disk-auth-headers";
import type { BibleTranslationMeta, BibleTranslationsIndex } from "@/lib/bible/translations-types";
import { SELAH_BIBLE_FORMAT } from "@/lib/bible/translations-types";

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function parseJson(res: Response, badJsonMessage: string): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(badJsonMessage);
  }
}

export function BibleVersionsAdminClient() {
  const { t } = useLocale();
  const [index, setIndex] = useState<BibleTranslationsIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [id, setId] = useState("");
  const [labelZh, setLabelZh] = useState("");
  const [labelEn, setLabelEn] = useState("");
  const [language, setLanguage] = useState("zh-Hans");
  const [file, setFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const [deleteBusy, setDeleteBusy] = useState<string | null>(null);
  const [defaultBusy, setDefaultBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/bible/translations", {
        headers: { ...diskAuthHeaders() },
      });
      const j = await parseJson(res, t("admin.bibleVersions.badJsonResponse", { status: String(res.status) }));
      if (!res.ok) {
        const e = typeof j.error === "string" ? j.error : t("admin.bibleVersions.loadFailed", { status: String(res.status) });
        throw new Error(e + (res.status === 403 ? ` ${t("admin.bibleVersions.diskHint")}` : ""));
      }
      setIndex({
        translations: Array.isArray(j.translations)
          ? (j.translations as BibleTranslationMeta[])
          : [],
        defaultTranslationId:
          typeof j.defaultTranslationId === "string" && j.defaultTranslationId.trim()
            ? j.defaultTranslationId.trim()
            : null,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setIndex(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (!file) {
      setErr(t("admin.bibleVersions.needFile"));
      return;
    }
    setUploadBusy(true);
    try {
      const fd = new FormData();
      fd.set("id", id.trim());
      fd.set("labelZh", labelZh.trim());
      fd.set("labelEn", labelEn.trim());
      fd.set("language", language.trim());
      fd.set("file", file);
      const res = await fetch("/api/admin/bible/translations", {
        method: "POST",
        headers: { ...diskAuthHeaders() },
        body: fd,
      });
      const j = await parseJson(res, t("admin.bibleVersions.badJsonResponse", { status: String(res.status) }));
      if (!res.ok) {
        const emsg = typeof j.error === "string" ? j.error : t("admin.bibleVersions.uploadFailed", { status: String(res.status) });
        throw new Error(emsg + (res.status === 403 ? ` ${t("admin.bibleVersions.diskHint")}` : ""));
      }
      setMsg(t("admin.bibleVersions.uploadDone"));
      setFile(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadBusy(false);
    }
  }

  async function setDefault(idStr: string) {
    setDefaultBusy(idStr);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/bible/translations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
        body: JSON.stringify({ defaultTranslationId: idStr }),
      });
      const j = await parseJson(res, t("admin.bibleVersions.badJsonResponse", { status: String(res.status) }));
      if (!res.ok) {
        const emsg = typeof j.error === "string" ? j.error : t("admin.bibleVersions.setDefaultFailed", { status: String(res.status) });
        throw new Error(emsg + (res.status === 403 ? ` ${t("admin.bibleVersions.diskHint")}` : ""));
      }
      setMsg(t("admin.bibleVersions.defaultDone"));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDefaultBusy(null);
    }
  }

  async function removeTranslation(idStr: string) {
    if (!window.confirm(t("admin.bibleVersions.confirmDelete", { id: idStr }))) return;
    setDeleteBusy(idStr);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/bible/translations?id=${encodeURIComponent(idStr)}`, {
        method: "DELETE",
        headers: { ...diskAuthHeaders() },
      });
      const j = await parseJson(res, t("admin.bibleVersions.badJsonResponse", { status: String(res.status) }));
      if (!res.ok) {
        const emsg = typeof j.error === "string" ? j.error : t("admin.bibleVersions.deleteFailed", { status: String(res.status) });
        throw new Error(emsg + (res.status === 403 ? ` ${t("admin.bibleVersions.diskHint")}` : ""));
      }
      setMsg(t("admin.bibleVersions.deleteDone"));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleteBusy(null);
    }
  }

  const rows = index?.translations ?? [];

  return (
    <div className={ADMIN_MAIN_CLASS}>
      <h1 className="text-lg font-medium tracking-tight text-adminFg">{t("admin.bibleVersions.title")}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-adminMuted">
        {t("admin.bibleVersions.intro")}
      </p>

      <section className="mt-8 rounded-lg border border-adminLine/80 bg-adminPanel/40 p-4 md:p-5">
        <h2 className="text-[13px] font-medium text-adminFg">{t("admin.bibleVersions.formatTitle")}</h2>
        <pre className="mt-2 overflow-x-auto rounded-md bg-adminFg/[0.05] p-3 text-[11px] leading-relaxed text-adminFg/90">
          {`{
  "format": "${SELAH_BIBLE_FORMAT}",
  "books": {
    "GEN": {
      "1": { "1": "起初神创造天地。", "2": "…" }
    }
  }
}`}
        </pre>
        <p className="mt-2 text-[12px] text-adminMuted">{t("admin.bibleVersions.formatHint")}</p>
      </section>

      <form
        onSubmit={onSubmit}
        className="mt-8 max-w-xl space-y-3 rounded-lg border border-adminLine/80 bg-adminPanel/40 p-4 md:p-5"
      >
        <h2 className="text-[13px] font-medium text-adminFg">{t("admin.bibleVersions.uploadTitle")}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-[12px] text-adminMuted">
            <span className="mb-1 block text-adminFg/90">{t("admin.bibleVersions.fieldId")}</span>
            <input
              className="w-full rounded-md border border-adminLine bg-adminPanel px-2.5 py-1.5 text-[13px] text-adminFg"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="cuv"
              required
              pattern="[a-z0-9][a-z0-9_-]{0,47}"
            />
          </label>
          <label className="block text-[12px] text-adminMuted">
            <span className="mb-1 block text-adminFg/90">{t("admin.bibleVersions.fieldLanguage")}</span>
            <input
              className="w-full rounded-md border border-adminLine bg-adminPanel px-2.5 py-1.5 text-[13px] text-adminFg"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="zh-Hans"
              required
            />
          </label>
        </div>
        <label className="block text-[12px] text-adminMuted">
          <span className="mb-1 block text-adminFg/90">{t("admin.bibleVersions.fieldLabelZh")}</span>
          <input
            className="w-full rounded-md border border-adminLine bg-adminPanel px-2.5 py-1.5 text-[13px] text-adminFg"
            value={labelZh}
            onChange={(e) => setLabelZh(e.target.value)}
            required
          />
        </label>
        <label className="block text-[12px] text-adminMuted">
          <span className="mb-1 block text-adminFg/90">{t("admin.bibleVersions.fieldLabelEn")}</span>
          <input
            className="w-full rounded-md border border-adminLine bg-adminPanel px-2.5 py-1.5 text-[13px] text-adminFg"
            value={labelEn}
            onChange={(e) => setLabelEn(e.target.value)}
            required
          />
        </label>
        <label className="block text-[12px] text-adminMuted">
          <span className="mb-1 block text-adminFg/90">{t("admin.bibleVersions.fieldFile")}</span>
          <input
            type="file"
            accept=".json,application/json"
            className="w-full text-[13px] text-adminFg file:mr-3 file:rounded file:border-0 file:bg-adminFg/[0.08] file:px-2 file:py-1"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="submit"
          disabled={uploadBusy}
          className="rounded-md bg-adminFg px-3 py-1.5 text-[12px] font-medium text-adminPanel disabled:opacity-50"
        >
          {uploadBusy ? t("admin.bibleVersions.uploading") : t("admin.bibleVersions.uploadSubmit")}
        </button>
      </form>

      {err ? (
        <p className="mt-6 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-200">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="mt-4 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-100">
          {msg}
        </p>
      ) : null}

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[13px] font-medium text-adminFg">{t("admin.bibleVersions.listTitle")}</h2>
          <button
            type="button"
            onClick={() => void load()}
            className="text-[12px] text-adminMuted underline-offset-2 hover:text-adminFg hover:underline"
          >
            {t("common.refresh")}
          </button>
        </div>
        {loading ? (
          <p className="mt-3 text-[13px] text-adminMuted">{t("admin.bibleVersions.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="mt-3 text-[13px] text-adminMuted">{t("admin.bibleVersions.empty")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-adminLine/80">
            <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-adminLine/80 bg-adminPanel/60 text-adminMuted">
                  <th className="px-3 py-2 font-medium">{t("admin.bibleVersions.colId")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin.bibleVersions.colLabels")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin.bibleVersions.colVerses")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin.bibleVersions.colSize")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin.bibleVersions.colUpdated")}</th>
                  <th className="px-3 py-2 font-medium">{t("admin.bibleVersions.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isDefault = index?.defaultTranslationId === r.id;
                  return (
                    <tr key={r.id} className="border-b border-adminLine/40 text-adminFg">
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {r.id}
                        {isDefault ? (
                          <span className="ml-2 rounded bg-adminFg/[0.1] px-1.5 py-0.5 text-[10px] text-adminMuted">
                            {t("admin.bibleVersions.badgeDefault")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <div>{r.labelZh}</div>
                        <div className="text-adminMuted">{r.labelEn}</div>
                        <div className="text-[11px] text-adminMuted">{r.language}</div>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{r.verseCount.toLocaleString()}</td>
                      <td className="px-3 py-2 tabular-nums">{formatBytes(r.bytes)}</td>
                      <td className="px-3 py-2 text-adminMuted">{r.updatedAt.slice(0, 19).replace("T", " ")}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {!isDefault ? (
                            <button
                              type="button"
                              disabled={defaultBusy !== null}
                              onClick={() => void setDefault(r.id)}
                              className="rounded border border-adminLine px-2 py-1 text-[11px] hover:bg-adminFg/[0.06] disabled:opacity-50"
                            >
                              {defaultBusy === r.id ? "…" : t("admin.bibleVersions.setDefault")}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={deleteBusy !== null}
                            onClick={() => void removeTranslation(r.id)}
                            className="rounded border border-red-500/35 px-2 py-1 text-[11px] text-red-200 hover:bg-red-500/10 disabled:opacity-50"
                          >
                            {deleteBusy === r.id ? "…" : t("admin.bibleVersions.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
