# AskBible.me 全局代码导航地图（自动生成）

> 由 `scripts/gen-code-map.mjs` 自动扫描源码生成（运行 `npm run map` 秒级刷新；每次 `git commit` 自动对齐）。
> **AI 使用铁律**：先查本表定位文件与精确行号，按 `start_line..end_line` 精准读取 40–100 行，严禁盲目全仓搜索或整读千行大文件。拆巨石契约见 `docs/ARCHITECTURE.md`。

---

## 1. 核心业务域直达路由表（改什么功能直接去哪）

| 业务域 | 前端视图与状态（`app/*` / `components/*` / `hooks/*`） | 数据逻辑与后端（`lib/*` / `workers/*` / `tools/*`） | 验证命令 / 单测 |
| :--- | :--- | :--- | :--- |
| **三路音频与壳层播放（音乐 · 读经 · 金句）** | 壳层播放核：`components/music/music-shell-playback-types.ts`(164L) · `components/music/MusicShellPlaybackContext.tsx`(513L) · `components/music/use-music-shell-audio-events.ts`(162L) · `components/music/use-music-shell-media-session.ts`(208L) · `components/music/use-music-shell-persistence.ts`(354L) · `components/music/use-music-shell-scripture-and-ended.ts`(606L) · `components/music/use-music-shell-sleep-and-hooks.ts`(131L)<br>全屏音乐页：`components/music/AmbientBackdrop.tsx`(168L) · `components/music/DeviceMusicLibrarySection.tsx`(256L) · `components/music/music-home-album-theme.ts`(39L) · `components/music/MusicAlbumGlyph.tsx`(35L) · `components/music/MusicHomeBackdropScene.tsx`(279L) · `components/music/MusicHomeClient.tsx`(947L) · `components/music/MusicHomeIcons.tsx`(92L) · `components/music/MusicHomeProgressBar.tsx`(81L) · `components/music/MusicHomeQueue.tsx`(229L) · `components/music/MusicHomeTransportButtonRow.tsx`(93L) · `components/music/MusicHomeVisuals.tsx`(567L) | 默认「安静」曲池：`lib/music-companion/*`<br>专辑推进：`lib/music/album-playback.ts` · `lib/music/shell-music-advance.ts`<br>媒体锁屏桥：`lib/music/shell-media-session-web.ts` | `npm test`<br>`npm run check:chapter-audio` |
| **圣经阅读 · 双语对照 · 译本与搜经** | 章页阅读：`app/(app-shell)/read/[bookId]/[chapter]/page.tsx`<br>经文渲染：`components/bible/ReadChapterVersesClient.tsx`<br>目录大纲：`components/bible/BibleCatalogReadOutline.tsx` | 译本选择：`lib/bible/pick-translation-for-locale.ts`<br>章节音频：`lib/bible/read-chapter-audio.ts`<br>静态分包：`scripts/build-static-scripture.ts` | `npm run check:scripture-data`<br>`npm run check:book-catalog` |
| **读经计划 · 今日跟读 · 灵修（Solid Joys）** | 计划总览：`app/(app-shell)/read/plans/page.tsx`<br>跟读播放：`components/bible/ReadPlanPlayClient.tsx`<br>灵修视图：`components/bible/ReadPlanDevotional.tsx` | 计划队列：`lib/read/reading-plan-chapter-queue.ts`<br>灵修交接：`lib/devotional/solid-joys.ts`<br>跟读时间轴：`tools/build-verse-timings-db.mjs` | `npm run check:reading-plan`<br>`npm run check:verse-timings` |
| **自然首页 · 金句轮播 · 羊皮卷五栏壳层（D-45）** | 首页/自然页：`components/nature/NatureVideoExperience.tsx`<br>首页仪表盘：`components/home/HomeDashboard.tsx`<br>金句轮播：`components/home/HomeVerseRotator.tsx` | 场景生成：`tools/gen-nature-scenes.mjs`<br>金句池：`lib/daily-verse/*` · `lib/golden-verses/*` | `npm run check:endpoints` |
| **探索 · 人物馆 · 历史信经 · 去游戏化藏书票** | 探索入口：`app/(app-shell)/explore/page.tsx`<br>人物馆：`app/(app-shell)/explore/figures/page.tsx`<br>藏书票：`app/(app-shell)/explore/achievements/page.tsx` | 人物数据：`lib/figures/*` · `lib/legacy-figure-preview.ts`<br>信经链接：`lib/explore/historical-creeds-scripture-links.mjs`<br>藏书票生成：`tools/gen-medals.mjs` | `npm run check:medals`<br>`npm run check:explore-articles` |
| **账号认证（OTP / Apple / Google）& 读经云同步（D-44）** | 登录页：`app/(narrow-auth)/login/page.tsx`<br>用户态：`components/auth/AskbibleUserProvider.tsx`<br>Web 代理：`app/api/sync/[...path]/route.ts` | 同步 Worker：`workers/askbible-sync/src/index.js`<br>JWKS 直验：`workers/askbible-sync/src/jwks.js`<br>单点合并：`workers/askbible-sync/src/merge.js`<br>Web 本地同步：`lib/member-reading-sync/*` | `lib/askbible-web-auth-client.test.ts` |
| **双端极薄原生壳 & 离线包热更（D-44 / D-46）** | Android：`apps/askbible-android/app/src/main/java/me/askbible/native_/MainActivity.kt`<br>iOS：`apps/askbible-ios/AskBible/AskBibleApp.swift` | 离线包构建：`tools/build-web-pack.mjs`<br>多域名选线：`tools/endpoints-sync.mjs`（`data/endpoints.json`）<br>CF 直发：`scripts/deploy-direct.sh` | `npm run check:native`<br>`npm run check:web-pack` |

