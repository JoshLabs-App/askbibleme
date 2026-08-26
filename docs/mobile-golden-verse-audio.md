# 金句：单池文字 + 临时 R2 直链语音

## 产品

- **文字**：首页默认全量池（`theme-repeat-ge5`，约 4000 句）；菜单筛选是同一池的过滤，不是第二个池。
- **语音（TEMPORARY）**：因安装包过大，默认 **Cloudflare R2 HTTPS 直链点播**（不进安装包、不走 Render / `askbible.me` 流量）。
- **禁止**：Render / `askbible.me` 下 ge5-delta；「精选 700 / 大池解锁」双池产品态。
- 恢复本地：设 `EXPO_PUBLIC_GOLDEN_VERSE_AUDIO_STREAM=0`，并 `MOBILE_BUNDLE_GOLDEN_VERSE_AUDIO=1 npm run mobile:sync-offline-media`。

## 远端

- 基址：`EXPO_PUBLIC_GOLDEN_VERSE_AUDIO_BASE_URL`（如 `https://pub-….r2.dev`）。
- 对象键：`audio/golden-verses/{book}-{chapter}-{verse}-32kbps.mp3` 与 `audio/golden-verses-web-en/…`。
- 上传：`npm run mobile:upload:golden-verse-r2`（开通 R2 后；原样上传，不压缩）。

## 打包

- `npm run mobile:sync-offline-media`：默认**跳过**金句 zip（`MOBILE_BUNDLE_GOLDEN_VERSE_AUDIO` 须显式 `=1` 才打进 assets）。
- **不再**写入 `public/audio/golden-verse-ge5-delta/`。

## 运行时

- 点播：优先本机已解压文件（若有）；否则 R2 HTTPS 直链。
- 冷启动：不暖金句 zip、不解压。
