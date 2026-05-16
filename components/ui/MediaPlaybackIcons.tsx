/**
 * 媒体控件图标（跳过为描边；播放 / 暂停为 **Apple / SF Symbols 气质**：圆角楔形 + 胶囊竖条）。
 *
 * **播放**（近 `play.fill`）
 * - 圆角楔形、实心、`fill="currentColor"`；父级用 `text-*` / `color` 控制颜色。
 * - 可略 `translate-x-[0.5px]` 做光学居中。
 *
 * **暂停**（近 `pause.fill`）
 * - 两根圆角矩形（`rx` 为半宽 → 端部半圆），与系统控制条暂停一致。
 *
 * 避免用 ▶ ⏸ Unicode，以免在 iOS/Android 上变成彩色 emoji。
 */
const stroke = {
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** 圆角楔形播放（SF Symbols `play.fill` 一类形，24×24 视口）。 */
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

/** 双胶囊暂停（SF Symbols `pause.fill` 一类形）。 */
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

const repeatStroke = {
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** 经朗读：重复本章（循环箭头 + 单划） */
export function IconScriptureRepeatChapter({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M6.5 9.25A5.75 5.75 0 0 1 17.2 7.5M17.5 14.75A5.75 5.75 0 0 1 6.8 16.5"
        {...repeatStroke}
      />
      <path d="M6.5 9.25V6.5H3.75M17.5 14.75v2.75h2.75" {...repeatStroke} />
      <path d="M10.5 12h6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** 经朗读：重复本卷（循环箭头 + 多行） */
export function IconScriptureRepeatBook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M6.5 9.25A5.75 5.75 0 0 1 17.2 7.5M17.5 14.75A5.75 5.75 0 0 1 6.8 16.5"
        {...repeatStroke}
      />
      <path d="M6.5 9.25V6.5H3.75M17.5 14.75v2.75h2.75" {...repeatStroke} />
      <path d="M10 10.75h7M10 12.25h7M10 13.75h5.5" {...repeatStroke} />
    </svg>
  );
}
