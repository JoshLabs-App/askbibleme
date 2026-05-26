import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY,
  CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY_LEGACY,
  isCuvChapterAudioVoiceId,
  type CuvChapterAudioVoiceId,
} from "./cuv-chapter-audio-voices";

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeCuvChapterAudioVoice(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

export async function readCuvChapterAudioVoice(): Promise<CuvChapterAudioVoiceId> {
  try {
    const raw = (
      (await AsyncStorage.getItem(CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY)) ??
      (await AsyncStorage.getItem(CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY_LEGACY))
    )?.trim();
    if (raw && isCuvChapterAudioVoiceId(raw)) {
      await AsyncStorage.setItem(CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY, raw);
      await AsyncStorage.removeItem(CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY_LEGACY);
      return raw;
    }
  } catch {
    /* ignore */
  }
  return "mandarin";
}

export async function writeCuvChapterAudioVoice(voiceId: CuvChapterAudioVoiceId): Promise<void> {
  await AsyncStorage.setItem(CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY, voiceId);
  await AsyncStorage.removeItem(CUV_CHAPTER_AUDIO_VOICE_STORAGE_KEY_LEGACY);
  emit();
}
