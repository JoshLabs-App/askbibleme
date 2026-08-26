export type LocalizedField = string | { "zh-CN"?: string; en?: string };

export type AudioTrack = {
  id: string;
  title: LocalizedField;
  artist?: LocalizedField;
  src: string;
  analysisSrc?: string;
  durationSec?: number;
  tags?: string[];
  remark?: LocalizedField;
  hidden?: boolean;
};

export type BackgroundVisual = {
  id: string;
  type: "image" | "gradient";
  imageSrc?: string;
  cssGradient?: string;
};

export type Scene = {
  id: string;
  title?: LocalizedField;
  audioTrackId: string | null;
  backgroundVisualId: string | null;
  order: number;
};

export type MusicCompanionStore = {
  version: number;
  audioTracks: AudioTrack[];
  backgroundVisuals?: BackgroundVisual[];
  scenes: Scene[];
  defaultSceneId: string | null;
};

/** 壳层播放用：已解析 URL 与展示用封面 */
export type PlaybackTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  /** 可播放本地 URI（下载包或安装包内置） */
  src: string;
  /** 曲库远端键/路径；无本地文件时经 R2 点播（边播边存），禁止 askbible.me */
  catalogSrc: string;
  localReady: boolean;
  /** `require()` 模块 id；Release APK 内音轨在 Android 上须直连模块 */
  bundledModule?: number;
  /** 曲库元数据时长（秒），用于续播落点校正 */
  durationSec?: number;
  analysisSrc: string | null;
  artworkUri: string | null;
  gradientColors: readonly [string, string, string];
};
