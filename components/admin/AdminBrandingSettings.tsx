"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";
import { AdminMobileAppIconPreview } from "@/components/admin/AdminMobileAppIconPreview";
import { notifySiteBrandingUpdated } from "@/lib/branding-broadcast";
import { diskAuthHeaders } from "@/lib/disk-auth-headers";
import type { BrandColors, SiteBrandingState } from "@/lib/site-branding-colors";
import { isValidHex6 } from "@/lib/site-branding-colors";

type PreviewUrls = {
  logo?: string;
  splash?: string;
  icon192?: string;
  icon512?: string;
  appleTouch?: string;
  favicon32?: string;
};

export function AdminBrandingSettings({
  initialState,
  iconsReady,
  logoReady,
  splashReady,
  previewUrls,
  resolvedColors,
  resolvedLogoBackground,
  resolvedLogoTextAccent,
  iconPreviewBackground: initialIconPreviewBackground,
  vectorUrl,
}: {
  initialState: SiteBrandingState | null;
  iconsReady: boolean;
  logoReady: boolean;
  splashReady: boolean;
  previewUrls: PreviewUrls | null;
  resolvedColors: BrandColors;
  resolvedLogoBackground: string;
  resolvedLogoTextAccent: string;
  iconPreviewBackground: string;
  vectorUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busyGenerate, setBusyGenerate] = useState(false);
  const [pendingSvg, setPendingSvg] = useState<File | null>(null);
  const [pendingSvgPreview, setPendingSvgPreview] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [state, setState] = useState<SiteBrandingState | null>(initialState);
  const [urls, setUrls] = useState<PreviewUrls | null>(previewUrls);
  const [vecUrl, setVecUrl] = useState<string | null>(vectorUrl);
  const [iconPreviewBust, setIconPreviewBust] = useState(0);
  const [iconPreviewBackground, setIconPreviewBackground] = useState(initialIconPreviewBackground);

  const [draftLogoBackground, setDraftLogoBackground] = useState(resolvedLogoBackground);
  const [draftLogoTextAccent, setDraftLogoTextAccent] = useState(resolvedLogoTextAccent);

  const onPickSvg = useCallback(() => inputRef.current?.click(), []);

  const onSvgSelected = useCallback((list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".svg")) {
      setFeedback({ tone: "err", text: "请上传 SVG 文件（透明底、白色图形）。" });
      return;
    }
    setFeedback(null);
    setPendingSvg(file);
    setPendingSvgPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const generateAll = useCallback(async () => {
    if (!isValidHex6(draftLogoBackground)) {
      setFeedback({ tone: "err", text: "请设置有效的 LOGO 底色（#RRGGBB）。" });
      return;
    }
    if (!isValidHex6(draftLogoTextAccent)) {
      setFeedback({ tone: "err", text: "请设置有效的 LOGO 辅助色（#RRGGBB）。" });
      return;
    }
    if (!pendingSvg && !logoReady) {
      setFeedback({ tone: "err", text: "请先选择 SVG 文件。" });
      return;
    }
    setFeedback(null);
    setBusyGenerate(true);
    try {
      const fd = new FormData();
      fd.append("logoBackground", draftLogoBackground);
      fd.append("logoTextAccent", draftLogoTextAccent);
      if (pendingSvg) fd.append("file", pendingSvg);
      const res = await fetch("/api/admin/branding/generate-all", {
        method: "POST",
        headers: { ...diskAuthHeaders() },
        body: fd,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        logoBackground?: string;
        logoTextAccent?: string;
        iconBackground?: string;
        updatedAt?: string;
        originalName?: string;
        appIconsUpdatedAt?: string;
        appIconOriginalName?: string;
        urls?: PreviewUrls & { vector?: string };
      };
      if (!res.ok) throw new Error(data.error ?? `生成失败（${res.status}）`);
      if (!data.ok || !data.urls || !data.updatedAt) throw new Error("响应异常");
      if (data.logoBackground) setDraftLogoBackground(data.logoBackground);
      if (data.logoTextAccent) setDraftLogoTextAccent(data.logoTextAccent);
      if (data.iconBackground) setIconPreviewBackground(data.iconBackground);
      setPendingSvg(null);
      setPendingSvgPreview((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
      const brandingBase = state ?? initialState;
      setState({
        updatedAt: data.updatedAt,
        originalName: data.originalName ?? "logo.svg",
        logoKind: "svg",
        presetId: brandingBase?.presetId ?? "parchment",
        colors: brandingBase?.colors ?? resolvedColors,
        logoBackground: data.logoBackground ?? draftLogoBackground,
        logoTextAccent: data.logoTextAccent ?? draftLogoTextAccent,
        appIconsUpdatedAt: data.appIconsUpdatedAt,
        appIconOriginalName: data.appIconOriginalName,
      });
      setUrls(data.urls);
      setVecUrl("/branding/logo.svg");
      setIconPreviewBust(Date.now());
      setFeedback({
        tone: "ok",
        text: "已生成：顶栏 LOGO、网站 / PWA 图标、手机安装图标与启动屏。重新打包安装 App 后真机生效。",
      });
      notifySiteBrandingUpdated("logo");
      router.refresh();
    } catch (e) {
      setFeedback({ tone: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusyGenerate(false);
    }
  }, [
    draftLogoBackground,
    draftLogoTextAccent,
    initialState,
    logoReady,
    pendingSvg,
    resolvedColors,
    router,
    state,
  ]);

  useEffect(() => {
    return () => {
      if (pendingSvgPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(pendingSvgPreview);
      }
    };
  }, [pendingSvgPreview]);

  const mobileIconPreviewSrc = useMemo(() => {
    const hasIconPack =
      iconsReady || Boolean(state?.appIconsUpdatedAt) || iconPreviewBust > 0;
    if (!hasIconPack) return null;
    const base = "/branding/icon-192.png";
    const v =
      iconPreviewBust > 0
        ? iconPreviewBust
        : state?.appIconsUpdatedAt ?? state?.updatedAt ?? "";
    return v ? `${base}?v=${encodeURIComponent(String(v))}` : base;
  }, [iconPreviewBust, iconsReady, state?.appIconsUpdatedAt, state?.updatedAt]);

  const iconUrlWithBust = useCallback(
    (path: string) => {
      const v =
        iconPreviewBust > 0
          ? iconPreviewBust
          : state?.appIconsUpdatedAt ?? state?.updatedAt ?? "";
      return v ? `${path}?v=${encodeURIComponent(String(v))}` : path;
    },
    [iconPreviewBust, state?.appIconsUpdatedAt, state?.updatedAt],
  );

  const splashPreviewSrc = useMemo(() => {
    if (splashReady || urls?.splash) {
      return iconUrlWithBust(urls?.splash ?? "/branding/splash-icon.png");
    }
    return null;
  }, [splashReady, urls?.splash, iconUrlWithBust]);

  const canShowSplashPreview = logoReady || iconsReady || Boolean(pendingSvgPreview);
  const logoPreviewSrc = (pendingSvgPreview ?? vecUrl ?? urls?.logo) as string | undefined;
  const canGenerate = Boolean(pendingSvg) || logoReady;

  return (
    <div className={`${ADMIN_MAIN_CLASS} space-y-8`}>
      <header className="space-y-2">
        <h1 className="text-[15px] font-medium tracking-tight text-adminFg">全局设置</h1>
        <p className="max-w-prose text-[12px] leading-relaxed text-adminMuted">
          上传透明底、仅白色图形的 SVG，设置底色后<strong>一键生成</strong>顶栏 LOGO、网站 / PWA 图标、手机安装图标与启动屏。写入权限与音乐上传相同。
        </p>
      </header>

      {feedback ? (
        <p
          className={`max-w-2xl text-[12px] leading-relaxed ${feedback.tone === "err" ? "text-red-800/90" : "text-adminMuted"}`}
        >
          {feedback.text}
        </p>
      ) : null}

      <section className="max-w-2xl space-y-5 rounded-lg border border-adminLine bg-adminPanel/40 p-5">
        <h2 className="text-[13px] font-medium text-adminFg">顶栏 LOGO 与品牌图标</h2>
        <p className="text-[11px] leading-relaxed text-adminMuted">
          上传<strong>透明底、仅白色图形</strong>的 SVG，设置 LOGO 底色后点「一键生成」——将同步顶栏、网站 / PWA、手机安装图标与 App 启动屏。无需再上传其它文件。
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".svg,image/svg+xml"
          className="hidden"
          onChange={(e) => onSvgSelected(e.target.files)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busyGenerate}
            onClick={onPickSvg}
            className="rounded-md border border-adminLine bg-adminBg px-3 py-2 text-[12px] font-medium text-adminFg shadow-sm transition hover:border-sand hover:bg-adminPanel disabled:opacity-45"
          >
            {pendingSvg ? `已选：${pendingSvg.name}` : "选择 LOGO（SVG）"}
          </button>
          {state ? (
            <span className="text-[11px] text-adminMuted">
              上次生成：{new Date(state.updatedAt).toLocaleString("zh-CN")}
              {state.originalName ? ` · ${state.originalName}` : ""}
            </span>
          ) : (
            <span className="text-[11px] text-adminMuted">尚未生成。</span>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium text-adminFg">LOGO 底色</p>
          <p className="text-[10px] leading-relaxed text-adminMuted">
            用于顶栏方块、安装图标与 App 启动全屏。
          </p>
          <label className="flex max-w-sm items-center gap-2 rounded-md border border-adminLine/70 bg-adminBg/60 px-2 py-2">
            <input
              type="color"
              value={isValidHex6(draftLogoBackground) ? draftLogoBackground : "#ECD9B9"}
              onChange={(e) => setDraftLogoBackground(e.target.value.toUpperCase())}
              className="h-8 w-10 cursor-pointer overflow-hidden rounded border border-adminLine bg-transparent p-0"
              aria-label="LOGO 底色"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-adminFg">hex</div>
              <input
                type="text"
                value={draftLogoBackground}
                onChange={(e) => setDraftLogoBackground(e.target.value.toUpperCase())}
                spellCheck={false}
                className="mt-0.5 w-full rounded border border-transparent bg-transparent font-mono text-[11px] text-adminMuted outline-none focus:border-sand/50"
              />
            </div>
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium text-adminFg">LOGO 阅读辅助色</p>
          <p className="text-[10px] leading-relaxed text-adminMuted">
            用于前台阅读页强调文字（如目录切换、统计数字）。建议使用高可读的金色系。
          </p>
          <label className="flex max-w-sm items-center gap-2 rounded-md border border-adminLine/70 bg-adminBg/60 px-2 py-2">
            <input
              type="color"
              value={isValidHex6(draftLogoTextAccent) ? draftLogoTextAccent : "#E5A525"}
              onChange={(e) => setDraftLogoTextAccent(e.target.value.toUpperCase())}
              className="h-8 w-10 cursor-pointer overflow-hidden rounded border border-adminLine bg-transparent p-0"
              aria-label="LOGO 阅读辅助色"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-adminFg">hex</div>
              <input
                type="text"
                value={draftLogoTextAccent}
                onChange={(e) => setDraftLogoTextAccent(e.target.value.toUpperCase())}
                spellCheck={false}
                className="mt-0.5 w-full rounded border border-transparent bg-transparent font-mono text-[11px] text-adminMuted outline-none focus:border-sand/50"
              />
            </div>
          </label>
        </div>

        <button
          type="button"
          disabled={
            busyGenerate ||
            !canGenerate ||
            !isValidHex6(draftLogoBackground) ||
            !isValidHex6(draftLogoTextAccent)
          }
          onClick={() => void generateAll()}
          className="rounded-md border border-sand/60 bg-sand/15 px-4 py-2.5 text-[12px] font-medium text-adminFg shadow-sm transition hover:border-sand hover:bg-sand/25 disabled:opacity-45"
        >
          {busyGenerate ? "生成中…" : "一键生成全部"}
        </button>

        {(logoPreviewSrc || canShowSplashPreview) && (
          <div className="space-y-5 border-t border-adminLine/80 pt-5">
            <p className="text-[11px] font-medium text-adminFg">生成结果预览</p>

            {logoPreviewSrc ? (
              <figure className="space-y-1 text-center">
                <p className="text-[10px] text-adminMuted">顶栏 LOGO</p>
                <div
                  className="relative mx-auto h-16 w-16 overflow-hidden rounded-lg border border-adminLine"
                  style={{ backgroundColor: draftLogoBackground }}
                >
                  <Image src={logoPreviewSrc} alt="" fill className="object-contain p-1" unoptimized />
                </div>
              </figure>
            ) : null}

            {canShowSplashPreview ? (
              <figure className="mx-auto max-w-[11rem] space-y-2">
                <p className="text-center text-[10px] text-adminMuted">启动屏</p>
                <div className="relative aspect-[9/19] w-full overflow-hidden rounded-[1.25rem] border-[2px] border-adminFg/12 bg-adminBg shadow-md">
                  {splashPreviewSrc ? (
                    <Image
                      src={splashPreviewSrc}
                      alt=""
                      fill
                      sizes="(max-width: 11rem) 100vw"
                      className="object-cover"
                      unoptimized
                    />
                  ) : logoPreviewSrc ? (
                    <div
                      className="absolute inset-0 flex items-center justify-center p-[18%]"
                      style={{ backgroundColor: draftLogoBackground }}
                    >
                      <div className="relative aspect-square w-[58%] max-w-full">
                        <Image src={logoPreviewSrc} alt="" fill className="object-contain" unoptimized />
                      </div>
                    </div>
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{ backgroundColor: draftLogoBackground }}
                      aria-hidden
                    />
                  )}
                </div>
              </figure>
            ) : null}

            {mobileIconPreviewSrc ? (
              <div>
                <p className="mb-2 text-center text-[10px] text-adminMuted">手机安装图标</p>
                <AdminMobileAppIconPreview
                  iconSrc={mobileIconPreviewSrc}
                  canvasHex={iconPreviewBackground}
                />
              </div>
            ) : null}

            {iconsReady && urls?.icon192 && urls.favicon32 ? (
              <div className="flex flex-wrap items-end justify-center gap-6">
                <figure className="space-y-1 text-center">
                  <p className="text-[10px] text-adminMuted">PWA 192</p>
                  <div
                    className="relative mx-auto h-14 w-14 overflow-hidden rounded-lg border border-adminLine"
                    style={{ backgroundColor: iconPreviewBackground }}
                  >
                    <Image
                      src={iconUrlWithBust(urls.icon192)}
                      alt="192"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                </figure>
                <figure className="space-y-1 text-center">
                  <p className="text-[10px] text-adminMuted">favicon</p>
                  <div
                    className="relative mx-auto h-14 w-14 overflow-hidden rounded-lg border border-adminLine"
                    style={{ backgroundColor: iconPreviewBackground }}
                  >
                    <Image
                      src={iconUrlWithBust(urls.favicon32)}
                      alt="32"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                </figure>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
