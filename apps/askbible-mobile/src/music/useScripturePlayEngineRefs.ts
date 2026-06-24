import { useRef } from "react";

export function useScripturePlayEngineRefs() {
  return {
    scripturePlayInFlightRef: useRef<Promise<void> | null>(null),
    scriptureSrcRef: useRef<string | null>(null),
    scriptureStopAtSecRef: useRef<number | null>(null),
    scriptureStopAtOnEndedRef: useRef<(() => void) | null>(null),
    autoPlayScriptureRef: useRef(false),
    /** 用户/planFlow 期望继续朗读；仅显式暂停或 stop 时置 false，系统打断后用于自动续播。 */
    scriptureWantPlayingRef: useRef(false),
    /** 防止章末 stall / 重复 status 触发多次续章。 */
    scriptureChapterEndHandledRef: useRef(false),
    scriptureLastProgressMsRef: useRef(-1),
    scriptureLastProgressAtRef: useRef(Date.now()),
    /** 章末续章 / planFlow 导航 handoff：避免 registerReadChapter(null) 误停朗读。 */
    scriptureChapterHandoffRef: useRef(false),
  };
}

export type ScripturePlayEngineRefs = ReturnType<typeof useScripturePlayEngineRefs>;
