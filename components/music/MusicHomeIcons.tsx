import type { MusicHomeAlbumIcon } from "@/components/music/music-home-album-theme";

type Props = { kind: MusicHomeAlbumIcon; color?: string; className?: string };

export function MusicHomeAlbumIconGlyph({ kind, color, className = "h-5 w-5" }: Props) {
  const fill = color ?? "currentColor";
  switch (kind) {
    case "calm":
      return (
        <svg viewBox="0 0 24 24" fill={fill} className={className} aria-hidden>
          <path d="M8.55 12zm10.43-1.61zm-3.49-.76c-.18-2.79-1.31-5.51-3.43-7.63a12.188 12.188 0 0 0-3.55 7.63c1.28.68 2.46 1.56 3.49 2.63 1.03-1.06 2.21-1.94 3.49-2.63zm-6.5 2.65c-.14-.1-.3-.19-.45-.29.15.11.31.19.45.29zm6.42-.25c-.13.09-.27.16-.4.26.13-.1.27-.17.4-.26zM12 15.45C9.85 12.17 6.18 10 2 10c0 5.32 3.36 9.82 8.03 11.49.63.23 1.29.4 1.97.51.68-.12 1.33-.29 1.97-.51C18.64 19.82 22 15.32 22 10c-4.18 0-7.85 2.17-10 5.45z" />
        </svg>
      );
    case "coffee":
      return (
        <svg viewBox="0 0 24 24" fill={fill} className={className} aria-hidden>
          <path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z" />
        </svg>
      );
    case "work":
      return (
        <svg viewBox="0 0 24 24" fill={fill} className={className} aria-hidden>
          <path d="M14 6V4h-4v2h4zM4 8v11h16V8H4zm16-2c1.11 0 2 .89 2 2v11c0 1.11-.89 2-2 2H4c-1.11 0-2-.89-2-2l.01-11c0-1.11.88-2 1.99-2h4V4c0-1.11.89-2 2-2h4c1.11 0 2 .89 2 2v2h4z" fillRule="evenodd" />
        </svg>
      );
    case "sleep":
      return (
        <svg viewBox="0 0 24 24" fill={fill} className={className} aria-hidden>
          <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
          <circle cx="12" cy="12" r="8" stroke={fill} strokeWidth="1.6" />
          <circle cx="12" cy="12" r="2.5" fill={fill} />
        </svg>
      );
  }
}

function IconSkipPrev({ className = "h-[34px] w-[34px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M6 6v12M16 7l-5 5 5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSkipNext({ className = "h-[34px] w-[34px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M18 6v12M8 7l5 5-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconRepeatOne({ className = "h-[27px] w-[27px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M7 7h8a4 4 0 0 1 4 4v1M17 17H9a4 4 0 0 1-4-4v-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 4 4 7l3 3M17 20l3-3-3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="15" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="700">1</text>
    </svg>
  );
}

function IconRepeatAll({ className = "h-[27px] w-[27px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M7 7h8a4 4 0 0 1 4 4v1M17 17H9a4 4 0 0 1-4-4v-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 4 4 7l3 3M17 20l3-3-3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTimer({ className = "h-[27px] w-[27px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="13" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 10v4l2.5 1.5M9 3h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export {
  IconRepeatAll,
  IconRepeatOne,
  IconSkipNext,
  IconSkipPrev,
  IconTimer,
};
