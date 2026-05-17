"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCuvChapterAudioVoice } from "@/components/bible/CuvChapterAudioVoiceContext";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { teochewNtVoiceActive } from "@/lib/bible/teochew-nt-audio";
import {
  fetchCuvChapterVerseTimings,
  type CuvChapterVerseTiming,
  verseIndexForVerseNumber,
  verseNumberAtChapterAudioTime,
} from "@/lib/bible/cuv-chapter-verse-timings";
import { getCuvChapterAudioContentBounds } from "@/lib/bible/cuv-chapter-audio-content-bounds";
import {
  inferDivineSpeechSpans,
  isDivineSpeechPilotChapter,
  splitTextByDivineSpeechSpans,
} from "@/lib/bible/infer-divine-speech-spans";
import { resolveCuvChapterAudioPlayableSrc, translationSupportsCuvChapterAudio } from "@/lib/bible/cuv-chapter-audio";
import {
  verseIndexForReadChapterAudioTime,
  verseWeightsForReadChapterAudio,
} from "@/lib/bible/read-chapter-audio-verse-from-progress";
import { shellPlaybackUrlsEqual } from "@/lib/music-companion/shell-playback-storage";

type Verse = { verse: number; text: string };

type Props = {
  translationId: string;
  bookId: string;
  bookName: string;
  chapter: number;
  verses: Verse[];
  contrastVerses?: Verse[] | null;
};

export function ReadChapterVersesClient({
  translationId,
  bookId,
  bookName,
  chapter,
  verses,
  contrastVerses = null,
}: Props) {
  const { effectiveVoiceId } = useCuvChapterAudioVoice();
  const { effectiveSrc, currentSec, durationSec, playing } = useMusicShellPlayback();
  const playVoice = effectiveVoiceId(bookId);
  const [resolvedChapterSrc, setResolvedChapterSrc] = useState<string | null>(null);
  const [verseTimings, setVerseTimings] = useState<CuvChapterVerseTiming[] | null>(null);
  const [verseTimingsReady, setVerseTimingsReady] = useState<"idle" | "pending" | "yes" | "no">("idle");
  const verseElRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const lastFollowIndexRef = useRef<number | null>(null);
  const anchorKeyRef = useRef("");

  const anchorKey = `${bookId}:${chapter}`;
  if (anchorKeyRef.current !== anchorKey) {
    anchorKeyRef.current = anchorKey;
    verseElRefs.current = [];
    lastFollowIndexRef.current = null;
    setVerseTimings(null);
    setVerseTimingsReady("idle");
  }

  const supported = translationSupportsCuvChapterAudio(translationId);

  useEffect(() => {
    if (!supported) {
      setResolvedChapterSrc(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const r = await resolveCuvChapterAudioPlayableSrc({
        bookName,
        bookId,
        chapter,
        voiceId: playVoice,
      });
      if (cancelled) return;
      setResolvedChapterSrc(r.ok ? r.src : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supported, bookName, bookId, chapter, playVoice]);

  const useVerseTimingsFile = supported && !teochewNtVoiceActive(playVoice);

  useEffect(() => {
    if (!useVerseTimingsFile) {
      setVerseTimings(null);
      setVerseTimingsReady("idle");
      return;
    }
    let cancelled = false;
    setVerseTimingsReady("pending");
    setVerseTimings(null);
    void (async () => {
      const timings = await fetchCuvChapterVerseTimings(bookId, chapter);
      if (cancelled) return;
      if (timings?.length) {
        setVerseTimings(timings);
        setVerseTimingsReady("yes");
      } else {
        setVerseTimings(null);
        setVerseTimingsReady("no");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [useVerseTimingsFile, bookId, chapter]);

  const contrastByVerse = useMemo(() => {
    if (!contrastVerses?.length) return null;
    const m = new Map<number, string>();
    for (const v of contrastVerses) {
      if (v.text.trim()) m.set(v.verse, v.text);
    }
    return m;
  }, [contrastVerses]);

  const weights = useMemo(() => verseWeightsForReadChapterAudio(verses), [verses]);

  const pilotDivineSpeech = isDivineSpeechPilotChapter(bookId, chapter);
  const verseDivineParts = useMemo(() => {
    if (!pilotDivineSpeech) return null;
    const ctx = { translationId, bookId, chapter };
    return verses.map((v) =>
      splitTextByDivineSpeechSpans(v.text, inferDivineSpeechSpans(v.text, { ...ctx, verse: v.verse })),
    );
  }, [pilotDivineSpeech, verses, translationId, bookId, chapter]);

  const contentBounds = useMemo(() => {
    if (!supported || teochewNtVoiceActive(playVoice) || verseTimingsReady === "yes") return undefined;
    const { leadInSec, trailOutSec } = getCuvChapterAudioContentBounds(bookId, chapter);
    return { contentStartSec: leadInSec, contentEndTrimSec: trailOutSec };
  }, [supported, bookId, chapter, playVoice, verseTimingsReady]);

  const audioMatchesThisChapter =
    Boolean(resolvedChapterSrc) &&
    Boolean(effectiveSrc.trim()) &&
    shellPlaybackUrlsEqual(resolvedChapterSrc!, effectiveSrc.trim());

  const verseFollowEnabled = supported && !teochewNtVoiceActive(playVoice);

  const activeIndex = (() => {
    if (!verseFollowEnabled || !audioMatchesThisChapter) return null;
    if (verseTimingsReady === "yes" && verseTimings?.length) {
      const verseNum = verseNumberAtChapterAudioTime(currentSec, verseTimings);
      if (verseNum === null) return null;
      return verseIndexForVerseNumber(verses, verseNum);
    }
    if (verseTimingsReady === "pending") return null;
    return verseIndexForReadChapterAudioTime(currentSec, durationSec, weights, contentBounds);
  })();

  useLayoutEffect(() => {
    if (!playing) {
      lastFollowIndexRef.current = null;
      return;
    }
    if (activeIndex === null) {
      lastFollowIndexRef.current = null;
      return;
    }
    if (lastFollowIndexRef.current === activeIndex) return;
    lastFollowIndexRef.current = activeIndex;
    const el = verseElRefs.current[activeIndex];
    if (!el) return;
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [playing, activeIndex, verses.length]);

  return (
    <>
      {verses.map((v, i) => {
        const active = activeIndex !== null && i === activeIndex;
        const contrastText = contrastByVerse?.get(v.verse) ?? null;
        return (
          <p
            key={`${bookId}:${chapter}:${v.verse}`}
            ref={(node) => {
              verseElRefs.current[i] = node;
            }}
            data-verse={v.verse}
            aria-current={active ? "location" : undefined}
            className={[
              "read-chapter-verse [text-wrap:pretty]",
              active ? "read-chapter-verse--audio-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="read-chapter-verse-num">{v.verse}</span>
            <span className="read-chapter-verse-primary">
              {verseDivineParts ? (
                verseDivineParts[i]!.map((seg, si) =>
                  seg.divine ? (
                    <span key={si} className="read-chapter-divine-speech">
                      {seg.text}
                    </span>
                  ) : (
                    <Fragment key={si}>{seg.text}</Fragment>
                  ),
                )
              ) : (
                v.text
              )}
            </span>
            {contrastText ? (
              <span className="read-chapter-verse-contrast">{contrastText}</span>
            ) : null}
          </p>
        );
      })}
    </>
  );
}
