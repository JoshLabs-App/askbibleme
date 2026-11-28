/**
 * 01AskBible 苹果 SF Symbols 风格统一内联 SVG 图标组件（唯一图标真源）
 * 与 01查到及 JoshLabs 全局图标规范（~/.gemini/config/rules/mobile-app-icons-sf-style.md）100% 同源
 */
import type { CSSProperties } from "react";

export type SfIconName =
  | "chevron-left"
  | "chevron-right"
  | "chevron-up"
  | "chevron-down"
  | "home"
  | "compass"
  | "clock"
  | "book-open"
  | "sparkles"
  | "play"
  | "pause"
  | "settings"
  | "user"
  | "search"
  | "share"
  | "pencil"
  | "plus"
  | "xmark"
  | "check"
  | "star"
  | "star-fill"
  | "ellipsis";

export interface SfIconProps {
  name: SfIconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function SfIcon({ name, size = 20, className, style }: SfIconProps) {
  const baseStyle: CSSProperties = {
    display: "inline-block",
    flexShrink: 0,
    verticalAlign: "middle",
    ...style,
  };

  if (name === "play" || name === "pause" || name === "star-fill" || name === "ellipsis") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className={className}
        style={baseStyle}
      >
        {name === "play" && (
          <path d="M7.5 5.4c0-1.15 1.25-1.86 2.24-1.28l9.8 5.6c1 .57 1 2 0 2.56l-9.8 5.6c-.99.58-2.24-.13-2.24-1.28V5.4Z" />
        )}
        {name === "pause" && (
          <>
            <rect x="6" y="4.5" width="4.2" height="15" rx="1.4" />
            <rect x="13.8" y="4.5" width="4.2" height="15" rx="1.4" />
          </>
        )}
        {name === "star-fill" && (
          <path d="m12 3.2 2.7 5.47 6.03.88-4.36 4.25 1.03 6L12 16.97 6.6 19.8l1.03-6L3.27 9.55l6.03-.88L12 3.2Z" />
        )}
        {name === "ellipsis" && (
          <>
            <circle cx="5.5" cy="12" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="18.5" cy="12" r="1.75" />
          </>
        )}
      </svg>
    );
  }

  const sw =
    name === "chevron-left" ||
    name === "chevron-right" ||
    name === "chevron-up" ||
    name === "chevron-down" ||
    name === "plus" ||
    name === "xmark" ||
    name === "check"
      ? 2
      : 1.85;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={baseStyle}
    >
      {name === "chevron-left" && <path d="M15 5.5 8.5 12 15 18.5" />}
      {name === "chevron-right" && <path d="M9 5.5 15.5 12 9 18.5" />}
      {name === "chevron-up" && <path d="M6 14.5 12 8.5l6 6" />}
      {name === "chevron-down" && <path d="M6 9.5 12 15.5l6-6" />}
      {name === "home" && (
        <>
          <path d="M3.5 10.8 12 4l8.5 6.8" />
          <path d="M5.5 9.5V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V9.5" />
        </>
      )}
      {name === "compass" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z" />
        </>
      )}
      {name === "clock" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.2 2" />
        </>
      )}
      {name === "book-open" && (
        <path d="M12 6.5c-1.8-1.3-4.6-1.8-7.5-1.5v13c2.9-.3 5.7.2 7.5 1.5m0-13c1.8-1.3 4.6-1.8 7.5-1.5v13c-2.9-.3-5.7.2-7.5 1.5m0-13v13" />
      )}
      {name === "sparkles" && (
        <>
          <path d="M12 3.5 13.7 8.8 19 10.5l-5.3 1.7L12 17.5l-1.7-5.3L5 10.5l5.3-1.7L12 3.5Z" />
          <path d="M18.5 15.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z" />
        </>
      )}
      {name === "settings" && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </>
      )}
      {name === "user" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="9.5" r="2.8" />
          <path d="M6.8 18.4a6.2 6.2 0 0 1 10.4 0" />
        </>
      )}
      {name === "search" && (
        <>
          <circle cx="11" cy="11" r="6.8" />
          <path d="m20 20-4.2-4.2" />
        </>
      )}
      {name === "share" && (
        <>
          <path d="M12 3.5v11M8 7.5 12 3.5l4 4" />
          <path d="M5.5 11.5v6.5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-6.5" />
        </>
      )}
      {name === "pencil" && (
        <>
          <path d="M16.86 3.94a2.25 2.25 0 0 1 3.18 3.18L8.4 18.76 4 20l1.24-4.4L16.86 3.94Z" />
          <path d="m14.5 6.3 3.2 3.2" />
        </>
      )}
      {name === "plus" && <path d="M12 5v14M5 12h14" />}
      {name === "xmark" && <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />}
      {name === "check" && <path d="M5 12.5 9.8 17.2 19 7.5" />}
      {name === "star" && (
        <path d="m12 3.6 2.55 5.17 5.7.83-4.12 4.02.97 5.68L12 16.62 6.9 19.3l.97-5.68-4.12-4.02 5.7-.83L12 3.6Z" />
      )}
    </svg>
  );
}
