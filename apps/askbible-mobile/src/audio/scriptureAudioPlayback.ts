import type { AVPlaybackSource } from "expo-av";
import { Asset } from "expo-asset";
import { Platform } from "react-native";
import { resolveBundledChapterAudioModule } from "../bible/bundled-chapter-audio";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";

/** 整章朗读：APK 内优先 `require()` 模块，避免 Android 上 Asset.uri 无法播放。 */
export async function resolveScriptureAvSource(
  src: string,
  bundledModule?: number | null,
): Promise<AVPlaybackSource | null> {
  const trimmed = src.trim();
  if (!trimmed && bundledModule == null) return null;

  if (bundledModule != null) {
    if (Platform.OS === "android") {
      try {
        const [asset] = await Asset.loadAsync(bundledModule);
        const localUri = (asset?.localUri || asset?.uri || "").trim();
        if (localUri) return { uri: localUri };
      } catch {
        /* fall through to module id */
      }
    }
    return bundledModule;
  }

  return trimmed ? { uri: trimmed } : null;
}

export function resolveScriptureBundledModule(args: {
  translationId: string;
  bookId: string;
  chapter: number;
  voiceId?: CuvChapterAudioVoiceId;
}): number | null {
  return resolveBundledChapterAudioModule(args);
}
