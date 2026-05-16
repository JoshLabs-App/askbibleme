"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { gatewaySlotEndpoint } from "@/lib/admin/gateway-slot-endpoints";
import { AI_API_CONFIG_MASK, type AiApiConfigPublic } from "@/lib/admin/ai-api-config-types";
import { AI_PROFILES_STORAGE_KEY, emptyProfilesBundle } from "@/lib/ai/storage";
import type { AIConnectionProfile, AIProfilesBundle } from "@/lib/ai/types";
import { diskAuthHeaders } from "@/lib/disk-auth-headers";
import { profileSizeGbLabel, profileSuitabilityHint } from "@/lib/ai/profile-display";

type SlotDraft = {
  id: string;
  label: string;
  hostContains: string;
  enabled: boolean;
  apiKeyInput: string;
  maskedKey: string | null;
  hasKey: boolean;
};

type ProfileDraft = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKeyInput: string;
  maskedKey: string | null;
  hasKey: boolean;
};

type DockState = "idle" | "probing" | "ok" | "fail" | "warn";

type ProfileDock = {
  state: DockState;
  keySource?: string;
  error?: string;
  text?: string;
  latencyMs?: number;
};

type TestResultRow = {
  id: string;
  ok: boolean;
  keySource: string;
  text?: string;
  error?: string;
  latencyMs: number;
};

type TestTarget = {
  id: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
};

function buildGatewayTestTargets(slots: SlotDraft[]): TestTarget[] {
  const out: TestTarget[] = [];
  for (const s of slots) {
    if (!s.enabled) continue;
    const ep = gatewaySlotEndpoint(s.id);
    if (!ep) continue;
    const key = draftKeyForApi(s.apiKeyInput, s.maskedKey, s.hasKey);
    if (!s.hasKey && !key) continue;
    out.push({
      id: `slot:${s.id}`,
      baseUrl: ep.baseUrl,
      model: ep.model,
      apiKey: key,
    });
  }
  return out;
}

function buildStudioTestTargets(profiles: ProfileDraft[]): TestTarget[] {
  return profiles
    .filter((p) => p.baseUrl.trim() && p.model.trim())
    .map((p) => ({
      id: p.id,
      baseUrl: p.baseUrl.trim(),
      model: p.model.trim(),
      apiKey: draftKeyForApi(p.apiKeyInput, p.maskedKey, p.hasKey),
    }));
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function loadLocalProfiles(): AIConnectionProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AI_PROFILES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AIProfilesBundle;
    if (parsed?.version === 1 && Array.isArray(parsed.profiles)) return parsed.profiles;
  } catch {
    /* ignore */
  }
  return [];
}

function slotsFromPublic(config: AiApiConfigPublic): SlotDraft[] {
  return config.slots.map((s) => ({
    id: s.id,
    label: s.label,
    hostContains: s.hostContains,
    enabled: s.enabled,
    apiKeyInput: s.maskedKey ?? "",
    maskedKey: s.maskedKey,
    hasKey: s.hasKey,
  }));
}

function draftKeyForApi(input: string, masked: string | null, hasKey: boolean): string | undefined {
  const v = input.trim();
  if (!v) return undefined;
  if (hasKey && masked && (v === masked || v === AI_API_CONFIG_MASK || v.startsWith(AI_API_CONFIG_MASK))) {
    return undefined;
  }
  return v;
}

function keySourceTitle(tr: (k: string) => string, source?: string): string {
  switch (source) {
    case "profile":
      return tr("keySourceProfile");
    case "slot":
      return tr("keySourceSlot");
    case "env":
      return tr("keySourceEnv");
    case "request":
      return tr("keySourceDraft");
    case "none":
      return tr("keySourceNone");
    default:
      return tr("dockIdle");
  }
}

