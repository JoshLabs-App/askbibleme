/** 可复用的环境声素材（水声、鸟声等），写入 `nature-settings.json` */
export type NatureAmbientClipEntry = {
  id: string;
  src: string;
  title?: string;
};

/** 单条影片上的混音层：引用素材库 clip，音量 0～1 */
export type NatureVideoMixLayer = {
  id: string;
  clipId: string;
  volume: number;
};

export type NatureVideoEntry = {
  id: string;
  src: string;
  title?: string;
  /** 正方形封面（相册与前台 poster）；由后台从视频截取写入 */
  thumbSrc?: string;
  /** 该片前台叠加的环境声（可多轨） */
  mix?: NatureVideoMixLayer[];
};

/** 当前磁盘与前台使用的形态（v1 在读入时会升为 v2） */
export type NatureSettingsV2 = {
  version: 2;
  videos: NatureVideoEntry[];
  /** 全库环境声素材；各片的 mix.clipId 须指向此处 */
  ambientClips: NatureAmbientClipEntry[];
  /** 自然页当前播放；若为空或找不到对应项则用列表第一项 */
  activeVideoId: string;
  playbackRate: number;
  posterSrc?: string;
};
