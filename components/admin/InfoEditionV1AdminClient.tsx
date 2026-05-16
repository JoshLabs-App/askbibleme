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
import type {
  InfoEditionV1Generation,
  InfoEditionV1HistoryEntry,
  InfoEditionV1Workspace,
} from "@/lib/bible/info-edition-v1-types";
import type { ScriptureBook } from "@/lib/bible/scripture-books";
import { INFO_EDITION_V1_MAX_COMPARE_RUNS } from "@/lib/bible/info-edition-v1-types";
import { sortGenerationsWithPublishedFirst } from "@/lib/bible/info-edition-v1-publish";
import { InfoEditionCompareGrid } from "@/components/admin/InfoEditionCompareGrid";
import { dedupeConnectionProfiles, profileCompareDisplay } from "@/lib/ai/profile-display";
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
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function isCompareEntry(entry: InfoEditionV1HistoryEntry): boolean {
  if (entry.entryKind === "draft") return false;
  if (entry.entryKind === "compare") return true;
  return Boolean(entry.generations?.length);
}

function compareEntrySummary(entry: InfoEditionV1HistoryEntry, books: ScriptureBook[]): string {
  const b = books.find((x) => x.bookId === entry.bookId);
  const ref = `${b?.bookName ?? entry.bookId} ${entry.chapter}章`;
  const runs = entry.generations?.length ?? 0;
  const roles = entry.selectedGenerationRoleIds?.length ?? 0;
  const ai = entry.selectedProfileIds?.length ?? 0;
  if (runs > 0) return `${ref} · ${runs}路`;
  if (roles || ai) return `${ref} · ${roles}角色×${ai}AI`;
  return `${ref} · ${entry.descriptionCharCount}字`;
}

