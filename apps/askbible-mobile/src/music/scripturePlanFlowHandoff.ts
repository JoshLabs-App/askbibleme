import type { AudioPlayer } from "expo-audio";
import type { MutableRefObject } from "react";
import { safeStopAndUnloadSound } from "../audio/safeShellSound";
import { armReadPlanFlowAutoplay } from "../read/read-plan-flow-autoplay";
import { markScriptureWantPlaying } from "./scriptureResumeAfterInterruption";

let handoffReleasePromise: Promise<void> | null = null;

export async function awaitPlanFlowHandoffRelease(): Promise<void> {
  if (handoffReleasePromise) {
    await handoffReleasePromise;
  }
}
