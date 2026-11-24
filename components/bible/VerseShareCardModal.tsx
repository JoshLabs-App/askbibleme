"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import { VERSE_TEXT_HIGHLIGHT_PALETTE } from "@/lib/read/read-verse-text-highlights";
import { getAppShellPortalRoot } from "@/lib/shell/app-shell-portal-root";

export type VerseShareCardPayload = {
  reference: string;
  translationName: string;
  text: string;
};

function pickCopy(zh: string, en: string, locale: string): string {
  if (locale === "en") return en;
  return locale === "zh-TW" ? toZhTwText(zh) : zh;
}

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of Array.from(text)) {
    if (ch === "\n") {
      lines.push(line);
      line = "";
      continue;
    }
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function renderShareCardBlob(
  payload: VerseShareCardPayload,
  dark: boolean,
): Promise<Blob | null> {
  const width = 1080;
  const padX = 96;
  const maxWidth = width - padX * 2;
  const probe = document.createElement("canvas");
  const pctx = probe.getContext("2d");
  if (!pctx) return null;
  const bodyFont = '600 46px -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", sans-serif';
  pctx.font = bodyFont;
  const lines = wrapCanvasLines(pctx, payload.text.trim(), maxWidth);
  const lineH = 74;
  const height = Math.max(680, 220 + lines.length * lineH + 200);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = dark ? "#1F1A15" : "#F5EFE4";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = dark ? "#3E3328" : "#DCCCB2";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(36, 36, width - 72, height - 72, 40);
  ctx.stroke();

  ctx.fillStyle = "#D97707";
  ctx.beginPath();
  ctx.roundRect(width / 2 - 52, 108, 104, 7, 3.5);
  ctx.fill();

  ctx.font = bodyFont;
  ctx.fillStyle = dark ? "#EDE2CF" : "#231A12";
  ctx.textBaseline = "top";
  lines.forEach((ln, idx) => {
    ctx.fillText(ln, padX, 180 + idx * lineH);
  });

  const footerY = height - 118;
  ctx.font = '600 32px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  ctx.fillStyle = dark ? "#A99A84" : "#7B6751";
  ctx.fillText(`${payload.reference} · ${payload.translationName}`, padX, footerY);

  ctx.font = '700 30px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = "#D97707";
  ctx.textAlign = "right";
  ctx.fillText("AskBible.me", width - padX, footerY);

  return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
}

/**
 * 羊皮卷金句书签分享卡弹层（对齐 iOS / Android VerseShareCardSheet）：
 * 浅色羊皮 / 夜读沉香双底色预览 + 高清 PNG 书签图分享或下载 + 纯文本复制。
 */
export function VerseShareCardModal({
  payload,
  onCopied,
  onClose,
}: {
  payload: VerseShareCardPayload | null;
  onCopied?: () => void;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const [darkCard, setDarkCard] = useState(false);

  const portalTarget = typeof document !== "undefined" ? getAppShellPortalRoot() ?? document.body : null;
  if (!payload || !portalTarget) return null;

  const shareImage = async () => {
    const blob = await renderShareCardBlob(payload, darkCard);
    if (blob) {
      const file = new File([blob], "askbible-verse-card.png", { type: "image/png" });
      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: payload.reference });
          onClose();
          return;
        } catch {
          /* 用户取消或系统不支持，回退下载 */
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `askbible-${payload.reference.replace(/\s+/g, "-")}.png`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 3000);
    }
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[390px] rounded-[24px] border border-[#D8C6AA] bg-[#FAF5EC] p-5 shadow-2xl dark:border-[#3E3328] dark:bg-[#241E18]"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="rounded-[20px] border p-6 transition"
          style={{
            backgroundColor: darkCard ? "#1F1A15" : "#F5EFE4",
            borderColor: darkCard ? "#3E3328" : "#DCCCB2",
            color: darkCard ? "#EDE2CF" : "#231A12",
          }}
        >
          <div className="mx-auto mb-5 h-[2.5px] w-9 rounded-full bg-[#D97707]" />
          <p className="m-0 text-[17.5px] font-semibold leading-[1.68]">{payload.text}</p>
          <div className="mt-6 flex items-center justify-between gap-2 text-[12px] font-semibold">
            <span style={{ color: darkCard ? "#A99A84" : "#7B6751" }}>
              {payload.reference} · {payload.translationName}
            </span>
            <span className="font-bold text-[#D97707]">AskBible.me</span>
          </div>
        </div>

        <div className="mx-auto mt-4 flex w-fit items-center gap-1 rounded-full bg-black/[0.06] p-1 dark:bg-white/[0.08]">
          {[
            { dark: false, label: pickCopy("浅色羊皮", "Light Parchment", locale) },
            { dark: true, label: pickCopy("夜读沉香", "Night Agarwood", locale) },
          ].map((opt) => {
            const active = darkCard === opt.dark;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => setDarkCard(opt.dark)}
                className={[
                  "rounded-full border-0 px-4 py-1.5 text-[12.5px] font-semibold transition",
                  active
                    ? "bg-white text-[#231A12] shadow-sm dark:bg-[#352C23] dark:text-[#EDE2CF]"
                    : "bg-transparent text-[#75614B] dark:text-[#A99A84]",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => void shareImage()}
          className="mt-4 flex h-12 w-full items-center justify-center rounded-xl border-0 bg-[#C1660B] text-[15px] font-bold text-[#FFFBF4] transition hover:opacity-95"
        >
          {pickCopy("发送金句书签图", "Share Verse Card", locale)}
        </button>

        <button
          type="button"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(`${payload.reference} ${payload.text}`)
              .then(() => onCopied?.());
            onClose();
          }}
          className="mt-2.5 block w-full border-0 bg-transparent py-1.5 text-center text-[13px] font-medium text-[#75614B] dark:text-[#A99A84]"
        >
          {pickCopy("仅复制文字", "Copy Text Only", locale)}
        </button>
      </div>
    </div>,
    portalTarget,
  );
}

/**
 * 阅读页一步直达四色古籍颜料高亮 + 动作胶囊弹层（对齐 iOS SelectionHighlightPopover / Android InstantVerseHighlightBar）：
 * 无需进入整页涂抹模式，点颜色圆点一步给该节染色或清除，并提供「复制 · 收藏 · 书签图 · 多选 · 逐词细涂」。
 */
export function InstantVerseHighlightPopover({
  open,
  verseNumber,
  bookmarked,
  currentColor,
  onPickColor,
  onCopy,
  onToggleBookmark,
  onOpenShareCard,
  onOpenMultiSelect,
  onOpenFineBrush,
  onClose,
}: {
  open: boolean;
  verseNumber: number;
  bookmarked: boolean;
  currentColor: string | null;
  onPickColor: (hex: string | null) => void;
  onCopy: () => void;
  onToggleBookmark: () => void;
  onOpenShareCard: () => void;
  onOpenMultiSelect: () => void;
  onOpenFineBrush: () => void;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const portalTarget = typeof document !== "undefined" ? getAppShellPortalRoot() ?? document.body : null;
  if (!open || !portalTarget) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/20 px-4 pb-24 sm:items-center sm:pb-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[360px] rounded-[22px] border border-[#D8C6AA] bg-[#FAF5EC] px-4 py-3.5 shadow-xl dark:border-[#3E3328] dark:bg-[#262019]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold text-[#75614B] dark:text-[#A99A84]">
            {pickCopy(`第 ${verseNumber} 节`, `v.${verseNumber}`, locale)}
          </span>
          <div className="flex items-center gap-3">
            {VERSE_TEXT_HIGHLIGHT_PALETTE.map((hex) => {
              const active = currentColor?.toUpperCase() === hex;
              return (
                <button
                  key={hex}
                  type="button"
                  aria-label={hex}
                  onClick={() => onPickColor(active ? null : hex)}
                  className="h-7 w-7 rounded-full transition active:scale-95"
                  style={{
                    backgroundColor: hex,
                    border: active ? "2.5px solid #231A12" : "1px solid rgba(0,0,0,0.16)",
                  }}
                />
              );
            })}
            {currentColor ? (
              <button
                type="button"
                onClick={() => onPickColor(null)}
                aria-label={pickCopy("清除高亮", "Clear highlight", locale)}
                className="flex h-6 w-6 items-center justify-center rounded-full border-0 bg-black/10 text-xs text-[#75614B] dark:bg-white/10 dark:text-[#EDE2CF]"
              >
                ×
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onOpenFineBrush}
            className="border-0 bg-transparent text-[11.5px] font-medium text-[#C1660B]"
          >
            {pickCopy("细涂", "Brush", locale)}
          </button>
        </div>

        <div className="my-2.5 h-[0.5px] w-full bg-[#DFD0B8] dark:bg-[#3E3328]" />

        <div className="flex items-center justify-around text-[13px] font-semibold text-[#231A12] dark:text-[#EDE2CF]">
          <button type="button" onClick={onCopy} className="border-0 bg-transparent px-2 py-1 text-inherit">
            {pickCopy("复制", "Copy", locale)}
          </button>
          <button
            type="button"
            onClick={onToggleBookmark}
            className="border-0 bg-transparent px-2 py-1"
            style={{ color: bookmarked ? "#D97707" : "inherit" }}
          >
            {bookmarked ? pickCopy("已收藏", "Saved", locale) : pickCopy("收藏", "Save", locale)}
          </button>
          <button type="button" onClick={onOpenShareCard} className="border-0 bg-transparent px-2 py-1 text-inherit">
            {pickCopy("书签图", "Card", locale)}
          </button>
          <button type="button" onClick={onOpenMultiSelect} className="border-0 bg-transparent px-2 py-1 text-inherit">
            {pickCopy("多选", "Select", locale)}
          </button>
        </div>
      </div>
    </div>,
    portalTarget,
  );
}
