import type { MusicHomeAlbumIcon } from "@/components/music/music-home-album-theme";

type Props = { kind: MusicHomeAlbumIcon; color?: string; className?: string };

export function MusicHomeAlbumIconGlyph({ kind, color, className = "h-5 w-5" }: Props) {
  const fill = color ?? "currentColor";
  switch (kind) {
    case "calm":
      return (
        <svg viewBox="0 0 24 24" fill={fill} className={className} aria-hidden>
          <path d="M12 22c4.97 0 9-4.03 9-9-4.97 0-9 4.03-9 9zM5.6 10.25c0 1.38 1.12 2.5 2.5 2.5.53 0 1.01-.16 1.42-.44l-.02.19c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5l-.02-.19c.4.28.89.44 1.42.44 1.38 0 2.5-1.12 2.5-2.5 0-1-.59-1.85-1.43-2.25.84-.4 1.43-1.25 1.43-2.25 0-1.38-1.12-2.5-2.5-2.5-.53 0-1.01.16-1.42.44l.02-.19C8.62 2 7.5 2 6.12 2S3.62 3.12 3.62 4.5l.02.19C3.23 4.41 2.75 4.25 2.22 4.25c-1.38 0-2.5 1.12-2.5 2.5 0 1 .59 1.85 1.43 2.25-.84.4-1.43 1.25-1.43 2.25z" />
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
          <path d="M14 6V4h-4v2H4v14h16V6h-4zM4 20V8h16v12H4zm10-14h-4V4h4v2z" fillRule="evenodd" />
        </svg>
      );
    case "sleep":
      return (
        <svg viewBox="0 0 24 24" fill={fill} className={className} aria-hidden>
          <path d="M9.37 5.51C9.19 6.15 9.1 6.82 9.1 7.5c0 4.08 3.32 7.4 7.4 7.4 1.68 0 3.22-.56 4.46-1.5 0 2.22-.92 4.23-2.4 5.68 7.07-.72 12.54-6.84 11.84-14.12-.51-4.66-4.21-8.35-8.86-8.86-7.28-.7-13.4 4.77-12.54 11.84z" />
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

function IconSkipPrev({ className = "h-[26px] w-[26px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M6 6v12M16 7l-5 5 5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSkipNext({ className = "h-[26px] w-[26px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M18 6v12M8 7l5 5-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconRepeatOne({ className = "h-[17px] w-[17px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M7 7h8a4 4 0 0 1 4 4v1M17 17H9a4 4 0 0 1-4-4v-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 4 4 7l3 3M17 20l3-3-3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="15" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="700">1</text>
    </svg>
  );
}

function IconRepeatAll({ className = "h-[17px] w-[17px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M7 7h8a4 4 0 0 1 4 4v1M17 17H9a4 4 0 0 1-4-4v-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 4 4 7l3 3M17 20l3-3-3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTimer({ className = "h-[17px] w-[17px]" }: { className?: string }) {
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
