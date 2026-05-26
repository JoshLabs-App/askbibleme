"use client";

import { useCallback, useEffect, useState } from "react";
import { diskAuthHeaders } from "@/lib/disk-auth-headers";

type Flags = {
  memberRegisterEnabled: boolean;
  remoteContentManifestEnabled: boolean;
  exploreCategoriesRemoteEnabled: boolean;
};

const EMPTY_FLAGS: Flags = {
  memberRegisterEnabled: false,
  remoteContentManifestEnabled: true,
  exploreCategoriesRemoteEnabled: true,
};

export function AdminMobileContentFlagsClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [flags, setFlags] = useState<Flags>(EMPTY_FLAGS);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/mobile-content-flags", {
        headers: { ...diskAuthHeaders() },
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : `HTTP ${res.status}`);
      }
      const inFlags = (data.flags ?? {}) as Record<string, unknown>;
      setFlags({
        memberRegisterEnabled: Boolean(inFlags.memberRegisterEnabled),
        remoteContentManifestEnabled: Boolean(inFlags.remoteContentManifestEnabled),
        exploreCategoriesRemoteEnabled: Boolean(inFlags.exploreCategoriesRemoteEnabled),
      });
      setUpdatedAt(typeof data.updatedAt === "string" ? data.updatedAt : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/mobile-content-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
        body: JSON.stringify({ flags }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : `HTTP ${res.status}`);
      }
      setMessage("已保存。");
      setUpdatedAt(typeof data.updatedAt === "string" ? data.updatedAt : updatedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [flags, updatedAt]);

  if (loading) {
    return <p className="mt-4 text-[12px] text-adminMuted">加载中…</p>;
  }

  return (
    <div className="mt-4 max-w-2xl space-y-4">
      <p className="text-[12px] leading-relaxed text-adminMuted">
        本地可视化控制移动端关键开关。保存后写入 <code>data/admin/mobile-content-flags.json</code>，接口会立即读取。
      </p>

      {error ? <p className="text-[11px] text-red-700/90 dark:text-red-300/90">{error}</p> : null}
      {message ? <p className="text-[11px] text-adminMuted">{message}</p> : null}

      <div className="space-y-2 rounded border border-adminLine/70 bg-adminBg/30 p-3">
        <label className="flex items-center gap-2 text-[12px] text-adminFg">
          <input
            type="checkbox"
            checked={flags.memberRegisterEnabled}
            onChange={(e) => setFlags((prev) => ({ ...prev, memberRegisterEnabled: e.target.checked }))}
          />
          会员注册开关（API）
        </label>
        <label className="flex items-center gap-2 text-[12px] text-adminFg">
          <input
            type="checkbox"
            checked={flags.remoteContentManifestEnabled}
            onChange={(e) => setFlags((prev) => ({ ...prev, remoteContentManifestEnabled: e.target.checked }))}
          />
          远程内容清单（manifest）开关
        </label>
        <label className="flex items-center gap-2 text-[12px] text-adminFg">
          <input
            type="checkbox"
            checked={flags.exploreCategoriesRemoteEnabled}
            onChange={(e) => setFlags((prev) => ({ ...prev, exploreCategoriesRemoteEnabled: e.target.checked }))}
          />
          Explore 远程类目开关
        </label>
      </div>

      {updatedAt ? (
        <p className="font-mono text-[10px] text-adminMuted">updatedAt: {updatedAt}</p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded border border-adminFg/30 bg-adminFg/[0.1] px-3 py-1 text-[12px] font-medium text-adminFg disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={saving}
          className="rounded border border-adminLine/80 px-3 py-1 text-[12px] text-adminMuted hover:text-adminFg disabled:opacity-50"
        >
          刷新
        </button>
      </div>
    </div>
  );
}
