# 产品使用统计（Telemetry）隐私说明

面向创始人与部署；仅做匿名基础统计，不做第三方广告追踪。

## 默认策略（当前）

- **默认关闭**：移动端首次安装后，统计开关默认不启用。
- **同意后启用**：首次启动会出现同意弹窗，只有用户点「允许」才开始采集匿名事件。
- **可随时关闭**：用户可在 App 左侧菜单的隐私区随时关闭匿名统计。
- **无广告追踪**：不接入广告标识，不做跨 App/跨站追踪（`NSPrivacyTracking=false`）。

## 收集什么

- **匿名设备 ID**：首次打开时在本机生成 UUID，不上传邮箱、姓名、账号 ID。
- **使用事件**（白名单）：页面浏览、底栏 Tab、少量按钮点击、自然场景查看/停留时长、读经章打开（书卷 ID + 章号，**无**经文正文）、音乐曲目播放/时长。
- **环境元数据**：平台（web / iOS / Android）、App 版本、语言（若可得）。

## 不收集什么

- 经文内容、搜索关键词、书签列表、登录凭据、精确 GPS、广告 ID。
- 跨站追踪；不向第三方分析 SDK 发送数据。

## 存储与保留

**默认与信息版相同（推荐）：**

- 本机：`data/bible/telemetry-v1-store.json`
- Render 持久盘：`<DATA_ROOT>/telemetry-v1-store.json`（需已配置 `INFO_EDITION_DISK_SAVE` + `DATA_ROOT`）
- 文件内为按日聚合（DAU、页面/点击/场景排行），保留约 90 天

## 离线行为

- 事件先入队（Web：`localStorage`；App：`AsyncStorage`），有网后批量 `POST /api/telemetry/ingest`。
- 机内已下载的场景视频仍会记录 `scene_view` / `scene_session`（与是否 CDN 拉流无关）。

## 关闭采集

- Web：`NEXT_PUBLIC_TELEMETRY_DISABLED=1`
- Mobile：`EXPO_PUBLIC_TELEMETRY_DISABLED=1`

## 正式 App 构建（EAS）

机内资源与统计分开：**可保持** `EXPO_PUBLIC_MOBILE_BUNDLED_ONLY=1`（经文/场景走 APK 包内），同时有网时上报到 `https://askbible.me/api/telemetry/ingest`。

[`apps/askbible-mobile/eas.json`](../apps/askbible-mobile/eas.json) 的 `preview` / `production` 已默认：

- `EXPO_PUBLIC_MOBILE_BUNDLED_ONLY=1`
- `EXPO_PUBLIC_ASKBIBLE_BASE_URL=https://askbible.me`
- **不要**设 `EXPO_PUBLIC_TELEMETRY_DISABLED=1`（设了则正式包也不统计）

重新打安装包后，用户打开 App 的数据会进线上 Render 盘的 `telemetry-v1-store.json`，在 `/admin/system/usage` 查看。

## 管理查看

- `/admin/system/usage`（需现有管理后台权限）。
