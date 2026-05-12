/** 与 `lib/nature/types.ts` 对齐，供解析 `/api/nature/settings` JSON */

export type NatureAmbientClipEntry = {
  id: string;
  src: string;
  title?: string;
};

export type NatureVideoMixLayer = {
  id: string;
  clipId: string;
  volume: number;
};

export type NatureVideoEntry = {
  id: string;
  src: string;
  title?: unknown;
  thumbSrc?: string;
  previewFrameSrc?: string;
  mix?: NatureVideoMixLayer[];
};

export type NatureSettingsV2 = {
  version: number;
  videos: NatureVideoEntry[];
  ambientClips: NatureAmbientClipEntry[];
  activeVideoId: string;
  playbackRate: number;
  posterSrc?: string;
};