- **`components/*` 模块分布**：`components/about/`(2) · `components/achievements/`(6) · `components/app-shell/`(15) · `components/auth/`(5) · `components/bible/`(62) · `components/calm/`(1) · `components/content-correction/`(1) · `components/explore/`(28) · `components/feedback/`(1) · `components/figures/`(0) · `components/home/`(16) · `components/i18n/`(3) · `components/install/`(2) · `components/legacy/`(3) · `components/media/`(1) · `components/member/`(2) · `components/music/`(18) · `components/nature/`(17) · `components/onboarding/`(2) · `components/panorama/`(2) · `components/pwa/`(3) · `components/relax/`(1) · `components/scripture/`(2) · `components/shell/`(18) · `components/site/`(5) · `components/tv/`(0) · `components/tvscreen/`(2) · `components/ui/`(3) · `components/verse/`(7)
- **`lib/*` 模块分布**：`lib/__tests__/`(1) · `lib/achievements/`(4) · `lib/admin/`(6) · `lib/ai/`(11) · `lib/auth/`(5) · `lib/bible/`(165) · `lib/content-corrections/`(2) · `lib/daily-verse/`(2) · `lib/devotional/`(2) · `lib/dom/`(3) · `lib/endpoints/`(3) · `lib/explore/`(93) · `lib/feedback/`(1) · `lib/figures/`(5) · `lib/generated/`(0) · `lib/golden-verses/`(2) · `lib/home/`(14) · `lib/home-listening/`(3) · `lib/home-prayer-pools/`(18) · `lib/http/`(1) · `lib/i18n/`(9) · `lib/media/`(1) · `lib/member-reading-sync/`(15) · `lib/music/`(14) · `lib/music-companion/`(11) · `lib/nature/`(25) · `lib/notifications/`(3) · `lib/onboarding/`(4) · `lib/prayer/`(1) · `lib/pwa/`(8) · `lib/read/`(76) · `lib/relax/`(3) · `lib/scripture/`(13) · `lib/shell/`(13) · `lib/ui/`(2) · `lib/verse/`(3) · `lib/widget/`(2)

---

## 2. >800 行源码文件精确行号目录（严禁整读，按 `L<N>` 直达）

### `apps/askbible-android/app/src/main/java/me/askbible/native_/MainActivity.kt`（共 1471 行）
- `L142` — `object VerseDeepLinkBus`
- `L144` — `fun deliver`
- `L152` — `class MainActivity`
- `L153` — `fun onCreate`
- `L180` — `fun onStart`
- `L188` — `fun onNewIntent`
- `L195` — `fun hostActivity`
- `L216` — `fun RootScreen`
- `L423` — `fun loadChapterAudioNow`
- `L445` — `fun openPlanChapter`
- `L455` — `fun listenPlanChapter`
- `L725` — `fun markPlanListened`
- `L731` — `fun planPlay`
- `L742` — `fun planRead`
- `L753` — `fun planTogglePlay`
- `L758` — `fun planNext`
- `L1468` — `fun copyText`

