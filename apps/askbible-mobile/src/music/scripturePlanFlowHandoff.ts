import type { AudioPlayer } from "expo-audio";
import type { MutableRefObject } from "react";
import { safeStopAndUnloadSound } from "../audio/safeShellSound";
import { armReadPlanFlowAutoplay } from "../read/read-plan-flow-autoplay";
import { markScriptureWantPlaying } from "./scriptureResumeAfterInterruption";

let handoffReleasePromise: Promise<void> | null = null;

/** planFlow 章末换章：卸掉上一章音轨，但保留会话与「期望续播」状态。 */
export function releaseScriptureShellForPlanFlowAdvance(args: {
  soundRef: MutableRefObject<AudioPlayer | null>;
  scriptureSrcRef: MutableRefObject<string | null>;
  autoPlayScriptureRef: MutableRefObject<boolean>;
  scriptureWantPlayingRef: MutableRefObject<boolean>;
  setPlaying: (playing: boolean) => void;
}): Promise<void> {
  const work = (async () => {
    const sound = args.soundRef.current;
    args.soundRef.current = null;
    args.scriptureSrcRef.current = null;
    args.setPlaying(false);
    args.autoPlayScriptureRef.current = true;
    markScriptureWantPlaying(args.scriptureWantPlayingRef, true);
    armReadPlanFlowAutoplay();
    if (sound) {
      await safeStopAndUnloadSound(sound);
    }
  })();
  handoffReleasePromise = work;
  void work.finally(() => {
    if (handoffReleasePromise === work) {
      handoffReleasePromise = null;
    }
  });
  return work;
}

export async function awaitPlanFlowHandoffRelease(): Promise<void> {
  if (handoffReleasePromise) {
    await handoffReleasePromise;
  }
}
