import { getShellScriptureWantPlaying } from "../audio/shellScriptureWantPlaying";
import { publishScripturePlaybackSec, setScripturePlaybackClockPlaying } from "./scripturePlaybackSec";

type NativeProgressPayload = {
  playing?: unknown;
  positionSec?: unknown;
  durationSec?: unknown;
  rate?: unknown;
  kind?: unknown;
};

export type IosNativeScriptureProgressSink = {
  setScriptureCurrentSec?: (sec: number) => void;
  setScriptureDurationSec?: (sec: number) => void;
  scripturePlaybackRateRef?: { current: number };
  playingStateRef: { current: boolean };
  setPlaying: (playing: boolean) => void;
};

function readRate(payload: NativeProgressPayload, fallback: number): number {
  const fromPayload = Number(payload.rate);
  if (Number.isFinite(fromPayload) && fromPayload > 0) return fromPayload;
  if (Number.isFinite(fallback) && fallback > 0) return fallback;
  return 1;
}

/** iOS 读经走原生 AVPlayer：把 NativeProgress 写回时长 / 时钟，供进度轴与跟读使用。 */
export function applyIosNativeScriptureProgress(
  payload: unknown,
  sink: IosNativeScriptureProgressSink,
): void {
  if (!payload || typeof payload !== "object") return;
  const body = payload as NativeProgressPayload;
  const kind = String(body.kind ?? "");
  if (kind === "verse" || kind === "ambient") return;

  const pos = Number(body.positionSec);
  const dur = Number(body.durationSec);
  const rate = readRate(body, sink.scripturePlaybackRateRef?.current ?? 1);
  if (Number.isFinite(pos) && pos >= 0) {
    publishScripturePlaybackSec(pos);
    sink.setScriptureCurrentSec?.(pos);
  }
  if (Number.isFinite(dur) && dur > 0) {
    sink.setScriptureDurationSec?.(dur);
  }

  const playing = body.playing === true && getShellScriptureWantPlaying();
  setScripturePlaybackClockPlaying(playing, rate);
  if (!playing) return;
  sink.playingStateRef.current = true;
  sink.setPlaying(true);
}