### `apps/askbible-ios/AskBible/AskBibleApp.swift`（共 1252 行）
- `L4` — `struct AskBibleApp`
- `L17` — `struct RootView`
- `L68` — `func openSupportMail`
- `L73` — `func applyLocaleChoice`
- `L185` — `func loadChapterAudioNow`
- `L211` — `func skipToNextChapter`
- `L252` — `func setSleepTimerAll`
- `L263` — `func toggleBookmark`
- `L271` — `func copyVerse`
- `L277` — `func chapterHighlights`
- `L286` — `func shareVerse`
- `L295` — `func openVerseByKey`
- `L314` — `func showToast`
- `L325` — `func openToday`
- `L330` — `func openPlanChapter`
- `L340` — `func listenPlanChapter`
- `L385` — `func markPlanListened`
- `L392` — `func planPlay`
- `L404` — `func planRead`
- `L416` — `func planTogglePlay`
- `L422` — `func planNext`
- `L427` — `func startPlanFlow`
- `L594` — `func bookLabel`
- `L878` — `func checkUpdatesManually`

### `components/nature/NatureVideoExperience.tsx`（共 1197 行）
- `L72` — `const NATURE_SCENE_DWELL_MS`
- `L75` — `const NATURE_VERSE_FIT_COMPRESS_MIN`
- `L87` — `const NATURE_VIDEO_STAGE_FRAME`
- `L91` — `const NATURE_BG_COVER_MEDIA`
- `L95` — `const INTRO_REVEAL_MIN_DELAY_MS`
- `L98` — `function isNatureVideoFullyLoaded`
- `L112` — `const SLOW_INTRO_HINT_DELAY_MS`
- `L114` — `const PLAYBACK_WAIT_HINT_DELAY_MS`
- `L117` — `const HOME_CHROME_AUTO_HIDE_MS`
- `L122` — `export function NatureVideoExperience`
- `L283` — `selectScene` (callback/handler)
- `L305` — `onSelectLoopAll` (callback/handler)
- `L314` — `onToggleAmbientSlot` (callback/handler)
- `L456` — `clearPlaybackWaitHint` (callback/handler)
- `L464` — `schedulePlaybackWaitHint` (callback/handler)
- `L472` — `commitIntroReveal` (callback/handler)
- `L487` — `maybeRevealIntroFromBuffer` (callback/handler)
- `L508` — `onTimeUpdatePollIntroReveal` (callback/handler)
- `L836` — `onNatureVideoBlankClick` (callback/handler)
- `L863` — `onNatureHomePrefsChanged` (callback/handler)
- `L868` — `onToggleLiveVideo` (callback/handler)

### `components/bible/ReadChapterVersesClient.tsx`（共 1172 行）
- `L56` — `function useVerseLongPress`
- `L125` — `export function ReadChapterVersesClient`
- `L402` — `scrollVerseIntoReadableCenter` (callback/handler)
- `L464` — `runToggleBookmarkFromMenu` (callback/handler)
- `L505` — `runInstantPickColor` (callback/handler)
- `L523` — `openShareCardFromMenu` (callback/handler)
- `L565` — `cancelVerseSelectionMode` (callback/handler)
- `L570` — `toggleSelectedVerse` (callback/handler)
- `L576` — `copySelectedVerses` (callback/handler)
- `L600` — `shareCurrentVerse` (callback/handler)
- `L945` — `function ReadChapterInlineVerseChunk`
- `L1048` — `function ReadChapterVerseParagraph`
- `L1169` — `function verseHasSearchKeyword`

### `apps/askbible-android/app/src/main/java/me/askbible/native_/ui/NativeMediaBridge.kt`（共 1153 行）
- `L72` — `class NativeMediaBridge`
- `L195` — `fun configureWebView`
- `L288` — `fun loadInlinePack`
- `L316` — `fun loadLocalPack`
- `L324` — `fun beginWatchdogIfHotPack`
- `L348` — `fun cancelWatchdog`
- `L353` — `fun release`
- `L362` — `fun emit`
- `L371` — `fun emitKeyboardHeight`
- `L387` — `fun emitAudioState`
- `L393` — `fun emitTabSelected`
- `L399` — `fun emitBackPressed`
- `L403` — `fun emitPackReadyToSwap`
- `L410` — `fun callBridge`
- `L600` — `fun resolveBridgeOk`
- `L611` — `fun resolveBridgeErr`
- `L624` — `fun postMessage`
- `L664` — `fun markBootHealthy`
- `L672` — `fun handleAudioIntent`
- `L746` — `fun buildAudioStateJson`
- `L795` — `fun triggerHaptic`
- `L828` — `fun readSessionJson`
- `L849` — `fun userToJson`
- `L858` — `fun shareImageOrText`

