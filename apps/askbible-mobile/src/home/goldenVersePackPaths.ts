import { Directory, File, Paths } from "expo-file-system";
import {
  GOLDEN_VERSE_AUDIO_SUBDIR,
  GOLDEN_VERSE_WEBP_AUDIO_SUBDIR,
  type GoldenVerseAudioTranslationId,
} from "@/lib/bible/golden-verse-audio";

/** 全量金句语音解压根（安装包 zip → Documents）。无精选/大池双目录。 */
export const GOLDEN_VERSE_AUDIO_ROOT = "full" as const;

export type GoldenVerseLangPackId =
  | typeof GOLDEN_VERSE_AUDIO_SUBDIR
  | typeof GOLDEN_VERSE_WEBP_AUDIO_SUBDIR;

export function goldenVerseLangPackId(
  translationId: GoldenVerseAudioTranslationId,
): GoldenVerseLangPackId {
  return translationId === "web-en" ? GOLDEN_VERSE_WEBP_AUDIO_SUBDIR : GOLDEN_VERSE_AUDIO_SUBDIR;
}

export function goldenVersePacksBaseDir(): Directory {
  return new Directory(Paths.document, "askbible-golden-verse-packs");
}

export function goldenVerseAudioRootDir(): Directory {
  return new Directory(goldenVersePacksBaseDir(), GOLDEN_VERSE_AUDIO_ROOT);
}

export function goldenVerseLangPackDir(langPackId: GoldenVerseLangPackId): Directory {
  return new Directory(goldenVerseAudioRootDir(), langPackId);
}

export function goldenVerseAudioFile(relativePath: string): File {
  const parts = relativePath.replace(/^\/+/, "").split("/").filter(Boolean);
  return new File(goldenVerseAudioRootDir(), ...parts);
}

/** 尚未整包解压时，点播抽条缓存。 */
export function goldenVerseOnDemandFile(relativePath: string): File {
  const parts = relativePath.replace(/^\/+/, "").split("/").filter(Boolean);
  return new File(goldenVerseAudioRootDir(), "ondemand", ...parts);
}

export function goldenVerseInstalledMarkerFile(langPackId: GoldenVerseLangPackId): File {
  return new File(goldenVerseAudioRootDir(), `${langPackId}.installed`);
}