function DockLight({ state, title }: { state: DockState; title?: string }) {
  const cls =
    state === "ok"
      ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
      : state === "fail"
        ? "bg-red-500/90"
        : state === "probing"
          ? "bg-amber-400 animate-pulse"
          : state === "warn"
            ? "bg-amber-500/85"
            : "bg-adminMuted/35";
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`}
      title={title}
      aria-label={title}
    />
  );
}

export function AdminAiApiConfigClient() {
  const { t } = useLocale();
  const tr = useCallback((key: string, vars?: Record<string, string>) => t(`admin.aiApiConfig.${key}`, vars), [t]);
  const rt = useCallback((key: string) => t(`admin.bibleVersions.${key}`), [t]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [profiles, setProfiles] = useState<ProfileDraft[]>([]);
  const [envHint, setEnvHint] = useState<{ hasBaseUrl: boolean; hasApiKey: boolean } | null>(null);
  const [testMessage, setTestMessage] = useState("");
  const [docks, setDocks] = useState<Record<string, ProfileDock>>({});
  const [lastReply, setLastReply] = useState<string | null>(null);
  const autoProbedRef = useRef(false);

  const readyProfiles = useMemo(
    () => profiles.filter((p) => p.baseUrl.trim() && p.model.trim()),
    [profiles],
  );

  const gatewayTestTargets = useMemo(() => buildGatewayTestTargets(slots), [slots]);
  const studioTestTargets = useMemo(() => buildStudioTestTargets(profiles), [profiles]);

  const allTestTargets = useMemo(() => {
    const seen = new Set<string>();
    const out: TestTarget[] = [];
    for (const t of [...gatewayTestTargets, ...studioTestTargets]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
    return out;
  }, [gatewayTestTargets, studioTestTargets]);

  const applyTestResults = useCallback((rows: TestResultRow[]) => {
    setDocks((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        next[r.id] = {
          state: r.ok ? "ok" : "fail",
          keySource: r.keySource,
          error: r.error,
          text: r.text,
          latencyMs: r.latencyMs,
        };
      }
      return next;
    });
    const okOne = rows.find((r) => r.ok && r.text);
    if (okOne?.text) setLastReply(okOne.text);
  }, []);

  const refreshLinkStatus = useCallback(async () => {
    if (!allTestTargets.length) return;
    const res = await fetch("/api/admin/ai-api-config/status", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
      body: JSON.stringify({
        profiles: allTestTargets.map((t) => ({
          id: t.id,
          baseUrl: t.baseUrl,
          model: t.model,
          apiKey: t.apiKey,
        })),
      }),
    });
    const j = await parseJson(res);
    if (!res.ok) return;
    const list = Array.isArray(j.profiles) ? (j.profiles as { id: string; keySource: string; ready: boolean }[]) : [];
    setDocks((prev) => {
      const next = { ...prev };
      for (const row of list) {
        const cur = next[row.id];
        if (cur?.state === "probing" || cur?.state === "ok" || cur?.state === "fail") continue;
        if (!row.ready) {
          next[row.id] = { state: "warn", keySource: row.keySource };
        } else if (row.keySource === "none") {
          const t = allTestTargets.find((x) => x.id === row.id);
          const isLocal =
            t?.baseUrl.includes("127.0.0.1") || t?.baseUrl.includes("localhost");
          next[row.id] = { state: isLocal ? "idle" : "warn", keySource: "none" };
        } else {
          next[row.id] = { state: "idle", keySource: row.keySource };
        }
      }
      return next;
    });
  }, [allTestTargets]);

  const runTests = useCallback(
    async (ids?: string[]) => {
      const pool = ids ? allTestTargets.filter((t) => ids.includes(t.id)) : allTestTargets;
      const targets = pool.slice(0, 8);
      if (!targets.length) {
        setErr(tr("testNeedTarget"));
        return;
      }
      if (!ids && pool.length > 8) {
        setMsg(tr("testCapped", { count: "8" }));
      }
      setTesting(true);
      setErr(null);
      setDocks((prev) => {
        const next = { ...prev };
        for (const t of targets) next[t.id] = { ...next[t.id], state: "probing" };
        return next;
      });
      try {
        const res = await fetch("/api/admin/ai-api-config/test", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
          body: JSON.stringify({
            message: testMessage.trim() || undefined,
            targets,
          }),
        });
        const j = await parseJson(res);
        if (!res.ok) {
          const e = typeof j.error === "string" ? j.error : tr("testFailed");
          throw new Error(e + (res.status === 403 ? ` ${rt("diskHint")}` : ""));
        }
        const results = (j.results ?? (j.result ? [j.result] : [])) as TestResultRow[];
        applyTestResults(results);
        const ok = results.filter((r) => r.ok).length;
        setMsg(tr("testDone", { ok: String(ok), total: String(results.length) }));
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
        setDocks((prev) => {
          const next = { ...prev };
          for (const t of targets) {
            if (next[t.id]?.state === "probing") next[t.id] = { state: "fail", error: "请求失败" };
          }
          return next;
        });
      } finally {
        setTesting(false);
      }
    },
    [allTestTargets, applyTestResults, rt, testMessage, tr],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/ai-api-config", { headers: { ...diskAuthHeaders() } });
      const j = await parseJson(res);
      if (!res.ok) {
        const e = typeof j.error === "string" ? j.error : tr("loadFailed");
        throw new Error(e + (res.status === 403 ? ` ${rt("diskHint")}` : ""));
      }
      const config = j.config as AiApiConfigPublic | undefined;
      if (!config) throw new Error(tr("loadFailed"));
      setSlots(slotsFromPublic(config));
      const eh = j.envHint as { hasBaseUrl?: boolean; hasApiKey?: boolean } | undefined;
      setEnvHint(
        eh
          ? { hasBaseUrl: Boolean(eh.hasBaseUrl), hasApiKey: Boolean(eh.hasApiKey) }
          : null,
      );

      const local = loadLocalProfiles();
      const pk = config.profileKeys ?? {};
      setProfiles(
        local.map((p) => {
          const meta = pk[p.id];
          return {
            id: p.id,
            name: p.name,
            baseUrl: p.baseUrl,
            model: p.model,
            apiKeyInput: meta?.maskedKey ?? "",
            maskedKey: meta?.maskedKey ?? null,
            hasKey: Boolean(meta?.hasKey),
          };
        }),
      );
      setTestMessage((prev) => prev || tr("defaultTestMessage"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [rt, tr]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading) return;
    void refreshLinkStatus();
  }, [loading, allTestTargets, refreshLinkStatus]);

  useEffect(() => {
    if (loading || autoProbedRef.current || !gatewayTestTargets.length) return;
    autoProbedRef.current = true;
    void runTests(gatewayTestTargets.map((t) => t.id));
  }, [loading, gatewayTestTargets, runTests]);

  const save = useCallback(async () => {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const profileKeys: Record<string, { apiKey: string }> = {};
      for (const p of profiles) {
        profileKeys[p.id] = { apiKey: p.apiKeyInput };
      }
      const res = await fetch("/api/admin/ai-api-config", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
        body: JSON.stringify({
          slots: slots.map((s) => ({
            id: s.id,
            label: s.label,
            hostContains: s.hostContains,
            enabled: s.enabled,
            apiKey: s.apiKeyInput,
          })),
          profileKeys,
        }),
      });
      const j = await parseJson(res);
      if (!res.ok) {
        const e = typeof j.error === "string" ? j.error : tr("saveFailed");
        throw new Error(e + (res.status === 403 ? ` ${rt("diskHint")}` : ""));
      }
      const config = j.config as AiApiConfigPublic | undefined;
      if (config) {
        setSlots(slotsFromPublic(config));
        const pk = config.profileKeys ?? {};
        setProfiles((prev) =>
          prev.map((p) => {
            const meta = pk[p.id];
            return {
              ...p,
              apiKeyInput: meta?.maskedKey ?? "",
              maskedKey: meta?.maskedKey,
              hasKey: Boolean(meta?.hasKey),
            };
          }),
        );
      }
      setMsg(tr("saveDone"));
      autoProbedRef.current = false;
      void refreshLinkStatus();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [profiles, refreshLinkStatus, rt, slots, tr]);

  const addSlot = useCallback(() => {
    setSlots((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        label: tr("customSlotLabel"),
        hostContains: "",
        enabled: true,
        apiKeyInput: "",
        maskedKey: null,
        hasKey: false,
      },
    ]);
  }, [tr]);

  const refreshProfiles = useCallback(() => {
    const local = loadLocalProfiles();
    setProfiles((prev) => {
      const prevById = new Map(prev.map((p) => [p.id, p]));
      return local.map((p) => {
        const old = prevById.get(p.id);
        return {
          id: p.id,
          name: p.name,
          baseUrl: p.baseUrl,
          model: p.model,
          apiKeyInput: old?.apiKeyInput ?? "",
          maskedKey: old?.maskedKey ?? null,
          hasKey: old?.hasKey ?? false,
        };
      });
    });
    autoProbedRef.current = false;
    setMsg(tr("profilesRefreshed"));
  }, [tr]);

  if (loading) {
    return <p className="mt-4 text-[12px] text-adminMuted">{rt("loading")}</p>;
  }

  const inputClass =
    "min-w-0 flex-1 rounded border border-adminLine/80 bg-adminBg px-2 py-1 text-[12px] text-adminFg outline-none focus:border-adminFg/25";

  return (
    <div className="mt-4 max-w-2xl space-y-4">
      {(err || msg) && (
        <p className={`text-[11px] ${err ? "text-red-700/90 dark:text-red-300/90" : "text-adminMuted"}`}>
          {err ?? msg}
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-adminMuted">{tr("intro")}</p>

      <section className="rounded border border-adminLine/70 bg-adminBg/30 p-2.5">
        <div className="mb-2 flex flex-wrap items-center gap-3 text-[10px] text-adminMuted">
          <span className="flex items-center gap-1">
            <DockLight state="ok" /> {tr("legendOk")}
          </span>
          <span className="flex items-center gap-1">
            <DockLight state="fail" /> {tr("legendFail")}
          </span>
          <span className="flex items-center gap-1">
            <DockLight state="probing" /> {tr("legendProbing")}
          </span>
          <span className="flex items-center gap-1">
            <DockLight state="warn" /> {tr("legendWarn")}
          </span>
          <span className="flex items-center gap-1">
            <DockLight state="idle" /> {tr("legendIdle")}
          </span>
        </div>
        <label className="block text-[11px] text-adminFg" htmlFor="ai-test-msg">
          {tr("testMessageLabel")}
        </label>
        <textarea
          id="ai-test-msg"
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          rows={2}
          className="mt-1 w-full resize-y rounded border border-adminLine/80 bg-adminBg px-2 py-1.5 text-[12px] text-adminFg outline-none focus:border-adminFg/20"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={testing || !allTestTargets.length}
            onClick={() => void runTests()}
            className="rounded border border-adminFg/25 bg-adminFg/[0.08] px-2.5 py-1 text-[11px] font-medium text-adminFg disabled:opacity-40"
          >
            {testing ? tr("testing") : tr("testAll")}
          </button>
        </div>
        {lastReply ? (
          <p className="mt-2 text-[11px] leading-relaxed text-adminMuted">
            <span className="text-adminFg">{tr("lastReply")}</span> {lastReply}
          </p>
        ) : null}
      </section>

      {envHint ? (
        <p className="font-mono text-[10px] text-adminMuted/90">
          {tr("envHint", {
            base: envHint.hasBaseUrl ? "✓" : "—",
            key: envHint.hasApiKey ? "✓" : "—",
          })}
        </p>
      ) : null}

      <section>
        <h2 className="text-[12px] font-medium text-adminFg">{tr("slotsTitle")}</h2>
        <p className="mt-0.5 text-[10px] text-adminMuted">{tr("slotsHint")}</p>
        <ul className="mt-2 space-y-2">
          {slots.map((s, i) => {
            const slotId = `slot:${s.id}`;
            const dock = docks[slotId];
            const slotDock: DockState =
              dock?.state ??
              (!s.hostContains ? "warn" : s.hasKey || s.apiKeyInput.trim() ? "idle" : "warn");
            const canTest = s.enabled && Boolean(gatewaySlotEndpoint(s.id)) && (s.hasKey || s.apiKeyInput.trim());
            const dockTitle = [
              dock ? keySourceTitle(tr, dock.keySource) : s.hasKey ? tr("slotKeyOk") : tr("slotKeyMissing"),
              dock?.error,
              dock?.latencyMs != null ? `${dock.latencyMs}ms` : "",
              dock?.text,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                <DockLight state={slotDock} title={dockTitle} />
                <input
                  value={s.label}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSlots((prev) => prev.map((x, j) => (j === i ? { ...x, label: v } : x)));
                  }}
                  className="w-24 shrink-0 rounded border border-adminLine/80 bg-adminBg px-2 py-1 text-[11px]"
                  aria-label={tr("fieldLabel")}
                />
                <input
                  value={s.hostContains}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSlots((prev) => prev.map((x, j) => (j === i ? { ...x, hostContains: v } : x)));
                  }}
                  placeholder="api.example.com"
                  className="w-36 shrink-0 rounded border border-adminLine/80 bg-adminBg px-2 py-1 font-mono text-[10px]"
                  aria-label={tr("fieldHost")}
                />
                <input
                  type="password"
                  value={s.apiKeyInput}
                  placeholder={s.hasKey ? (s.maskedKey ?? AI_API_CONFIG_MASK) : tr("keyPlaceholder")}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSlots((prev) => prev.map((x, j) => (j === i ? { ...x, apiKeyInput: v } : x)));
                  }}
                  className={inputClass}
                  aria-label={tr("fieldKey")}
                />
                <label className="flex shrink-0 items-center gap-1 text-adminMuted">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setSlots((prev) => prev.map((x, j) => (j === i ? { ...x, enabled: v } : x)));
                    }}
                  />
                  {tr("enabled")}
                </label>
                {canTest ? (
                  <button
                    type="button"
                    disabled={testing}
                    onClick={() => void runTests([slotId])}
                    className="shrink-0 rounded border border-adminLine/80 px-1.5 py-0.5 text-[10px] text-adminFg hover:bg-adminFg/[0.06] disabled:opacity-40"
                  >
                    {tr("testOne")}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={addSlot} className="mt-2 text-[11px] text-adminMuted underline">
          {tr("addSlot")}
        </button>
      </section>

      <section>
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-[12px] font-medium text-adminFg">{tr("profilesTitle")}</h2>
          <button type="button" onClick={refreshProfiles} className="text-[10px] text-adminMuted underline">
            {tr("refreshProfiles")}
          </button>
        </div>
        <p className="mt-0.5 text-[10px] text-adminMuted">{tr("profilesHint")}</p>
        {readyProfiles.length === 0 ? (
          <p className="mt-2 text-[11px] text-adminMuted">{tr("profilesEmpty")}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {readyProfiles.map((p, i) => {
              const dock = docks[p.id] ?? { state: "idle" as DockState };
              const sizeGb = profileSizeGbLabel(p);
              const suitability = profileSuitabilityHint(p);
              const title = [
                p.name,
                sizeGb,
                suitability,
                keySourceTitle(tr, dock.keySource),
                dock.state === "ok" ? tr("dockOk") : "",
                dock.error,
                dock.latencyMs != null ? `${dock.latencyMs}ms` : "",
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                  <DockLight state={dock.state} title={title || tr("dockIdle")} />
                  <span className="min-w-0 max-w-[10rem] shrink truncate font-medium text-adminFg" title={p.name}>
                    {p.name}
                  </span>
                  {sizeGb ? (
                    <span className="shrink-0 tabular-nums text-[10px] font-medium text-adminMuted" title={sizeGb}>
                      {sizeGb}
                    </span>
                  ) : null}
                  <span
                    className="max-w-[6rem] shrink-0 truncate font-mono text-[10px] text-adminMuted"
                    title={`${p.baseUrl} · ${p.model}`}
                  >
                    {p.model}
                  </span>
                  {suitability ? (
                    <span
                      className="min-w-0 max-w-[14rem] shrink truncate text-[10px] text-adminMuted/90"
                      title={suitability}
                    >
                      {suitability}
                    </span>
                  ) : null}
                  <input
                    type="password"
                    value={p.apiKeyInput}
                    placeholder={p.hasKey ? (p.maskedKey ?? AI_API_CONFIG_MASK) : tr("keyPlaceholder")}
                    onChange={(e) => {
                      const v = e.target.value;
                      setProfiles((prev) => prev.map((x, j) => (j === i ? { ...x, apiKeyInput: v } : x)));
                    }}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    disabled={testing}
                    onClick={() => void runTests([p.id])}
                    className="shrink-0 rounded border border-adminLine/80 px-1.5 py-0.5 text-[10px] text-adminFg hover:bg-adminFg/[0.06] disabled:opacity-40"
                  >
                    {tr("testOne")}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-[10px] text-adminMuted">{tr("usedBy")}</p>

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="rounded border border-adminFg/30 bg-adminFg/[0.1] px-3 py-1 text-[12px] font-medium text-adminFg disabled:opacity-50"
      >
        {saving ? "…" : tr("save")}
      </button>
    </div>
  );
}
