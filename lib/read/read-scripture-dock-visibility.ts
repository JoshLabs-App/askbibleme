/** 章页常驻；其它读经子页仅在朗读中/准备中显示。对齐 App `readScriptureDockVisibility.ts`。 */
export function shouldShowReadScriptureAudioDock(opts: {
  readChapterAudioAvailable: boolean;
  onChapterPage: boolean;
  playing: boolean;
  scripturePreparing: boolean;
}): boolean {
  if (!opts.readChapterAudioAvailable) return false;
  if (opts.onChapterPage) return true;
  return opts.playing || opts.scripturePreparing;
}
