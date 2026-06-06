import type { MusicHomeAlbumIcon } from "@/components/music/music-home-album-theme";

type Props = { kind: MusicHomeAlbumIcon; color?: string; className?: string };

export function MusicHomeAlbumIconGlyph({ kind, color, className = "h-5 w-5" }: Props) {
  const stroke = color ?? "currentColor";
  switch (kind) {
    case "calm":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
          <path
            d="M12 3c-2.8 3.2-4 5.8-4 8.5a4 4 0 1 0 8 0c0-2.7-1.2-5.3-4-8.5Z"
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M9 20h6" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "coffee":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
          <path
            d="M5 8h11a3 3 0 0 1 0 6H5V8Z"
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M7 19h8" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "work":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
          <path
            d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z"
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M9 9V7a3 3 0 0 1 6 0v2" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "sleep":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
          <path
            d="M20 14.5A7.5 7.5 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5Z"
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
          <circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.6" />
          <circle cx="12" cy="12" r="2.5" fill={stroke} />
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
