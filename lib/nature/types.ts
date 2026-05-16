import type { NatureSceneCategory } from "./scene-categories";

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
  /** 线上默认播放（新上传经转码后为 720p H.264）；历史数据可为单文件任意分辨率 */
  src: string;
  /** 可选 1080p H.264；前台「高清」开关打开且存在时使用 */
  src1080?: string;
  /** 原始母片（如 4K / .mov），仅存档；默认不参与播放与预取 */
  src4k?: string;
  title?: string;
  /** 场景分类：自然 / 白天 / 晚上；缺省为 `nature` */
  category?: NatureSceneCategory;
  /** 正方形封面（相册与场景卡）；后台截取或上传 */
  thumbSrc?: string;
  /** 首帧预览图（16:9 友好 JPEG，上传/回填时生成）；预览条只显示此图不预拉视频 */
  previewFrameSrc?: string;
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
  /** 场景选择页 `/scenes` 背景影片；缺省或无效时同 {@link activeVideoId} */
  scenesPageVideoId?: string;
  playbackRate: number;
  posterSrc?: string;
};
