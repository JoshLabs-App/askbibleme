"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  AI_PROFILES_STORAGE_KEY,
  AI_SETTINGS_LEGACY_KEY,
  bundleFromLegacySettingsJson,
  emptyProfilesBundle,
} from "@/lib/ai/storage";
import type { AIConnectionProfile, AIProfilesBundle } from "@/lib/ai/types";
import { dedupeConnectionProfiles } from "@/lib/ai/profile-display";
import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";
import {
  pickDefaultInfoEditionProfileIds,
  sortProfilesForInfoEditionProduction,
} from "@/lib/bible/info-edition-v1-publish";
import {
  isInfoEditionV4CompileRole,
  isInfoEditionV4ReviseRole,
  pickDefaultV4RoleIds,
  sortRolesForV4Phase,
} from "@/lib/bible/info-edition-v4-roles";
import type { InfoEditionV4HistoryEntry, InfoEditionV4Workspace } from "@/lib/bible/info-edition-v4-types";
import { INFO_EDITION_V4_MAX_COMPARE_RUNS } from "@/lib/bible/info-edition-v4-types";
import {
  InfoEditionV4PairCompareGrid,
  type InfoEditionV4ResultPair,
} from "@/components/admin/InfoEditionV4PairCompareGrid";
import { diskAuthHeaders } from "@/lib/disk-auth-headers";
import type { StudioConnectionPublic } from "@/lib/admin/ai-api-config-types";
import type { GenerationRole } from "@/lib/admin/generation-roles-types";

type PipelineStep = "compile" | "revise" | null;

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

