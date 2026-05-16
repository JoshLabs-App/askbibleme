"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { NatureSceneCategorySelect } from "@/components/admin/NatureSceneCategorySelect";
import { NatureVideoAdminListThumb } from "@/components/admin/NatureVideoAdminListThumb";
import { NatureVideoSquareThumbModal } from "@/components/admin/NatureVideoSquareThumbModal";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { nextDateNumberedNatureVideoTitle } from "@/lib/music-companion/track-naming";
import { diskAuthHeaders } from "@/lib/disk-auth-headers";
import {
  DEFAULT_NATURE_SCENE_CATEGORY,
  parseNatureSceneCategory,
  type NatureSceneCategory,
} from "@/lib/nature/scene-categories";
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
  const [thumbModalVideoId, setThumbModalVideoId] = useState<string | null>(null);
  const [thumbSaveBusy, setThumbSaveBusy] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<NatureSceneCategory>(DEFAULT_NATURE_SCENE_CATEGORY);
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
          src?: string;
          src1080?: string;
          src4k?: string;
          renditions?: boolean;
          previewFrameUrl?: string | null;
          previewFrameWarning?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? `上传失败（${res.status}）`);
        const primary = (typeof data.src === "string" ? data.src : typeof data.url === "string" ? data.url : "").trim();
        if (!primary) throw new Error("上传响应异常");

        const titles = prev.videos.map((v) => v.title ?? "").filter(Boolean);
        const title = nextDateNumberedNatureVideoTitle(titles);
        const id = newId();
        const row: NatureVideoEntry = { id, src: primary, title, category: uploadCategory };
        const s1080 = typeof data.src1080 === "string" ? data.src1080.trim() : "";
        if (s1080) row.src1080 = s1080;
        const s4k = typeof data.src4k === "string" ? data.src4k.trim() : "";
        if (s4k) row.src4k = s4k;
        const pfu = typeof data.previewFrameUrl === "string" ? data.previewFrameUrl.trim() : "";
        if (pfu) {
          row.previewFrameSrc = pfu;
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
          if (data.previewFrameWarning) {
            setUploadHint(`已上传；预览首帧未生成：${data.previewFrameWarning}`);
          } else if (data.renditions) {
            setUploadHint(`已写入并转码（720 默认 · 1080 可选）；母片已保留：${title}`);
          } else {
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
    [applyAndSync, setMsg, settings, uploadCategory],
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
      let scenesPageVideoId = prev.scenesPageVideoId;
      if (scenesPageVideoId === id || (scenesPageVideoId && !videos.some((v) => v.id === scenesPageVideoId))) {
        scenesPageVideoId = undefined;
      }
      const next: NatureSettingsV2 = { ...prev, videos, activeVideoId, scenesPageVideoId };
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

  const updateCategory = useCallback(
    async (id: string, category: NatureSceneCategory) => {
      const prev = settingsRef.current ?? settings;
      if (!prev) return;
      const videos = prev.videos.map((v) =>
        v.id === id ? { ...v, category: parseNatureSceneCategory(category) } : v,
      );
      const next: NatureSettingsV2 = { ...prev, videos };
      await applyAndSync(next);
    },
    [applyAndSync, settings],
  );

  const setScenesPageVideoId = useCallback(
    async (videoId: string) => {
      const prev = settingsRef.current ?? settings;
      if (!prev) return;
      const trimmed = videoId.trim();
      const next: NatureSettingsV2 = {
        ...prev,
        scenesPageVideoId:
          trimmed && prev.videos.some((v) => v.id === trimmed) ? trimmed : undefined,
      };
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

  const busy = uploadBusy || thumbSaveBusy;

  return (
    <>
    <div className="mt-10 flex flex-col gap-10">
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

        <div className="mt-4 flex max-w-md flex-col gap-1.5">
          <label htmlFor="nature-scenes-page-backdrop" className="text-[11px] font-medium text-adminFg">
            {t("admin.naturePage.scenesPageBackdropLabel")}
          </label>
          <select
            id="nature-scenes-page-backdrop"
            disabled={busy || settings.videos.length === 0}
            value={settings.scenesPageVideoId?.trim() ?? ""}
            className="rounded border border-border bg-adminPanel px-2 py-1.5 text-[12px] text-adminFg"
            onChange={(e) => void setScenesPageVideoId(e.target.value)}
          >
            <option value="">{t("admin.naturePage.scenesPageBackdropFollowHome")}</option>
            {settings.videos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title?.trim() || t("admin.naturePage.unnamedClip")}
              </option>
            ))}
          </select>
          <p className="text-[10px] leading-relaxed text-adminMuted">
            {t("admin.naturePage.scenesPageBackdropHint")}
          </p>
        </div>

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
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-adminMuted">{t("admin.naturePage.uploadCategoryLabel")}</span>
          <NatureSceneCategorySelect
            value={uploadCategory}
            onChange={setUploadCategory}
            disabled={busy}
            aria-label={t("admin.naturePage.uploadCategoryLabel")}
          />
        </div>
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
        <p className="mt-2 text-[10px] leading-relaxed text-adminMuted">{t("admin.naturePage.videoUploadFootMulti")}</p>
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
                <div className="flex gap-3">
                  <NatureVideoAdminListThumb
                    video={v}
                    active={active}
                    disabled={busy}
                    onPress={() => void setActive(v.id)}
                  />
                  <div className="min-w-0 flex-1">
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
                  <NatureSceneCategorySelect
                    value={parseNatureSceneCategory(v.category)}
                    disabled={busy}
                    aria-label={t("admin.naturePage.videoCategoryLabel")}
                    onChange={(category) => void updateCategory(v.id, category)}
                  />
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
                {v.src1080?.trim() ? (
                  <p className="mt-0.5 break-all font-mono text-[10px] text-adminMuted/85">
                    1080：{v.src1080.trim()}
                  </p>
                ) : null}
                {v.src4k?.trim() ? (
                  <p className="mt-0.5 break-all font-mono text-[10px] text-adminMuted/85">
                    母片：{v.src4k.trim()}
                  </p>
                ) : null}
                  </div>
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
