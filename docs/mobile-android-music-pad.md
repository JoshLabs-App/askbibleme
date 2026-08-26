# Android 音乐：Play Asset Delivery（PAD）— LEGACY

> **现行策略（2026-08 起）**：商店包默认 **每专辑首曲 + Cloudflare R2**，**不要**开 PAD。  
> 见 `.cursor/rules/mobile-local-media-playback-first.mdc`、`.cursor/rules/android-release.mdc`。  
> 本文仅保留遗留 PAD 工程说明；除非用户明确要求恢复 PAD，否则发版勿用。

> 原决策日期：2026-08-10  
> 范围：**仅 Android**（遗留路径）。

## 事故记录

| 日期 | 问题 | 正确做法 |
|------|------|----------|
| 2026-08-24 | 生产 AAB 误开 `MOBILE_ANDROID_MUSIC_PAD=1` → **~654MB**、上传约 25 分钟 | `MOBILE_ANDROID_MUSIC_PAD=0`（默认）→ **~160MB** |

`npm run mobile:build:android:production` **默认关闭 PAD**。若未设 `ALLOW_ANDROID_MUSIC_PAD=1`，脚本会拒绝 `MOBILE_ANDROID_MUSIC_PAD=1`。

## 遗留策略（仅显式例外）

| 内容 | 交付方式 |
|------|----------|
| 每个专辑 **第一首** | 打进 **base AAB**（Expo `assets/music/tracks`） |
| 其余曲目 | **PAD `fast-follow`** 包 `music_companion_pack` |

专辑分组（`data/music-companion.json` 的 `tags[0]`）：安静 / 下午茶 / 睡眠 / 专注工作。

## 工程要点（遗留）

- 同步：`ALLOW_ANDROID_MUSIC_PAD=1 MOBILE_ANDROID_MUSIC_PAD=1 npm run mobile:sync-offline-media`
  - base：每专辑第一首 → `apps/askbible-mobile/assets/music/tracks/`
  - pack：其余 → `apps/askbible-mobile/android/music_companion_pack/src/main/assets/music/tracks/`
- Gradle：`include ':music_companion_pack'`，`assetPacks = [":music_companion_pack"]`，`deliveryType = fast-follow`
- 原生：`AskBibleMusicAssetPack`（Play Asset Delivery Library）
- JS：`resolveMusicTrackPlayback` 在 Android 上：base require → PAD 本地路径 → R2

## 构建（遗留 PAD）

```bash
# 现行商店包（R2，默认）
npm run mobile:build:android:production

# 仅当明确要求遗留 PAD
ALLOW_ANDROID_MUSIC_PAD=1 MOBILE_ANDROID_MUSIC_PAD=1 npm run mobile:build:android:production
```

## 与 R2 / 自建站点的关系

**大体积媒体增量不走 Render / askbible.me。**  
现行默认增量是 **R2**；PAD 为遗留二选一，不是商店默认。

## 非目标

- 不要把金句大池塞进本音乐 pack
- 不要把主站 zip 当装完再补通道
- iOS 不引入 PAD
