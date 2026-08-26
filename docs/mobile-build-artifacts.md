# 移动端构建产物与磁盘清理

目标：每次打包后**只留一版**可上传/可安装的产物，避免 `dist/mobile` 堆满硬盘；同时**不伤日常开发与增量构建速度**。

## 原则（强制）

| 做 | 不做 |
|----|------|
| 构建成功后只保留 `*-latest` 各一份 | 不在每次构建时清 Gradle / Xcode DerivedData / Metro 缓存 |
| 构建结束删掉旧 APK / AAB / IPA 与 iOS export/archive 临时目录 | 不删 `node_modules`、不删离线媒体真源、不删签名材料 |
| 上传/安装一律指向 `*-latest` | 不为「留档」自动堆时间戳副本 |

**为什么不清编译缓存？**  
`android/app/build`、Xcode `DerivedData` 是增量编译加速器。每次构建都清会显著拖慢下次打包；只有磁盘告急时才手动清（见下文）。

## 保留什么

路径：`dist/mobile/`（已 gitignore，不进仓库）

| 文件 | 用途 |
|------|------|
| `askbible-android-latest.aab` | Play 上传 |
| `askbible-android-latest.apk` | 侧载 / 真机安装 |
| `askbible-ios-latest.ipa` | App Store / TestFlight |

构建脚本在成功写出上述文件后，会自动调用：

```bash
npm run mobile:prune:dist
# 等同 bash scripts/prune-mobile-dist.sh
```

也可随时手动跑一遍，不依赖刚完成的构建。

## 自动挂载点

以下脚本在产物落盘后都会 prune：

- `scripts/build-android-aab-local.sh`（`mobile:build:android:production`）
- `scripts/build-ios-ipa-xcode-local.sh`（`mobile:build:ios:production`）
- `scripts/build-mobile-apk-local.sh`（`mobile:build:apk:local`）

临时目录：iOS 的 `apps/askbible-mobile/ios/build/*.xcarchive` 与 `ios/build/export` 在 prune 时删除（下次发版会重建）。需要保留临时目录时：

```bash
MOBILE_DIST_KEEP_TEMP=1 npm run mobile:prune:dist
```

## 磁盘告急时（可选，手动）

这些**不要**接到每次构建上：

```bash
# Android Gradle 中间产物（下次 release 会变慢）
rm -rf apps/askbible-mobile/android/app/build

# Xcode DerivedData（全机共用；清后首次编译很慢）
# 仅清 AskBible 相关目录更稳妥，在 DerivedData 里按 AskBibleme / AskBible.me 前缀删

# Agent 截图等本地 QA 图（与商店包无关）
# 可按需删 .artifacts/ 下旧图；默认不自动清，避免打断排障对照
```

Metro / Expo 打包缓存仍由发版前的 `scripts/clear-mobile-bundle-cache.sh` 清理（保证旧 JS 不进包），与「库存包体积」无关。

## 与开发的关系

- 日常 `mobile:dev` / Metro / 模拟器：**不受影响**（不碰 DerivedData / Gradle 日常缓存策略）。
- 发版速度：**不受影响**（只多一次秒级 `rm`；且少写一份时间戳副本，磁盘写入更少）。
- 上传脚本已指向 `*-latest`，无需改提交流程。

## 验收

构建后 `dist/mobile` 里每种扩展名至多一个 `*-latest` 文件；旧带时间戳的 APK/AAB/IPA 应被删除。
