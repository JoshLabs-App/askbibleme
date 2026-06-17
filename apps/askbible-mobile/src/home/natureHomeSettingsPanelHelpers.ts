import type { NatureHomeTtsLevel } from "./natureHomePrefs";
import type { DeviceVoice } from "./natureHomeSettingsPanelConstants";

export function ttsPrefsEqual(
  a: { rateLevel: NatureHomeTtsLevel; pitchLevel: NatureHomeTtsLevel; voiceId: string },
  b: { rateLevel: NatureHomeTtsLevel; pitchLevel: NatureHomeTtsLevel; voiceId: string },
): boolean {
  return a.rateLevel === b.rateLevel && a.pitchLevel === b.pitchLevel && a.voiceId === b.voiceId;
}

export function compactVoiceName(voice: DeviceVoice): string {
  const raw = (voice.name?.trim() || voice.identifier || "").trim();
  if (!raw) return "Voice";
  const normalized = raw.replace(/\s+/g, " ");
  const isZh = (voice.language || "").toLowerCase().startsWith("zh");
  if (isZh) return normalized.length > 6 ? normalized.slice(0, 6) : normalized;
  const firstWord = normalized.split(" ")[0]?.trim() || normalized;
  return firstWord.length > 10 ? firstWord.slice(0, 10) : firstWord;
}

export function genderGlyph(g: "male" | "unknown"): string {
  return g === "male" ? "♂" : "◦";
}
