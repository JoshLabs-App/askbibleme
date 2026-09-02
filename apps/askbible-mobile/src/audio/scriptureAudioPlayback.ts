import type { AudioSource } from "expo-audio";
import { Asset } from "expo-asset";
import { Platform } from "react-native";
import { resolveBundledChapterAudioModule } from "../bible/bundled-chapter-audio";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";

const bundledChapterAudioUriCache = new Map<number, string>();

/** 预热 bundled 章朗读对应的本地 file URI，避免冷启动时重复 Asset.loadAsync。 */
export async function warmBundledScriptureChapterAudioUri(bundledModule: number): Promise<string | null> {
  const cached = bundledChapterAudioUriCache.get(bundledModule);
  if (cached) return cached;
  try {
    const [asset] = await Asset.loadAsync(bundledModule);
    const localUri = (asset?.localUri || asset?.uri || "").trim();
    if (localUri) {
      bundledChapterAudioUriCache.set(bundledModule, localUri);
      return localUri;
    }
  } catch {
    /* ignore warm failures */
  }
  return null;
}

/** 整章朗读：APK 内优先 `require()` 模块，避免 Android 上 Asset.uri 无法播放。 */
export async function resolveScriptureAvSource(
  src: string,
  bundledModule?: number | null,
): Promise<AudioSource | null> {
  const trimmed = src.trim();
  if (!trimmed && bundledModule == null) return null;

  if (bundledModule != null) {
    if (Platform.OS === "android") {
      const cached = bundledChapterAudioUriCache.get(bundledModule);
      if (cached) return { uri: cached };
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
