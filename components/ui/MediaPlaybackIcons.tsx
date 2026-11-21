/**
 * 媒体控件图标（循环图标逐路径对齐安卓 `PlaybackDock.kt` 的 `RepeatGlyph`）。
 * 避免用 ▶ ⏸ Unicode，以免在 iOS/Android 上变成彩色 emoji。
 */
const stroke = {
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** 圆角楔形播放（24×24 视口）。 */
export function IconPlay({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** 双胶囊暂停。 */
export function IconPause({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <rect x="6.75" y="5.25" width="3.75" height="13.5" rx="1.875" ry="1.875" />
      <rect x="13.5" y="5.25" width="3.75" height="13.5" rx="1.875" ry="1.875" />
    </svg>
  );
}

/** 上一段 / 上一场景（竖条 + 向左三角） */
export function IconSkipBack({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M5 6.5v11M18.25 7l-7.25 5 7.25 5" {...stroke} />
    </svg>
  );
}

/** 下一段 / 下一场景（向右三角 + 竖条） */
export function IconSkipForward({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M19 6.5v11M5.75 7l7.25 5-7.25 5" {...stroke} />
    </svg>
  );
}

/**
 * 100% 对齐安卓 `PlaybackDock.kt` 的 `RepeatGlyph`：
 * 24 格里两段圆角箭头（M7 7h8a4 4 0 0 1 4 4v1 / M17 17H9a4 4 0 0 1-4-4v-1 / M7 4 4 7l3 3 / M17 20l3-3-3-3），
 * 描边 1.6 圆头；角标：本章「1」、本书「B」、继续往前 null。
 */
export function IconScriptureRepeatGlyph({
  badge = null,
  className,
}: {
  badge?: "1" | "B" | null;
  className?: string;
}) {
  return (
    <span className={["relative inline-flex items-center justify-center", className].filter(Boolean).join(" ")} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
        <path
          d="M7 7h8a4 4 0 0 1 4 4v1M17 17H9a4 4 0 0 1-4-4v-1M7 4L4 7l3 3M17 20l3-3-3-3"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {badge ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center translate-y-[0.3px] text-[8px] font-bold leading-none">
          {badge}
        </span>
      ) : null}
    </span>
  );
}

/** 经文朗读：重复本章（循环箭头 + 居中 1） */
export function IconScriptureRepeatChapter({ className }: { className?: string }) {
  return <IconScriptureRepeatGlyph badge="1" className={className} />;
}

/** 经文朗读：重复本卷（循环箭头 + 居中 B） */
export function IconScriptureRepeatBook({ className }: { className?: string }) {
  return <IconScriptureRepeatGlyph badge="B" className={className} />;
}
