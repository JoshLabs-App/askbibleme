"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";

const OUT_SIZE = 768;

/** pan ∈ [-1,1]：-1 最左，0 居中，1 最右（仅当画面宽大于裁切边长时有效） */
function squareCropSourceRect(vw: number, vh: number, pan: number): { sx: number; sy: number; side: number } {
  const side = Math.min(vw, vh);
  if (vw > vh) {
    const max = vw - side;
    const sx = max <= 0 ? 0 : ((Math.min(1, Math.max(-1, pan)) + 1) / 2) * max;
    return { sx, sy: 0, side };
  }
  const maxY = vh - side;
  const sy = maxY <= 0 ? 0 : ((Math.min(1, Math.max(-1, pan)) + 1) / 2) * maxY;
  return { sx: 0, sy, side };
}

function paintSquarePreview(video: HTMLVideoElement, canvas: HTMLCanvasElement, pan: number) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;
  const { sx, sy, side } = squareCropSourceRect(vw, vh, pan);
  const preview = 240;
  canvas.width = preview;
  canvas.height = preview;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(video, sx, sy, side, side, 0, 0, preview, preview);
}

function captureSquareJpeg(video: HTMLVideoElement, pan: number): Promise<Blob | null> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return Promise.resolve(null);
  const { sx, sy, side } = squareCropSourceRect(vw, vh, pan);
  const c = document.createElement("canvas");
  c.width = OUT_SIZE;
  c.height = OUT_SIZE;
  const ctx = c.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(video, sx, sy, side, side, 0, 0, OUT_SIZE, OUT_SIZE);
  return new Promise((resolve) => {
    c.toBlob((b) => resolve(b), "image/jpeg", 0.9);
  });
}

type Props = {
  open: boolean;
  videoSrc: string;
  onClose: () => void;
  onCommit: (blob: Blob) => Promise<void>;
};

export function NatureVideoSquareThumbModal({ open, videoSrc, onClose, onCommit }: Props) {
  const { t } = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** -1 左 … 1 右（横条余量）；竖幅时为上下选区 */
  const [pan, setPan] = useState(0);
  const [videoSize, setVideoSize] = useState<{ w: number; h: number } | null>(null);

  const cropSlack = useMemo(() => {
    if (!videoSize || videoSize.w < 2 || videoSize.h < 2) return { canPan: false as const, mode: "none" as const };
    const { w, h } = videoSize;
    if (w > h) return { canPan: w - h > 0.5, mode: "horizontal" as const };
    if (h > w) return { canPan: h - w > 0.5, mode: "vertical" as const };
    return { canPan: false, mode: "square" as const };
  }, [videoSize]);

  const repaint = useCallback(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !v.videoWidth) return;
    paintSquarePreview(v, c, pan);
  }, [pan]);

  useEffect(() => {
    if (!open) {
      setReady(false);
      setDuration(0);
      setTime(0);
      setPan(0);
      setVideoSize(null);
      setError(null);
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => {
      const raw = v.duration;
      const d = Number.isFinite(raw) && raw > 0 && raw !== Number.POSITIVE_INFINITY ? raw : 0;
      setDuration(d);
      const t0 = d > 0.1 ? 0.05 : 0;
      setTime(t0);
      setVideoSize({ w: v.videoWidth, h: v.videoHeight });
      setPan(0);
      setReady(true);
    };
    const onSeeked = () => repaint();
    const onErr = () => setError(t("admin.naturePage.thumbModalVideoError"));
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("error", onErr);
    v.load();
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("error", onErr);
    };
  }, [open, videoSrc, repaint, t]);

  useEffect(() => {
    if (!open || !ready) return;
    const v = videoRef.current;
    if (!v) return;
    if (!Number.isFinite(duration) || duration <= 0.05) {
      repaint();
      return;
    }
    const safe = Math.min(Math.max(0.02, time), duration - 0.02);
    if (Math.abs(v.currentTime - safe) > 0.02) {
      v.currentTime = safe;
    } else {
      repaint();
    }
  }, [open, ready, time, duration, repaint]);

  useEffect(() => {
    if (!cropSlack.canPan && pan !== 0) setPan(0);
  }, [cropSlack.canPan, pan]);

  useEffect(() => {
    if (!open || !ready) return;
    repaint();
  }, [open, ready, pan, repaint]);

  const onSave = async () => {
    const v = videoRef.current;
    if (!v || saving) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await captureSquareJpeg(v, pan);
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
      <div className="max-h-[min(92vh,640px)] w-full max-w-md overflow-y-auto rounded-2xl border border-adminLine bg-adminBg p-4 shadow-xl sm:p-5">
        <h3 id="nature-thumb-modal-title" className="text-[13px] font-semibold text-adminFg">
          {t("admin.naturePage.thumbModalTitle")}
        </h3>
        <p className="mt-1.5 text-[11px] leading-relaxed text-adminMuted">{t("admin.naturePage.thumbModalHint")}</p>

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
            disabled={!ready || !cropSlack.canPan}
            onChange={(e) => setPan(Number(e.target.value))}
            className="mt-1.5 block w-full accent-adminFg"
          />
          <p className="mt-1 text-[10px] leading-relaxed text-adminMuted">
            {!ready
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
            disabled={!ready || saving}
          >
            {saving ? t("admin.naturePage.thumbModalSaving") : t("admin.naturePage.thumbModalSave")}
          </button>
        </div>
      </div>
    </div>
  );
}
