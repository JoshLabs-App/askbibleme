"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { GenerationRole, GenerationRolesPublic } from "@/lib/admin/generation-roles-types";
import { diskAuthHeaders } from "@/lib/disk-auth-headers";

type RoleDraft = GenerationRole;

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function newClientRoleId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `role_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `role_${Date.now().toString(36)}`;
}

function emptyCustomRole(): RoleDraft {
  return {
    id: newClientRoleId(),
    label: "",
    hint: "",
    systemPrompt: "",
    enabled: true,
  };
}

export function AdminGenerationRolesClient() {
  const { t } = useLocale();
  const tr = useCallback((key: string, vars?: Record<string, string>) => t(`admin.generationRoles.${key}`, vars), [t]);

  const [roles, setRoles] = useState<RoleDraft[]>([]);
  const [defaultRoleId, setDefaultRoleId] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const applyConfig = useCallback((config: GenerationRolesPublic) => {
    setDefaultRoleId(config.defaultRoleId);
    setRoles(config.roles.map((r) => ({ ...r })));
    setExpandedId((prev) => prev ?? config.defaultRoleId ?? config.roles[0]?.id ?? null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/generation-roles", { headers: { ...diskAuthHeaders() } });
      const j = await parseJson(res);
      if (!res.ok) {
        const e = typeof j.error === "string" ? j.error : tr("loadFailed");
        throw new Error(e);
      }
      const config = j.config as GenerationRolesPublic | undefined;
      if (config?.roles) applyConfig(config);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [applyConfig, tr]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateRole = useCallback((id: string, patch: Partial<RoleDraft>) => {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setMsg(null);
  }, []);

  const addRole = useCallback(() => {
    const row = emptyCustomRole();
    row.label = tr("newRoleLabel");
    setRoles((prev) => [...prev, row]);
    setExpandedId(row.id);
    setMsg(null);
  }, [tr]);

  const removeRole = useCallback(
    (id: string) => {
      const target = roles.find((r) => r.id === id);
      if (target?.builtin) return;
      if (!window.confirm(tr("confirmDelete"))) return;
      setRoles((prev) => {
        const next = prev.filter((r) => r.id !== id);
        if (defaultRoleId === id) {
          const fallback = next.find((r) => r.enabled)?.id ?? next[0]?.id ?? "";
          setDefaultRoleId(fallback);
        }
        return next;
      });
      if (expandedId === id) setExpandedId(null);
      setMsg(null);
    },
    [defaultRoleId, expandedId, roles, tr],
  );

  const save = useCallback(async () => {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const payload = roles.map((r) => ({
        id: r.id,
        label: r.label.trim() || r.id,
        hint: r.hint.trim(),
        systemPrompt: r.systemPrompt.trim(),
        enabled: r.enabled,
        ...(r.builtin ? { builtin: true } : {}),
      }));
      for (const r of payload) {
        if (!r.systemPrompt) throw new Error(tr("needSystem", { label: r.label }));
      }
      const res = await fetch("/api/admin/generation-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
        body: JSON.stringify({ defaultRoleId, roles: payload }),
      });
      const j = await parseJson(res);
      if (!res.ok) {
        const e = typeof j.error === "string" ? j.error : tr("saveFailed");
        throw new Error(e);
      }
      const config = j.config as GenerationRolesPublic | undefined;
      if (config) applyConfig(config);
      setMsg(tr("saveDone"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [applyConfig, defaultRoleId, roles, tr]);

  if (loading) {
    return <p className="mt-4 text-[12px] text-adminMuted">{tr("loading")}</p>;
  }

  const statusLine = err ?? msg;

  return (
    <div className="mt-4 max-w-2xl space-y-4">
      <p className="text-[12px] leading-relaxed text-adminMuted">{tr("intro")}</p>
      <p className="font-mono text-[11px] text-adminMuted/90">{tr("fileLine")}</p>
      <p className="text-[11px] text-adminMuted">
        {tr("usedBy")}{" "}
        <Link href="/admin/read/info-edition-v1" className="underline underline-offset-2">
          {t("admin.items.infoEditionV1")}
        </Link>
      </p>

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

      <ul className="divide-y divide-adminLine border-y border-adminLine">
        {roles.map((r) => {
          const open = expandedId === r.id;
          const isDefault = defaultRoleId === r.id;
          return (
            <li key={r.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : r.id)}
                  className="min-w-0 flex-1 text-left text-[13px] font-medium text-adminFg"
                >
                  {r.label || r.id}
                  {r.builtin ? (
                    <span className="ml-1.5 text-[10px] font-normal text-adminMuted">({tr("builtin")})</span>
                  ) : null}
                </button>
                <label className="flex items-center gap-1 text-[11px] text-adminMuted">
                  <input
                    type="radio"
                    name="defaultRole"
                    checked={isDefault}
                    disabled={!r.enabled}
                    onChange={() => setDefaultRoleId(r.id)}
                  />
                  {tr("default")}
                </label>
                <label className="flex items-center gap-1 text-[11px] text-adminMuted">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) => updateRole(r.id, { enabled: e.target.checked })}
                  />
                  {tr("enabled")}
                </label>
                {!r.builtin ? (
                  <button
                    type="button"
                    onClick={() => removeRole(r.id)}
                    className="text-[11px] text-adminMuted underline underline-offset-2 hover:text-adminFg"
                  >
                    {tr("delete")}
                  </button>
                ) : null}
              </div>
              {open ? (
                <div className="mt-3 space-y-2 pl-0.5">
                  <label className="block">
                    <span className="text-[11px] text-adminMuted">{tr("fieldLabel")}</span>
                    <input
                      value={r.label}
                      onChange={(e) => updateRole(r.id, { label: e.target.value })}
                      className="mt-0.5 w-full rounded border border-adminLine bg-adminBg px-2 py-1 text-[12px] text-adminFg outline-none focus:border-adminFg/25"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-adminMuted">{tr("fieldHint")}</span>
                    <input
                      value={r.hint}
                      onChange={(e) => updateRole(r.id, { hint: e.target.value })}
                      className="mt-0.5 w-full rounded border border-adminLine bg-adminBg px-2 py-1 text-[12px] text-adminFg outline-none focus:border-adminFg/25"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-adminMuted">{tr("fieldSystem")}</span>
                    <textarea
                      value={r.systemPrompt}
                      onChange={(e) => updateRole(r.id, { systemPrompt: e.target.value })}
                      rows={8}
                      className="mt-0.5 w-full resize-y rounded border border-adminLine bg-adminBg px-2 py-1.5 font-mono text-[11px] leading-relaxed text-adminFg outline-none focus:border-adminFg/25"
                    />
                  </label>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addRole}
          className="rounded border border-adminLine/80 px-2.5 py-1 text-[11px] font-medium text-adminFg hover:bg-adminFg/[0.06]"
        >
          {tr("addRole")}
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded border border-adminFg/25 bg-adminFg/[0.08] px-3 py-1 text-[11px] font-medium text-adminFg hover:bg-adminFg/[0.12] disabled:opacity-40"
        >
          {saving ? tr("saving") : tr("save")}
        </button>
      </div>
    </div>
  );
}
