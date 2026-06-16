export type NatureHomeTtsDeviceVoice = {
  identifier: string;
  name?: string;
  language?: string;
};

export type TtsVoiceGender = "female" | "male" | "unknown";

export function inferTtsVoiceGender(voice: NatureHomeTtsDeviceVoice): TtsVoiceGender {
  const text = `${voice.name || ""} ${voice.identifier || ""}`.toLowerCase();
  if (
    /\bfemale\b|\bwoman\b|\bgirl\b|tingting|ting-ting|meijia|mei-jia|sinji|sin-ji|samantha|victoria|karen|siri_female|xiaoyi|xiao-yi|xiaoxiao|xiao-xiao|yushu|yu-shu|\blili\b|li-li|huihui|hui-hui|zira|susan|fiona|moira|tessa|veena|amelie|anna|carmit|damayanti|ellen|kyoko|laura|linda|mariska|melina|milena|monica|nora|paulina|sara|satu|tessa|yelda/.test(
      text,
    )
  ) {
    return "female";
  }
  if (
    /\bmale\b|\bman\b|\bboy\b|alex|daniel|tom|fred|aaron|ralph|bruce|siri_male|yunxi|yunjian|yunfeng|yun-yang|kangkang|kang-kang|limu|li-mu|grandpa|compact\.zh-cn\.(yunxi|yunjian|kangkang|limu)/.test(
      text,
    )
  ) {
    return "male";
  }
  return "unknown";
}

export function isFemaleTtsVoice(voice: NatureHomeTtsDeviceVoice): boolean {
  return inferTtsVoiceGender(voice) === "female";
}

/** 去掉明确女声；保留男声与未识别声线。 */
export function filterNonFemaleTtsVoices<T extends NatureHomeTtsDeviceVoice>(voices: T[]): T[] {
  return voices.filter((voice) => !isFemaleTtsVoice(voice));
}

export function filterTtsVoicesForLocale<T extends NatureHomeTtsDeviceVoice>(
  voices: T[],
  langPrefix: string,
): T[] {
  const nonFemale = filterNonFemaleTtsVoices(voices).filter(
    (voice) => typeof voice.identifier === "string" && voice.identifier.trim().length > 0,
  );
  const prefix = langPrefix.toLowerCase();
  const preferred = nonFemale.filter((voice) =>
    String(voice.language || "")
      .toLowerCase()
      .startsWith(prefix),
  );
  return preferred.length > 0 ? preferred : nonFemale;
}

/** 播放时解析声线：优先用户选择（非女声），否则选同语种男声。 */
export function resolveMaleTtsVoiceId(
  voices: NatureHomeTtsDeviceVoice[],
  input: { preferredId?: string; langPrefix: string },
): string | undefined {
  const pool = filterTtsVoicesForLocale(voices, input.langPrefix);
  if (!pool.length) return undefined;

  const preferred = String(input.preferredId || "").trim();
  if (preferred && pool.some((voice) => voice.identifier === preferred)) {
    return preferred;
  }

  const explicitMale = pool.find((voice) => inferTtsVoiceGender(voice) === "male");
  if (explicitMale) return explicitMale.identifier;

  return pool[0]?.identifier;
}

export function sanitizeTtsVoiceId(
  voices: NatureHomeTtsDeviceVoice[],
  voiceId: string,
  langPrefix: string,
): string {
  const trimmed = voiceId.trim();
  if (!trimmed) {
    return resolveMaleTtsVoiceId(voices, { langPrefix }) ?? "";
  }
  const match = voices.find((voice) => voice.identifier === trimmed);
  if (!match || isFemaleTtsVoice(match)) {
    return resolveMaleTtsVoiceId(voices, { langPrefix }) ?? "";
  }
  return trimmed;
}
