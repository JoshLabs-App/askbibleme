import { spawn } from "node:child_process";
import type { TrackAudioAnalysisV1 } from "@/lib/music/track-analysis";

const ANALYSIS_SAMPLE_RATE = 22050;
const MAX_ANALYSIS_SEC = 900;

function blockRms(samples: Float32Array, offset: number, n: number): number {
  let s = 0;
  for (let i = 0; i < n; i++) {
    const x = samples[offset + i] ?? 0;
    s += x * x;
  }
  return Math.sqrt(s / n);
}

/** 单频点能量（归一化前），块长 n、采样率 sr */
function goertzelMagnitude(samples: Float32Array, offset: number, n: number, sr: number, targetHz: number): number {
  if (n < 16) return 0;
  let k = Math.floor(0.5 + (n * targetHz) / sr);
  k = Math.max(1, Math.min(k, Math.floor(n / 2) - 1));
  const omega = (2 * Math.PI * k) / n;
  const sn = Math.sin(omega);
  const cn = Math.cos(omega);
  const coeff = 2 * cn;
  let s = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    const x = samples[offset + i] ?? 0;
    const s0 = coeff * s - s2 + x;
    s2 = s;
    s = s0;
  }
  const real = cn * s - s2;
  const imag = sn * s;
  return Math.sqrt(real * real + imag * imag) / n;
}

function normalize01(arr: number[]): number[] {
  const m = Math.max(1e-12, ...arr);
  return arr.map((x) => Math.min(1, Math.max(0, x / m)));
}

export function buildTrackAnalysisFromMonoSamples(
  samples: Float32Array,
  sampleRate: number,
  hopMs = 50,
): TrackAudioAnalysisV1 {
  const hop = Math.max(256, Math.floor((sampleRate * hopMs) / 1000));
  const lowHz = 90;
  const midHz = 900;
  const highHz = 4000;
  const rmsArr: number[] = [];
  const lowArr: number[] = [];
  const midArr: number[] = [];
  const highArr: number[] = [];
  for (let off = 0; off + hop <= samples.length; off += hop) {
    rmsArr.push(blockRms(samples, off, hop));
    lowArr.push(goertzelMagnitude(samples, off, hop, sampleRate, lowHz));
    midArr.push(goertzelMagnitude(samples, off, hop, sampleRate, midHz));
    highArr.push(goertzelMagnitude(samples, off, hop, sampleRate, highHz));
  }
  const durationSec = samples.length / sampleRate;
  if (rmsArr.length === 0) {
    return {
      v: 1,
      dt: hop / sampleRate,
      durationSec,
      rms: [0],
      low: [0],
      mid: [0],
      high: [0],
    };
  }
  return {
    v: 1,
    dt: hop / sampleRate,
    durationSec,
    rms: normalize01(rmsArr),
    low: normalize01(lowArr),
    mid: normalize01(midArr),
    high: normalize01(highArr),
  };
}

export type DecodeAudioPcmOptions = {
  /** 最多解码时长（秒），上限为 MAX_ANALYSIS_SEC；上传后能量分析应使用较短片段以免阻塞。 */
  maxSeconds?: number;
};

export async function decodeFileToMonoF32Pcm(
  filePath: string,
  opts?: DecodeAudioPcmOptions,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  const cap = opts?.maxSeconds;
  const tSec =
    typeof cap === "number" && Number.isFinite(cap) && cap > 0
      ? Math.min(MAX_ANALYSIS_SEC, Math.max(1, Math.floor(cap)))
      : MAX_ANALYSIS_SEC;
  return new Promise((resolve, reject) => {
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      filePath,
      "-t",
      String(tSec),
      "-vn",
      "-ac",
      "1",
      "-ar",
      String(ANALYSIS_SAMPLE_RATE),
      "-f",
      "f32le",
      "pipe:1",
    ];
    const ff = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let err = "";
    ff.stdout.on("data", (c: Buffer) => chunks.push(c));
    ff.stderr?.on("data", (d: Buffer) => {
      err += d.toString();
    });
    ff.on("error", (e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") reject(new Error("ENOENT"));
      else reject(e);
    });
    ff.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(err.trim() || `ffmpeg ${code}`));
        return;
      }
      const buf = Buffer.concat(chunks);
      if (buf.byteLength < 8) {
        reject(new Error("empty pcm"));
        return;
      }
      const byteLength = Math.floor(buf.byteLength / 4) * 4;
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + byteLength);
      const samples = new Float32Array(ab);
      resolve({ samples, sampleRate: ANALYSIS_SAMPLE_RATE });
    });
  });
}

export async function analyzeAudioFileToV1(
  filePath: string,
  opts?: DecodeAudioPcmOptions,
): Promise<TrackAudioAnalysisV1> {
  const { samples, sampleRate } = await decodeFileToMonoF32Pcm(filePath, opts);
  return buildTrackAnalysisFromMonoSamples(samples, sampleRate);
}
