"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";

const OUT_SIZE = 3840;

/** pan ∈ [-1,1]：-1 最左，0 居中，1 最右（仅当画面宽大于裁切边长时有效） */
function squareCropSourceRect(iw: number, ih: number, pan: number): { sx: number; sy: number; side: number } {
  const side = Math.min(iw, ih);
  if (iw > ih) {
    const max = iw - side;
    const sx = max <= 0 ? 0 : ((Math.min(1, Math.max(-1, pan)) + 1) / 2) * max;
    return { sx, sy: 0, side };
  }
  const maxY = ih - side;
  const sy = maxY <= 0 ? 0 : ((Math.min(1, Math.max(-1, pan)) + 1) / 2) * maxY;
  return { sx: 0, sy, side };
}

function drawSquarePreview(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  iw: number,
  ih: number,
  pan: number,
  destPx: number,
) {
  if (!iw || !ih) return;
  const { sx, sy, side } = squareCropSourceRect(iw, ih, pan);
  ctx.drawImage(source, sx, sy, side, side, 0, 0, destPx, destPx);
}

function paintPreviewToCanvas(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  iw: number,
  ih: number,
  pan: number,
) {
  if (!iw || !ih) return;
  const preview = 240;
  canvas.width = preview;
  canvas.height = preview;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  drawSquarePreview(ctx, source, iw, ih, pan, preview);
}

function captureSquareJpegFromSource(source: CanvasImageSource, iw: number, ih: number, pan: number): Promise<Blob | null> {
  if (!iw || !ih) return Promise.resolve(null);
  const { sx, sy, side } = squareCropSourceRect(iw, ih, pan);
  const c = document.createElement("canvas");
  c.width = OUT_SIZE;
  c.height = OUT_SIZE;
  const ctx = c.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(source, sx, sy, side, side, 0, 0, OUT_SIZE, OUT_SIZE);
  return new Promise((resolve) => {
    c.toBlob((b) => resolve(b), "image/jpeg", 0.9);
  });
}

type SourceMode = "video" | "image";

type Props = {
  open: boolean;
  videoSrc: string;
  onClose: () => void;
  onCommit: (blob: Blob) => Promise<void>;
};

