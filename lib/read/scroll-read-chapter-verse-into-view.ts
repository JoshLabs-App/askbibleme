import {
  READ_VERSE_SCROLL_BOTTOM_INSET_RATIO,
  READ_VERSE_SCROLL_TOP_INSET_RATIO,
  readVerseScrollFocusRatio,
} from "@/lib/read/read-chapter-verse-scroll-focus";

export type ScrollReadChapterVerseOpts = {
  topInsetPx?: number;
  bottomInsetPx?: number;
  audioDockVisible?: boolean;
  behavior?: ScrollBehavior;
};

function defaultTopInsetPx(): number {
  if (typeof window === "undefined") return 88;
  const root = document.documentElement;
  const raw = getComputedStyle(root).getPropertyValue("--read-chapter-verse-scroll-margin-top").trim();
  const parsed = Number.parseFloat(raw);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return 88;
}

function defaultBottomInsetPx(audioDockVisible: boolean): number {
  if (typeof window === "undefined") return audioDockVisible ? 160 : 120;
  const vh = window.innerHeight || 800;
  const ratio =
    READ_VERSE_SCROLL_BOTTOM_INSET_RATIO + (audioDockVisible ? 0.08 : 0);
  return Math.round(vh * ratio);
}

export function findReadChapterScrollContainer(from: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = from;
  while (el) {
    if (el.classList.contains("read-bible-parchment-scroll")) return el;
    const style = getComputedStyle(el);
    if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 2) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

/** 将经节滚到羊皮卷可读区垂直中心（避开顶栏与底栏音频条）。 */
export function scrollReadChapterVerseIntoView(
  verseEl: HTMLElement,
  opts?: ScrollReadChapterVerseOpts,
): void {
  const behavior = opts?.behavior ?? "smooth";
  const container = findReadChapterScrollContainer(verseEl);
  if (!container) {
    verseEl.scrollIntoView({ block: "center", inline: "nearest", behavior });
    return;
  }

  const topInset = opts?.topInsetPx ?? defaultTopInsetPx();
  const bottomInset =
    opts?.bottomInsetPx ?? defaultBottomInsetPx(Boolean(opts?.audioDockVisible));
  const focusRatio = readVerseScrollFocusRatio({
    topInsetRatio: topInset / Math.max(container.clientHeight, 1),
    bottomInsetRatio: bottomInset / Math.max(container.clientHeight, 1),
  });

  const containerRect = container.getBoundingClientRect();
  const verseRect = verseEl.getBoundingClientRect();
  const verseCenter =
    verseRect.top - containerRect.top + container.scrollTop + verseRect.height / 2;
  const targetScrollTop = verseCenter - container.clientHeight * focusRatio;
  const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
  const next = Math.max(0, Math.min(targetScrollTop, maxScroll));

  container.scrollTo({ top: next, behavior });
}