function RolePicker({
  title,
  roles,
  selected,
  onToggle,
  emptyLabel,
}: {
  title: string;
  roles: GenerationRole[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  emptyLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-adminFg">{title}</p>
      {roles.length ? (
        <div className="flex flex-wrap gap-1.5">
          {roles.map((r) => {
            const on = selected.has(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onToggle(r.id)}
                className={[
                  "rounded-full border px-2.5 py-1 text-[10px] transition",
                  on
                    ? "border-adminFg/35 bg-adminFg/[0.12] font-medium text-adminFg"
                    : "border-adminLine/70 text-adminMuted hover:text-adminFg",
                ].join(" ")}
                title={r.hint || r.systemPrompt.slice(0, 120)}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-amber-900/90 dark:text-amber-200/90">{emptyLabel}</p>
      )}
    </div>
  );
}

function ProfilePicker({
  profiles,
  selected,
  onToggle,
}: {
  profiles: AIConnectionProfile[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {profiles.map((p) => {
        const on = selected.has(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
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
  );
}

async function fetchGenerate(opts: {
  phase: "compile" | "revise";
  body: Record<string, unknown>;
  diskHint?: string;
}): Promise<InfoEditionV1Generation[]> {
  const res = await fetch("/api/admin/bible/info-edition-v4/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
    body: JSON.stringify({ phase: opts.phase, ...opts.body }),
  });
  const j = await parseJson(res);
  if (!res.ok) {
    const e = typeof j.error === "string" ? j.error : "generate failed";
    throw new Error(e + (res.status === 403 && opts.diskHint ? ` ${opts.diskHint}` : ""));
  }
  return Array.isArray(j.generations) ? (j.generations as InfoEditionV1Generation[]) : [];
}

export function InfoEditionV4AdminClient() {
  const { t } = useLocale();
  const ie = useCallback((key: string, vars?: Record<string, string>) => t(`admin.infoEditionV4.${key}`, vars), [t]);
  const rt = useCallback((key: string) => t(`admin.bibleVersions.${key}`), [t]);

  const [profilesBundle, setProfilesBundle] = useState<AIProfilesBundle>(() => emptyProfilesBundle());
  const [workspace, setWorkspace] = useState<InfoEditionV4Workspace | null>(null);
  const [themeTitle, setThemeTitle] = useState("受洗");
  const [editorNotes, setEditorNotes] = useState("");
  const [lastUsedProfileId, setLastUsedProfileId] = useState("");
  const [generationRoles, setGenerationRoles] = useState<GenerationRole[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [selectedCompileRoleIds, setSelectedCompileRoleIds] = useState<Set<string>>(new Set());
  const [selectedReviseRoleIds, setSelectedReviseRoleIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>(null);
  const [rolesLoadErr, setRolesLoadErr] = useState<string | null>(null);
  const [resultPairs, setResultPairs] = useState<InfoEditionV4ResultPair[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const pauseAutoSaveRef = useRef(true);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readyProfiles = useMemo(
    () => sortProfilesForInfoEditionProduction(profilesBundle.profiles.filter((p) => p.baseUrl.trim() && p.model.trim())),
    [profilesBundle.profiles],
  );
  const compileRoles = useMemo(
    () => sortRolesForV4Phase(generationRoles.filter(isInfoEditionV4CompileRole), "compile"),
    [generationRoles],
  );
  const reviseRoles = useMemo(
    () => sortRolesForV4Phase(generationRoles.filter(isInfoEditionV4ReviseRole), "revise"),
    [generationRoles],
  );

  const draftPayload = useCallback(
    () => ({
      themeTitle,
      editorNotes,
      compileText: resultPairs?.[0]?.compile.text ?? "",
      reviseText: resultPairs?.[0]?.revise?.text ?? "",
      lastUsedProfileId,
      selectedProfileIds: [...selectedProfileIds],
      selectedCompileRoleIds: [...selectedCompileRoleIds],
      selectedReviseRoleIds: [...selectedReviseRoleIds],
    }),
    [
      editorNotes,
      lastUsedProfileId,
      resultPairs,
      selectedCompileRoleIds,
      selectedProfileIds,
      selectedReviseRoleIds,
      themeTitle,
    ],
  );

  const applyWorkspace = useCallback((ws: InfoEditionV4Workspace, opts?: { restorePairs?: InfoEditionV4ResultPair[] }) => {
    pauseAutoSaveRef.current = true;
    setWorkspace(ws);
    setThemeTitle(ws.current.themeTitle);
    setEditorNotes(ws.current.editorNotes);
    setLastUsedProfileId(ws.current.lastUsedProfileId);
    setSelectedProfileIds(() => {
      const ids = new Set(ws.current.selectedProfileIds);
      if (ws.current.lastUsedProfileId) ids.add(ws.current.lastUsedProfileId);
      return ids;
    });
    setSelectedCompileRoleIds(new Set(ws.current.selectedCompileRoleIds));
    setSelectedReviseRoleIds(new Set(ws.current.selectedReviseRoleIds));
    if (opts?.restorePairs?.length) {
      setResultPairs(opts.restorePairs);
    } else {
      const latest = ws.history.find((h) => h.pipelinePairs?.length);
      setResultPairs(latest?.pipelinePairs ?? null);
    }
    queueMicrotask(() => {
      pauseAutoSaveRef.current = false;
    });
  }, []);

  const persistDraft = useCallback(async () => {
    const res = await fetch("/api/admin/bible/info-edition-v4", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
      body: JSON.stringify({ action: "save_current", ...draftPayload() }),
    });
    const j = await parseJson(res);
    if (res.ok && j.workspace) setWorkspace(j.workspace as InfoEditionV4Workspace);
    return res.ok;
  }, [draftPayload]);

  const syncConnections = useCallback(async (preferredProfileIds?: string[]) => {
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
      const allowed = new Set(sorted.map((p) => p.id));
      const fromPreferred = (preferredProfileIds ?? []).filter((id) => allowed.has(id));
      setSelectedProfileIds((prev) => {
        const fromPrev = [...prev].filter((id) => allowed.has(id));
        if (fromPrev.length) return new Set(fromPrev);
        if (fromPreferred.length) return new Set(fromPreferred);
        return new Set(pickDefaultInfoEditionProfileIds(sorted));
      });
    } catch {
      setProfilesBundle(loadProfilesFromStorage());
    }
  }, []);

  const loadGenerationRoles = useCallback(async (ws?: InfoEditionV4Workspace) => {
    setRolesLoadErr(null);
    const res = await fetch("/api/admin/generation-roles", { headers: { ...diskAuthHeaders() } });
    const j = await parseJson(res);
    if (!res.ok) {
      setRolesLoadErr(typeof j.error === "string" ? j.error : ie("rolesLoadFailed"));
      return;
    }
    const config = j.config as { roles?: GenerationRole[] } | undefined;
    const all = (config?.roles ?? []).filter((r) => r.enabled);
    setGenerationRoles(all);
    const compile = sortRolesForV4Phase(all.filter(isInfoEditionV4CompileRole), "compile");
    const revise = sortRolesForV4Phase(all.filter(isInfoEditionV4ReviseRole), "revise");
    const cur = ws?.current;
    setSelectedCompileRoleIds(
      new Set(
        (cur?.selectedCompileRoleIds ?? []).filter((id) => compile.some((r) => r.id === id)).length
          ? (cur?.selectedCompileRoleIds ?? []).filter((id) => compile.some((r) => r.id === id))
          : pickDefaultV4RoleIds(compile, "compile"),
      ),
    );
    setSelectedReviseRoleIds(
      new Set(
        (cur?.selectedReviseRoleIds ?? []).filter((id) => revise.some((r) => r.id === id)).length
          ? (cur?.selectedReviseRoleIds ?? []).filter((id) => revise.some((r) => r.id === id))
          : pickDefaultV4RoleIds(revise, "revise"),
      ),
    );
  }, [ie]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/bible/info-edition-v4", { headers: { ...diskAuthHeaders() } });
        const j = await parseJson(res);
        if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : ie("loadFailed"));
        const ws = j.workspace as InfoEditionV4Workspace | undefined;
        if (!cancelled && ws) applyWorkspace(ws);
        await loadGenerationRoles(ws);
        if (!cancelled) await syncConnections(ws?.current.selectedProfileIds);
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
  }, [
    editorNotes,
    lastUsedProfileId,
    loading,
    persistDraft,
    resultPairs,
    selectedCompileRoleIds,
    selectedProfileIds,
    selectedReviseRoleIds,
    themeTitle,
  ]);

  const profilesForGenerate = useCallback(() => {
    return readyProfiles.filter((p) => selectedProfileIds.has(p.id));
  }, [readyProfiles, selectedProfileIds]);

  const runPipeline = useCallback(async () => {
    const profiles = profilesForGenerate();
    const compileRoleList = compileRoles.filter((r) => selectedCompileRoleIds.has(r.id));
    const reviseRoleList = reviseRoles.filter((r) => selectedReviseRoleIds.has(r.id));
    if (!compileRoleList.length || !reviseRoleList.length) {
      setErr(ie("needRole"));
      return;
    }
    if (!profiles.length) {
      setErr(ie("needProfile"));
      return;
    }
    const compileRuns = compileRoleList.length * profiles.length;
    if (compileRuns > INFO_EDITION_V4_MAX_COMPARE_RUNS) {
      setErr(ie("compareCap", { max: String(INFO_EDITION_V4_MAX_COMPARE_RUNS), count: String(compileRuns) }));
      return;
    }

    setPipelineStep("compile");
    setErr(null);
    setMsg(null);
    setResultPairs(null);

    const baseBody = {
      themeTitle,
      editorNotes,
      compileText: "",
      reviseText: "",
      generationRoleIds: compileRoleList.map((r) => r.id),
      profiles: profiles.map((p) => ({
        id: p.id,
        name: p.name,
        settings: { provider: p.provider, baseUrl: p.baseUrl, model: p.model },
      })),
    };

    try {
      const compileGens = await fetchGenerate({ phase: "compile", body: baseBody, diskHint: rt("diskHint") });

      const successful = compileGens.filter((g) => g.text.trim() && !g.error);
      if (!successful.length) {
        throw new Error(ie("compileEmpty"));
      }

      setPipelineStep("revise");
      const pairs: InfoEditionV4ResultPair[] = [];

      for (const comp of successful) {
        const profile = profiles.find((p) => p.id === comp.profileId);
        if (!profile) {
          pairs.push({ compile: comp, revise: null });
          continue;
        }
        try {
          const reviseGens = await fetchGenerate({
            phase: "revise",
            body: {
              themeTitle,
              editorNotes,
              compileText: comp.text,
              reviseText: "",
              generationRoleIds: reviseRoleList.map((r) => r.id),
              profiles: [
                {
                  id: profile.id,
                  name: profile.name,
                  settings: { provider: profile.provider, baseUrl: profile.baseUrl, model: profile.model },
                },
              ],
            },
            diskHint: rt("diskHint"),
          });
          pairs.push({ compile: comp, revise: reviseGens[0] ?? null });
        } catch (e) {
          pairs.push({
            compile: comp,
            revise: {
              profileId: profile.id,
              profileName: profile.name,
              generationRoleId: reviseRoleList[0]?.id ?? "revise",
              generationRoleLabel: reviseRoleList[0]?.label ?? "修订",
              text: "",
              charCount: 0,
              error: e instanceof Error ? e.message : String(e),
            },
          });
        }
      }

      setResultPairs(pairs);

      const primaryCompile =
        successful.find((g) => g.profileId === lastUsedProfileId) ??
        successful.find((g) => selectedProfileIds.has(g.profileId)) ??
        successful[0];
      const primaryProfileId = primaryCompile.profileId;
      setLastUsedProfileId(primaryProfileId);

      const saveBody = {
        action: "save_pipeline",
        themeTitle,
        editorNotes,
        compileText: primaryCompile.text,
        reviseText: pairs.find((p) => p.compile.profileId === primaryProfileId)?.revise?.text ?? "",
        lastUsedProfileId: primaryProfileId,
        selectedProfileIds: [...selectedProfileIds],
        selectedCompileRoleIds: [...selectedCompileRoleIds],
        selectedReviseRoleIds: [...selectedReviseRoleIds],
        pipelinePairs: pairs,
      };

      const res2 = await fetch("/api/admin/bible/info-edition-v4", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
        body: JSON.stringify(saveBody),
      });
      const j2 = await parseJson(res2);
      if (!res2.ok) {
        throw new Error(typeof j2.error === "string" ? j2.error : ie("saveFailed"));
      }
      if (j2.workspace) applyWorkspace(j2.workspace as InfoEditionV4Workspace, { restorePairs: pairs });

      setHistoryOpen(true);
      setMsg(ie("pipelineDone", { count: String(pairs.length) }));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setErr(message + (message.includes("403") ? ` ${rt("diskHint")}` : ""));
    } finally {
      setPipelineStep(null);
    }
  }, [
    applyWorkspace,
    compileRoles,
    ie,
    lastUsedProfileId,
    profilesForGenerate,
    reviseRoles,
    rt,
    selectedCompileRoleIds,
    selectedProfileIds,
    selectedReviseRoleIds,
    themeTitle,
  ]);

  const restoreHistory = useCallback(
    async (entry: InfoEditionV4HistoryEntry) => {
      const res = await fetch("/api/admin/bible/info-edition-v4", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
        body: JSON.stringify({ action: "restore_history", historyId: entry.id }),
      });
      const j = await parseJson(res);
      if (res.ok && j.workspace) {
        const restored = j.entry as InfoEditionV4HistoryEntry | undefined;
        applyWorkspace(j.workspace as InfoEditionV4Workspace, {
          restorePairs: restored?.pipelinePairs,
        });
        setMsg(ie("historyLoaded"));
      }
    },
    [applyWorkspace, ie],
  );

  const toggleInSet = (id: string, setter: Dispatch<SetStateAction<Set<string>>>) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const compareRunCount = selectedCompileRoleIds.size * selectedProfileIds.size;
  const history = workspace?.history ?? [];
  const pipelineBusy = pipelineStep !== null;

  if (loading) {
    return <p className="text-[13px] text-adminMuted">{ie("loading")}</p>;
  }

  return (
    <div className="mt-4 space-y-4 text-adminFg">
      <p className="text-[12px] leading-relaxed text-adminMuted">{ie("intro")}</p>
      <p className="text-[10px] font-mono text-adminMuted/80">{ie("fileLine")}</p>

      {err ? <p className="text-[12px] text-red-700 dark:text-red-300">{err}</p> : null}
      {rolesLoadErr ? <p className="text-[12px] text-red-700 dark:text-red-300">{rolesLoadErr}</p> : null}
      {msg ? <p className="text-[12px] text-emerald-800 dark:text-emerald-200">{msg}</p> : null}

      <section className="rounded-lg border border-adminLine/70 bg-adminPanel/50 p-3 space-y-3">
        <h2 className="text-[12px] font-semibold">{ie("themeTitle")}</h2>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-adminMuted">{ie("fieldTheme")}</span>
          <input
            value={themeTitle}
            onChange={(e) => setThemeTitle(e.target.value)}
            className="rounded border border-adminLine bg-white px-2.5 py-1.5 text-[12px]"
            placeholder={ie("fieldThemePlaceholder")}
          />
        </label>
        <p className="text-[10px] leading-relaxed text-adminMuted">
          {ie("roleRulesHint")}{" "}
          <Link href="/admin/system/generation-roles" className="underline hover:text-adminFg">
            {ie("roleManage")}
          </Link>
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-adminMuted">{ie("editorNotesTitle")}</span>
          <textarea
            value={editorNotes}
            onChange={(e) => setEditorNotes(e.target.value)}
            rows={2}
            placeholder={ie("editorNotesPlaceholder")}
            className="rounded border border-adminLine bg-white px-2.5 py-2 text-[12px] leading-relaxed"
          />
        </label>
      </section>

      <section className="rounded-lg border border-adminLine/70 bg-adminPanel/50 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[12px] font-semibold">{ie("phaseCompileTitle")}</h2>
            <p className="text-[10px] text-adminMuted">{ie("phaseCompileHint")}</p>
          </div>
          <Link href="/admin/system/generation-roles" className="text-[10px] text-adminMuted underline hover:text-adminFg">
            {ie("roleManage")}
          </Link>
        </div>
        <p className="text-[10px] text-adminMuted">{ie("profilesRememberHint")}</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-adminFg">{ie("profilesTitle")}</span>
          <Link href="/admin/system/ai-api" className="text-[10px] text-adminMuted underline hover:text-adminFg">
            {ie("aiManage")}
          </Link>
        </div>
        <ProfilePicker
          profiles={readyProfiles}
          selected={selectedProfileIds}
          onToggle={(id) => toggleInSet(id, setSelectedProfileIds)}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <RolePicker
            title={ie("compileRoleTitle")}
            roles={compileRoles}
            selected={selectedCompileRoleIds}
            onToggle={(id) => toggleInSet(id, setSelectedCompileRoleIds)}
            emptyLabel={ie("rolesEmpty")}
          />
          <RolePicker
            title={ie("reviseRoleTitle")}
            roles={reviseRoles}
            selected={selectedReviseRoleIds}
            onToggle={(id) => toggleInSet(id, setSelectedReviseRoleIds)}
            emptyLabel={ie("rolesEmpty")}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={
              pipelineBusy ||
              compareRunCount === 0 ||
              compareRunCount > INFO_EDITION_V4_MAX_COMPARE_RUNS ||
              !selectedReviseRoleIds.size
            }
            onClick={() => void runPipeline()}
            className="rounded border border-adminFg/40 bg-adminFg px-4 py-1.5 text-[12px] font-semibold text-adminBg disabled:opacity-45"
          >
            {pipelineStep === "compile"
              ? ie("generatingCompile")
              : pipelineStep === "revise"
                ? ie("generatingRevise")
                : ie("runPipeline")}
          </button>
          <span className="text-[10px] text-adminMuted">
            {ie("compareRuns", {
              count: String(compareRunCount),
              max: String(INFO_EDITION_V4_MAX_COMPARE_RUNS),
            })}
          </span>
        </div>

        {resultPairs?.length ? (
          <InfoEditionV4PairCompareGrid
            pairs={resultPairs}
            profiles={readyProfiles}
            compileColumnTitle={ie("pairCompileColumn")}
            reviseColumnTitle={ie("pairReviseColumn")}
            revisePendingLabel={ie("revisePending")}
          />
        ) : null}
      </section>

      <section className="border-t border-adminLine/60 pt-3">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className="text-[11px] font-medium text-adminMuted underline hover:text-adminFg"
        >
          {historyOpen ? ie("historyHide") : ie("historyShow")} ({history.length})
        </button>
        {historyOpen ? (
          <ul className="mt-2 space-y-1">
            {history.length === 0 ? (
              <li className="text-[11px] text-adminMuted">{ie("historyEmpty")}</li>
            ) : (
              history.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => void restoreHistory(h)}
                    className="w-full rounded border border-adminLine/60 px-2 py-1.5 text-left text-[11px] hover:bg-adminFg/[0.04]"
                  >
                    <span className="font-medium">{h.themeTitle}</span>
                    <span className="text-adminMuted">
                      {" "}
                      · {h.phase ?? h.entryKind} · {formatSavedAt(h.savedAt)}
                      {h.pipelinePairs?.length ? ` · ${h.pipelinePairs.length}路` : ""}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
