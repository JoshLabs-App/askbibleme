# 每日灵修续播：多渠道更新

用户 2026-11-09 明确要求更新全部现有渠道，包括网页、iPhone、安卓商店版与安卓下载版。

## 原生渠道

- iOS 1.1.9 (142)：本机 Xcode archive/export，IPA 检查 bundle ID、版本与后台音频声明通过；上传 delivery `7abd3595-0ba5-45ce-b39a-4c2d705e6a7b`，已提交 App Store 审核（批准后自动发布）。同一 build 142 已加入 External Testers 并提交外部 Beta 审核。App Store 旧版本 1.1.8 (141) 在新版本批准前继续服务。
- Android 1.0.56 (253)：本机 Gradle 构建，下载页与 `version.json` 已更新；下载回来的最终 APK 通过 aapt2 版本核对，并确认包含 `PlanDevotionalHandoff`。同版本 AAB 已由 fastlane supply 提交 Play production，API 返回 versionCode 253、status completed。上一个 Play production 是 1.0.55 (252)。
- 现有中文管理员可见范围、授权文字与原始音频源保持一致。原生功能验收见 `docs/native-devotional-handoff.md`。

## 网页

- 计划页新增今日灵修卡片与“读经后接着听”开关，默认关闭，本机保存。正文展开后显示出处、作者与译文/音频署名。
- 音频复用壳层唯一播放器；仅当天计划末章自然完成后衔接。手动跳章不触发；灵修音频结束后停播。异步加载后再次检查当前音源、偏好、日期和账号范围，避免晚到请求覆盖新操作。
- 开始播放前先建立计划意图，防止章节导航先清除计划标志而丢失自动衔接。
- TypeScript 全量检查与规则测试通过。浏览器集成验收使用虚构管理员身份及短音频夹具，验证开关重载保存、末章自然续播、关闭不续播、手动跳章不续播、匿名用户不可见；截图人工检查。真实灵修音频带标记 URL 已单独验证 HTTP 200。
- 网页仅本机构建、上传预构建产物；发布后核对 `/app-build.json` 和实际计划页。
- 发布前 Vercel 回滚部署：`dpl_5Lm4wacNavtVvAp21AhvJJHCZhT7`，`askbibleme-h8gu6xiso-joshlabsapp.vercel.app`。回滚保留在 Vercel，不另留本地旧构建。

审核状态和实际发布回执以渠道 API 为准；“上传/提交”不等于已经通过商店审核。