export function InfoEditionV1AdminClient() {
  const { t } = useLocale();
  const ie = useCallback((key: string, vars?: Record<string, string>) => t(`admin.infoEditionV1.${key}`, vars), [t]);
  const rt = useCallback((key: string, vars?: Record<string, string>) => t(`admin.bibleVersions.${key}`, vars), [t]);

  const [profilesBundle, setProfilesBundle] = useState<AIProfilesBundle>(() => emptyProfilesBundle());
  const [workspace, setWorkspace] = useState<InfoEditionV1Workspace | null>(null);
  const [bookId, setBookId] = useState("GEN");
  const [chapter, setChapter] = useState(1);
  const [descriptionRules, setDescriptionRules] = useState("");
  const [generationRoles, setGenerationRoles] = useState<GenerationRole[]>([]);
  const [selectedGenerationRoleIds, setSelectedGenerationRoleIds] = useState<Set<string>>(new Set());
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [chapterErr, setChapterErr] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [generations, setGenerations] = useState<InfoEditionV1Generation[] | null>(null);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [connectionsSyncedAt, setConnectionsSyncedAt] = useState<string | null>(null);

  const pauseAutoSaveRef = useRef(true);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bookMeta = useMemo(() => scriptureBooks.find((b) => b.bookId === bookId), [bookId]);
  const descriptionCharCount = descriptionRules.length;

  const profiles = profilesBundle.profiles;
  const readyProfiles = useMemo(
    () => profiles.filter((p) => p.baseUrl.trim() && p.model.trim()),
    [profiles],
  );

  const draftPayload = useCallback(
    () => ({
      bookId,
      chapter,
      descriptionRules,
      selectedProfileIds: [...selectedProfileIds],
      selectedGenerationRoleIds: [...selectedGenerationRoleIds],
    }),
    [bookId, chapter, descriptionRules, selectedGenerationRoleIds, selectedProfileIds],
  );

  const selectedProfilesForGenerate = useCallback((): AIConnectionProfile[] => {
    return readyProfiles.filter((p) => selectedProfileIds.has(p.id));
  }, [readyProfiles, selectedProfileIds]);

  const selectedRolesForGenerate = useCallback((): GenerationRole[] => {
    return generationRoles.filter((r) => selectedGenerationRoleIds.has(r.id));
  }, [generationRoles, selectedGenerationRoleIds]);

  const compareRunCount = selectedGenerationRoleIds.size * selectedProfileIds.size;

  const applyWorkspace = useCallback((ws: InfoEditionV1Workspace, opts?: { pauseAutoSave?: boolean }) => {
    if (opts?.pauseAutoSave !== false) pauseAutoSaveRef.current = true;
    setWorkspace(ws);
    setBookId(ws.current.bookId);
    setChapter(ws.current.chapter);
    setDescriptionRules(ws.current.descriptionRules);
    setSelectedProfileIds(new Set(ws.current.selectedProfileIds));
    const roleIds =
      ws.current.selectedGenerationRoleIds?.length > 0
        ? ws.current.selectedGenerationRoleIds
        : ws.current.generationRoleId
          ? [ws.current.generationRoleId]
          : [];
    setSelectedGenerationRoleIds(new Set(roleIds));
    if (opts?.pauseAutoSave !== false) {
      queueMicrotask(() => {
        pauseAutoSaveRef.current = false;
      });
    }
  }, []);

  const loadGenerationRoles = useCallback(async (preferredRoleIds?: string[]) => {
    try {
      const res = await fetch("/api/admin/generation-roles", { headers: { ...diskAuthHeaders() } });
      const j = await parseJson(res);
      if (!res.ok) return;
      const config = j.config as { defaultRoleId?: string; roles?: GenerationRole[] } | undefined;
      const list = (config?.roles ?? []).filter((r) => r.enabled);
      setGenerationRoles(list);
      const allowed = new Set(list.map((r) => r.id));
      const fromPreferred = (preferredRoleIds ?? []).filter((id) => allowed.has(id));
      if (fromPreferred.length) {
        pauseAutoSaveRef.current = true;
        setSelectedGenerationRoleIds(new Set(fromPreferred));
        queueMicrotask(() => {
          pauseAutoSaveRef.current = false;
        });
        return;
      }
      const def = config?.defaultRoleId;
      pauseAutoSaveRef.current = true;
      if (def && allowed.has(def)) {
        setSelectedGenerationRoleIds(new Set([def]));
      } else if (list[0]) {
        setSelectedGenerationRoleIds(new Set([list[0].id]));
      }
      queueMicrotask(() => {
        pauseAutoSaveRef.current = false;
      });
    } catch {
      /* ignore */
    }
  }, []);

  const loadWorkspace = useCallback(async () => {
    pauseAutoSaveRef.current = true;
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/bible/info-edition-v1", { headers: { ...diskAuthHeaders() } });
      const j = await parseJson(res);
      if (!res.ok) {
        const e = typeof j.error === "string" ? j.error : ie("loadFailed", { status: String(res.status) });
        throw new Error(e + (res.status === 403 ? ` ${rt("diskHint")}` : ""));
      }
      const ws = j.workspace as InfoEditionV1Workspace | undefined;
      if (ws?.current) applyWorkspace(ws, { pauseAutoSave: false });
      else setWorkspace(null);
      const preferredRoles =
        ws?.current?.selectedGenerationRoleIds?.length
          ? ws.current.selectedGenerationRoleIds
          : ws?.current?.generationRoleId
            ? [ws.current.generationRoleId]
            : undefined;
      await loadGenerationRoles(preferredRoles);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      pauseAutoSaveRef.current = false;
    }
  }, [applyWorkspace, ie, loadGenerationRoles, rt]);

  const persistDraft = useCallback(
    async (opts?: { silent?: boolean }) => {
      try {
        const res = await fetch("/api/admin/bible/info-edition-v1", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
          body: JSON.stringify({ action: "save_current", ...draftPayload() }),
        });
        const j = await parseJson(res);
        if (!res.ok) return false;
        const ws = j.workspace as InfoEditionV1Workspace | undefined;
        if (ws) setWorkspace(ws);
        return true;
      } catch {
        return false;
      }
    },
    [draftPayload],
  );

  const refreshChapterCheck = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ bookId, chapter: String(chapter) });
      const res = await fetch(`/api/admin/bible/info-edition-v1/chapter?${qs}`, {
        headers: { ...diskAuthHeaders() },
      });
      const j = await parseJson(res);
      if (!res.ok) {
        setChapterErr(typeof j.error === "string" ? j.error : null);
        return;
      }
      setChapterErr(null);
    } catch {
      setChapterErr(null);
    }
  }, [bookId, chapter]);

  const syncConnections = useCallback(async () => {
    const local = dedupeConnectionProfiles(loadProfilesFromStorage().profiles);
    const payload = local
      .filter((p) => p.baseUrl.trim())
      .map((p) => ({
        id: p.id,
        name: p.name,
        baseUrl: p.baseUrl,
        model: p.model,
      }));

    try {
      if (payload.length) {
        await fetch("/api/admin/ai-api-config/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
          body: JSON.stringify({ connections: payload }),
        });
      }
      const res = await fetch("/api/admin/ai-api-config/connections", {
        headers: { ...diskAuthHeaders() },
      });
      const j = await parseJson(res);
      if (!res.ok) return;

      const list = Array.isArray(j.connections) ? (j.connections as StudioConnectionPublic[]) : [];
      const fromApi = connectionsToProfiles(list);
      const useProfilesRaw =
        fromApi.length > 0
          ? fromApi
          : payload.map((p) => ({
              id: p.id,
              name: p.name,
              baseUrl: p.baseUrl,
              model: p.model,
              provider: "openai-compatible" as const,
            }));

      const useProfiles = dedupeConnectionProfiles(
        useProfilesRaw.filter((p) => p.baseUrl.trim() && p.model.trim()),
      );

      setProfilesBundle({ version: 1, activeProfileId: null, profiles: useProfiles });
      setConnectionsSyncedAt(typeof j.syncedAt === "string" ? j.syncedAt : null);
      const allowed = new Set(useProfiles.map((p) => p.id));
      setSelectedProfileIds((prev) => new Set([...prev].filter((id) => allowed.has(id))));
    } catch {
      setProfilesBundle(loadProfilesFromStorage());
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadWorkspace();
      if (!cancelled) await syncConnections();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadWorkspace, syncConnections]);

  useEffect(() => {
    if (loading || pauseAutoSaveRef.current) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      void persistDraft({ silent: true });
    }, 600);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [
    bookId,
    chapter,
    descriptionRules,
    loading,
    persistDraft,
    selectedGenerationRoleIds,
    selectedProfileIds,
  ]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === AI_PROFILES_STORAGE_KEY) void syncConnections();
    };
    const onFocus = () => void syncConnections();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [syncConnections]);

  useEffect(() => {
    void refreshChapterCheck();
  }, [refreshChapterCheck]);

  const toggleProfile = useCallback((id: string) => {
    setSelectedProfileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMsg(null);
  }, []);

  const selectAllProfiles = useCallback(() => {
    setSelectedProfileIds(new Set(readyProfiles.map((p) => p.id)));
    setMsg(null);
  }, [readyProfiles]);

  const clearProfiles = useCallback(() => {
    setSelectedProfileIds(new Set());
    setMsg(null);
  }, []);

  const saveCurrent = useCallback(async () => {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const ok = await persistDraft();
      if (!ok) throw new Error(ie("saveFailed", { status: "" }));
      setMsg(ie("saveDone"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [ie, persistDraft]);

  const toggleRole = useCallback((id: string) => {
    setSelectedGenerationRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMsg(null);
  }, []);

  const selectAllRoles = useCallback(() => {
    setSelectedGenerationRoleIds(new Set(generationRoles.map((r) => r.id)));
    setMsg(null);
  }, [generationRoles]);

  const clearRoles = useCallback(() => {
    setSelectedGenerationRoleIds(new Set());
    setMsg(null);
  }, []);

  const runGenerate = useCallback(
    async (opts?: { historyId?: string; persistToHistory?: boolean }) => {
      const pickedRoles = selectedRolesForGenerate();
      const picked = selectedProfilesForGenerate();
      if (!pickedRoles.length) {
        setErr(ie("needRole"));
        return;
      }
      if (!picked.length) {
        setErr(ie("needProfile"));
        return;
      }
      const runs = pickedRoles.length * picked.length;
      if (runs > INFO_EDITION_V1_MAX_COMPARE_RUNS) {
        setErr(ie("compareCap", { max: String(INFO_EDITION_V1_MAX_COMPARE_RUNS), count: String(runs) }));
        return;
      }
      setGenerating(true);
      setErr(null);
      setMsg(null);
      setActiveHistoryId(opts?.historyId ?? null);
      try {
        const res = await fetch("/api/admin/bible/info-edition-v1/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
          body: JSON.stringify({
            bookId,
            chapter,
            descriptionRules,
            generationRoleIds: pickedRoles.map((r) => r.id),
            profiles: picked.map((p) => ({
              id: p.id,
              name: p.name,
              settings: {
                provider: p.provider,
                baseUrl: p.baseUrl,
                model: p.model,
              },
            })),
          }),
        });
        const j = await parseJson(res);
        if (!res.ok) {
          const e = typeof j.error === "string" ? j.error : ie("generateFailed", { status: String(res.status) });
          throw new Error(e + (res.status === 403 ? ` ${rt("diskHint")}` : ""));
        }
        const gens = Array.isArray(j.generations) ? (j.generations as InfoEditionV1Generation[]) : [];
        const sorted = sortGenerationsWithPublishedFirst(gens);
        setGenerations(sorted);

        const saveAction = opts?.historyId ? "update_compare" : "save_compare";
        const saveBody: Record<string, unknown> = {
          action: saveAction,
          ...draftPayload(),
          generations: sorted,
        };
        if (opts?.historyId) saveBody.historyId = opts.historyId;
        const res2 = await fetch("/api/admin/bible/info-edition-v1", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
          body: JSON.stringify(saveBody),
        });
        const j2 = await parseJson(res2);
        if (res2.ok && j2.workspace) {
          applyWorkspace(j2.workspace as InfoEditionV1Workspace);
          const compareId = typeof j2.compareId === "string" ? j2.compareId : opts?.historyId ?? null;
          if (compareId) setActiveHistoryId(compareId);
          setHistoryOpen(true);
          setMsg(
            j2.published
              ? ie("generateDonePublished", { count: String(sorted.length) })
              : ie("generateDoneSaved", { count: String(sorted.length) }),
          );
        } else {
          setMsg(ie("generateDone", { count: String(sorted.length) }));
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
        setGenerations(null);
      } finally {
        setGenerating(false);
      }
    },
    [applyWorkspace, bookId, chapter, descriptionRules, draftPayload, ie, rt, selectedProfilesForGenerate, selectedRolesForGenerate],
  );

  const publishToReader = useCallback(async () => {
    if (!generations?.length) return;
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/bible/info-edition-v1", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
        body: JSON.stringify({
          action: "publish_reader",
          ...draftPayload(),
          generations,
        }),
      });
      const j = await parseJson(res);
      if (!res.ok) {
        const e = typeof j.error === "string" ? j.error : ie("publishReaderFailed");
        throw new Error(e);
      }
      if (j.published) setMsg(ie("publishReaderDone"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [draftPayload, generations, ie]);

  const archiveToHistory = useCallback(async () => {
    setArchiving(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/bible/info-edition-v1", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
        body: JSON.stringify({
          action: "archive",
          ...draftPayload(),
          ...(generations?.length ? { generations } : {}),
        }),
      });
      const j = await parseJson(res);
      if (!res.ok) {
        const e = typeof j.error === "string" ? j.error : ie("archiveFailed", { status: String(res.status) });
        throw new Error(e + (res.status === 403 ? ` ${rt("diskHint")}` : ""));
      }
      if (j.workspace) applyWorkspace(j.workspace as InfoEditionV1Workspace);
      setMsg(ie("archiveDone"));
      setHistoryOpen(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setArchiving(false);
    }
  }, [applyWorkspace, draftPayload, generations, ie, rt]);

  const loadCompareEntry = useCallback(
    (entry: InfoEditionV1HistoryEntry) => {
      pauseAutoSaveRef.current = true;
      setErr(null);
      setBookId(entry.bookId);
      setChapter(entry.chapter);
      setDescriptionRules(entry.descriptionRules);
      const roleIds =
        entry.selectedGenerationRoleIds?.length > 0
          ? entry.selectedGenerationRoleIds
          : entry.generationRoleId
            ? [entry.generationRoleId]
            : [];
      setSelectedGenerationRoleIds(new Set(roleIds));
      setSelectedProfileIds(new Set(entry.selectedProfileIds));
      setActiveHistoryId(entry.id);
      if (entry.generations?.length) {
        setGenerations(sortGenerationsWithPublishedFirst(entry.generations));
        setMsg(ie("compareLoaded"));
      } else {
        setGenerations(null);
        setMsg(ie("compareSettingsLoaded"));
      }
      queueMicrotask(() => {
        pauseAutoSaveRef.current = false;
        void persistDraft({ silent: true });
      });
    },
    [ie, persistDraft],
  );

  const deleteHistory = useCallback(
    async (historyId: string) => {
      if (!window.confirm(ie("confirmDeleteHistory"))) return;
      setErr(null);
      try {
        const res = await fetch("/api/admin/bible/info-edition-v1", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
          body: JSON.stringify({ action: "delete_history", historyId }),
        });
        const j = await parseJson(res);
        if (!res.ok) {
          const e = typeof j.error === "string" ? j.error : ie("deleteFailed");
          throw new Error(e);
        }
        if (j.workspace) applyWorkspace(j.workspace as InfoEditionV1Workspace);
        if (activeHistoryId === historyId) {
          setActiveHistoryId(null);
          setGenerations(null);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [activeHistoryId, applyWorkspace, ie],
  );

  const chipClass = (on: boolean) =>
    [
      "shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-medium transition-colors",
      on
        ? "border-adminFg/35 bg-adminFg/[0.12] text-adminFg"
        : "border-adminLine/70 bg-adminBg/40 text-adminFg/80 hover:bg-adminFg/[0.05]",
    ].join(" ");

  const actionClass =
    "shrink-0 rounded border border-adminLine/80 px-2 py-0.5 text-[11px] font-medium text-adminFg transition hover:bg-adminFg/[0.06] disabled:opacity-40";

  const canGenerate =
    selectedProfileIds.size > 0 &&
    selectedGenerationRoleIds.size > 0 &&
    compareRunCount > 0 &&
    compareRunCount <= INFO_EDITION_V1_MAX_COMPARE_RUNS;

  const history = workspace?.history ?? [];
  const compareHistory = useMemo(() => history.filter(isCompareEntry), [history]);
  const draftHistory = useMemo(() => history.filter((e) => !isCompareEntry(e)), [history]);
  const statusLine = err ?? msg;

  if (loading) {
    return <p className="mt-4 text-[12px] text-adminMuted">{rt("loading")}</p>;
  }

  return (
    <div className="mt-4 max-w-[min(100%,90rem)] space-y-3">
      {statusLine ? (
        <p
          className={[
            "text-[11px] leading-snug",
            err ? "text-red-700/90 dark:text-red-300/90" : "text-adminMuted",
          ].join(" ")}
        >
          {statusLine}
        </p>
      ) : null}
      {chapterErr ? <p className="text-[11px] text-amber-800/90 dark:text-amber-200/80">{chapterErr}</p> : null}

      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <select
          aria-label={ie("fieldBook")}
          value={bookId}
          onChange={(e) => {
            const next = e.target.value;
            setBookId(next);
            const meta = scriptureBooks.find((b) => b.bookId === next);
            if (meta && chapter > meta.chapters) setChapter(1);
            setMsg(null);
          }}
          className="max-w-[7.5rem] shrink-0 rounded border border-adminLine bg-adminBg py-0.5 pl-1.5 pr-6 text-[11px] text-adminFg outline-none focus:border-adminFg/25"
        >
          {scriptureBooks.map((b) => (
            <option key={b.bookId} value={b.bookId}>
              {b.bookName}
            </option>
          ))}
        </select>
        <select
          aria-label={ie("fieldChapter")}
          value={chapter}
          onChange={(e) => {
            setChapter(Number(e.target.value));
            setMsg(null);
          }}
          className="w-14 shrink-0 rounded border border-adminLine bg-adminBg py-0.5 pl-1.5 pr-5 text-[11px] tabular-nums text-adminFg outline-none focus:border-adminFg/25"
        >
          {Array.from({ length: bookMeta?.chapters ?? 1 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <span className="shrink-0 text-[10px] uppercase tracking-wide text-adminMuted">{ie("aiRow")}</span>

        {readyProfiles.length === 0 ? (
          <span className="shrink-0 text-[11px] text-adminMuted">
            <Link href="/admin/studio" className="underline underline-offset-2">
              Studio
            </Link>
            {ie("profilesEmptyMini")}
          </span>
        ) : (
          <>
            {readyProfiles.map((p) => {
              const on = selectedProfileIds.has(p.id);
              const { chip, sizeGb, hint, title } = profileCompareDisplay(p, readyProfiles);
              return (
                <button
                  key={p.id}
                  type="button"
                  title={title}
                  onClick={() => toggleProfile(p.id)}
                  aria-pressed={on}
                  className={[chipClass(on), "max-w-[11rem] py-1 text-left leading-snug"].join(" ")}
                >
                  <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                    <span className="text-[11px] font-medium">{chip}</span>
                    {sizeGb ? (
                      <span className="text-[9px] font-normal tabular-nums text-adminMuted">{sizeGb}</span>
                    ) : null}
                  </span>
                  {hint ? (
                    <span className="mt-0.5 block text-[9px] font-normal text-adminMuted line-clamp-2">
                      {hint}
                    </span>
                  ) : null}
                </button>
              );
            })}
            <button type="button" onClick={selectAllProfiles} className={actionClass} title={ie("selectAllProfiles")}>
              {ie("allShort")}
            </button>
            <button
              type="button"
              onClick={clearProfiles}
              disabled={!selectedProfileIds.size}
              className={actionClass}
              title={ie("clearProfiles")}
            >
              {ie("clearShort")}
            </button>
          </>
        )}

        <span className="ml-auto shrink-0 tabular-nums text-[10px] text-adminMuted">
          {compareRunCount > 0
            ? ie("compareRuns", {
                count: String(compareRunCount),
                max: String(INFO_EDITION_V1_MAX_COMPARE_RUNS),
              })
            : null}
          {connectionsSyncedAt ? ` · ${ie("profilesLive")}` : ""}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-adminMuted">{ie("rolesRow")}</span>
        {generationRoles.length === 0 ? (
          <span className="text-[11px] text-adminMuted">
            <Link href="/admin/system/generation-roles" className="underline underline-offset-2">
              {ie("roleManage")}
            </Link>
          </span>
        ) : (
          <>
            {generationRoles.map((r) => {
              const on = selectedGenerationRoleIds.has(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  title={r.hint || r.label}
                  onClick={() => toggleRole(r.id)}
                  aria-pressed={on}
                  className={chipClass(on)}
                >
                  {r.label}
                </button>
              );
            })}
            <button type="button" onClick={selectAllRoles} className={actionClass} title={ie("selectAllRoles")}>
              {ie("allShort")}
            </button>
            <button
              type="button"
              onClick={clearRoles}
              disabled={!selectedGenerationRoleIds.size}
              className={actionClass}
              title={ie("clearRoles")}
            >
              {ie("clearShort")}
            </button>
            <Link
              href="/admin/system/generation-roles"
              className="shrink-0 text-[10px] text-adminMuted underline underline-offset-2 hover:text-adminFg"
            >
              {ie("roleManage")}
            </Link>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-y border-adminLine/50 py-2">
        <button type="button" onClick={() => void saveCurrent()} disabled={saving} className={actionClass}>
          {saving ? ie("saving") : ie("saveShort")}
        </button>
        <button
          type="button"
          onClick={() => void archiveToHistory()}
          disabled={archiving}
          className={actionClass}
          title={ie("archive")}
        >
          {archiving ? ie("archiving") : ie("archiveShort")}
        </button>
        <button
          type="button"
          onClick={() => void runGenerate({ persistToHistory: false })}
          disabled={generating || !canGenerate}
          title={
            compareRunCount > INFO_EDITION_V1_MAX_COMPARE_RUNS
              ? ie("compareCap", {
                  max: String(INFO_EDITION_V1_MAX_COMPARE_RUNS),
                  count: String(compareRunCount),
                })
              : ie("generateCompare")
          }
          className="shrink-0 rounded border border-adminFg/35 bg-adminFg/[0.14] px-3.5 py-1 text-[12px] font-semibold text-adminFg shadow-sm transition hover:bg-adminFg/[0.2] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {generating ? ie("generating") : ie("generateCompare")}
        </button>
        <button
          type="button"
          onClick={() => void publishToReader()}
          disabled={!generations?.length}
          className={actionClass}
          title={ie("publishReader")}
        >
          {ie("publishReader")}
        </button>
        <span className="text-[10px] tabular-nums text-adminMuted">
          {ie("charCount", { count: String(descriptionCharCount) })}
        </span>
        {!canGenerate && !generating && selectedProfileIds.size > 0 && !selectedGenerationRoleIds.size ? (
          <span className="text-[10px] text-amber-800/90 dark:text-amber-200/80">{ie("needRole")}</span>
        ) : null}
        {!canGenerate && !generating && selectedGenerationRoleIds.size > 0 && !selectedProfileIds.size ? (
          <span className="text-[10px] text-amber-800/90 dark:text-amber-200/80">{ie("needProfile")}</span>
        ) : null}
        {!canGenerate && !generating && compareRunCount > INFO_EDITION_V1_MAX_COMPARE_RUNS ? (
          <span className="text-[10px] text-amber-800/90 dark:text-amber-200/80">
            {ie("compareCap", {
              max: String(INFO_EDITION_V1_MAX_COMPARE_RUNS),
              count: String(compareRunCount),
            })}
          </span>
        ) : null}
      </div>

      <textarea
        id="info-edition-rules"
        value={descriptionRules}
        onChange={(e) => {
          setDescriptionRules(e.target.value);
          setMsg(null);
        }}
        rows={4}
        placeholder={ie("rulesPlaceholder")}
        className="w-full resize-y rounded border border-adminLine/80 bg-adminBg/50 px-2.5 py-2 text-[12px] leading-relaxed text-adminFg outline-none placeholder:text-adminMuted/50 focus:border-adminFg/20"
      />

      <div className="border-t border-adminLine/60 pt-2">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className="flex w-full items-center gap-2 text-left text-[11px] text-adminMuted hover:text-adminFg"
          aria-expanded={historyOpen}
        >
          <span>{historyOpen ? "▾" : "▸"}</span>
          <span>{ie("compareHistoryTitle")}</span>
          <span className="tabular-nums">({compareHistory.length})</span>
        </button>
        <p className="mt-0.5 text-[10px] text-adminMuted">{ie("compareHistoryHint")}</p>
        {historyOpen && compareHistory.length > 0 ? (
          <ul className="mt-1.5 space-y-1">
            {compareHistory.map((entry) => {
              const active = activeHistoryId === entry.id;
              return (
                <li key={entry.id} className="flex flex-nowrap items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => loadCompareEntry(entry)}
                    className={[
                      "min-w-0 flex-1 truncate text-left",
                      active ? "font-medium text-adminFg" : "text-adminFg/85 hover:text-adminFg",
                    ].join(" ")}
                    title={ie("loadCompare")}
                  >
                    {compareEntrySummary(entry, scriptureBooks)}
                  </button>
                  <span className="shrink-0 tabular-nums text-[10px] text-adminMuted/80">
                    {formatSavedAt(entry.generatedAt ?? entry.savedAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void deleteHistory(entry.id)}
                    className="shrink-0 text-[10px] text-adminMuted hover:text-adminFg"
                    aria-label={ie("delete")}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        ) : historyOpen ? (
          <p className="mt-1 text-[11px] text-adminMuted">{ie("compareHistoryEmpty")}</p>
        ) : null}

        {draftHistory.length > 0 ? (
          <div className="mt-3 border-t border-adminLine/40 pt-2">
            <p className="text-[10px] uppercase tracking-wide text-adminMuted">
              {ie("draftHistoryTitle")} ({draftHistory.length})
            </p>
            <p className="mt-0.5 text-[10px] text-adminMuted">{ie("draftHistoryHint")}</p>
            <ul className="mt-1 space-y-1">
              {draftHistory.map((entry) => (
                <li key={entry.id} className="flex flex-nowrap items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => loadCompareEntry(entry)}
                    className="min-w-0 flex-1 truncate text-left text-adminFg/85 hover:text-adminFg"
                    title={ie("loadDraft")}
                  >
                    {compareEntrySummary(entry, scriptureBooks)}
                  </button>
                  <span className="shrink-0 text-[10px] text-adminMuted/80">{formatSavedAt(entry.savedAt)}</span>
                  <button
                    type="button"
                    onClick={() => void deleteHistory(entry.id)}
                    className="shrink-0 text-[10px] text-adminMuted hover:text-adminFg"
                    aria-label={ie("delete")}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {generations?.length ? (
        <InfoEditionCompareGrid
          generations={generations}
          profiles={readyProfiles}
          hint={ie("compareLayoutHint")}
        />
      ) : null}
    </div>
  );
}