### `lib/explore/years-days-eternity-content.ts`（共 1131 行）
- `L3` — `const YEARS_DAYS_ETERNITY_ZH`

### `components/music/MusicHomeClient.tsx`（共 947 行）
- `L60` — `const DEFAULT_ALBUM`
- `L61` — `const MUSIC_UI_AUTO_HIDE_MS`
- `L65` — `function pickScene`
- `L75` — `function formatNowClock`
- `L83` — `function formatTime`
- `L90` — `function initialSceneIndex`
- `L101` — `function computeRandomTrackPoolIdx`
- `L107` — `function urlsEqual`
- `L119` — `function MusicHomeTrackFromQuery`
- `L142` — `function countTracksWithSrc`
- `L146` — `export function MusicHomeClient`
- `L186` — `bumpUserSkip` (callback/handler)
- `L361` — `selectTrack` (callback/handler)
- `L373` — `selectAlbum` (callback/handler)
- `L452` — `resetUiAutoHide` (callback/handler)
- `L506` — `onLandscapeStageToggle` (callback/handler)
- `L555` — `onPrev` (callback/handler)
- `L565` — `onNext` (callback/handler)
- `L571` — `onMusicSwipe` (callback/handler)
- `L585` — `cycleSleepTimer` (callback/handler)

### `apps/askbible-android/app/src/main/java/me/askbible/native_/ui/DevotionalScreen.kt`（共 931 行）
- `L75` — `fun zh`
- `L78` — `fun minutesLabel`
- `L85` — `fun DevotionalCard`
- `L251` — `fun DevotionalScreen`
- `L772` — `fun DevotionalMonthPill`
- `L801` — `fun DevotionalAudioBar`
- `L837` — `fun DevotionalProgress`
- `L878` — `fun DevotionalDock`
- `L928` — `fun clock`

### `lib/legacy-figure-preview.ts`（共 883 行）
- `L16` — `export type LegacyFigureArticle`
- `L25` — `export type LegacyFigureProfile`
- `L63` — `function readRoot`
- `L69` — `export function readLegacyFigurePreviewStats`
- `L73` — `export function readLegacyFigureProfiles`
- `L77` — `export function readLegacyFigureOrphanArticles`
- `L81` — `export function readLegacyFigureProfileBySlug`
- `L97` — `export function readLegacyFigureOrphanArticleBySlug`
- `L106` — `const ORPHAN_ARTICLE_PROFILE_BINDINGS`
- `L123` — `function displayNameFromArticleTitle`
- `L128` — `function profileFromOrphanArticle`
- `L155` — `function makeLegacyFigureArticle`
- `L171` — `const JUDAH_OT_ARTICLE`
- `L212` — `const JUDE_AUTHOR_ARTICLE`
- `L250` — `function isMergedJudahProfile`
- `L254` — `function expandJudahProfiles`
- `L334` — `function isMergedPharaohProfile`
- `L338` — `function expandPharaohProfiles`
- `L421` — `function isMergedJosephProfile`
- `L425` — `const GOSPEL_JOSEPH_ARTICLE`
- `L459` — `function expandJosephProfiles`
- `L520` — `function isMergedZechariahProfile`
- `L524` — `const ZECHARIAH_LUKE_ARTICLE`
- `L543` — `function expandZechariahProfiles`

### `apps/askbible-ios/AskBible/Read/DevotionalView.swift`（共 868 行）
- `L5` — `struct DevotionalCard`
- `L156` — `struct DevotionalCatalogView`
- `L296` — `func topBar`
- `L369` — `func activeDayCard`
- `L565` — `func monthPill`
- `L588` — `func monthSectionHeader`
- `L600` — `func dayCatalogRow`
- `L710` — `struct DevotionalAudioBar`
- `L782` — `func formatClock`
- `L789` — `struct DevotionalDock`

### `components/bible/ReadPlanDevotional.tsx`（共 868 行）
- `L34` — `function formatClock`
- `L41` — `function shiftMdByDays`
- `L48` — `export function ReadPlanDevotional`
- `L229` — `export function ReadPlanDevotionalCatalog`
- `L250` — `scrollToTopCard` (callback/handler)
- `L308` — `playDay` (callback/handler)
- `L768` — `export function ReadDevotionalPlaybackDock`

