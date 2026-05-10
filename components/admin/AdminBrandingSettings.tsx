"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";
import { diskAuthHeaders } from "@/lib/disk-auth-headers";
import type { BrandColors, BrandPresetId, SiteBrandingState } from "@/lib/site-branding-colors";
import {
  BRAND_COLOR_GROUPS,
  BRAND_COLOR_LABELS,
  BRAND_PRESETS,
  BRAND_PRESET_LABELS,
  isValidHex6,
} from "@/lib/site-branding-colors";

type PreviewUrls = {
  logo: string;
  icon192: string;
  icon512: string;
  appleTouch: string;
  favicon32: string;
};

const PRESET_KEYS = Object.keys(BRAND_PRESETS) as (keyof typeof BRAND_PRESETS)[];

export function AdminBrandingSettings({
  initialState,
  assetsReady,
  previewUrls,
  resolvedColors,
  vectorUrl,
}: {
  initialState: SiteBrandingState | null;
  assetsReady: boolean;
  previewUrls: PreviewUrls | null;
  resolvedColors: BrandColors;
  vectorUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busyLogo, setBusyLogo] = useState(false);
  const [busyColors, setBusyColors] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [state, setState] = useState<SiteBrandingState | null>(initialState);
  const [urls, setUrls] = useState<PreviewUrls | null>(previewUrls);
  const [vecUrl, setVecUrl] = useState<string | null>(vectorUrl);

  const initialPreset = initialState?.presetId ?? "parchment";
  const [draftPreset, setDraftPreset] = useState<BrandPresetId>(initialPreset);
  const [draftColors, setDraftColors] = useState<BrandColors>(() => ({ ...resolvedColors }));

  const applyPreset = useCallback((id: Exclude<BrandPresetId, "custom">) => {
    setDraftPreset(id);
    setDraftColors({ ...BRAND_PRESETS[id] });
  }, []);

  const chooseCustom = useCallback(() => {
    setDraftPreset("custom");
  }, []);

  const setHex = useCallback((key: keyof BrandColors, hex: string) => {
    setDraftPreset("custom");
    setDraftColors((c) => ({ ...c, [key]: hex }));
  }, []);

  const saveColors = useCallback(async () => {
    setFeedback(null);
    setBusyColors(true);
    try {
      const body =
        draftPreset === "custom"
          ? { presetId: "custom" as const, colors: draftColors }
          : { presetId: draftPreset };
      const res = await fetch("/api/admin/branding/colors", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        colors?: BrandColors;
        presetId?: BrandPresetId;
      };
      if (!res.ok) throw new Error(data.error ?? `保存失败（${res.status}）`);
      if (!data.ok || !data.colors || !data.presetId) throw new Error("响应异常");
      setDraftColors(data.colors);
      setDraftPreset(data.presetId);
      setState((s) =>
        s
          ? {
              ...s,
              updatedAt: new Date().toISOString(),
              presetId: data.presetId!,
              colors: data.colors!,
            }
          : {
              updatedAt: new Date().toISOString(),
              originalName: "（尚未上传 LOGO）",
              logoKind: "raster",
              presetId: data.presetId!,
              colors: data.colors!,
            },
      );
      setFeedback({
        tone: "ok",
        text: "配色已保存。若已上传 LOGO，已按新画布色重新生成图标；前台刷新即可看到主题色更新。",
      });
      router.refresh();
    } catch (e) {
      setFeedback({ tone: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusyColors(false);
    }
  }, [draftColors, draftPreset, router]);

  const onPick = useCallback(() => inputRef.current?.click(), []);

  const onFile = useCallback(
    async (list: FileList | null) => {
      const file = list?.[0];
      if (!file) return;
      setFeedback(null);
      setBusyLogo(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/branding/logo", {
          method: "POST",
          headers: { ...diskAuthHeaders() },
          body: fd,
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          updatedAt?: string;
          originalName?: string;
          presetId?: BrandPresetId;
          colors?: BrandColors;
          logoKind?: "svg" | "raster";
          urls?: PreviewUrls & { vector?: string };
        };
        if (!res.ok) {
          throw new Error(data.error ?? `上传失败（${res.status}）`);
        }
        if (
          !data.ok ||
          !data.updatedAt ||
          !data.originalName ||
          !data.urls ||
          !data.colors ||
          !data.presetId
        ) {
          throw new Error("响应异常");
        }
        setState({
          updatedAt: data.updatedAt,
          originalName: data.originalName,
          logoKind: data.logoKind ?? "raster",
          presetId: data.presetId,
          colors: data.colors,
        });
        setDraftColors(data.colors);
        setDraftPreset(data.presetId);
        setUrls(data.urls);
        setVecUrl(data.logoKind === "svg" ? "/branding/logo.svg" : null);
        setFeedback({
          tone: "ok",
          text: "已处理 LOGO 并生成图标。矢量文件已保留为 logo.svg（若适用）。手机请移除旧主屏幕图标后再添加。",
        });
        router.refresh();
      } catch (e) {
        setFeedback({ tone: "err", text: e instanceof Error ? e.message : String(e) });
      } finally {
        setBusyLogo(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [router],
  );

  const hexIssues = useMemo(() => {
    const bad: string[] = [];
    (Object.keys(draftColors) as (keyof BrandColors)[]).forEach((k) => {
      if (!isValidHex6(draftColors[k])) bad.push(BRAND_COLOR_LABELS[k] ?? k);
    });
    return bad;
  }, [draftColors]);

  return (
    <div className={`${ADMIN_MAIN_CLASS} space-y-8`}>
      <header className="space-y-2">
        <h1 className="text-[15px] font-medium tracking-tight text-adminFg">全局设置</h1>
        <p className="max-w-prose text-[12px] leading-relaxed text-adminMuted">
          上传<strong>矢量 SVG</strong>或栅格图作为站点 LOGO；配色可选预设或自定义。画布色{" "}
          <code className="rounded bg-adminPanel px-1 py-0.5 text-[11px]">canvas</code>{" "}
          会用作图标留白与 PWA 主题底色。写入权限与音乐上传相同。
        </p>
      </header>

      <section className="max-w-2xl space-y-4 rounded-lg border border-adminLine bg-adminPanel/40 p-5">
        <h2 className="text-[13px] font-medium text-adminFg">品牌配色</h2>
        <div className="flex flex-wrap gap-2">
          {PRESET_KEYS.map((id) => (
            <button
              key={id}
              type="button"
              disabled={busyColors}
              onClick={() => applyPreset(id)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                draftPreset === id
                  ? "border-sand bg-adminBg text-adminFg"
                  : "border-adminLine bg-adminBg/80 text-adminMuted hover:border-sand/80 hover:text-adminFg"
              }`}
            >
              {BRAND_PRESET_LABELS[id]}
            </button>
          ))}
          <button
            type="button"
            disabled={busyColors}
            onClick={chooseCustom}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
              draftPreset === "custom"
                ? "border-sand bg-adminBg text-adminFg"
                : "border-adminLine bg-adminBg/80 text-adminMuted hover:border-sand/80 hover:text-adminFg"
            }`}
          >
            {BRAND_PRESET_LABELS.custom}
          </button>
        </div>

        {draftPreset === "custom" ? (
          <div className="space-y-5 border-t border-adminLine/80 pt-4">
            {BRAND_COLOR_GROUPS.map((g) => (
              <div key={g.label} className="space-y-2">
                <p className="text-[11px] font-medium text-adminFg">{g.label}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {g.keys.map((key) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 rounded-md border border-adminLine/70 bg-adminBg/60 px-2 py-2"
                    >
                      <input
                        type="color"
                        value={isValidHex6(draftColors[key]) ? draftColors[key] : "#000000"}
                        onChange={(e) => setHex(key, e.target.value)}
                        className="h-8 w-10 cursor-pointer overflow-hidden rounded border border-adminLine bg-transparent p-0"
                        aria-label={BRAND_COLOR_LABELS[key]}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-adminFg">{BRAND_COLOR_LABELS[key]}</div>
                        <input
                          type="text"
                          value={draftColors[key]}
                          onChange={(e) => setHex(key, e.target.value)}
                          spellCheck={false}
                          className="mt-0.5 w-full rounded border border-transparent bg-transparent font-mono text-[11px] text-adminMuted outline-none focus:border-sand/50"
                        />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-adminLine/80 pt-4">
          <button
            type="button"
            disabled={busyColors || hexIssues.length > 0}
            onClick={() => void saveColors()}
            className="rounded-md border border-adminLine bg-adminBg px-3 py-2 text-[12px] font-medium text-adminFg shadow-sm transition hover:border-sand hover:bg-adminPanel disabled:opacity-45"
          >
            {busyColors ? "保存中…" : "保存配色"}
          </button>
          {hexIssues.length > 0 ? (
            <span className="text-[11px] text-red-800/90">
              以下色值需为 #RRGGBB：{hexIssues.join("、")}
            </span>
          ) : null}
        </div>

        <div
          className="flex flex-wrap gap-2 rounded-md border border-adminLine/60 p-3"
          style={{ backgroundColor: draftColors.canvas }}
        >
          <span
            className="rounded px-2 py-1 text-[10px] font-medium"
            style={{ backgroundColor: draftColors.surface, color: draftColors.ink }}
          >
            surface / ink
          </span>
          <span
            className="rounded px-2 py-1 text-[10px] font-medium"
            style={{ backgroundColor: draftColors.canvas, color: draftColors.muted }}
          >
            muted on canvas
          </span>
          <span
            className="rounded px-2 py-1 text-[10px] font-medium"
            style={{ backgroundColor: draftColors.sand, color: draftColors.ink }}
          >
            sand accent
          </span>
        </div>
      </section>

      <section className="max-w-xl space-y-4 rounded-lg border border-adminLine bg-adminPanel/40 p-5">
        <h2 className="text-[13px] font-medium text-adminFg">LOGO 与图标</h2>
        <input
          ref={inputRef}
          type="file"
          accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => void onFile(e.target.files)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busyLogo}
            onClick={onPick}
            className="rounded-md border border-adminLine bg-adminBg px-3 py-2 text-[12px] font-medium text-adminFg shadow-sm transition hover:border-sand hover:bg-adminPanel disabled:opacity-45"
          >
            {busyLogo ? "处理中…" : "上传 LOGO（SVG / 栅格）"}
          </button>
          {state ? (
            <span className="text-[11px] text-adminMuted">
              上次更新：{new Date(state.updatedAt).toLocaleString("zh-CN")}
              {state.originalName ? ` · ${state.originalName}` : ""}
              {state.logoKind === "svg" ? " · 矢量" : " · 栅格"}
            </span>
          ) : (
            <span className="text-[11px] text-adminMuted">尚未上传；前台使用仓库默认图标。</span>
          )}
        </div>

        {vecUrl ? (
          <p className="text-[11px] text-adminMuted">
            矢量源文件：{" "}
            <Link href={vecUrl} className="text-sand underline underline-offset-2" target="_blank">
              logo.svg
            </Link>
          </p>
        ) : null}

        {feedback ? (
          <p
            className={`text-[12px] leading-relaxed ${feedback.tone === "err" ? "text-red-800/90" : "text-adminMuted"}`}
          >
            {feedback.text}
          </p>
        ) : null}

        {assetsReady && urls ? (
          <div className="space-y-3 border-t border-adminLine/80 pt-4">
            <p className="text-[11px] font-medium text-adminFg">预览</p>
            <div className="flex flex-wrap items-end gap-6">
              <figure className="space-y-1 text-center">
                <div
                  className="relative mx-auto h-16 w-16 overflow-hidden rounded-lg border border-adminLine"
                  style={{ backgroundColor: draftColors.canvas }}
                >
                  <Image src={urls.logo} alt="站点 LOGO" fill className="object-contain p-1" unoptimized />
                </div>
                <figcaption className="text-[10px] text-adminMuted">栅格预览</figcaption>
              </figure>
              <figure className="space-y-1 text-center">
                <div
                  className="relative mx-auto h-14 w-14 overflow-hidden rounded-lg border border-adminLine"
                  style={{ backgroundColor: draftColors.canvas }}
                >
                  <Image src={urls.icon192} alt="192" fill className="object-contain" unoptimized />
                </div>
                <figcaption className="text-[10px] text-adminMuted">192 PWA</figcaption>
              </figure>
              <figure className="space-y-1 text-center">
                <div
                  className="relative mx-auto h-14 w-14 overflow-hidden rounded-lg border border-adminLine"
                  style={{ backgroundColor: draftColors.canvas }}
                >
                  <Image src={urls.favicon32} alt="32" fill className="object-contain" unoptimized />
                </div>
                <figcaption className="text-[10px] text-adminMuted">favicon</figcaption>
              </figure>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
