"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";
import { readShellPlaybackPersisted } from "@/lib/music-companion/shell-playback-storage";
import { primaryLocaleText } from "@/lib/i18n/localized-text";
import { MusicVisualTuningForm } from "@/music-visual/components/MusicVisualTuningForm";
import {
  isHomeAtmospherePresetId,
  type HomeAtmospherePresetId,
  useHomeAtmosphereVisual,
  useMusicShellVisual,
  useMusicVisualTuning,
} from "@/music-visual";
import type { MusicVisualTuningV1 } from "@/music-visual/tuning/schema";
import { normalizeMusicVisualTuning } from "@/music-visual/tuning/schema";

type ConsoleBundleV1 = {
  v: 1;
  tuning: MusicVisualTuningV1;
  homeAtmospherePresetId?: HomeAtmospherePresetId;
};

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function MusicVisualConsoleClient({
  embeddedInAdmin = false,
}: {
  embeddedInAdmin?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const {
    effectiveSrc,
    shellDefaultSrc,
    shellOverrideSrc,
    playing,
    canPlay,
    loading,
    togglePlay,
    currentSec,
    durationSec,
    musicStore,
    refetchCompanionStore,
  } = useMusicShellPlayback();
  const { tuning, setTuning, replaceTuning } = useMusicVisualTuning();
  const { homeAtmospherePresetId, setHomeAtmospherePresetId } = useHomeAtmosphereVisual();
  const { driveRef, hasAnalysis } = useMusicShellVisual();

  const [driveUi, setDriveUi] = useState({ rms: 0, low: 0, mid: 0, high: 0 });
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [refetchMsg, setRefetchMsg] = useState<string | null>(null);
  const [refetchBusy, setRefetchBusy] = useState(false);

  useEffect(() => {
    let h = 0;
    const tick = () => {
      const d = driveRef.current;
      setDriveUi((p) =>
        p.rms === d.rms && p.low === d.low && p.mid === d.mid && p.high === d.high ? p : { ...d },
      );
      h = requestAnimationFrame(tick);
    };
    h = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(h);
  }, [driveRef]);

  const exportBundle = useCallback((): ConsoleBundleV1 => {
    return { v: 1, tuning, homeAtmospherePresetId };
  }, [tuning, homeAtmospherePresetId]);

  const copyExport = useCallback(async () => {
    const text = JSON.stringify(exportBundle(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setImportMsg("已复制到剪贴板");
    } catch {
      setImportMsg("复制失败，请手动全选导出区");
    }
    setTimeout(() => setImportMsg(null), 2400);
  }, [exportBundle]);

  const applyImport = useCallback(() => {
    setImportMsg(null);
    try {
      const raw = JSON.parse(importText) as unknown;
      if (!raw || typeof raw !== "object") {
        setImportMsg("无效 JSON");
        return;
      }
      const o = raw as Record<string, unknown>;
      if (o.v === 1 && o.tuning && typeof o.tuning === "object") {
        replaceTuning(normalizeMusicVisualTuning(o.tuning));
        const hid = o.homeAtmospherePresetId;
        if (typeof hid === "string" && isHomeAtmospherePresetId(hid)) {
          setHomeAtmospherePresetId(hid);
        }
        setImportMsg("已应用 bundle v1");
        setImportText("");
        return;
      }
      if (o.v === 1 || o.master !== undefined) {
        replaceTuning(normalizeMusicVisualTuning(raw));
        setImportMsg("已应用 tuning（仅调参）");
        setImportText("");
        return;
      }
      setImportMsg("需要 { v:1, tuning:{...} } 或完整 tuning 对象");
    } catch {
      setImportMsg("JSON 解析失败");
    }
  }, [importText, replaceTuning, setHomeAtmospherePresetId]);

  const trackCount = musicStore?.audioTracks?.filter((t) => t.src?.trim()).length ?? 0;

  const storeSummary = useMemo(() => {
    if (!musicStore) return null;
    const tracks = musicStore.audioTracks.filter((t) => t.src?.trim());
    return {
      scenes: musicStore.scenes.length,
      defaultSceneId: musicStore.defaultSceneId,
      tracksTotal: musicStore.audioTracks.length,
      tracksWithSrc: tracks.length,
      visuals: musicStore.backgroundVisuals.length,
      trackRows: tracks.slice(0, 20).map((t) => ({
        id: t.id,
        title: primaryLocaleText(t.title),
        src: clip(t.src ?? "", 72),
        analysis: t.analysisSrc ? clip(t.analysisSrc, 56) : "—",
      })),
    };
  }, [musicStore]);

  const storeJson = useMemo(() => {
    if (!musicStore) return "";
    try {
      return JSON.stringify(musicStore, null, 2);
    } catch {
      return "(无法序列化)";
    }
  }, [musicStore]);

  const onRefetchCompanion = useCallback(async () => {
    setRefetchBusy(true);
    setRefetchMsg(null);
    const r = await refetchCompanionStore();
    setRefetchBusy(false);
    if (r.ok) setRefetchMsg("已更新曲库");
    else setRefetchMsg(`失败${r.status != null ? ` HTTP ${r.status}` : ""}${r.message ? `: ${r.message}` : ""}`);
    setTimeout(() => setRefetchMsg(null), 4000);
  }, [refetchCompanionStore]);

  const ink = embeddedInAdmin ? "text-adminFg" : "text-ink";
  const muted = embeddedInAdmin ? "text-adminMuted" : "text-muted";
  const sectionBox = embeddedInAdmin
    ? "mb-8 border-b border-adminLine pb-8 last:mb-0 last:border-b-0 last:pb-0"
    : "mb-8 rounded-xl border border-border/60 bg-surface/40 p-4";
  const canvasBtn = embeddedInAdmin
    ? "border border-border bg-canvas px-2.5 py-1 text-[11px] font-medium text-adminFg transition hover:bg-surface disabled:opacity-50"
    : "rounded-lg border border-border/60 bg-canvas px-3 py-1.5 text-[11px] font-medium transition hover:bg-canvas/80 disabled:opacity-40";

  return (
    <main
      className={
        embeddedInAdmin
          ? `${ADMIN_MAIN_CLASS} pb-24 text-adminFg`
          : "mx-auto min-h-0 w-full max-w-3xl px-4 py-5 pb-28 text-ink"
      }
    >
      {!embeddedInAdmin ? (
        <header className="mb-6 border-b border-border/50 pb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-[15px] font-semibold tracking-tight">播放视觉调试台</h1>
            <div className="flex flex-wrap gap-3 text-[11px]">
              <Link href="/" className="text-muted transition hover:text-ink">
                首页
              </Link>
              <Link href="/admin/music" className="text-muted transition hover:text-ink">
                曲库与配图
              </Link>
              <Link href="/admin/studio" className="text-muted transition hover:text-ink">
                Studio
              </Link>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            调参、drive、引擎预设与导入导出集中在此；上传曲目与背景图请用「曲库与配图」。与前台壳层同源写入。当前路径{" "}
            <span className="font-mono text-ink/80">{pathname || "/"}</span>
            。
          </p>
        </header>
      ) : (
        <header className="mb-8 border-b border-adminLine pb-5">
          <h1 className="text-[15px] font-medium tracking-tight text-adminFg">播放视觉</h1>
          <p className="mt-2 max-w-prose text-[11px] leading-relaxed text-adminMuted">
            与前台壳层同源；曲库上传仍在「曲库与配图」。
          </p>
        </header>
      )}

      <section className={sectionBox}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className={`text-[12px] font-medium ${embeddedInAdmin ? "text-adminFg/90" : "text-ink/90"}`}>曲库与 API</h2>
          <button
            type="button"
            disabled={refetchBusy}
            onClick={() => void onRefetchCompanion()}
            className={`${canvasBtn} disabled:opacity-50`}
          >
            {refetchBusy ? "拉取中…" : "重新拉取 /api/music/companion"}
          </button>
        </div>
        <p className={`mb-2 text-[10px] ${muted}`}>
          壳层曲库加载中：{loading ? "是" : "否"}
          {refetchMsg ? (
            <span className={embeddedInAdmin ? "ml-2 text-adminFg/75" : "ml-2 text-ink/70"}>{refetchMsg}</span>
          ) : null}
        </p>
        {storeSummary ? (
          <ul className={`mb-3 space-y-0.5 text-[11px] ${embeddedInAdmin ? "text-adminFg/85" : "text-ink/80"}`}>
            <li>场景数 {storeSummary.scenes} · 默认场景 ID：{storeSummary.defaultSceneId ?? "—"}</li>
            <li>
              曲目 {storeSummary.tracksTotal} 条，其中含 src：{storeSummary.tracksWithSrc} · 背景视觉{" "}
              {storeSummary.visuals}
            </li>
          </ul>
        ) : (
          <p className={`mb-3 text-[11px] ${muted}`}>尚无曲库（等待 API 或拉取失败）</p>
        )}
        {storeSummary && storeSummary.trackRows.length > 0 ? (
          <div
            className={`mb-3 overflow-x-auto ${embeddedInAdmin ? "border-y border-adminLine" : "rounded-lg border border-border/40"}`}
          >
            <table className="w-full min-w-[28rem] border-collapse text-left text-[10px]">
              <thead className={embeddedInAdmin ? "bg-surface/90 text-adminMuted" : "bg-canvas/90 text-muted"}>
                <tr>
                  <th className={`border-b px-2 py-1 font-medium ${embeddedInAdmin ? "border-adminLine" : "border-border/40"}`}>id</th>
                  <th className={`border-b px-2 py-1 font-medium ${embeddedInAdmin ? "border-adminLine" : "border-border/40"}`}>标题</th>
                  <th className={`border-b px-2 py-1 font-medium ${embeddedInAdmin ? "border-adminLine" : "border-border/40"}`}>src</th>
                  <th className={`border-b px-2 py-1 font-medium ${embeddedInAdmin ? "border-adminLine" : "border-border/40"}`}>analysis</th>
                </tr>
              </thead>
              <tbody className={`font-mono ${embeddedInAdmin ? "text-adminFg/85" : "text-ink/85"}`}>
                {storeSummary.trackRows.map((row) => (
                  <tr key={row.id} className={`border-b last:border-0 ${embeddedInAdmin ? "border-adminLine/80" : "border-border/30"}`}>
                    <td className="max-w-[6rem] truncate px-2 py-1 align-top">{clip(row.id, 20)}</td>
                    <td className={`max-w-[8rem] truncate px-2 py-1 align-top ${embeddedInAdmin ? "text-adminFg/75" : "text-ink/75"}`}>{clip(row.title, 24)}</td>
                    <td className={`px-2 py-1 align-top ${muted}`}>{row.src}</td>
                    <td className={`px-2 py-1 align-top ${muted}`}>{row.analysis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {trackCount > 20 ? (
              <p className={`border-t px-2 py-1 text-[9px] ${embeddedInAdmin ? "border-adminLine bg-canvas/90 text-adminMuted" : "border-border/40 bg-canvas/80 text-muted"}`}>仅显示前 20 条有 src 的曲目</p>
            ) : null}
          </div>
        ) : null}
        <details className={`text-[10px] ${muted}`}>
          <summary className={`cursor-pointer select-none ${embeddedInAdmin ? "text-adminFg/55" : "text-ink/55"}`}>完整 companion JSON</summary>
          <pre
            className={
              embeddedInAdmin
                ? "mt-2 max-h-56 overflow-auto border border-border bg-surface/60 p-2 font-mono text-[10px] leading-relaxed text-adminFg/80"
                : "mt-2 max-h-56 overflow-auto rounded-lg border border-border/40 bg-canvas/90 p-2 font-mono text-[10px] leading-relaxed text-ink/70"
            }
          >
            {storeJson || "null"}
          </pre>
        </details>
        <details className={`mt-2 text-[10px] ${muted}`}>
          <summary className={`cursor-pointer select-none ${embeddedInAdmin ? "text-adminFg/55" : "text-ink/55"}`}>壳层持久化播放（localStorage）</summary>
          <pre
            className={
              embeddedInAdmin
                ? "mt-2 max-h-32 overflow-auto border border-border bg-surface/60 p-2 font-mono text-[10px] text-adminFg/85"
                : "mt-2 max-h-32 overflow-auto rounded-lg border border-border/40 bg-canvas/90 p-2 font-mono text-[10px] text-ink/70"
            }
          >
            {(() => {
              const p = readShellPlaybackPersisted();
              return p ? JSON.stringify(p, null, 2) : "（无）";
            })()}
          </pre>
        </details>
      </section>

      <section className={sectionBox}>
        <h2 className={`mb-2 text-[12px] font-medium ${embeddedInAdmin ? "text-adminFg/90" : "text-ink/90"}`}>播放</h2>
        <div className={`mb-2 space-y-1 font-mono text-[10px] leading-relaxed ${muted}`}>
          <p>
            <span className={embeddedInAdmin ? "text-adminFg/55" : "text-ink/55"}>effective</span> {clip(effectiveSrc || "（空）", 200)}
          </p>
          <p>
            <span className={embeddedInAdmin ? "text-adminFg/55" : "text-ink/55"}>default</span> {clip(shellDefaultSrc || "（空）", 200)}
          </p>
          <p>
            <span className={embeddedInAdmin ? "text-adminFg/55" : "text-ink/55"}>override</span>{" "}
            {shellOverrideSrc ? clip(shellOverrideSrc, 200) : "（无，使用默认）"}
          </p>
        </div>
        <div className={`flex flex-wrap items-center gap-3 text-[11px] ${embeddedInAdmin ? "text-adminFg/85" : "text-ink/80"}`}>
          <button
            type="button"
            disabled={!canPlay}
            onClick={() => void togglePlay()}
            className={`${canvasBtn} disabled:opacity-40`}
          >
            {playing ? "暂停" : "播放"}
          </button>
          <span className={`tabular-nums ${muted}`}>
            {Math.floor(currentSec)}s / {durationSec ? `${Math.floor(durationSec)}s` : "—"}
          </span>
          <span className={muted}>曲库有 src 的曲目：{trackCount}</span>
        </div>
      </section>

      <MusicVisualTuningForm showEnginePresetTable className="mb-8" embeddedInAdmin={embeddedInAdmin} />

      <section className={sectionBox}>
        <h2 className={`mb-2 text-[12px] font-medium ${embeddedInAdmin ? "text-adminFg/90" : "text-ink/90"}`}>实时 drive</h2>
        <p className={`mb-2 text-[10px] ${muted}`}>与壳层 rAF 同源；有分析 JSON：{hasAnalysis ? "是" : "否"}</p>
        <div className="grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
          {(["rms", "low", "mid", "high"] as const).map((k) => (
            <div
              key={k}
              className={
                embeddedInAdmin
                  ? "border border-adminLine px-2 py-1.5"
                  : "rounded-md border border-border/40 bg-canvas/80 px-2 py-1.5"
              }
            >
              <div className={`text-[9px] uppercase ${muted}`}>{k}</div>
              <div className={ink}>{driveUi[k].toFixed(3)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={sectionBox}>
        <h2 className={`mb-2 text-[12px] font-medium ${embeddedInAdmin ? "text-adminFg/90" : "text-ink/90"}`}>导入 / 导出</h2>
        <p className={`mb-2 text-[10px] leading-relaxed ${muted}`}>
          导出为 JSON（含 tuning 与可选 homeAtmospherePresetId）。导入支持完整 bundle，或仅 tuning 对象。
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void copyExport()} className={canvasBtn}>
            复制当前配置
          </button>
          <button type="button" onClick={applyImport} className={canvasBtn}>
            应用下方 JSON
          </button>
        </div>
        {importMsg ? (
          <p className={`mt-2 text-[11px] ${embeddedInAdmin ? "text-adminFg/75" : "text-ink/70"}`}>{importMsg}</p>
        ) : null}
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder='{"v":1,"tuning":{"v":1,"master":1,...},"homeAtmospherePresetId":"lagoon"}'
          rows={8}
          className={
            embeddedInAdmin
              ? "mt-3 w-full resize-y border border-border bg-canvas p-2 font-mono text-[10px] text-ink placeholder:text-muted/50"
              : "mt-3 w-full resize-y rounded-lg border border-border/60 bg-canvas p-2 font-mono text-[10px] text-ink placeholder:text-muted/50"
          }
          spellCheck={false}
        />
        <pre
          className={
            embeddedInAdmin
              ? "mt-3 max-h-40 overflow-auto border border-border bg-surface/70 p-2 font-mono text-[9px] leading-relaxed text-muted"
              : "mt-3 max-h-40 overflow-auto rounded-lg border border-border/40 bg-canvas/90 p-2 font-mono text-[9px] leading-relaxed text-muted"
          }
        >
          {JSON.stringify(exportBundle(), null, 2)}
        </pre>
      </section>
    </main>
  );
}