### `lib/bible/scripture-book-notes.ts`（共 810 行）
- `L1` — `export type ScriptureBookSpiritualFrame`
- `L7` — `export type ScriptureBookNote`
- `L17` — `export const scriptureBookNotes`

---

## 3. Cloudflare Workers & D1 数据库全图

### A. `workers/askbible-sync` 认证与读经同步路由（自动扫描 `workers/askbible-sync/src/index.js`）
- `GET /healthz.txt` → `workers/askbible-sync/src/index.js`(L269)
- `GET /health` → `workers/askbible-sync/src/index.js`(L269)
- `GET /` → `workers/askbible-sync/src/index.js`(L269)
- `POST /v1/auth/otp/send` → `workers/askbible-sync/src/index.js`(L277)
- `POST /v1/auth/otp/verify` → `workers/askbible-sync/src/index.js`(L323)
- `POST /v1/auth/oauth/apple` → `workers/askbible-sync/src/index.js`(L381)
- `POST /v1/auth/oauth/google` → `workers/askbible-sync/src/index.js`(L381)
- `GET /v1/auth/session` → `workers/askbible-sync/src/index.js`(L407)
- `PATCH /v1/auth/profile` → `workers/askbible-sync/src/index.js`(L414)
- `POST /v1/auth/logout` → `workers/askbible-sync/src/index.js`(L439)
- `DELETE /v1/auth/account` → `workers/askbible-sync/src/index.js`(L448)
- `ANY /v1/sync/reading` → `workers/askbible-sync/src/index.js`(L465)
- `POST /v1/feedback` → `workers/askbible-sync/src/index.js`(L535)
- `POST /v1/corrections` → `workers/askbible-sync/src/index.js`(L535)
- `GET /v1/mcp/summary` → `workers/askbible-sync/src/index.js`(L556)
- `ANY /v1/mcp/proposals` → `workers/askbible-sync/src/index.js`(L605)
- 边缘代理 Worker：`workers/site-proxy/worker.js`（白名单路径透传上游 + `/healthz.txt` 探针）
- Web 主站 Worker 配置：`cloudflare.config.ts`（Worker 名 `askbible-web`，Service Binding `ASKBIBLE_SYNC`）

### B. D1 数据库表结构速查（自动扫描 `workers/askbible-sync/schema.sql`）
| 表名 | 定义行号 | 主键 (PK) | 关键列摘要 |
| :--- | :--- | :--- | :--- |
| `users` | L1 | `id` | `id`, `email`, `display_name`, `locale`, `is_admin`, `created_at`, `updated_at` |
| `otp_codes` | L13 | `email` | `email`, `code_hash`, `expires_at`, `attempts`, `created_at` |
| `sessions` | L21 | `token_hash` | `token_hash`, `user_id`, `email`, `device_id`, `device_name`, `platform`, `expires_at`, `created_at` 等 9 列 |
| `reading_sync_docs` | L35 | `user_id` | `user_id`, `schema_version`, `revision`, `blobs_json`, `updated_at` |
| `feedback_items` | L43 | `id` | `id`, `kind`, `email`, `locale`, `payload_json`, `created_at` |
| `mcp_proposals` | L55 | `id` | `id`, `user_id`, `action`, `payload_json`, `summary`, `source_agent`, `status`, `created_at` 等 9 列 |

---

## 4. Next.js / vinext 页面路由与 API 路由全表

