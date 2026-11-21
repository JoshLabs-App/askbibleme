/**
 * 媒体控件图标（跳过与循环为圆润几何描边；播放 / 暂停为圆角楔形 + 胶囊竖条）。
 * 避免用 ▶ ⏸ Unicode，以免在 iOS/Android 上变成彩色 emoji。
 */
const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.9,
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

const repeatStroke = {
  stroke: "currentColor",
  strokeWidth: 1.85,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** 经文朗读：单章循环（对称圆角循环轨 + 居中数字 1） */
export function IconScriptureRepeatChapter({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M17 3l3.5 3.5L17 10" {...repeatStroke} />
      <path d="M3.5 11V9.5a3 3 0 0 1 3-3H20.5" {...repeatStroke} />
      <path d="M7 21l-3.5-3.5L7 14" {...repeatStroke} />
      <path d="M20.5 13v1.5a3 3 0 0 1-3 3H3.5" {...repeatStroke} />
      <path
        d="M11.1 10.4l1.4-.9v5"
        stroke="currentColor"
        strokeWidth={1.85}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 经文朗读：整卷循环 / 默认循环图标（干净对称圆角循环轨，不塞杂乱横线） */
export function IconScriptureRepeatBook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M17 3l3.5 3.5L17 10" {...repeatStroke} />
      <path d="M3.5 11V9.5a3 3 0 0 1 3-3H20.5" {...repeatStroke} />
      <path d="M7 21l-3.5-3.5L7 14" {...repeatStroke} />
      <path d="M20.5 13v1.5a3 3 0 0 1-3 3H3.5" {...repeatStroke} />
    </svg>
  );
}
