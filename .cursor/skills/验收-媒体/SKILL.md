---
name: verify-media
description: >-
  AskBible 音乐 / 金句语音 / 视频 / 本地媒体改动验收。改 musicAudioRemote、金句音频、场景视频、
  R2、专辑默认、播放器时使用。强制本地/R2 优先，禁止 askbible.me 当下发或常规播放源。简写：验收-媒体。
---

# 验收 · 媒体（音乐 / 金句 / 场景）

## 改之前

确认本次动的是哪一类：

| 类型 | 默认策略 |
|------|----------|
| 音乐 | 每专辑**首曲在包内**；其余 TEMPORARY：**Cloudflare R2** + DocumentDirectory 缓存 |
| 金句语音 | TEMPORARY：**R2 HTTPS 直链**；文字可全量池 |
| 场景 / 其它视频 | **本地**（包内或本机路径）；未获例外勿接远端流 |
| 增量下发 | **禁止** Render / `askbible.me` 当 App 媒体管道 |

真源规则：`.cursor/rules/mobile-local-media-playback-first.mdc`  
金句文档：`docs/mobile-golden-verse-audio.md`

## 默认选曲

- 首页 / 壳层默认只从 **安静** 专辑选曲
- 其它专辑仅用户在音乐栏 / Music Tab **主动切换**后才播

## 改之后检查清单

1. **播放源**：代码路径是本地路径或约定 R2 base URL？有无回落到 `askbible.me` / Render？
2. **进屏复现**（`docs/mobile-feature-map.md`）：
   - 音乐 → Music Tab 或 Home 底条切专辑再播
   - 金句语音 → Home 底条音量
   - 场景 Live → Home 齿轮 → Blur 开关
3. **缺文件时**：首曲缺 → 查 sync/打包；非首曲 / 金句缺 → 查 R2 上传与 `EXPO_PUBLIC_*_BASE_URL`；**不要**接主站补救
4. **外站拉取**：若任务含拉取音频，**禁止压缩/转码**（byte-preserving）

## 禁止当作完成

- 只改了 URL 字符串，未说明用哪条基址、哪类对象键
- 为「方便调试」临时接 askbible.me 播放且未标明临时例外
- Android 发版误开 `MOBILE_ANDROID_MUSIC_PAD=1`（全量进包）
