/**
 * 与 `MusicShellVisualProvider` 内 rAF 平滑后的能量同源，
 * 通过 ref 同步给 WebGL 等，避免每帧 setState。
 */
export type MusicVisualDriveSnapshot = {
  rms: number;
  low: number;
  mid: number;
  high: number;
};

export const IDLE_MUSIC_VISUAL_DRIVE: MusicVisualDriveSnapshot = {
  rms: 0.06,
  low: 0,
  mid: 0,
  high: 0,
};
