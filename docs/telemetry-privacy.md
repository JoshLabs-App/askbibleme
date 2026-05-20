# 产品使用统计（Telemetry）隐私说明

面向创始人与部署；用户端不展示追踪提示（无第三方广告追踪）。

## 收集什么

- **匿名设备 ID**：首次打开时在本机生成 UUID，不上传邮箱、姓名、账号 ID。
- **使用事件**（白名单）：页面浏览、底栏 Tab、少量按钮点击、自然场景查看/停留时长、读经章打开（书卷 ID + 章号，**无**经文正文）、音乐曲目播放/时长。
- **环境元数据**：平台（web / iOS / Android）、App 版本、语言（若可得）。

## 不收集什么

- 经文内容、搜索关键词、书签列表、登录凭据、精确 GPS、广告 ID。
- 跨站追踪；不向第三方分析 SDK 发送数据。

## 存储与保留

**默认与信息版相同（推荐，无需 Supabase）：**

- 本机：`data/bible/telemetry-v1-store.json`
- Render 持久盘：`<DATA_ROOT>/telemetry-v1-store.json`（需已配置 `INFO_EDITION_DISK_SAVE` + `DATA_ROOT`）
- 文件内为按日聚合（DAU、页面/点击/场景排行），保留约 90 天

**可选：** 若已配置 `SUPABASE_SERVICE_ROLE_KEY` 且未挂磁盘，则写入 Supabase 表（见 `supabase/migrations/20260519000000_telemetry_events.sql`）。

## 离线行为

- 事件先入队（Web：`localStorage`；App：`AsyncStorage`），有网后批量 `POST /api/telemetry/ingest`。
- 机内已下载的场景视频仍会记录 `scene_view` / `scene_session`（与是否 CDN 拉流无关）。

## 关闭采集

- Web：`NEXT_PUBLIC_TELEMETRY_DISABLED=1`
- Mobile：`EXPO_PUBLIC_TELEMETRY_DISABLED=1`

## 正式 App 构建（EAS）

机内资源与统计分开：**可保持** `EXPO_PUBLIC_MOBILE_BUNDLED_ONLY=1`（经文/场景走 APK 包内），同时有网时上报到 `https://askbible.me/api/telemetry/ingest`。

[`apps/selah-mobile/eas.json`](../apps/selah-mobile/eas.json) 的 `preview` / `production` 已默认：

- `EXPO_PUBLIC_MOBILE_BUNDLED_ONLY=1`
- `EXPO_PUBLIC_ASKBIBLE_BASE_URL=https://askbible.me`
- **不要**设 `EXPO_PUBLIC_TELEMETRY_DISABLED=1`（设了则正式包也不统计）

重新打安装包后，用户打开 App 的数据会进线上 Render 盘的 `telemetry-v1-store.json`，在 `/admin/system/usage` 查看。

## 管理查看

- `/admin/system/usage`（需现有管理后台权限 + Supabase service role）。