### A. App Router 页面入口（共 47 个页面）
| URL 路径（含路由组） | 页面源文件 |
| :--- | :--- |
| `/about` (app-shell) | `app/(app-shell)/(narrow-parchment)/about/page.tsx` |
| `/feedback` (app-shell) | `app/(app-shell)/(narrow-parchment)/feedback/page.tsx` |
| `/install` (app-shell) | `app/(app-shell)/(narrow-parchment)/install/page.tsx` |
| `/joshmoney/privacy` (app-shell) | `app/(app-shell)/(narrow-parchment)/joshmoney/privacy/page.tsx` |
| `/privacy` (app-shell) | `app/(app-shell)/(narrow-parchment)/privacy/page.tsx` |
| `/dev/legacy-articles/[slug]` (app-shell) | `app/(app-shell)/dev/legacy-articles/[slug]/page.tsx` |
| `/dev/legacy-articles` (app-shell) | `app/(app-shell)/dev/legacy-articles/page.tsx` |
| `/explore/[stagedEntry]` (app-shell) | `app/(app-shell)/explore/[stagedEntry]/page.tsx` |
| `/explore/achievements` (app-shell) | `app/(app-shell)/explore/achievements/page.tsx` |
| `/explore/articles/[slug]` (app-shell) | `app/(app-shell)/explore/articles/[slug]/page.tsx` |
| `/explore/figures/[slug]` (app-shell) | `app/(app-shell)/explore/figures/[slug]/page.tsx` |
| `/explore/figures/article/[slug]` (app-shell) | `app/(app-shell)/explore/figures/article/[slug]/page.tsx` |
| `/explore/figures` (app-shell) | `app/(app-shell)/explore/figures/page.tsx` |
| `/explore/historical-creeds` (app-shell) | `app/(app-shell)/explore/historical-creeds/page.tsx` |
| `/explore/narrow-gate` (app-shell) | `app/(app-shell)/explore/narrow-gate/page.tsx` |
| `/explore` (app-shell) | `app/(app-shell)/explore/page.tsx` |
| `/explore/praise-worship` (app-shell) | `app/(app-shell)/explore/praise-worship/page.tsx` |
| `/explore/prayer` (app-shell) | `app/(app-shell)/explore/prayer/page.tsx` |
| `/explore/reading-planner` (app-shell) | `app/(app-shell)/explore/reading-planner/page.tsx` |
| `/explore/year-day-count` (app-shell) | `app/(app-shell)/explore/year-day-count/page.tsx` |
| `/explore/years-days-eternity` (app-shell) | `app/(app-shell)/explore/years-days-eternity/page.tsx` |
| `/index` (app-shell) | `app/(app-shell)/index/page.tsx` |
| `/journey` (app-shell) | `app/(app-shell)/journey/page.tsx` |
| `/music` (app-shell) | `app/(app-shell)/music/page.tsx` |
| `/nature` (app-shell) | `app/(app-shell)/nature/page.tsx` |
| `/offline` (app-shell) | `app/(app-shell)/offline/page.tsx` |
| `/panorama` (app-shell) | `app/(app-shell)/panorama/page.tsx` |
| `/read/[bookId]/[chapter]` (app-shell) | `app/(app-shell)/read/[bookId]/[chapter]/page.tsx` |
| `/read/catalog` (app-shell) | `app/(app-shell)/read/catalog/page.tsx` |
| `/read/favorites` (app-shell) | `app/(app-shell)/read/favorites/page.tsx` |
| `/read` (app-shell) | `app/(app-shell)/read/page.tsx` |
| `/read/plan-play` (app-shell) | `app/(app-shell)/read/plan-play/page.tsx` |
| `/read/plans/[planId]` (app-shell) | `app/(app-shell)/read/plans/[planId]/page.tsx` |
| `/read/plans` (app-shell) | `app/(app-shell)/read/plans/page.tsx` |
| `/read/read` (app-shell) | `app/(app-shell)/read/read/page.tsx` |
| `/read/search` (app-shell) | `app/(app-shell)/read/search/page.tsx` |
| `/read/translations` (app-shell) | `app/(app-shell)/read/translations/page.tsx` |
| `/relax` (app-shell) | `app/(app-shell)/relax/page.tsx` |
| `/scenes` (app-shell) | `app/(app-shell)/scenes/page.tsx` |
| `/template` (app-shell) | `app/(app-shell)/template/page.tsx` |
| `/verse` (app-shell) | `app/(app-shell)/verse/page.tsx` |
| `/web` (app-shell) | `app/(app-shell)/web/page.tsx` |
| `/welcome` (app-shell) | `app/(app-shell)/welcome/page.tsx` |
| `/login` (narrow-auth) | `app/(narrow-auth)/login/page.tsx` |
| `/` (site) | `app/(site)/page.tsx` |
| `/app` | `app/app/page.tsx` |
| `/tv` | `app/tv/page.tsx` |

