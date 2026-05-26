"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useContext, useMemo, useState } from "react";
import {
  ReadBibleReadSettingsContext,
  ReadBibleTypographyProvider,
  useReadBibleTranslationSettings,
} from "@/components/bible/ReadBibleTypographyProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ReadChapterJumpSheet } from "@/components/bible/ReadChapterJumpSheet";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { IconPause, IconPlay } from "@/components/ui/MediaPlaybackIcons";
import { resolveReadChapterNeighbors } from "@/lib/bible/read-chapter-neighbors";
import { translationSupportsChapterAudio } from "@/lib/bible/read-chapter-audio";
import { isCuvChapterAudioEffectiveSrc } from "@/lib/bible/parse-cuv-chapter-audio-src";

function IconBack() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 17 4 12l5-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 12h10.5a5.5 5.5 0 0 1 5.5 5.5V19"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconList() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.25" stroke="currentColor" strokeWidth="1.75" />
      <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconBookmark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4.5h10a1 1 0 0 1 1 1V19l-6-3.25L6 19V5.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconNext() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 6v12M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const btnClass =
  "read-chapter-action-chrome-btn flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-white/85 transition hover:bg-white/[0.1] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 drop-shadow-[0_1px_2px_rgba(0,0,0,0.62)]";

const btnActiveClass = "bg-white/[0.14] text-white";

function parseReadChapterPath(pathname: string): { bookId: string; chapter: number } | null {
  const m = pathname.match(/^\/read\/([^/]+)\/(\d+)\/?$/);
  if (!m) return null;
  const chapter = Number(m[2]);
  if (!Number.isFinite(chapter) || chapter < 1) return null;
  return { bookId: decodeURIComponent(m[1]).toUpperCase(), chapter };
}

function ReadChapterActionChromeBody() {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [jumpOpen, setJumpOpen] = useState(false);
  const { chapterAudioTranslationId } = useReadBibleTranslationSettings();
  const { togglePlayScripture, playing, effectiveSrc } = useMusicShellPlayback();

  const loc = useMemo(() => parseReadChapterPath(pathname), [pathname]);
  const next = useMemo(
    () => (loc ? resolveReadChapterNeighbors(loc.bookId, loc.chapter).next : null),
    [loc],
  );
  const chapterAudioAvailable = translationSupportsChapterAudio(chapterAudioTranslationId);
  const scriptureActive = playing && isCuvChapterAudioEffectiveSrc(effectiveSrc);

  if (!loc) return null;

  return (
    <>
      <nav
        className="read-chapter-action-chrome pointer-events-auto"
        aria-label={t("pages.read.chapterChromeNavAria")}
      >
        <button
          type="button"
          className={btnClass}
          aria-label={t("pages.read.chapterChromeBack")}
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) router.back();
            else router.push("/read");
          }}
        >
          <IconBack />
        </button>
        <button
          type="button"
          className={btnClass}
          aria-label={t("pages.read.chapterChromeCatalog")}
          onClick={() => setJumpOpen(true)}
        >
          <IconList />
        </button>
        {chapterAudioAvailable ? (
          <button
            type="button"
            className={[btnClass, scriptureActive ? btnActiveClass : ""].filter(Boolean).join(" ")}
            aria-label={
              scriptureActive
                ? t("pages.read.chapterChromeAudioPause")
                : t("pages.read.chapterChromeAudio")
            }
            aria-pressed={scriptureActive}
            onClick={() => void togglePlayScripture()}
          >
            {scriptureActive ? (
              <IconPause className="h-[22px] w-[22px]" />
            ) : (
              <IconPlay className="h-[22px] w-[22px] translate-x-[0.5px]" />
            )}
          </button>
        ) : null}
        <Link href="/read/search" className={btnClass} aria-label={t("pages.read.chapterChromeSearch")}>
          <IconSearch />
        </Link>
        <Link href="/read" className={btnClass} aria-label={t("pages.read.chapterChromeFavorites")}>
          <IconBookmark />
        </Link>
        {next ? (
          <Link
            href={`/read/${next.bookId}/${next.chapter}`}
            className={btnClass}
            aria-label={t("pages.read.chapterChromeNext")}
          >
            <IconNext />
          </Link>
        ) : (
          <button type="button" className={btnClass} disabled aria-label={t("pages.read.chapterChromeNext")}>
            <IconNext />
          </button>
        )}
      </nav>
      <ReadChapterJumpSheet
        open={jumpOpen}
        onClose={() => setJumpOpen(false)}
        bookId={loc.bookId}
        chapter={loc.chapter}
        focusSection="book"
      />
    </>
  );
}

/** 读经章：底栏主导航上方的快捷操作行 */
export function ReadChapterActionChrome() {
  const pathname = usePathname() ?? "";
  const loc = parseReadChapterPath(pathname);
  if (!loc) return null;

  const hasProvider = useContext(ReadBibleReadSettingsContext) != null;
  if (hasProvider) return <ReadChapterActionChromeBody />;

  return (
    <ReadBibleTypographyProvider>
      <ReadChapterActionChromeBody />
    </ReadBibleTypographyProvider>
  );
}
