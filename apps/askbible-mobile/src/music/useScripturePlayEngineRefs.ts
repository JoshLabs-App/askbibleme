import { useRef } from "react";

export function useScripturePlayEngineRefs() {
  return {
    scripturePlayInFlightRef: useRef<Promise<void> | null>(null),
    scriptureSrcRef: useRef<string | null>(null),
    scriptureStopAtSecRef: useRef<number | null>(null),
    scriptureStopAtOnEndedRef: useRef<(() => void) | null>(null),
    autoPlayScriptureRef: useRef(false),
  };
}

export type ScripturePlayEngineRefs = ReturnType<typeof useScripturePlayEngineRefs>;