### B. Web API 路由入口（共 43 个接口）
| API 路径 | HTTP 方法 | 路由源文件 |
| :--- | :--- | :--- |
| `/.well-known/mcp.json` | `GET` | `app/.well-known/mcp.json/route.ts` |
| `/.well-known/openai-apps-challenge` | `GET` | `app/.well-known/openai-apps-challenge/route.ts` |
| `/api/app-build` | `GET` | `app/api/app-build/route.ts` |
| `/api/golden-verses/backgrounds` | `GET` | `app/api/golden-verses/backgrounds/route.ts` |
| `/api/golden-verses/upload-image` | `POST` | `app/api/golden-verses/upload-image/route.ts` |
| `/api/health` | `GET` `HEAD` | `app/api/health/route.ts` |
| `/api/home/bible-translations-catalog` | `GET` | `app/api/home/bible-translations-catalog/route.ts` |
| `/api/mcp` | - | `app/api/mcp/route.ts` |
| `/api/mobile/bible/translations` | `GET` | `app/api/mobile/bible/translations/route.ts` |
| `/api/mobile/bible/youversion/books` | `GET` | `app/api/mobile/bible/youversion/books/route.ts` |
| `/api/mobile/bible/youversion/catalog` | `GET` | `app/api/mobile/bible/youversion/catalog/route.ts` |
| `/api/mobile/bible/youversion/chapter` | `GET` | `app/api/mobile/bible/youversion/chapter/route.ts` |
| `/api/mobile/content/flags` | `GET` | `app/api/mobile/content/flags/route.ts` |
| `/api/mobile/content/manifest` | `GET` | `app/api/mobile/content/manifest/route.ts` |
| `/api/mobile/explore/featured-articles` | `GET` | `app/api/mobile/explore/featured-articles/route.ts` |
| `/api/mobile/explore/legacy-figures` | `GET` | `app/api/mobile/explore/legacy-figures/route.ts` |
| `/api/mobile/explore/modules` | `GET` | `app/api/mobile/explore/modules/route.ts` |
| `/api/mobile/resource-pack/chapter-audio/manifest` | `GET` | `app/api/mobile/resource-pack/chapter-audio/manifest/route.ts` |
| `/api/mobile/resource-pack/music/manifest` | `GET` | `app/api/mobile/resource-pack/music/manifest/route.ts` |
| `/api/mobile/resource-pack/nature/manifest` | `GET` | `app/api/mobile/resource-pack/nature/manifest/route.ts` |
| `/api/music/companion` | `GET` `POST` | `app/api/music/companion/route.ts` |
| `/api/music/upload-image` | `POST` | `app/api/music/upload-image/route.ts` |
| `/api/music/upload` | `POST` | `app/api/music/upload/route.ts` |
| `/api/nature/prefetch-srcs` | `GET` | `app/api/nature/prefetch-srcs/route.ts` |
| `/api/nature/settings` | `GET` `POST` | `app/api/nature/settings/route.ts` |
| `/api/nature/upload-audio` | `POST` | `app/api/nature/upload-audio/route.ts` |
| `/api/nature/upload-thumb` | `POST` | `app/api/nature/upload-thumb/route.ts` |
| `/api/nature/upload` | `POST` | `app/api/nature/upload/route.ts` |
| `/api/read/chapter-audio` | `GET` | `app/api/read/chapter-audio/route.ts` |
| `/api/read/chapter-segments` | `GET` | `app/api/read/chapter-segments/route.ts` |
| `/api/read/chapter` | `GET` | `app/api/read/chapter/route.ts` |
| `/api/read/info-edition-v1` | `GET` `POST` | `app/api/read/info-edition-v1/route.ts` |
| `/api/read/markdown` | `GET` | `app/api/read/markdown/route.ts` |
| `/api/read/reading-plan/[planId]` | `GET` | `app/api/read/reading-plan/[planId]/route.ts` |
| `/api/read/reading-plans/registry` | `GET` | `app/api/read/reading-plans/registry/route.ts` |
| `/api/read/verse-snippets` | `POST` | `app/api/read/verse-snippets/route.ts` |
| `/api/sync/[...path]` | `GET` `POST` `PATCH` `DELETE` `OPTIONS` | `app/api/sync/[...path]/route.ts` |
| `/api/tv-report` | `POST` | `app/api/tv-report/route.ts` |
| `/llms-full.txt` | `GET` | `app/llms-full.txt/route.ts` |
| `/llms.txt` | `GET` | `app/llms.txt/route.ts` |
| `/manifest.webmanifest` | `GET` | `app/manifest.webmanifest/route.ts` |
| `/mcp` | `OPTIONS` `GET` `POST` | `app/mcp/route.ts` |
| `/sitemap.xml` | `GET` | `app/sitemap.xml/route.ts` |

---

## 5. 跨端数据生成与自检工具链（`tools/*`）

