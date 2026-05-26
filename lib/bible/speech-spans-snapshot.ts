import fs from "node:fs";
import path from "node:path";

export const SPEECH_SPANS_SNAPSHOT_V1_REL_PATH = "data/bible/annotations/speech-spans-v1.json";
export const SPEECH_SPANS_SNAPSHOT_V2_REL_PATH = "data/bible/annotations/speech-spans-v2.json";
export type SpeechSpansSnapshotVersion = "v1" | "v2";
export type SpeechSpansSnapshotPreference = "latest" | SpeechSpansSnapshotVersion;

export type SpeechSpansSnapshot = {
  format: "askbible-speech-spans-v1" | "askbible-speech-spans-v2";
  generatedAt: string;
  translations: Record<string, Record<string, string>>;
};

export type LoadedSpeechSpansSnapshot = {
  version: SpeechSpansSnapshotVersion;
  absolutePath: string;
  relPath: string;
  generatedAt: string;
  translations: Map<string, Map<string, string>>;
};

function speechSpansSnapshotRelPath(version: SpeechSpansSnapshotVersion): string {
  return version === "v2" ? SPEECH_SPANS_SNAPSHOT_V2_REL_PATH : SPEECH_SPANS_SNAPSHOT_V1_REL_PATH;
}

export function speechSpansSnapshotPath(
  cwd: string,
  version: SpeechSpansSnapshotVersion = "v1",
): string {
  return path.join(cwd, speechSpansSnapshotRelPath(version));
}

export function loadSpeechSpansSnapshot(
  cwd: string,
  preference: SpeechSpansSnapshotPreference = "latest",
): LoadedSpeechSpansSnapshot | null {
  const candidates: SpeechSpansSnapshotVersion[] =
    preference === "latest" ? ["v2", "v1"] : [preference];
  for (const version of candidates) {
    const loaded = loadSpeechSpansSnapshotVersion(cwd, version);
    if (loaded) return loaded;
  }
  return null;
}

function loadSpeechSpansSnapshotVersion(
  cwd: string,
  version: SpeechSpansSnapshotVersion,
): LoadedSpeechSpansSnapshot | null {
  const p = speechSpansSnapshotPath(cwd, version);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<SpeechSpansSnapshot>;
    const expectedFormat = version === "v2" ? "askbible-speech-spans-v2" : "askbible-speech-spans-v1";
    if (raw?.format !== expectedFormat) return null;
    const translations = raw.translations;
    if (!translations || typeof translations !== "object") return null;
    const out = new Map<string, Map<string, string>>();
    for (const [translationId, byVerse] of Object.entries(translations)) {
      if (!byVerse || typeof byVerse !== "object") continue;
      const verseMap = new Map<string, string>();
      for (const [verseKey, speechSpans] of Object.entries(byVerse)) {
        const key = String(verseKey || "").trim();
        const spans = String(speechSpans || "").trim();
        if (!key || !spans) continue;
        verseMap.set(key, spans);
      }
      if (verseMap.size) out.set(String(translationId || "").trim(), verseMap);
    }
    return {
      version,
      absolutePath: p,
      relPath: speechSpansSnapshotRelPath(version),
      generatedAt: String(raw.generatedAt || ""),
      translations: out,
    };
  } catch {
    return null;
  }
}
