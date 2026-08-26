/** 章页常驻；其它读经子页仅在朗读中/准备中显示。 */
export function shouldShowReadScriptureAudioDock(opts: {
  readChapterAudioAvailable: boolean;
  onChapterPage: boolean;
  playbackMode: string;
  playing: boolean;
  scripturePreparing: boolean;
}): boolean {
  if (!opts.readChapterAudioAvailable) return false;
  if (opts.onChapterPage) return true;
  return (
    opts.playbackMode === "scripture" &&
    (opts.playing || opts.scripturePreparing)
  );
}