export function NatureVideoSquareThumbModal({ open, videoSrc, onClose, onCommit }: Props) {
  const { t } = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<SourceMode>("video");
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
  const [imageNatural, setImageNatural] = useState<{ w: number; h: number } | null>(null);

  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** -1 左 … 1 右（横条余量）；竖幅时为上下选区 */
  const [pan, setPan] = useState(0);
  const [videoSize, setVideoSize] = useState<{ w: number; h: number } | null>(null);

  const panRef = useRef(pan);
  panRef.current = pan;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const rasterSize = useMemo(() => {
    if (mode === "image") return imageNatural;
    return videoSize;
  }, [mode, imageNatural, videoSize]);

  const cropSlack = useMemo(() => {
    if (!rasterSize || rasterSize.w < 2 || rasterSize.h < 2) return { canPan: false as const, mode: "none" as const };
    const { w, h } = rasterSize;
    if (w > h) return { canPan: w - h > 0.5, mode: "horizontal" as const };
    if (h > w) return { canPan: h - w > 0.5, mode: "vertical" as const };
    return { canPan: false, mode: "square" as const };
  }, [rasterSize]);

  /** 不随 pan 变引用，避免 `video.load()` 在拖滑块时被反复触发 */
  const flushPreview = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const m = modeRef.current;
    const p = panRef.current;
    if (m === "image") {
      const img = imageRef.current;
      if (!img?.complete || !img.naturalWidth) return;
      paintPreviewToCanvas(c, img, img.naturalWidth, img.naturalHeight, p);
      return;
    }
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    paintPreviewToCanvas(c, v, v.videoWidth, v.videoHeight, p);
  }, []);

  const revokeImageUrl = useCallback((url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    if (!open) {
      setReady(false);
      setDuration(0);
      setTime(0);
      setPan(0);
      setVideoSize(null);
      setError(null);
      setMode("video");
      setImageNatural(null);
      setImageObjectUrl((prev) => {
        revokeImageUrl(prev);
        return null;
      });
      return;
    }
    const v = videoRef.current;
    if (!v) return;

    const pumpMeta = () => {
      const raw = v.duration;
      const d = Number.isFinite(raw) && raw > 0 && raw !== Number.POSITIVE_INFINITY ? raw : 0;
      setDuration(d);
      const t0 = d > 0.1 ? 0.05 : 0;
      setTime(t0);
      const w = v.videoWidth;
      const h = v.videoHeight;
      if (w > 0 && h > 0) {
        setVideoSize({ w, h });
        setReady(true);
        requestAnimationFrame(() => flushPreview());
      }
    };

    const onSeeked = () => flushPreview();
    const onErr = () => setError(t("admin.naturePage.thumbModalVideoError"));
    const onLoadedData = () => {
      const w = v.videoWidth;
      const h = v.videoHeight;
      if (w > 0 && h > 0) {
        setVideoSize({ w, h });
        setReady(true);
        requestAnimationFrame(() => flushPreview());
      }
    };

    v.addEventListener("loadedmetadata", pumpMeta);
    v.addEventListener("loadeddata", onLoadedData);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("error", onErr);
    v.load();
    return () => {
      v.removeEventListener("loadedmetadata", pumpMeta);
      v.removeEventListener("loadeddata", onLoadedData);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("error", onErr);
    };
  }, [open, videoSrc, flushPreview, t]);

  useEffect(() => {
    if (!open || mode !== "video" || !ready) return;
    const v = videoRef.current;
    if (!v) return;
    if (!Number.isFinite(duration) || duration <= 0.05) {
      flushPreview();
      return;
    }
    const safe = Math.min(Math.max(0.02, time), duration - 0.02);
    if (Math.abs(v.currentTime - safe) > 0.02) {
      v.currentTime = safe;
    } else {
      flushPreview();
    }
  }, [open, ready, mode, time, duration, flushPreview]);

  useEffect(() => {
    if (!cropSlack.canPan && pan !== 0) setPan(0);
  }, [cropSlack.canPan, pan]);

  useEffect(() => {
    if (!open) return;
    if (mode === "video" && ready && videoSize?.w) {
      flushPreview();
      return;
    }
    if (mode === "image" && imageNatural?.w) {
      flushPreview();
    }
  }, [open, mode, ready, pan, imageNatural, videoSize, flushPreview]);

  const setModeVideo = () => {
    setError(null);
    setMode("video");
    setImageNatural(null);
    setImageObjectUrl((prev) => {
      revokeImageUrl(prev);
      return null;
    });
    setPan(0);
    requestAnimationFrame(() => flushPreview());
  };

  const setModeImage = () => {
    setError(null);
    setMode("image");
    setPan(0);
  };

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setMode("image");
    setPan(0);
    setImageNatural(null);
    setImageObjectUrl((prev) => {
      revokeImageUrl(prev);
      return URL.createObjectURL(file);
    });
  };

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      let blob: Blob | null = null;
      if (mode === "image") {
        const img = imageRef.current;
        if (!img?.complete || !img.naturalWidth) {
          setError(t("admin.naturePage.thumbModalCaptureFail"));
          return;
        }
        blob = await captureSquareJpegFromSource(img, img.naturalWidth, img.naturalHeight, pan);
      } else {
        const v = videoRef.current;
        if (!v?.videoWidth) {
          setError(t("admin.naturePage.thumbModalCaptureFail"));
          return;
        }
        blob = await captureSquareJpegFromSource(v, v.videoWidth, v.videoHeight, pan);
      }
      if (!blob) {
        setError(t("admin.naturePage.thumbModalCaptureFail"));
        return;
      }
      await onCommit(blob);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("admin.naturePage.thumbModalSaveFail"));
    } finally {
      setSaving(false);
    }
  };

  const exportReady =
    mode === "image" ? Boolean(imageNatural && imageNatural.w > 0) : ready && Boolean(videoSize?.w);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nature-thumb-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="sr-only"
        aria-hidden
        onChange={onPickImage}
      />
      <div className="max-h-[min(92vh,640px)] w-full max-w-md overflow-y-auto rounded-2xl border border-adminLine bg-adminBg p-4 shadow-xl sm:p-5">
        <h3 id="nature-thumb-modal-title" className="text-[13px] font-semibold text-adminFg">
          {t("admin.naturePage.thumbModalTitle")}
        </h3>
        <p className="mt-1.5 text-[11px] leading-relaxed text-adminMuted">{t("admin.naturePage.thumbModalHint")}</p>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className={[
              "flex-1 rounded-lg border px-2 py-2 text-[11px] font-medium transition",
              mode === "video"
                ? "border-adminFg/40 bg-adminFg/10 text-adminFg"
                : "border-adminLine bg-adminPanel text-adminMuted hover:text-adminFg",
            ].join(" ")}
            onClick={setModeVideo}
          >
            {t("admin.naturePage.thumbModalTabVideo")}
          </button>
          <button
            type="button"
            className={[
              "flex-1 rounded-lg border px-2 py-2 text-[11px] font-medium transition",
              mode === "image"
                ? "border-adminFg/40 bg-adminFg/10 text-adminFg"
                : "border-adminLine bg-adminPanel text-adminMuted hover:text-adminFg",
            ].join(" ")}
            onClick={setModeImage}
          >
            {t("admin.naturePage.thumbModalTabImage")}
          </button>
        </div>

        {mode === "video" ? (
          <>
            <div className="mt-4 overflow-hidden rounded-xl border border-adminLine bg-black">
              <video
                ref={videoRef}
                key={videoSrc}
                src={videoSrc}
                className="mx-auto max-h-[200px] w-full object-contain"
                muted
                playsInline
                preload="metadata"
              />
            </div>

            <label className="mt-4 block text-[10px] font-medium uppercase tracking-wide text-adminMuted">
              {t("admin.naturePage.thumbModalSeek")}
              <input
                type="range"
                min={0}
                max={duration > 0 ? duration : 1}
                step={duration > 2 ? 0.05 : 0.01}
                value={duration > 0 ? time : 0}
                disabled={!ready || duration <= 0}
                onChange={(e) => setTime(Number(e.target.value))}
                className="mt-1.5 block w-full accent-adminFg"
              />
            </label>
          </>
        ) : (
          <>
            <div className="mt-4 overflow-hidden rounded-xl border border-adminLine bg-black">
              {imageObjectUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- 本地 object URL 预览
                <img
                  ref={imageRef}
                  src={imageObjectUrl}
                  alt=""
                  className="mx-auto max-h-[200px] w-full object-contain"
                  onLoad={(e) => {
                    const el = e.currentTarget;
                    setImageNatural({ w: el.naturalWidth, h: el.naturalHeight });
                    setReady(true);
                    requestAnimationFrame(() => flushPreview());
                  }}
                  onError={() => {
                    setImageNatural(null);
                    setReady(false);
                    setError(t("admin.naturePage.thumbModalImageError"));
                  }}
                />
              ) : (
                <div className="flex min-h-[120px] items-center justify-center px-3 py-6 text-center text-[11px] text-adminMuted">
                  {t("admin.naturePage.thumbModalImageEmpty")}
                </div>
              )}
            </div>
            <button
              type="button"
              className="mt-3 w-full rounded-lg border border-adminLine bg-adminPanel px-3 py-2 text-[11px] text-adminFg transition hover:bg-surface"
              onClick={() => fileInputRef.current?.click()}
            >
              {t("admin.naturePage.thumbModalPickImage")}
            </button>
            <p className="mt-1.5 text-[10px] leading-relaxed text-adminMuted">{t("admin.naturePage.thumbModalImageHint")}</p>
          </>
        )}

        <label className="mt-4 block text-[10px] font-medium uppercase tracking-wide text-adminMuted">
          {cropSlack.mode === "vertical"
            ? t("admin.naturePage.thumbModalPanLabelVertical")
            : t("admin.naturePage.thumbModalPanLabel")}
          <input
            type="range"
            min={-1}
            max={1}
            step={0.02}
            value={pan}
            disabled={!exportReady || !cropSlack.canPan}
            onChange={(e) => setPan(Number(e.target.value))}
            className="mt-1.5 block w-full accent-adminFg"
          />
          <p className="mt-1 text-[10px] leading-relaxed text-adminMuted">
            {!exportReady
              ? ""
              : !cropSlack.canPan
                ? t("admin.naturePage.thumbModalPanNoSlack")
                : cropSlack.mode === "vertical"
                  ? t("admin.naturePage.thumbModalPanHintVertical")
                  : t("admin.naturePage.thumbModalPanHint")}
          </p>
        </label>

        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="text-[10px] text-adminMuted">{t("admin.naturePage.thumbModalPreviewLabel")}</p>
          <canvas
            ref={canvasRef}
            className="h-40 w-40 rounded-lg border border-adminLine bg-black shadow-inner"
            width={240}
            height={240}
            aria-hidden
          />
        </div>

        {error ? <p className="mt-3 text-[11px] text-red-700/90">{error}</p> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded border border-adminLine bg-adminPanel px-3 py-2 text-[12px] text-adminFg transition hover:bg-surface"
            onClick={onClose}
            disabled={saving}
          >
            {t("admin.naturePage.thumbModalCancel")}
          </button>
          <button
            type="button"
            className="rounded border border-adminFg/30 bg-adminFg px-3 py-2 text-[12px] font-medium text-adminBg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void onSave()}
            disabled={!exportReady || saving}
          >
            {saving ? t("admin.naturePage.thumbModalSaving") : t("admin.naturePage.thumbModalSave")}
          </button>
        </div>
      </div>
    </div>
  );
}
