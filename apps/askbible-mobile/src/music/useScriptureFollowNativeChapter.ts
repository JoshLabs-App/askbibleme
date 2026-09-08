import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { usePlaybackStream } from "../audio/playbackState";
import { syncShellMediaSessionExplicit } from "../audio/shellMediaControls";
import { reshuffleShellMediaSceneArtwork } from "../audio/shellMediaSceneArtwork";
import { readCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { buildScriptureNativeNextUris } from "./buildScriptureNativeNextUris";
import { lookupScriptureQueueChapter } from "./scriptureQueueChapterMap";
import { scriptureChapterPool } from "./scripture-chapter-pool";
import { setScripturePlayingChapter } from "./scripturePlayingChapterStore";
import {
  setBrowseReadChapterPlayback,
  setPlayingReadChapterPlayback,
} from "../read/read-chapter-playback-store";
import type {
  ReadChapterPlaybackRegistration,
  ScriptureAudioRepeatMode,
} from "./scripturePlaybackTypes";

type Args = {
  scriptureSrcRef: MutableRefObject<string | null>;
  scriptureAudioRepeatRef: MutableRefObject<ScriptureAudioRepeatMode>;
  scripturePlaybackRateRef: MutableRefObject<number>;
  readChapterRef: MutableRefObject<ReadChapterPlaybackRegistration | null>;
  setReadChapter: (reg: ReadChapterPlaybackRegistration | null) => void;
};

/** 队列剩这么少就补货。 */
const REFILL_THRESHOLD = 2;

/**
 * 跟随原生正在朗读的章：同步界面与今日计划，并在队列见底时补货。
 *
 * **这里不做任何播放决策。** 换章是原生按队列自己完成的，关屏也照走。
 *
 * 取代了 `useIosNativeScriptureEnded` 里那段最危险的逻辑：它在收到「章终」事件后，
 * **照着原生同一套规则再算一遍**下一章是谁（`peekUpcomingScriptureChapters`），
 * 指望两次独立推演得出同一个答案。不一致时没人会发现，界面章号就和音轨错开。
 * 现在建队列时已经记下每条 URI 对应哪一章（见 scriptureQueueChapterMap），按 URI 查表即可，
 * **顺序只有一处知道**。
 */
export function useScriptureFollowNativeChapter({
  scriptureSrcRef,
  scriptureAudioRepeatRef,
  scripturePlaybackRateRef,
  readChapterRef,
  setReadChapter,
}: Args): void {
  const scripture = usePlaybackStream("scripture");
  const lastUriRef = useRef<string | null>(null);

  useEffect(() => {
    const uri = scripture.uri;
    if (!uri || uri === lastUriRef.current) return;
    lastUriRef.current = uri;

    const ref = lookupScriptureQueueChapter(uri);
    if (!ref) return;

    scriptureSrcRef.current = uri;

    /** 今日计划：把池推进到这一章，完成标记才不会记在浏览中的那一章上。 */
    if (scriptureChapterPool.isActive()) {
      const previous = readChapterRef.current;
      if (previous) scriptureChapterPool.onNativeChained(previous.bookId, previous.chapter);
    }

    const previous = readChapterRef.current;
    const next: ReadChapterPlaybackRegistration = {
      bookId: ref.bookId,
      chapter: ref.chapter,
      bookName: getScriptureBookDisplayName(ref.bookId),
      translationId: ref.translationId,
      chapterAudioSrc: uri,
      onAdvancePreviousChapter: previous?.onAdvancePreviousChapter ?? (() => {}),
      onAdvanceNextChapter: previous?.onAdvanceNextChapter ?? (() => {}),
      onAdvanceNextInBook: previous?.onAdvanceNextInBook ?? (() => {}),
    };
    readChapterRef.current = next;
    setReadChapter(next);
    setScripturePlayingChapter({
      bookId: ref.bookId,
      chapter: ref.chapter,
      translationId: ref.translationId,
    });
    setPlayingReadChapterPlayback(next);
    setBrowseReadChapterPlayback(next);
  }, [scripture.uri, readChapterRef, scriptureSrcRef, setReadChapter]);

  useEffect(() => {
    if (!scripture.playing || !scripture.uri) return;
    if (scripture.queueLength > REFILL_THRESHOLD) return;
    const ref = lookupScriptureQueueChapter(scripture.uri) ?? currentChapterOf(readChapterRef);
    if (!ref) return;

    let cancelled = false;
    void (async () => {
      const voiceId = await readCuvChapterAudioVoice();
      const nextUris = await buildScriptureNativeNextUris({
        bookId: ref.bookId,
        chapter: ref.chapter,
        translationId: ref.translationId,
        repeatMode: scriptureAudioRepeatRef.current,
        voiceId,
      });
      if (cancelled || nextUris.length === 0) return;
      const artworkUri = await reshuffleShellMediaSceneArtwork();
      if (cancelled) return;
      /** 不带 userPlay：原生只取队列，不重新起播。 */
      syncShellMediaSessionExplicit({
        title: `${getScriptureBookDisplayName(ref.bookId)} ${ref.chapter}`,
        artist: "AskBible.me",
        album: ref.translationId,
        assetUri: scripture.uri,
        artworkUri,
        durationSec: scripture.durationSec,
        positionSec: scripture.positionSec,
        playing: true,
        kind: "scripture",
        rate: scripturePlaybackRateRef.current,
        nextAssetUri: nextUris[0] ?? null,
        nextNextAssetUri: nextUris[1] ?? null,
        nextAssetUris: nextUris,
      });
    })();
    return () => {
      cancelled = true;
    };
    // positionSec 每秒都变，不能进依赖；补货只看队列长度与当前章。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scripture.playing, scripture.uri, scripture.queueLength]);
}

function currentChapterOf(
  ref: MutableRefObject<ReadChapterPlaybackRegistration | null>,
): { bookId: string; chapter: number; translationId: string } | null {
  const rc = ref.current;
  if (!rc) return null;
  return { bookId: rc.bookId, chapter: rc.chapter, translationId: rc.translationId };
}
