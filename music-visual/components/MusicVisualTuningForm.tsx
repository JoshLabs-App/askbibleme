"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  HOME_ATMOSPHERE_PRESETS,
  MUSIC_VISUAL_ATMOSPHERE_PRESETS,
  getMusicVisualAtmospherePresetForHome,
  useHomeAtmosphereVisual,
  useMusicVisualTuning,
} from "@/music-visual";
import { MUSIC_VISUAL_TUNING_LIMITS as TL } from "@/music-visual/tuning/schema";

function TuningRow(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  decimals?: number;
  embeddedInAdmin?: boolean;
}) {
  const d = props.decimals ?? 2;
  const admin = props.embeddedInAdmin;
  return (
    <label
      className={`flex items-center gap-2 py-1 text-[11px] ${admin ? "text-adminFg/78" : "text-ink/75"}`}
    >
      <span className="w-[6.5rem] shrink-0 leading-snug">{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="min-w-0 flex-1 accent-ink/35"
      />
      <span
        className={`w-11 shrink-0 text-right font-mono text-[10px] tabular-nums ${admin ? "text-adminFg/48" : "text-ink/45"}`}
      >
        {props.value.toFixed(d)}
      </span>
    </label>
  );
}

export type MusicVisualTuningFormProps = {
  className?: string;
  /** 底部链到 `/admin/visual`（drive、引擎预设、导入导出） */
  showConsoleLink?: boolean;
  /** 控制台用：展开「全部引擎预设表」 */
  showEnginePresetTable?: boolean;
  /** 嵌入统一后台侧：浅色扁平分区 */
  embeddedInAdmin?: boolean;
};

/**
 * 首页氛围 + 引擎映射说明 + 播放视觉调参（localStorage，与 WebGL / `--music-*` 同源）。
 */
export function MusicVisualTuningForm({
  className = "",
  showConsoleLink = false,
  showEnginePresetTable = false,
  embeddedInAdmin = false,
}: MusicVisualTuningFormProps) {
  const { tuning, setTuning, resetTuning } = useMusicVisualTuning();
  const { homeAtmospherePresetId, setHomeAtmospherePresetId } = useHomeAtmosphereVisual();

  const sec = embeddedInAdmin
    ? "mb-6 border-b border-adminLine pb-6 last:mb-0 last:border-b-0 last:pb-0"
    : "mb-6 rounded-xl border border-border/60 bg-surface/40 p-4 last:mb-0";
  const secLast = embeddedInAdmin
    ? "border-b border-adminLine pb-6"
    : "rounded-xl border border-border/60 bg-surface/40 p-4";
  const btnBorder = embeddedInAdmin
    ? "border border-border px-2 py-1 text-[10px] text-adminMuted hover:bg-ink/[0.04] hover:text-adminFg"
    : "rounded-lg border border-border/60 px-2 py-1 text-[10px] text-muted hover:text-ink";

  const h2 = embeddedInAdmin ? "mb-2 text-[12px] font-medium text-adminFg/90" : "mb-2 text-[12px] font-medium text-ink/90";
  const bodyMuted = embeddedInAdmin ? "text-adminMuted" : "text-muted";
  const bodyInk = embeddedInAdmin ? "text-adminFg/85" : "text-ink/80";
  const summaryInk = embeddedInAdmin ? "text-adminFg/55" : "text-ink/55";

  const enginePreset = useMemo(
    () => getMusicVisualAtmospherePresetForHome(homeAtmospherePresetId),
    [homeAtmospherePresetId],
  );

  return (
    <div className={className}>
      <section className={sec}>
        <h2 className={h2}>首页氛围</h2>
        <p className={`mb-2 text-[10px] leading-relaxed ${bodyMuted}`}>
          与音乐首页播放区「氛围」同一套 ID；壳层 WebGL / CSS 驱动与此处选项对齐。
        </p>
        <div className="flex flex-wrap gap-2">
          {HOME_ATMOSPHERE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setHomeAtmospherePresetId(p.id)}
              className={`rounded-full border px-3 py-1 text-[11px] transition ${
                homeAtmospherePresetId === p.id
                  ? embeddedInAdmin
                    ? "border-ink/20 bg-ink/[0.06] text-adminFg"
                    : "border-ink/25 bg-ink/[0.06] text-ink"
                  : embeddedInAdmin
                    ? "border-adminLine text-adminMuted hover:border-border hover:text-adminFg"
                    : "border-border/60 text-muted hover:border-ink/15 hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section className={sec}>
        <h2 className={h2}>引擎映射（当前）</h2>
        <p className={`text-[11px] ${bodyInk}`}>
          <span className="font-medium">{enginePreset.label}</span>（{enginePreset.id}）· fog{" "}
          {enginePreset.fogSpeedMul.toFixed(2)} · glow {enginePreset.glowWeightMul.toFixed(2)} · particle{" "}
          {enginePreset.particleDensityMul.toFixed(2)}
        </p>
        {showEnginePresetTable ? (
          <details className={`mt-2 text-[10px] ${bodyMuted}`}>
            <summary className={`cursor-pointer select-none ${summaryInk}`}>全部引擎预设表</summary>
            <ul className="mt-2 space-y-1 font-mono">
              {MUSIC_VISUAL_ATMOSPHERE_PRESETS.map((p) => (
                <li key={p.id}>
                  {p.id} · fog {p.fogSpeedMul} · glow {p.glowWeightMul} · particle {p.particleDensityMul}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className={secLast}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className={h2}>播放视觉调参（WebGL / CSS）</h2>
          <button type="button" onClick={() => resetTuning()} className={btnBorder}>
            恢复默认
          </button>
        </div>
        <div className="space-y-0.5">
          <TuningRow
            embeddedInAdmin={embeddedInAdmin}
            label="总强度"
            min={TL.master.min}
            max={TL.master.max}
            step={1}
            value={tuning.master}
            onChange={(n) => setTuning({ master: n })}
          />
          <TuningRow
            embeddedInAdmin={embeddedInAdmin}
            label="光晕"
            min={TL.glowMul.min}
            max={TL.glowMul.max}
            step={2.5}
            value={tuning.glowMul}
            onChange={(n) => setTuning({ glowMul: n })}
          />
          <TuningRow
            embeddedInAdmin={embeddedInAdmin}
            label="深色光晕"
            min={TL.glowDarkExtra.min}
            max={TL.glowDarkExtra.max}
            step={2}
            value={tuning.glowDarkExtra}
            onChange={(n) => setTuning({ glowDarkExtra: n })}
          />
          <TuningRow
            embeddedInAdmin={embeddedInAdmin}
            label="背景呼吸"
            min={TL.shellBreathAmp.min}
            max={TL.shellBreathAmp.max}
            step={0.5}
            value={tuning.shellBreathAmp}
            onChange={(n) => setTuning({ shellBreathAmp: n })}
          />
          <TuningRow
            embeddedInAdmin={embeddedInAdmin}
            label="播放键"
            min={TL.playPulseMul.min}
            max={TL.playPulseMul.max}
            step={0.03}
            value={tuning.playPulseMul}
            onChange={(n) => setTuning({ playPulseMul: n })}
          />
          <TuningRow
            embeddedInAdmin={embeddedInAdmin}
            label="无数据呼吸"
            min={TL.fallbackBreath.min}
            max={TL.fallbackBreath.max}
            step={0.25}
            value={tuning.fallbackBreath}
            onChange={(n) => setTuning({ fallbackBreath: n })}
          />
          <TuningRow
            embeddedInAdmin={embeddedInAdmin}
            label="跟曲线"
            min={TL.analysisBlend.min}
            max={TL.analysisBlend.max}
            step={0.1}
            value={tuning.analysisBlend}
            onChange={(n) => setTuning({ analysisBlend: n })}
          />
        </div>
        {showConsoleLink && !embeddedInAdmin ? (
          <p className="mt-3 border-t border-border/40 pt-3 text-[10px] text-muted">
            实时 drive、引擎预设与导入导出见{" "}
            <Link href="/admin/visual" className="text-ink/70 underline underline-offset-2 hover:text-ink">
              播放视觉
            </Link>
            。
          </p>
        ) : null}
      </section>
    </div>
  );
}
