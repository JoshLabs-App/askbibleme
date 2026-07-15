/** 朗读目标永远跟随屏幕正文译本；不允许跨译本回退。 */
export function resolveCorrespondingChapterAudioTranslationId(primaryTranslationId: string): string {
  return primaryTranslationId.trim();
}