| 脚本路径 | 行数 | 职责摘要 |
| :--- | :--- | :--- |
| `tools/askbible-jsx-source-plugin.mjs` | 125 | const HOST_TAGS = new Set([ |
| `tools/askbible-mcp-stdio.mjs` | 104 | AskBible.me · Local Stdio MCP Server（供 Claude Desktop / Cursor / Codex / |
| `tools/book-catalog-parity.mjs` | 102 | 圣经目录三端对拍：书卷号 / id / 中文名 / 章数。 |
| `tools/build-app-pack.mjs` | 427 | D-47 同源纯静态内核热更包清单生成器与校验门禁（pack-manifest.json） |
| `tools/build-verse-timings-db.mjs` | 81 | 从真源 `public/verse-timings/`（cuv-v20 / cuv-simp 根级 / web-en）直接生成原生侧 SQLit |
| `tools/build-web-pack.mjs` | 766 | D-44 同源离线 UI 胶囊生成器（web-pack.json） |
| `tools/chapter-audio-check.mjs` | 112 | 整章朗读音源自检。 |
| `tools/check-contracts.mjs` | 372 | D-47 三端 NativeBridge 双向契约与热更协议静态门禁（tools/check-contracts.mjs） |
| `tools/endpoints-live-check.mjs` | 58 | 防封换线的联网自检（docs/anti-block-endpoints.md）。要联网，所以不进 check:native。 |
| `tools/endpoints-sync.mjs` | 91 | 防封换线的候选域表（docs/anti-block-endpoints.md、DECISIONS D-20）。 |
| `tools/gen-achievement-sfx.py` | 89 | AskBible 成就音效合成。 |
| `tools/gen-chapter-segments.mts` | 61 | 章节分段（小标题 + 段落起点）→ 两端静态 JSON。 |
| `tools/gen-explore-articles.mjs` | 117 | 探索页精选文章（查经资料）→ 两端原生。 |
| `tools/gen-info-edition.mjs` | 25 | 「读后两版」插画（陪你探索 / 查找资料）→ 两端原生。 |
| `tools/gen-language-names.mjs` | 46 | 重新生成 data/youversion-language-names.json。 |
| `tools/gen-language-order.mjs` | 78 | 译本面板语言行的排序表 → 两端静态表。 |
| `tools/gen-locale-tables.mts` | 108 | 语言展示用的静态表 → 两端（Swift / Kotlin）： |
| `tools/gen-medals.mjs` | 239 | 成就系统的勋章 / 等级 / XP 表（DECISIONS「成就系统：复用 MY CLASS 勋章图」「XP 要一直在涨」）。 |
| `tools/gen-music-catalog.mjs` | 138 | 从 RN 的 assets/content/music-companion.json 生成两端的音乐曲库（MusicCatalog.swift  |
| `tools/gen-nature-scenes.mjs` | 95 | 首页自然场景素材 + 场景表： |
| `tools/gen-reading-plans.mjs` | 182 | 读经计划目录 + 文案 → 两端静态表；日课表 JSON 原样拷进两端包。 |
| `tools/gen-site-copy.mjs` | 159 | 原生两端共用的界面文案表 SiteCopy（简 / 英；繁体运行时由 ZhTw 转）。 |
| `tools/gen-solid-joys.py` | 208 | 纯全喜乐（约翰·派博每日灵修，忠信福音事工中文版）：58 个 Word 稿 → 365 天的 JSON。 |
| `tools/gen-translation-catalog.mts` | 148 | 译本目录 → 两端静态表。真源就是 RN 生产环境实际用的那份： |
| `tools/reading-plan-check.mjs` | 97 | 读经计划三方对拍（TS 共享库 ↔ Swift ↔ Kotlin）。 |
| `tools/reading-plan-expect.mts` | 101 | TS 侧期望值：直接调共享库 lib/bible/reading-plans/* 与 lib/read/*（tsx + tsconfig pat |
| `tools/reading-plan-usability-check.mjs` | 82 | 读经计划可用性：12 个计划的每一天、每一段，逐章对着四个内置译本库核对—— |
| `tools/scripture-data-check.mjs` | 60 | 原生数据层自检：四个内置译本 + xref 库能否打开、内容是否确实不同、章数是否正确。 |
| `tools/sync-kernel-data.mjs` | 706 | D-47 真源数据同步：从仓库唯一真源 `data/` 提取并生成轻量化、标准化的 |
| `tools/verse-timing-check.mjs` | 104 | 跟读时间轴自检：SQLite 查询 + 由播放位置定位当前节的算法。 |
