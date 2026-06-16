"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  AI_PROFILES_STORAGE_KEY,
  AI_SETTINGS_LEGACY_KEY,
  bundleFromLegacySettingsJson,
  emptyProfilesBundle,
} from "@/lib/ai/storage";
import type { AIConnectionProfile, AIProfilesBundle } from "@/lib/ai/types";
import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";
import {
  pickDefaultInfoEditionProfileIds,
  sortProfilesForInfoEditionProduction,
} from "@/lib/bible/info-edition-v1-publish";
import {
  isInfoEditionV3CritiqueRole,
  pickDefaultV3CritiqueRoleIds,
  sortRolesForV3Critique,
} from "@/lib/bible/info-edition-v3-correction-roles";
import type {
  InfoEditionV3ChapterSource,
  InfoEditionV3HistoryEntry,
  InfoEditionV3Workspace,
} from "@/lib/bible/info-edition-v3-correction-types";
import { INFO_EDITION_V3_MAX_COMPARE_RUNS } from "@/lib/bible/info-edition-v3-correction-types";
import { InfoEditionCompareGrid } from "@/components/admin/InfoEditionCompareGrid";
import { InfoEditionCompareMarkdown } from "@/components/admin/InfoEditionCompareMarkdown";
import { dedupeConnectionProfiles } from "@/lib/ai/profile-display";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { diskAuthHeaders } from "@/lib/disk-auth-headers";
import type { StudioConnectionPublic } from "@/lib/admin/ai-api-config-types";
import type { GenerationRole } from "@/lib/admin/generation-roles-types";

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function loadProfilesFromStorage(): AIProfilesBundle {
  if (typeof window === "undefined") return emptyProfilesBundle();
  try {
    const raw = localStorage.getItem(AI_PROFILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AIProfilesBundle;
      if (parsed?.version === 1 && Array.isArray(parsed.profiles)) return parsed;
    }
    const legacy = localStorage.getItem(AI_SETTINGS_LEGACY_KEY);
    if (legacy) {
      const migrated = bundleFromLegacySettingsJson(legacy);
      if (migrated) return migrated;
    }
  } catch {
    /* ignore */
  }
  return emptyProfilesBundle();
}

function connectionsToProfiles(connections: StudioConnectionPublic[]): AIConnectionProfile[] {
  return connections.map((c) => ({
    id: c.id,
    name: c.name,
    baseUrl: c.baseUrl,
    model: c.model,
    provider: "openai-compatible",
  }));
}

function formatSavedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function SourcePanel({
  title,
  source,
  emptyLabel,
}: {
  title: string;
  source: InfoEditionV3ChapterSource["infoV1"];
  emptyLabel: string;
}) {
  return (
    <article className="min-w-0 flex-1 rounded-md border border-adminLine/80 bg-adminBg/40">
      <header className="border-b border-adminLine/60 px-3 py-2">
        <p className="text-[12px] font-semibold text-adminFg">{title}</p>
        {source ? (
          <p className="mt-0.5 text-[10px] text-adminMuted tabular-nums">
            {source.charCount} 字 · {source.roleLabel}
            {source.publishedAt ? ` · ${formatSavedAt(source.publishedAt)}` : ""}
          </p>
        ) : (
          <p className="mt-0.5 text-[10px] text-amber-800/90 dark:text-amber-200/90">{emptyLabel}</p>
        )}
      </header>
      <div className="max-h-[min(36vh,320px)] overflow-y-auto px-3 py-2">
        {source?.markdown ? (
          <InfoEditionCompareMarkdown content={source.markdown} />
        ) : (
          <p className="text-[11px] text-adminMuted">—</p>
        )}
      </div>
    </article>
  );
}

