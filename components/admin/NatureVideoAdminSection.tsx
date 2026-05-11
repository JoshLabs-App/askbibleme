"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { NatureClipMixWorkbench } from "@/components/admin/NatureClipMixWorkbench";
import { NatureVideoSquareThumbModal } from "@/components/admin/NatureVideoSquareThumbModal";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  nextDateNumberedNatureAmbientTitle,
  nextDateNumberedNatureVideoTitle,
} from "@/lib/music-companion/track-naming";
import { diskAuthHeaders } from "@/lib/disk-auth-headers";
import type { NatureSettingsV2, NatureVideoEntry } from "@/lib/nature/types";

async function postNatureSettings(
  data: NatureSettingsV2,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/nature/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...diskAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    const j = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) return { ok: false, error: j.error ?? `写入失败（${res.status}）` };
    return { ok: true };
  } catch {
    return { ok: false, error: "写入请求失败" };
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}`;
}

export function NatureVideoAdminSection({
  setMsg,
  showGallery = false,
  galleryTitle,
  galleryHint,
}: {
  setMsg: React.Dispatch<React.SetStateAction<string | null>>;
  showGallery?: boolean;
  galleryTitle?: string;
  galleryHint?: string;
}) {
  const { t } = useLocale();
  const [settings, setSettings] = useState<NatureSettingsV2 | null>(null);
  const settingsRef = useRef<NatureSettingsV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadHint, setUploadHint] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [audioUploadBusy, setAudioUploadBusy] = useState(false);
  const [audioUploadHint, setAudioUploadHint] = useState<string | null>(null);
  const [audioHintOk, setAudioHintOk] = useState(false);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const [thumbModalVideoId, setThumbModalVideoId] = useState<string | null>(null);
  const [thumbSaveBusy, setThumbSaveBusy] = useState(false);
  useLayoutEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/nature/settings");
      const data = (await res.json()) as NatureSettingsV2 | { error?: string };
      if (!res.ok) {
        setSettings(null);
        setMsg((data as { error?: string }).error ?? "自然页配置加载失败");
        return;
      }
      const s = data as NatureSettingsV2;
      setSettings({
        ...s,
        ambientClips: Array.isArray(s.ambientClips) ? s.ambientClips : [],
      });
    } catch {
      setSettings(null);
      setMsg("自然页配置网络错误");
    } finally {
      setLoading(false);
    }
  }, [setMsg]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(
    async (next: NatureSettingsV2) => {
      const r = await postNatureSettings(next);
      if (!r.ok) {
        setMsg(r.error);
        return false;
      }
      setMsg("自然页视频配置已写入。");
      return true;
    },
    [setMsg],
  );

  const applyAndSync = useCallback(
    async (next: NatureSettingsV2) => {
      const ok = await persist(next);
      if (ok) setSettings(next);
      return ok;
    },
    [persist],
  );

  const onFileChosen = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      const prev = settingsRef.current ?? settings;
      if (!prev) {
        const m = "自然页配置尚未就绪，请刷新本页后重试。";
        setMsg(m);
        setUploadHint(m);
        return;
      }
      const lower = file.name.toLowerCase();
      const okExt = /\.(mp4|webm|mov|m4v)$/.test(lower);
      const okMime = file.type.startsWith("video/");
      if (!okExt && !okMime) {
        const m = "请选择 mp4 / webm / mov / m4v 视频。";
        setMsg(m);
        setUploadHint(m);
        return;
      }
      setUploadBusy(true);
      setUploadHint(null);
      setMsg(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/nature/upload", {
          method: "POST",
          headers: { ...diskAuthHeaders() },
          body: fd,
        });
        const data = (await res.json()) as {
          ok?: boolean;
          url?: string;
          previewFrameUrl?: string | null;
          previewFrameWarning?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? `上传失败（${res.status}）`);
        const url = data.url;
        if (typeof url !== "string" || !url.trim()) throw new Error("上传响应异常");

        const titles = prev.videos.map((v) => v.title ?? "").filter(Boolean);
        const title = nextDateNumberedNatureVideoTitle(titles);
        const id = newId();
        const row: NatureVideoEntry = { id, src: url.trim(), title };
        const pfu = typeof data.previewFrameUrl === "string" ? data.previewFrameUrl.trim() : "";
        if (pfu) {
          row.previewFrameSrc = pfu;
        }
        if (data.previewFrameWarning) {
          setUploadHint(`已上传；预览首帧未生成：${data.previewFrameWarning}`);
        }

        const videos = [...prev.videos, row];
        const preferActive = prev.activeVideoId.trim();
        let activeVideoId =
          prev.videos.length === 0
            ? id
            : preferActive && videos.some((v) => v.id === preferActive)
              ? preferActive
              : prev.videos[0]?.id ?? id;
        if (!videos.some((v) => v.id === activeVideoId)) activeVideoId = id;

        const next: NatureSettingsV2 = { ...prev, videos, activeVideoId };
        const ok = await applyAndSync(next);
        if (ok) {
          if (!data.previewFrameWarning) {
            setUploadHint(`已上传并写入：${title}`);
          }
        }
      } catch (e) {
        const m = e instanceof Error ? e.message : "上传失败";
        setMsg(m);
        setUploadHint(m);
      } finally {
        setUploadBusy(false);
      }
    },
    [applyAndSync, setMsg, settings],
  );

  const onAmbientFileChosen = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      const prev = settingsRef.current ?? settings;
      if (!prev) {
        const m = "自然页配置尚未就绪，请刷新本页后重试。";
        setMsg(m);
        setAudioUploadHint(m);
        return;
      }
      const lower = file.name.toLowerCase();
      const okExt = /\.(mp3|wav|ogg|m4a|aac|opus|webm|flac)$/.test(lower);
      const okMime = file.type.startsWith("audio/");
      if (!okExt && !okMime) {
        const m = t("admin.naturePage.ambientBadType");
        setMsg(m);
        setAudioUploadHint(m);
        return;
      }
      setAudioUploadBusy(true);
      setAudioUploadHint(null);
      setAudioHintOk(false);
      setMsg(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/nature/upload-audio", {
          method: "POST",
          headers: { ...diskAuthHeaders() },
          body: fd,
        });
        const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? `上传失败（${res.status}）`);
        const url = data.url;
        if (typeof url !== "string" || !url.trim()) throw new Error("上传响应异常");

        const titles = prev.ambientClips.map((c) => c.title ?? "").filter(Boolean);
        const title = nextDateNumberedNatureAmbientTitle(titles);
        const id = newId();
        const ambientClips = [...prev.ambientClips, { id, src: url.trim(), title }];
        const next: NatureSettingsV2 = { ...prev, ambientClips };
        const ok = await applyAndSync(next);
        if (ok) {
          setAudioHintOk(true);
          setAudioUploadHint(t("admin.naturePage.ambientUploadDone", { title }));
        }
      } catch (e) {
        const m = e instanceof Error ? e.message : "上传失败";
        setMsg(m);
        setAudioUploadHint(m);
        setAudioHintOk(false);
      } finally {
        setAudioUploadBusy(false);
      }
    },
    [applyAndSync, setMsg, settings, t],
  );

  const setActive = useCallback(
    async (id: string) => {
      const prev = settingsRef.current ?? settings;
      if (!prev) return;
      const next = { ...prev, activeVideoId: id };
      await applyAndSync(next);
    },
    [applyAndSync, settings],
  );

  const removeAt = useCallback(
    async (id: string) => {
      const prev = settingsRef.current ?? settings;
      if (!prev) return;
      const videos = prev.videos.filter((v) => v.id !== id);
      let activeVideoId = prev.activeVideoId;
      if (activeVideoId === id || !videos.some((v) => v.id === activeVideoId)) {
        activeVideoId = videos[0]?.id ?? "";
      }
      const next: NatureSettingsV2 = { ...prev, videos, activeVideoId };
      await applyAndSync(next);
    },
    [applyAndSync, settings],
  );

  const updateTitle = useCallback(
    async (id: string, title: string) => {
      const prev = settingsRef.current ?? settings;
      if (!prev) return;
      const videos = prev.videos.map((v) =>
        v.id === id ? { ...v, title: title.trim() || undefined } : v,
      );
      const next: NatureSettingsV2 = { ...prev, videos };
      await applyAndSync(next);
    },
    [applyAndSync, settings],
  );

  const updateAmbientTitle = useCallback(
    async (clipId: string, title: string) => {
      const prev = settingsRef.current ?? settings;
      if (!prev) return;
      const ambientClips = prev.ambientClips.map((c) =>
        c.id === clipId ? { ...c, title: title.trim() || undefined } : c,
      );
      const next: NatureSettingsV2 = { ...prev, ambientClips };
      await applyAndSync(next);
    },
    [applyAndSync, settings],
  );

  const removeAmbientClip = useCallback(
    async (clipId: string) => {
      const prev = settingsRef.current ?? settings;
      if (!prev) return;
      const ambientClips = prev.ambientClips.filter((c) => c.id !== clipId);
      const videos = prev.videos.map((v) => {
        const mix = v.mix?.filter((l) => l.clipId !== clipId);
        const next = { ...v };
        if (mix?.length) next.mix = mix;
        else delete next.mix;
        return next;
      });
      const next: NatureSettingsV2 = { ...prev, ambientClips, videos };
      await applyAndSync(next);
    },
    [applyAndSync, settings],
  );

  const setMixClipVolume = useCallback(
    async (videoId: string, clipId: string, volume: number) => {
      const prev = settingsRef.current ?? settings;
      if (!prev) return;
      const v = Math.min(1, Math.max(0, volume));
      const videos = prev.videos.map((row) => {
        if (row.id !== videoId) return row;
        const others = (row.mix ?? []).filter((l) => l.clipId !== clipId);
        if (v < 0.0005) {
          const nextRow = { ...row };
          if (others.length) nextRow.mix = others;
          else delete nextRow.mix;
          return nextRow;
        }
        const existing = (row.mix ?? []).find((l) => l.clipId === clipId);
        const id = existing?.id ?? `mix-${clipId}`;
        return { ...row, mix: [...others, { id, clipId, volume: v }] };
      });
      const next: NatureSettingsV2 = { ...prev, videos };
      await applyAndSync(next);
    },
    [applyAndSync, settings],
  );

  const commitThumbBlobForVideo = useCallback(
    async (videoId: string, blob: Blob) => {
      const prev = settingsRef.current ?? settings;
      if (!prev) throw new Error("自然页配置尚未就绪");
      setThumbSaveBusy(true);
      setMsg(null);
      try {
        const fd = new FormData();
        fd.append("file", blob, "nature-thumb.jpg");
        const res = await fetch("/api/nature/upload-thumb", {
          method: "POST",
          headers: { ...diskAuthHeaders() },
          body: fd,
        });
        const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? `上传失败（${res.status}）`);
        const url = data.url;
        if (typeof url !== "string" || !url.trim()) throw new Error("上传响应无效");
        const videos = prev.videos.map((x) => (x.id === videoId ? { ...x, thumbSrc: url.trim() } : x));
        const next: NatureSettingsV2 = { ...prev, videos };
        const ok = await applyAndSync(next);
        if (!ok) throw new Error("配置写入失败");
      } finally {
        setThumbSaveBusy(false);
      }
    },
    [applyAndSync, settings],
  );

  const clearVideoThumb = useCallback(
    async (videoId: string) => {
      const prev = settingsRef.current ?? settings;
      if (!prev) return;
      const videos = prev.videos.map((x) => {
        if (x.id !== videoId) return x;
        const { thumbSrc: _removed, ...rest } = x;
        return rest;
      });
      const next: NatureSettingsV2 = { ...prev, videos };
      await applyAndSync(next);
    },
    [applyAndSync, settings],
  );

  if (loading) {
    return (
      <section className="mt-10">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-adminMuted">自然页视频</h2>
        <p className="mt-2 text-[12px] text-adminMuted">加载中…</p>
      </section>
    );
  }

  if (!settings) {
    return (
      <section className="mt-10">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-adminMuted">自然页视频</h2>
        <p className="mt-2 text-[12px] text-adminMuted">无法加载配置。</p>
        <button
          type="button"
          className="mt-2 rounded border border-adminLine px-2 py-1 text-[11px] text-adminFg"
          onClick={() => void load()}
        >
          重试
        </button>
      </section>
    );
  }

  const busy = uploadBusy || audioUploadBusy || thumbSaveBusy;

  return (
    <>
    <div className="mt-10 flex flex-col gap-10">
      <section
        className="rounded-2xl border border-adminLine/80 bg-adminPanel/15 px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] md:px-6 md:py-6"
        aria-labelledby="nature-ambient-block-title"
      >
        <div className="flex flex-wrap items-center gap-2 gap-y-1">
          <h2
            id="nature-ambient-block-title"
            className="text-[13px] font-semibold tracking-tight text-adminFg"
          >
            {t("admin.naturePage.ambientBlockTitle")}
          </h2>
          <span className="rounded-full border border-adminLine/70 bg-adminBg/70 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-adminMuted">
            {t("admin.naturePage.ambientBlockBadge")}
          </span>
        </div>
        <p className="mt-2 max-w-prose text-[11px] leading-relaxed text-adminMuted">
          {t("admin.naturePage.ambientBlockIntro")}
        </p>

        <div className="mt-4 rounded-md border border-dashed border-border bg-canvas/70 px-3 py-3">
          <input
            ref={audioFileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.opus,.webm,.flac"
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => {
              const input = e.target;
              const chosen = input.files?.item(0) ?? null;
              input.value = "";
              void onAmbientFileChosen(chosen);
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => audioFileInputRef.current?.click()}
            className="rounded border border-adminLine bg-adminPanel px-3 py-2 text-[12px] font-medium text-adminFg transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            {audioUploadBusy ? t("admin.naturePage.ambientUploading") : t("admin.naturePage.ambientUpload")}
          </button>
          <p className="mt-2 text-[10px] leading-relaxed text-adminMuted">
            {t("admin.naturePage.ambientUploadFoot")}
          </p>
          {audioUploadHint ? (
            <p
              className={`mt-2 text-[11px] leading-snug ${
                audioHintOk ? "text-emerald-900/90" : "text-amber-900/90"
              }`}
            >
              {audioUploadHint}
            </p>
          ) : null}
        </div>

        {settings.ambientClips.length === 0 ? (
          <p className="mt-3 text-[11px] text-adminMuted">{t("admin.naturePage.ambientListEmpty")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-adminLine border-y border-adminLine">
            {settings.ambientClips.map((c) => (
              <li key={c.id} className="px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    key={`${c.id}-${c.title ?? ""}`}
                    defaultValue={c.title ?? ""}
                    className="min-w-0 flex-1 rounded border border-border bg-adminPanel px-2 py-1 text-[12px] text-adminFg"
                    placeholder={t("admin.naturePage.ambientTitlePlaceholder")}
                    aria-label={t("admin.naturePage.ambientTitlePlaceholder")}
                    onBlur={(e) => {
                      const val = e.target.value;
                      if ((c.title ?? "").trim() === val.trim()) return;
                      void updateAmbientTitle(c.id, val);
                    }}
                  />
                  <button
                    type="button"
                    className="shrink-0 px-2 py-1 text-[11px] text-red-700/90 transition hover:bg-red-50"
                    onClick={() => void removeAmbientClip(c.id)}
                  >
                    {t("admin.naturePage.ambientRemove")}
                  </button>
                </div>
                <p className="mt-1 break-all font-mono text-[10px] text-adminMuted">{c.src}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="rounded-2xl border border-adminLine/80 bg-adminPanel/10 px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] md:px-6 md:py-6"
        aria-labelledby="nature-video-block-title"
      >
        <h2
          id="nature-video-block-title"
          className="text-[13px] font-semibold tracking-tight text-adminFg"
        >
          {t("admin.naturePage.videoBlockTitle")}
        </h2>
        <p className="mt-2 max-w-prose text-[11px] leading-relaxed text-adminMuted">
          {t("admin.naturePage.videoBlockIntro")}
        </p>

        {showGallery ? (
        <div className="mt-6">
          {galleryTitle ? (
            <h3 className="text-[12px] font-medium tracking-tight text-adminFg">{galleryTitle}</h3>
          ) : null}
          {galleryHint ? (
            <p className="mt-1 max-w-prose text-[10px] leading-relaxed text-adminMuted">{galleryHint}</p>
          ) : null}
          <p className="mt-2 max-w-prose text-[10px] leading-relaxed text-adminMuted">
            {t("admin.naturePage.galleryThumbHint")}
          </p>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {settings.videos.map((v) => {
              const active = settings.activeVideoId === v.id;
              const thumb = v.thumbSrc?.trim();
              return (
                <div
                  key={v.id}
                  className={
                    "relative w-[min(42vw,11rem)] shrink-0 overflow-hidden rounded-2xl border shadow-sm transition " +
                    (active
                      ? "border-emerald-600/50 ring-2 ring-emerald-500/35"
                      : "border-adminLine hover:border-adminFg/25")
                  }
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => void setActive(v.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void setActive(v.id);
                      }
                    }}
                    className="group relative block aspect-square w-full cursor-pointer bg-black/80 text-left outline-none ring-adminFg/30 focus-visible:ring-2"
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="h-full w-full object-cover opacity-95 transition group-hover:opacity-100"
                      />
                    ) : (
                      <video
                        src={v.src}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
                        aria-hidden
                      />
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/25" />
                    {active ? (
                      <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white">
                        {t("admin.naturePage.badgeCurrent")}
                      </span>
                    ) : null}
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 p-2.5">
                      <span className="line-clamp-2 text-[11px] font-medium leading-snug text-white drop-shadow">
                        {v.title?.trim() || t("admin.naturePage.unnamedClip")}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="absolute right-1.5 top-1.5 z-20 rounded-md bg-black/60 px-1.5 py-1 text-[9px] font-medium text-white shadow-sm backdrop-blur-sm transition hover:bg-black/75 disabled:opacity-40"
                    disabled={busy}
                    title={t("admin.naturePage.thumbModalTitle")}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setThumbModalVideoId(v.id);
                    }}
                  >
                    {t("admin.naturePage.galleryThumbEdit")}
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              aria-label={t("admin.naturePage.galleryAddTitle")}
              className={
                "relative flex aspect-square w-[min(42vw,11rem)] shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-adminLine/90 bg-adminPanel/40 px-2 py-3 text-center shadow-sm transition " +
                (busy
                  ? "cursor-not-allowed opacity-50"
                  : "hover:border-adminFg/30 hover:bg-adminPanel/70 active:scale-[0.99]")
              }
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-adminLine/80 bg-adminBg/80 text-[20px] font-light leading-none text-adminFg">
                +
              </span>
              <span className="text-[11px] font-semibold leading-tight text-adminFg">
                {t("admin.naturePage.galleryAddTitle")}
              </span>
              <span className="text-[9px] leading-snug text-adminMuted">{t("admin.naturePage.galleryAddHint")}</span>
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-md border border-dashed border-border bg-canvas/70 px-3 py-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const input = e.target;
            const chosen = input.files?.item(0) ?? null;
            input.value = "";
            void onFileChosen(chosen);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="rounded border border-adminLine bg-adminPanel px-3 py-2 text-[12px] font-medium text-adminFg transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "上传中…" : "选择视频文件"}
        </button>
        <p className="mt-2 text-[10px] leading-relaxed text-adminMuted">
          mp4 / webm / mov / m4v，单文件约 220MB；开发环境可直接写入，生产需配置磁盘写入密钥（与音乐上传相同）。
        </p>
        {uploadHint ? (
          <p
            className={`mt-2 text-[11px] leading-snug ${
              uploadHint.startsWith("已上传") ? "text-emerald-900/90" : "text-amber-900/90"
            }`}
          >
            {uploadHint}
          </p>
        ) : null}
      </div>

      <ul className="mt-4 divide-y divide-adminLine border-y border-adminLine">
        {settings.videos.length === 0 ? (
          <li className="px-3 py-8 text-[12px] text-adminMuted">暂无视频，上传后在此列出并可选择在自然页播放。</li>
        ) : (
          settings.videos.map((v) => {
            const active = settings.activeVideoId === v.id;
            return (
              <li key={v.id} className="px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="radio"
                    name="nature-video-active"
                    checked={active}
                    onChange={() => void setActive(v.id)}
                    className="shrink-0"
                    aria-label="在自然页播放"
                  />
                  <span className="text-[10px] text-adminMuted">{active ? "当前播放" : "选用"}</span>
                  <input
                    key={`${v.id}-${v.title ?? ""}`}
                    defaultValue={v.title ?? ""}
                    className="min-w-0 flex-1 rounded border border-border bg-adminPanel px-2 py-1 text-[12px] text-adminFg"
                    placeholder="标题"
                    aria-label="视频标题"
                    onBlur={(e) => {
                      const val = e.target.value;
                      if ((v.title ?? "").trim() === val.trim()) return;
                      void updateTitle(v.id, val);
                    }}
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded border border-adminLine/80 bg-adminPanel px-2 py-1 text-[11px] text-adminFg transition hover:bg-surface"
                    onClick={() => setThumbModalVideoId(v.id)}
                  >
                    {t("admin.naturePage.galleryThumbEdit")}
                  </button>
                  {v.thumbSrc?.trim() ? (
                    <button
                      type="button"
                      className="shrink-0 px-2 py-1 text-[11px] text-adminMuted transition hover:bg-adminPanel hover:text-adminFg"
                      onClick={() => void clearVideoThumb(v.id)}
                    >
                      {t("admin.naturePage.thumbClear")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="shrink-0 px-2 py-1 text-[11px] text-red-700/90 transition hover:bg-red-50"
                    onClick={() => void removeAt(v.id)}
                  >
                    删除
                  </button>
                </div>
                <p className="mt-1.5 break-all font-mono text-[10px] text-adminMuted">{v.src}</p>

                <div className="mt-4">
                  <p className="text-[11px] font-medium text-adminFg">{t("admin.naturePage.mixSectionTitle")}</p>
                  <NatureClipMixWorkbench
                    key={v.id}
                    videoSrc={v.src}
                    mix={v.mix}
                    ambientClips={settings.ambientClips}
                    onClipVolumeCommit={(clipId, vol) => void setMixClipVolume(v.id, clipId, vol)}
                  />
                </div>
              </li>
            );
          })
        )}
      </ul>
      </section>
    </div>

    <NatureVideoSquareThumbModal
      open={thumbModalVideoId != null}
      videoSrc={settings.videos.find((x) => x.id === thumbModalVideoId)?.src ?? ""}
      onClose={() => setThumbModalVideoId(null)}
      onCommit={async (blob) => {
        const id = thumbModalVideoId;
        if (!id) return;
        await commitThumbBlobForVideo(id, blob);
      }}
    />
    </>
  );
}
