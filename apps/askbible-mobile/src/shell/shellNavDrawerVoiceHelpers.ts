export type ShellNavDrawerDeviceVoice = { identifier: string; name?: string; language?: string };

export function compactVoiceName(voice: ShellNavDrawerDeviceVoice): string {
  const raw = (voice.name?.trim() || voice.identifier || "").trim();
  if (!raw) return "Voice";
  const normalized = raw.replace(/\s+/g, " ");
  const firstWord = normalized.split(" ")[0]?.trim() || normalized;
  return firstWord.length > 10 ? firstWord.slice(0, 10) : firstWord;
}