export function InfoEditionV3AdminClient() {
  const { t } = useLocale();
  const ie = useCallback((key: string, vars?: Record<string, string>) => t(`admin.infoEditionV3.${key}`, vars), [t]);
  const rt = useCallback((key: string) => t(`admin.bibleVersions.${key}`), [t]);

  const [profilesBundle, setProfilesBundle] = useState<AIProfilesBundle>(() => emptyProfilesBundle());
  const [workspace, setWorkspace] = useState<InfoEditionV3Workspace | null>(null);
  const [bookId, setBookId] = useState("GEN");
  const [chapter, setChapter] = useState(36);
  const [editorNotes, setEditorNotes] = useState("");
  const [generationRoles, setGenerationRoles] = useState<GenerationRole[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [source, setSource] = useState<InfoEditionV3ChapterSource | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyDryRun, setApplyDryRun] = useState(false);
  const [generations, setGenerations] = useState<InfoEditionV1Generation[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const pauseAutoSaveRef = useRef(true);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bookMeta = useMemo(() => scriptureBooks.find((b) => b.bookId === bookId), [bookId]);
  const critiqueRoles = useMemo(
    () => sortRolesForV3Critique(generationRoles.filter(isInfoEditionV3CritiqueRole)),
    [generationRoles],
  );
  const readyProfiles = useMemo(
    () => sortProfilesForInfoEditionProduction(profilesBundle.profiles.filter((p) => p.baseUrl.trim() && p.model.trim())),
    [profilesBundle.profiles],
  );
  const compareRunCount = selectedRoleIds.size * selectedProfileIds.size;

  const draftPayload = useCallback(
    () => ({
      bookId,
      chapter,
      editorNotes,
      critiqueText: "",
      selectedProfileIds: [...selectedProfileIds],
      selectedGenerationRoleIds: [...selectedRoleIds],
    }),
    [bookId, chapter, editorNotes, selectedProfileIds, selectedRoleIds],
  );

  const applyWorkspace = useCallback((ws: InfoEditionV3Workspace) => {
    pauseAutoSaveRef.current = true;
    setWorkspace(ws);
    setBookId(ws.current.bookId);
    setChapter(ws.current.chapter);
    setEditorNotes(ws.current.editorNotes);
    setSelectedProfileIds(new Set(ws.current.selectedProfileIds));
    setSelectedRoleIds(new Set(ws.current.selectedGenerationRoleIds));
    queueMicrotask(() => {
      pauseAutoSaveRef.current = false;
    });
  }, []);

  const persistDraft = useCallback(async () => {
    const res = await fetch("/api/admin/bible/info-edition-v3", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
      body: JSON.stringify({ action: "save_current", ...draftPayload() }),
    });
    const j = await parseJson(res);
    if (res.ok && j.workspace) setWorkspace(j.workspace as InfoEditionV3Workspace);
    return res.ok;
  }, [draftPayload]);

  const loadSource = useCallback(async () => {
    setSourceLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({ bookId, chapter: String(chapter) });
      const res = await fetch(`/api/admin/bible/info-edition-v3/source?${qs}`, {
        headers: { ...diskAuthHeaders() },
      });
      const j = await parseJson(res);
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : ie("sourceFailed"));
      }
      setSource(j.source as InfoEditionV3ChapterSource);
    } catch (e) {
      setSource(null);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSourceLoading(false);
    }
  }, [bookId, chapter, ie]);

  const syncConnections = useCallback(async () => {
    const local = dedupeConnectionProfiles(loadProfilesFromStorage().profiles);
    const payload = local
      .filter((p) => p.baseUrl.trim())
      .map((p) => ({ id: p.id, name: p.name, baseUrl: p.baseUrl, model: p.model }));
    try {
      if (payload.length) {
        await fetch("/api/admin/ai-api-config/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
          body: JSON.stringify({ connections: payload }),
        });
      }
      const res = await fetch("/api/admin/ai-api-config/connections", { headers: { ...diskAuthHeaders() } });
      const j = await parseJson(res);
      if (!res.ok) return;
      const list = Array.isArray(j.connections) ? (j.connections as StudioConnectionPublic[]) : [];
      const fromApi = connectionsToProfiles(list);
      const useProfiles = dedupeConnectionProfiles(
        (fromApi.length ? fromApi : payload.map((p) => ({ ...p, provider: "openai-compatible" as const }))).filter(
          (p) => p.baseUrl.trim() && p.model.trim(),
        ),
      );
      const sorted = sortProfilesForInfoEditionProduction(useProfiles);
      setProfilesBundle({ version: 1, activeProfileId: null, profiles: sorted });
      setSelectedProfileIds((prev) => {
        const allowed = new Set(sorted.map((p) => p.id));
        const filtered = new Set([...prev].filter((id) => allowed.has(id)));
        return filtered.size ? filtered : new Set(pickDefaultInfoEditionProfileIds(sorted));
      });
    } catch {
      setProfilesBundle(loadProfilesFromStorage());
    }
  }, []);

  const loadGenerationRoles = useCallback(async (preferred?: string[]) => {
    const res = await fetch("/api/admin/generation-roles", { headers: { ...diskAuthHeaders() } });
    const j = await parseJson(res);
    if (!res.ok) return;
    const config = j.config as { roles?: GenerationRole[] } | undefined;
    const all = (config?.roles ?? []).filter((r) => r.enabled);
    setGenerationRoles(all);
    const v3 = sortRolesForV3Critique(all.filter(isInfoEditionV3CritiqueRole));
    const allowed = new Set(v3.map((r) => r.id));
    const fromPreferred = (preferred ?? []).filter((id) => allowed.has(id));
    setSelectedRoleIds(new Set(fromPreferred.length ? fromPreferred : pickDefaultV3CritiqueRoleIds(v3)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/bible/info-edition-v3", { headers: { ...diskAuthHeaders() } });
        const j = await parseJson(res);
        if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : ie("loadFailed"));
        if (!cancelled && j.workspace) applyWorkspace(j.workspace as InfoEditionV3Workspace);
        await loadGenerationRoles(
          (j.workspace as InfoEditionV3Workspace | undefined)?.current.selectedGenerationRoleIds,
        );
        if (!cancelled) await syncConnections();
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) {
          setLoading(false);
          pauseAutoSaveRef.current = false;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyWorkspace, ie, loadGenerationRoles, syncConnections]);

  useEffect(() => {
    if (loading || pauseAutoSaveRef.current) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => void persistDraft(), 600);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [bookId, chapter, editorNotes, loading, persistDraft, selectedProfileIds, selectedRoleIds]);

  useEffect(() => {
    void loadSource();
  }, [loadSource]);

  const runGenerate = useCallback(async () => {
    const roles = critiqueRoles.filter((r) => selectedRoleIds.has(r.id));
    const profiles = readyProfiles.filter((p) => selectedProfileIds.has(p.id));
    if (!roles.length) {
      setErr(ie("needRole"));
      return;
    }
    if (!profiles.length) {
      setErr(ie("needProfile"));
      return;
    }
    if (compareRunCount > INFO_EDITION_V3_MAX_COMPARE_RUNS) {
      setErr(ie("compareCap", { max: String(INFO_EDITION_V3_MAX_COMPARE_RUNS), count: String(compareRunCount) }));
      return;
    }
    setGenerating(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/bible/info-edition-v3/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
        body: JSON.stringify({
          ...draftPayload(),
          generationRoleIds: roles.map((r) => r.id),
          profiles: profiles.map((p) => ({
            id: p.id,
            name: p.name,
            settings: { provider: p.provider, baseUrl: p.baseUrl, model: p.model },
          })),
        }),
      });
      const j = await parseJson(res);
      if (!res.ok) {
        throw new Error(
          (typeof j.error === "string" ? j.error : ie("generateFailed")) +
            (res.status === 403 ? ` ${rt("diskHint")}` : ""),
        );
      }
      const gens = Array.isArray(j.generations) ? (j.generations as InfoEditionV1Generation[]) : [];
      setGenerations(gens);

      const res2 = await fetch("/api/admin/bible/info-edition-v3", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
        body: JSON.stringify({ action: "save_compare", ...draftPayload(), generations: gens }),
      });
      const j2 = await parseJson(res2);
      if (res2.ok && j2.workspace) {
        applyWorkspace(j2.workspace as InfoEditionV3Workspace);
        setHistoryOpen(true);
      }

      setMsg(ie("generateDone", { count: String(gens.length) }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setGenerations(null);
    } finally {
      setGenerating(false);
    }
  }, [
    applyWorkspace,
    compareRunCount,
    draftPayload,
    ie,
    readyProfiles,
    rt,
    selectedProfileIds,
    selectedRoleIds,
    critiqueRoles,
  ]);

  const runApply = useCallback(async () => {
    setApplying(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/bible/info-edition-v3/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
        body: JSON.stringify({
          bookId,
          chapter,
          editorNotes,
          dryRun: applyDryRun,
        }),
      });
      const j = await parseJson(res);
      if (!res.ok || j.ok === false) {
        throw new Error(
          (typeof j.error === "string" ? j.error : ie("applyFailed")) +
            (res.status === 403 ? ` ${rt("diskHint")}` : ""),
        );
      }
      const parts: string[] = [];
      if (j.publishedInfo && typeof j.publishedInfo === "object") {
        const pi = j.publishedInfo as { charCount?: number };
        parts.push(`${ie("infoV1Title")} ${pi.charCount ?? "—"}字`);
      }
      if (j.publishedGuide && typeof j.publishedGuide === "object") {
        const pg = j.publishedGuide as { charCount?: number };
        parts.push(`${ie("guideV2Title")} ${pg.charCount ?? "—"}字`);
      }
      if (applyDryRun) {
        if (j.reviseInfo && typeof j.reviseInfo === "object") {
          const ri = j.reviseInfo as { charCount?: number };
          parts.push(`${ie("infoV1Title")} ${ri.charCount ?? "—"}字`);
        }
        if (j.reviseGuide && typeof j.reviseGuide === "object") {
          const rg = j.reviseGuide as { charCount?: number };
          parts.push(`${ie("guideV2Title")} ${rg.charCount ?? "—"}字`);
        }
      }
      const critique = j.critique as InfoEditionV1Generation | undefined;
      if (critique?.text) setGenerations([critique]);
      if (Array.isArray(j.errors) && j.errors.length) {
        setErr((j.errors as string[]).join("；"));
      }
      if (parts.length) {
        setMsg(ie("applyDone", { parts: parts.join(" · ") }));
      }
      if (!applyDryRun && j.ok) await loadSource();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  }, [applyDryRun, bookId, chapter, editorNotes, ie, loadSource, rt]);

  const restoreHistory = useCallback(
    async (entry: InfoEditionV3HistoryEntry) => {
      const res = await fetch("/api/admin/bible/info-edition-v3", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
        body: JSON.stringify({ action: "restore_history", historyId: entry.id }),
      });
      const j = await parseJson(res);
      if (res.ok && j.workspace) {
        applyWorkspace(j.workspace as InfoEditionV3Workspace);
        if (entry.generations?.length) setGenerations(entry.generations);
        setMsg(ie("historyLoaded"));
      }
    },
    [applyWorkspace, ie],
  );

  const history = workspace?.history ?? [];
  const compareHistory = history.filter((h) => h.entryKind === "compare" && h.generations?.length);

  if (loading) {
    return <p className="text-[13px] text-adminMuted">{ie("loading")}</p>;
  }

  return (
    <div className="mt-4 space-y-4 text-adminFg">
      <p className="text-[12px] leading-relaxed text-adminMuted">{ie("intro")}</p>
      <p className="text-[10px] font-mono text-adminMuted/80">{ie("fileLine")}</p>
      <p className="text-[11px]">
        <Link href="/admin/read/info-edition-v3-batch" className="underline text-amber-900/90 hover:text-adminFg dark:text-amber-200/90">
          全书批量纠错（断点续跑）→
        </Link>
      </p>

      {err ? <p className="text-[12px] text-red-700 dark:text-red-300">{err}</p> : null}
      {msg ? <p className="text-[12px] text-emerald-800 dark:text-emerald-200">{msg}</p> : null}

      <section className="rounded-lg border border-adminLine/70 bg-adminPanel/50 p-3">
        <h2 className="text-[12px] font-semibold">{ie("scopeTitle")}</h2>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-adminMuted">{ie("fieldBook")}</span>
            <select
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              className="rounded border border-adminLine bg-white px-2 py-1.5 text-[12px]"
            >
              {scriptureBooks.map((b) => (
                <option key={b.bookId} value={b.bookId}>
                  {b.bookName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-adminMuted">{ie("fieldChapter")}</span>
            <select
              value={chapter}
              onChange={(e) => setChapter(Number(e.target.value))}
              className="rounded border border-adminLine bg-white px-2 py-1.5 text-[12px] tabular-nums"
            >
              {Array.from({ length: bookMeta?.chapters ?? 1 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {ie("chapterOption", { n: String(n) })}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={sourceLoading}
            onClick={() => void loadSource()}
            className="rounded border border-adminLine/80 px-2.5 py-1.5 text-[11px] font-medium hover:bg-adminFg/[0.06] disabled:opacity-45"
          >
            {sourceLoading ? ie("sourceLoading") : ie("reloadSource")}
          </button>
        </div>
        {source ? (
          <p className="mt-2 text-[10px] text-adminMuted">
            {ie("sourceMeta", {
              verses: String(source.verseCount),
              translation: source.labelZh,
            })}
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-[12px] font-semibold">{ie("publishedTitle")}</h2>
        <p className="text-[10px] leading-relaxed text-adminMuted">{ie("publishedHint")}</p>
        <div className="flex flex-col gap-3 lg:flex-row">
          <SourcePanel title={ie("infoV1Title")} source={source?.infoV1 ?? null} emptyLabel={ie("infoV1Empty")} />
          <SourcePanel title={ie("guideV2Title")} source={source?.guideV2 ?? null} emptyLabel={ie("guideV2Empty")} />
        </div>
      </section>

      <section className="space-y-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-adminMuted">{ie("editorNotesTitle")}</span>
          <textarea
            value={editorNotes}
            onChange={(e) => setEditorNotes(e.target.value)}
            rows={3}
            placeholder={ie("editorNotesPlaceholder")}
            className="min-h-[4rem] rounded border border-adminLine bg-white px-2.5 py-2 text-[12px] leading-relaxed"
          />
          <p className="text-[10px] text-adminMuted">{ie("editorNotesHint")}</p>
        </label>
      </section>

      <section className="rounded-lg border border-adminLine/70 bg-adminPanel/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[12px] font-semibold">{ie("rolesTitle")}</h2>
          <Link href="/admin/system/generation-roles" className="text-[10px] text-adminMuted underline hover:text-adminFg">
            {ie("roleManage")}
          </Link>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {critiqueRoles.map((r) => {
            const on = selectedRoleIds.has(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() =>
                  setSelectedRoleIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(r.id)) next.delete(r.id);
                    else next.add(r.id);
                    return next;
                  })
                }
                className={[
                  "rounded-full border px-2.5 py-1 text-[10px] transition",
                  on
                    ? "border-adminFg/35 bg-adminFg/[0.12] font-medium text-adminFg"
                    : "border-adminLine/70 text-adminMuted hover:text-adminFg",
                ].join(" ")}
                title={r.hint}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] text-adminMuted">{ie("rolesHint")}</p>

        <h3 className="mt-4 text-[11px] font-semibold">{ie("profilesTitle")}</h3>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {readyProfiles.map((p) => {
            const on = selectedProfileIds.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  setSelectedProfileIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(p.id)) next.delete(p.id);
                    else next.add(p.id);
                    return next;
                  })
                }
                className={[
                  "rounded border px-2 py-0.5 text-[10px]",
                  on ? "border-adminFg/35 bg-adminFg/[0.1] font-medium" : "border-adminLine/60 text-adminMuted",
                ].join(" ")}
              >
                {p.name || p.model}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={generating || compareRunCount === 0 || compareRunCount > INFO_EDITION_V3_MAX_COMPARE_RUNS}
            onClick={() => void runGenerate()}
            className="rounded border border-adminFg/40 bg-adminFg px-4 py-1.5 text-[12px] font-semibold text-adminBg disabled:opacity-45"
          >
            {generating ? ie("generating") : ie("generateCompare")}
          </button>
          <span className="text-[10px] text-adminMuted">
            {compareRunCount > 0
              ? ie("compareRuns", { count: String(compareRunCount), max: String(INFO_EDITION_V3_MAX_COMPARE_RUNS) })
              : ie("pickRolesAndAi")}
          </span>
        </div>
      </section>

      <section className="rounded-lg border border-amber-700/25 bg-amber-50/40 p-3 dark:border-amber-400/20 dark:bg-amber-950/20">
        <h2 className="text-[12px] font-semibold">{ie("applyTitle")}</h2>
        <p className="mt-1 text-[10px] leading-relaxed text-adminMuted">{ie("applyHint")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={applying || generating || sourceLoading}
            onClick={() => void runApply()}
            className="rounded border border-amber-800/40 bg-amber-900 px-4 py-1.5 text-[12px] font-semibold text-amber-50 disabled:opacity-45 dark:border-amber-300/30 dark:bg-amber-200 dark:text-amber-950"
          >
            {applying ? ie("applying") : ie("applyButton")}
          </button>
          <label className="flex items-center gap-1.5 text-[10px] text-adminMuted">
            <input
              type="checkbox"
              checked={applyDryRun}
              onChange={(e) => setApplyDryRun(e.target.checked)}
              className="rounded border-adminLine"
            />
            {ie("applyDryRun")}
          </label>
        </div>
      </section>

      {generations?.length ? (
        <section>
          <InfoEditionCompareGrid generations={generations} profiles={readyProfiles} hint={ie("compareLayoutHint")} />
        </section>
      ) : null}

      <section className="border-t border-adminLine/50 pt-3">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className="text-[11px] font-medium text-adminFg"
        >
          {ie("compareHistoryTitle")} ({compareHistory.length})
        </button>
        {historyOpen && compareHistory.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {compareHistory.map((entry) => {
              const b = scriptureBooks.find((x) => x.bookId === entry.bookId);
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => void restoreHistory(entry)}
                    className="w-full rounded border border-adminLine/60 px-2 py-1.5 text-left text-[11px] hover:bg-adminFg/[0.04]"
                  >
                    {b?.bookName ?? entry.bookId} {entry.chapter}章 · {entry.generations?.length ?? 0} 路 ·{" "}
                    {formatSavedAt(entry.savedAt)}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : historyOpen ? (
          <p className="mt-1 text-[11px] text-adminMuted">{ie("compareHistoryEmpty")}</p>
        ) : null}
      </section>
    </div>
  );
}
