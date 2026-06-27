/**
 * 音乐陪伴：音频与背景解耦；Scene 仅做 id 组合。
 * 持久化见 `data/music-companion.json`。
 */

import type { LocalizedField } from "@/lib/i18n/localized-text";

export type AudioTrack = {
  id: string;
  /** 展示标题；可为纯中文串或 `{ "zh-CN", en? }` */
  title: LocalizedField;
  artist?: LocalizedField;
  /** 音频 URL（可同源 /public 或 https） */
  src: string;
  /** 预计算能量曲线 JSON（上传时生成，如 `/music/analysis/<id>.json`） */
  analysisSrc?: string;
  durationSec?: number;
  tags?: string[];
  /** 后期备注/标签，如【安静】【敬拜】【睡眠】 */
  remark?: LocalizedField;
  /** 为 true 时前台与 App 不展示、不打包进 starter */
  hidden?: boolean;
};

export type BackgroundVisual = {
  id: string;
  type: "image" | "gradient";
  imageSrc?: string;
  /** 图片素材在后台列表中的名称（上传时可自动生成） */
  title?: LocalizedField;
  cssGradient?: string;
  blur?: boolean;
  credit?: LocalizedField;
};

export type Scene = {
  id: string;
  title?: LocalizedField;
  audioTrackId: string | null;
  backgroundVisualId: string | null;
  order: number;
};

export type MusicCompanionStore = {
  version: 1;
  audioTracks: AudioTrack[];
  backgroundVisuals: BackgroundVisual[];
  scenes: Scene[];
  defaultSceneId: string | null;
};
