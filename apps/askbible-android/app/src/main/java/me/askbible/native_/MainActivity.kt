package me.askbible.native_

import me.askbible.native_.data.SiteCopy
import me.askbible.native_.data.TranslationDownloader
import me.askbible.native_.data.ChapterLoader
import me.askbible.native_.data.name
import me.askbible.native_.data.ReadChrome
import me.askbible.native_.data.ReadDisplayLocale
import me.askbible.native_.data.AppLocale
import androidx.compose.ui.platform.LocalConfiguration
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import me.askbible.native_.audio.ChapterAudioPlayer
import me.askbible.native_.audio.AmbientPlayer
import me.askbible.native_.audio.MusicPlayer
import me.askbible.native_.home.HomeVerseController
import me.askbible.native_.home.NatureHomePrefs
import me.askbible.native_.data.NatureScenes
import me.askbible.native_.home.ReadingPlanStore
import me.askbible.native_.data.PlanPlay
import me.askbible.native_.data.PlanPointer
import me.askbible.native_.ui.PlansListScreen
import me.askbible.native_.ui.PlanDetailScreen
import me.askbible.native_.ui.PlanPlayScreen
import me.askbible.native_.ui.RegisterScreen
import me.askbible.native_.ui.LoginScreen
import kotlinx.coroutines.launch
import me.askbible.native_.data.MemberAuthStore
import me.askbible.native_.data.MemberReadingSyncEngine
import me.askbible.native_.data.ReadingActivityStore
import me.askbible.native_.data.OAuthCallbackBus
import java.time.LocalDate
import androidx.compose.runtime.mutableIntStateOf
import me.askbible.native_.data.BookRef
import androidx.compose.foundation.layout.navigationBarsPadding
import me.askbible.native_.ui.VerseShareText
import me.askbible.native_.ui.VerseFeedbackToast
import me.askbible.native_.ui.VerseActionSheet
import me.askbible.native_.ui.FavoritesScreen
import me.askbible.native_.ui.SearchScreen
import me.askbible.native_.data.VerseBookmarkStore
import me.askbible.native_.data.SearchPrefs
import me.askbible.native_.data.SearchChapterRef
import me.askbible.native_.data.ExploreArticle
import me.askbible.native_.data.ExploreArticles
import me.askbible.native_.data.ChapterAudioSource
import me.askbible.native_.data.GoldenVerse
import me.askbible.native_.data.LoadedVerse
import me.askbible.native_.data.ReadSize
import me.askbible.native_.data.ScriptureDatabase
import me.askbible.native_.data.ScriptureTranslation
import me.askbible.native_.data.TranslationPrefs
import me.askbible.native_.data.ShellMetrics
import me.askbible.native_.data.XrefDatabase
import me.askbible.native_.ui.CatalogScreen
import me.askbible.native_.ui.ChapterPickerSheet
import me.askbible.native_.ui.ChapterScreen
import me.askbible.native_.ui.ExploreScreen
import me.askbible.native_.ui.HomeScreen
import me.askbible.native_.ui.MusicScreen
import me.askbible.native_.ui.ParchmentBackground
import me.askbible.native_.ui.ParchmentPinnedBottom
import me.askbible.native_.ui.PlaybackDock
import me.askbible.native_.ui.ShellTab
import me.askbible.native_.ui.ShellTabBar
import me.askbible.native_.ui.shellTabBarBottomInset
import me.askbible.native_.ui.TranslationPanel
import me.askbible.native_.ui.VerseXrefSheet
import me.askbible.native_.ui.SleepTimerSheet
import me.askbible.native_.data.VerseXrefs
import me.askbible.native_.data.BibleCatalog

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // 全量在线译本目录先读盘：记住的远端译本要在 TranslationPrefs 解析之前就认得
        me.askbible.native_.data.RemoteTranslations.attach(cacheDir)
        OAuthCallbackBus.deliver(intent?.dataString)
        setContent { RootScreen() }
    }

    /** 浏览器 OAuth 回调（askbible://auth/callback?code=…）：singleTask 下回到这里 */
    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        OAuthCallbackBus.deliver(intent.dataString)
    }
}

private data class ChapterData(
    val verses: List<LoadedVerse> = emptyList(),
    val xrefs: Set<Int> = emptySet(),
    /** 副译本对照：节号 → 文本 */
    val contrast: Map<Int, String> = emptyMap(),
    /** 在线 / 下载型译本取数中 */
    val loading: Boolean = false,
    /** 取不到（没网 / 抓不到页） */
    val failed: Boolean = false,
)

@Composable
private fun RootScreen() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var tab by remember { mutableStateOf(ShellTab.HOME) }
    var size by remember { mutableStateOf(ReadSize.DEFAULT) }
    // 译本选择跨启动记住（RN selah_read_bible_translation_v1）
    val translationPrefs = remember { TranslationPrefs(context) }
    // 下载型译本（KJV）的下载器；在线译本逐章抓取见 RemoteChapterStore
    val downloader = remember { TranslationDownloader(context) }
    var reloadToken by remember { mutableIntStateOf(0) }
    val storedTranslation = remember { translationPrefs.read() }
    var translation by remember { mutableStateOf(storedTranslation.primary) }
    var showTranslationPanel by remember { mutableStateOf(false) }
    var secondary by remember { mutableStateOf(storedTranslation.secondary) }
    // 界面语言跟系统走；读经展示语言再跟主译本走（英文译本 → 英文面）
    val configuration = LocalConfiguration.current
    // 手动设置（探索页）优先，否则跟系统
    var localeOverride by remember { mutableStateOf(me.askbible.native_.data.AppLocalePrefs.read(context)) }
    val systemLocale = remember(configuration) { AppLocale.fromLanguageTag(configuration.locales[0]?.toLanguageTag() ?: "") }
    val appLocale = localeOverride ?: systemLocale
    // 目录表 / 文案表 / 译本默认值都看 AppLocale.current；在建各 store 之前定好
    AppLocale.current = appLocale
    val displayLocale = ReadDisplayLocale.resolve(appLocale, translation.language)
    // 目录 / 章标题这类我们自己的文字只有中英两套：法语等译本没有对应语言，跟章页一样回退英文
    val readChromeLocale = ReadDisplayLocale.chrome(appLocale, translation.language)
    // 在线译本（目录接口来的那些）用它自己那套书卷名：正文是西语，书名也该是 Génesis
    var bookNamesRevision by remember { mutableStateOf(0) }
    LaunchedEffect(translation.id) {
        if (withContext(Dispatchers.IO) { me.askbible.native_.data.RemoteBookNames.ensure(context, translation) }) bookNamesRevision++
    }
    val bookLabel: (BookRef) -> String = { b ->
        bookNamesRevision.let { me.askbible.native_.data.RemoteBookNames.name(context, translation, b.id) ?: b.name(displayLocale) }
    }
    var xrefVerse by remember { mutableStateOf<Int?>(null) }
    var showSleepSheet by remember { mutableStateOf(false) }

    // 目录 → 章节选择 → 章页
    var pickingBook by remember { mutableStateOf<BookRef?>(null) }
    var openedBook by remember { mutableStateOf<BookRef?>(null) }
    var exploreArticle by remember { mutableStateOf<ExploreArticle?>(null) }
    // 会员登录（Supabase 直连；RN MemberAuthProvider）；登录 / 注册页盖在整个壳上（RN 是 stack 路由，无底栏）
    val auth = remember { MemberAuthStore(context) }
    var authRoute by remember { mutableStateOf<String?>(null) }
    // 睡眠专辑放着时音乐页把按钮藏起来了，底栏一起藏（RN musicAutoHideChrome）
    var musicChromeHidden by remember { mutableStateOf(false) }
    // 浏览器 OAuth 回调：拿到 code 就换会话（RN useMemberAuthGoogleDeepLink）
    val oauthCallback = OAuthCallbackBus.url
    LaunchedEffect(oauthCallback) {
        val u = oauthCallback ?: return@LaunchedEffect
        OAuthCallbackBus.url = null
        auth.handleOAuthCallback(u)
    }
    // 从浏览器回来却没带回调（用户关掉了登录页）：等一下没有回调就当取消，按钮别一直转
    val lifecycle = androidx.compose.ui.platform.LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event -> if (event == androidx.lifecycle.Lifecycle.Event.ON_RESUME) auth.onResumedFromBrowser() }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }
    val bookmarks = remember { VerseBookmarkStore(context) }
    val searchPrefs = remember { SearchPrefs(context) }
    // 经文搜索 / 收藏页：盖在读经 Tab 当前内容之上，关掉就回到原来的页
    var showSearch by remember { mutableStateOf(false) }
    var searchRef by remember { mutableStateOf<SearchChapterRef?>(null) }
    var showFavorites by remember { mutableStateOf(false) }
    // 从搜索 / 收藏跳进章页要定位的节
    var focusVerse by remember { mutableStateOf<Int?>(null) }
    // 长按弹出操作单的那节；收藏 / 复制后的轻提示
    var actionVerse by remember { mutableStateOf<LoadedVerse?>(null) }
    var toast by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(toast) { if (toast != null) { kotlinx.coroutines.delay(1560); toast = null } }
    var chapter by remember { mutableStateOf(1) }
    // 计划 Tab（底栏中央键）里的子页：play / plans / detail
    var planRoute by remember { mutableStateOf("play") }
    var planDetailId by remember { mutableStateOf("") }
    // 播放页状态：日历上看的那天（相对系统今天）与选中的章
    var planViewAhead by remember { mutableIntStateOf(0) }
    var planCursor by remember { mutableIntStateOf(0) }
    // 计划流在哪一页听：播放页（不开章页、顺队列换音源）还是章页（顺队列开下一章）—— RN PlanFlowUiHost
    var planFlowListen by remember { mutableStateOf(false) }
    // 播放页在听的章（章页没开时的音源目标）
    var listenBook by remember { mutableStateOf<BookRef?>(null) }
    var listenChapter by remember { mutableIntStateOf(1) }
    // 章页是从计划页开的：返回回计划 Tab、不停播
    var chapterFromPlan by remember { mutableStateOf(false) }
    // 读经计划流：今日逐章队列，一章播完顺到下一章并记已读
    var planQueue by remember { mutableStateOf<List<PlanPointer>>(emptyList()) }
    var planQueueIndex by remember { mutableIntStateOf(0) }
    var planFlowActive by remember { mutableStateOf(false) }
    var autoPlayPending by remember { mutableStateOf(false) }
    val plans = remember { ReadingPlanStore(context) }
    // 读经活动（习惯日 / 累计听 / 使用时长 / 最近阅读）与会员读经进度同步（RN AppUsageTimeBridge / useMemberReadingSync）
    val activity = remember { ReadingActivityStore(context) }
    val syncEngine = remember { MemberReadingSyncEngine(context).also { it.attach(auth, plans, bookmarks, activity, searchPrefs) } }
    LaunchedEffect(appLocale) { syncEngine.localeTag = { appLocale.tag } }
    // 网站译本目录（几百本在线译本）：盘里没过期就不走网
    var catalogRevision by remember { mutableStateOf(0) }
    LaunchedEffect(Unit) {
        if (withContext(Dispatchers.IO) { me.askbible.native_.data.RemoteTranslations.refresh() }) catalogRevision++
    }
    LaunchedEffect(Unit) {
        activity.noteForeground(); activity.touchHabitDay()
        activity.mergeRemoteHabit(plans.listenedDates)
        auth.verifyRemote()
        syncEngine.flushNow("foreground")
    }
    // 刚登录：立即拉云端进度（RN syncMemberReadingAfterLogin）
    LaunchedEffect(auth.user?.id) { if (auth.user != null) syncEngine.flushNow("login") }
    LaunchedEffect(plans.listenedDates) { activity.mergeRemoteHabit(plans.listenedDates) }
    // 15 秒一跳：使用时长打点 + 记当天为读经日；每三跳（45 秒）轮询一次同步
    LaunchedEffect(Unit) {
        var ticks = 0
        while (true) {
            kotlinx.coroutines.delay(15_000)
            activity.flushUsageTick(); activity.touchHabitDay()
            ticks += 1
            if (ticks % 3 == 0) syncEngine.schedule("poll")
        }
    }
    DisposableEffect(lifecycle) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            when (event) {
                androidx.lifecycle.Lifecycle.Event.ON_RESUME -> { activity.noteForeground(); activity.touchHabitDay(); syncEngine.flushInBackground("foreground"); me.askbible.native_.audio.AudioInterruptionMonitor.onForeground() }
                androidx.lifecycle.Lifecycle.Event.ON_PAUSE -> activity.noteBackground()
                else -> {}
            }
        }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }
    val naturePrefs = remember { NatureHomePrefs(context) }
    // 睡眠定时四路（读经 / 音乐 / 金句 / 环境音）同一份分钟数；0 = 未设
    var sleepTimerMinutes by remember { mutableIntStateOf(0) }

    val audio = remember { ChapterAudioPlayer(context, scope).also { p -> p.onProgress = { t, playing -> activity.noteListenProgress(t, playing) } } }
    fun openPlanChapter(p: PlanPointer, autoPlay: Boolean) {
        val b = BibleCatalog.book(p.bookId) ?: return
        focusVerse = null
        autoPlayPending = autoPlay
        listenBook = b; listenChapter = p.chapter
        chapter = p.chapter
        openedBook = b
    }
    // 播放页点播：不开章页，只把音源换到这一章（同章已载入就直接续播）
    fun listenPlanChapter(p: PlanPointer, autoPlay: Boolean) {
        val b = BibleCatalog.book(p.bookId) ?: return
        val tb = openedBook ?: listenBook
        val tc = if (openedBook != null) chapter else listenChapter
        if (tb?.id == b.id && tc == p.chapter) { if (autoPlay) audio.resume(); return }
        autoPlayPending = autoPlay
        listenBook = b; listenChapter = p.chapter
    }
    // 下一章：计划流里顺队列并记已读（播放页听着就只换音源，章页开着就开下一章页），否则本卷下一章
    val skipNext: () -> Unit = {
        val b = openedBook
        if (planFlowActive) {
            val cb = b ?: listenBook
            if (cb != null) plans.markChapterRead(cb.id, if (b != null) chapter else listenChapter)
            val next = planQueueIndex + 1
            if (next < planQueue.size) {
                planQueueIndex = next
                if (planFlowListen && b == null) listenPlanChapter(planQueue[next], true) else openPlanChapter(planQueue[next], true)
            } else planFlowActive = false
        } else if (b != null && chapter < b.chapterCount) chapter += 1
    }
    val music = remember { MusicPlayer(context, scope) }
    val home = remember { HomeVerseController(context, scope) }
    // 首页金句跟当前读经版本走：内置译本读本机库，在线译本（含法语等）取该版本的正文
    LaunchedEffect(translation.id) { home.setSource(translation) }
    val ambient = remember { AmbientPlayer(context, scope) }
    // 外部音频打断监听：永久失焦后外部声音一停 / 回到前台就把朗读 / 音乐叫回来
    LaunchedEffect(Unit) {
        me.askbible.native_.audio.AudioInterruptionMonitor.addRecoverer { audio.recoverAfterInterruption(); music.recoverAfterInterruption() }
        me.askbible.native_.audio.AudioInterruptionMonitor.start(context)
    }
    val setSleepTimerAll: (Int) -> Unit = { m ->
        sleepTimerMinutes = m
        val v = if (m > 0) m else null
        audio.setSleepTimer(v); music.setSleepTimer(v); home.setSleepTimer(v); ambient.setSleepTimer(v)
    }
    DisposableEffect(Unit) {
        // 互斥：整章朗读 ↔ 音乐（RN shell 单一 playbackMode）；整章朗读 ↔ 金句（都是人声）。
        // 首页最多两路有声（homeGoldenVerseTwoSourceMutex）：开音乐时金句+环境音都在 → 关环境音；
        // 开金句时音乐+环境音都在 → 关环境音；开环境音时人声+音乐都在 → 停音乐。
        audio.onWillPlay = { music.pause(); home.stopVoice() }
        audio.onFinished = { if (planFlowActive) skipNext() }
        music.onWillPlay = { audio.pause(); if (home.voiceOn && ambient.isOn) ambient.stop() }
        home.player.onWillPlay = { audio.pause(); if (music.isPlaying && ambient.isOn) ambient.stop() }
        ambient.onWillPlay = { if ((home.voiceOn || audio.isPlaying) && music.isPlaying) music.pause() }
        onDispose { audio.release(); music.release(); home.release(); ambient.release() }
    }
    // 整章朗读时环境音压半，停了恢复（「读经混播时继续播并压音量」）
    // 人声（整章 / 金句）或音乐在放时环境音压到 30%（AMBIENT_WHILE_VOICE_GAIN / AMBIENT_WHILE_MUSIC_GAIN）
    LaunchedEffect(audio.isPlaying, music.isPlaying, home.voiceOn) { ambient.setDucked(audio.isPlaying || music.isPlaying || home.voiceOn) }

    val book = openedBook
    // 音源目标：章页开着就是那一章；否则是播放页在听的章
    val targetBook = book ?: listenBook
    val targetChapter = if (book != null) chapter else listenChapter
    // 译本切换后重新取数
    val data by produceState(initialValue = ChapterData(), translation.id, secondary?.id, book?.id, chapter, reloadToken) {
        val id = book?.id
        if (id == null) { value = ChapterData(); return@produceState }
        value = ChapterData(loading = true)
        // 内置译本瞬时读库；在线译本抓 bible.com 页、下载型先拉整本 sqlite（ChapterLoader）
        val verses = ChapterLoader.load(context, downloader, translation.id, id, chapter)
        val xrefs = withContext(Dispatchers.IO) {
            XrefDatabase.open(context)?.let { db -> try { db.versesWithXrefs(id, chapter) } finally { db.close() } } ?: emptySet()
        }
        val sec = secondary
        val contrast = if (sec == null || sec.id == translation.id) emptyMap() else
            ChapterLoader.load(context, downloader, sec.id, id, chapter)?.associate { it.number to it.text } ?: emptyMap()
        value = ChapterData(verses ?: emptyList(), xrefs, contrast, failed = verses == null)
    }

    // xref 详情按需查，跳转时用目标译本原文做预览
    val xrefData by produceState<VerseXrefs?>(initialValue = null, xrefVerse, book?.id, chapter) {
        val v = xrefVerse; val id = book?.id
        value = if (v == null || id == null) null else withContext(Dispatchers.IO) {
            XrefDatabase.open(context)?.let { db -> try { db.verseXrefs(id, chapter, v) } finally { db.close() } }
        }
    }

    val audioUrl = targetBook?.let {
        ChapterAudioSource.resolve(translation.id, it.id, it.number, it.nameEn, targetChapter)
    }

    LaunchedEffect(audioUrl, targetChapter, translation.id) {
        val b = targetBook ?: return@LaunchedEffect
        audioUrl?.let {
            val key = "${translation.id}.${b.id}.$targetChapter"
            val title = ReadChrome.chapterTitle(bookLabel(b), targetChapter, readChromeLocale)
            if (ChapterAudioSource.isResolverUrl(it)) {
                // YouVersion 译本：先问网站代理拿 CDN mp3，再装载
                audio.beginResolving(key, title)
                val src = withContext(Dispatchers.IO) { ChapterAudioSource.fetchResolved(it, key) }
                if (src != null) audio.load(src, key, title, translation.id, b.id, targetChapter, resolved = true)
                else audio.failResolving(key)
            } else {
                audio.load(it, key, title, translation.id, b.id, targetChapter)
            }
        }
        audio.onSkipNext = skipNext
        if (autoPlayPending) { autoPlayPending = false; audio.resume() }
    }

    // 系统返回键按层级逐层收起：弹层 → 章页 → 回首页；到首页才真正退出。
    // Compose 弹层是普通 Box，不会自动接管返回键，不加这段整个 App 会直接被退出。
    val backHandled = authRoute != null || showSleepSheet || showSearch || showFavorites || actionVerse != null || xrefVerse != null || showTranslationPanel || exploreArticle != null ||
        pickingBook != null || openedBook != null || (tab == ShellTab.PLAN && planRoute != "play") || tab != ShellTab.HOME
    BackHandler(enabled = backHandled) {
        when {
            authRoute != null -> authRoute = null
            showSleepSheet -> showSleepSheet = false
            xrefVerse != null -> xrefVerse = null
            showTranslationPanel -> showTranslationPanel = false
            actionVerse != null -> actionVerse = null
            showSearch -> showSearch = false
            showFavorites -> showFavorites = false
            exploreArticle != null -> exploreArticle = null
            pickingBook != null -> pickingBook = null
            openedBook != null -> {
                openedBook = null
                // 从计划页进来的章页：回计划 Tab、不停播（RN 返回上一页仍在放）
                if (chapterFromPlan) { chapterFromPlan = false; planFlowListen = true; tab = ShellTab.PLAN; if (!planFlowActive) listenBook = null }
                else { audio.pause(); planFlowActive = false; listenBook = null }
            }
            tab == ShellTab.PLAN && planRoute != "play" -> planRoute = if (planRoute == "detail") "plans" else "play"
            else -> tab = ShellTab.HOME
        }
    }

    val onReadTab = tab == ShellTab.READ
    // 搜索 / 收藏页盖在上面时藏坞（RN 非章页只在播放中才出坞）
    // 章页照常；目录页只在播放中才出坞（计划页点播后切到圣经页也能控制）
    val showDock = onReadTab && (!(showSearch || showFavorites) || audio.isPlaying) && (book != null || (audio.isPlaying && targetBook != null))

    // 播放页（RN ReadPlanPlayScreen：本页队列 vs 全局播放池，谁在播就跟谁的游标）
    val planContentAhead = PlanPlay.contentAhead(planViewAhead, plans.prefs.ahead)
    val planPageQueue = plans.readings(planContentAhead).flatMap { it.chapters }
    val planPoolMatchesView = planFlowActive && planQueue.isNotEmpty() && planQueue == planPageQueue
    val planActiveIndex = if (planPoolMatchesView) planQueueIndex else planCursor
    val planActivePlaying = planPoolMatchesView && audio.isPlaying && targetBook != null &&
        planQueue.getOrNull(planQueueIndex) == PlanPointer(targetBook.id, targetChapter)
    val onPlanTab = tab == ShellTab.PLAN
    val showPlanDock = onPlanTab && planRoute == "play" && !showSearch && planPageQueue.isNotEmpty()
    // 播放页当前高亮那章有没有整章音源（UST 等无音源译本：播放键置灰，与章页一致；RN 朗读永远跟随正文译本、不跨译本回退）
    val planActiveAudioAvailable = planPageQueue.getOrNull(planActiveIndex)?.let { p ->
        BibleCatalog.book(p.bookId)?.let { b -> ChapterAudioSource.resolve(translation.id, b.id, b.number, b.nameEn, p.chapter) != null }
    } ?: false
    // 日历上看的那天算「听过」（月历标黄）
    fun markPlanListened() = plans.markListened(PlanPlay.isoDate(LocalDate.now().plusDays(planViewAhead.toLong())))
    // 行点播 / 行尾「声音」：建池（或复用）从第 index 章起播
    fun planPlay(index: Int) {
        val q = planPageQueue
        if (index !in q.indices) return
        markPlanListened()
        planFlowListen = true
        if (!planPoolMatchesView) { planQueue = q; planFlowActive = true }
        planQueueIndex = index
        planCursor = index
        listenPlanChapter(q[index], true)
    }
    // 行尾「阅读」/ 双击：进这一章的阅读页；正在播的那章不停播；返回回计划 Tab
    fun planRead(index: Int) {
        val q = planPageQueue
        val b = q.getOrNull(index)?.let { BibleCatalog.book(it.bookId) } ?: return
        chapterFromPlan = true
        planFlowListen = false
        focusVerse = null
        if (!(planPoolMatchesView && index == planQueueIndex)) { planFlowActive = false; listenBook = null }
        chapter = q[index].chapter; openedBook = b
        tab = ShellTab.READ
    }
    // 坞的播放键：播中就停；池对上本页就续播；否则从选中章起播
    fun planTogglePlay() {
        if (audio.isPlaying) { audio.pause(); return }
        if (planPoolMatchesView && targetBook != null) { markPlanListened(); audio.resume(); return }
        planPlay(planActiveIndex)
    }
    fun planNext() {
        if (planFlowActive) skipNext() else planCursor = (planCursor + 1).coerceIn(0, maxOf(0, planPageQueue.size - 1))
    }

    Box(Modifier.fillMaxSize()) {
        when (tab) {
            ShellTab.HOME -> HomeScreen(
                verse = home.verse,
                textScale = naturePrefs.textScale,
                sceneId = naturePrefs.sceneId,
                scenes = NatureScenes.sortedByUsage(naturePrefs.usage),
                liveVideo = naturePrefs.liveVideo,
                ambientSlotId = ambient.slotId,
                voiceOn = home.voiceOn,
                voiceAvailable = home.voiceAvailable,
                playingAlbum = if (music.isPlaying) music.track?.album else null,
                sleepTimerMinutes = sleepTimerMinutes,
                // 点选场景：记次数、存档、跟场景默认环境音（RN selectScene source=user）
                onSelectScene = { id ->
                    if (id != naturePrefs.sceneId) {
                        naturePrefs.bumpUsage(id)
                        naturePrefs.selectScene(id)
                        NatureScenes.scene(id)?.defaultAmbient?.let { ambient.start(it) }
                    }
                },
                onToggleLiveVideo = { naturePrefs.toggleLiveVideo(!naturePrefs.liveVideo) },
                onToggleAmbient = { id -> if (ambient.slotId == id) ambient.stop() else ambient.start(id) },
                onBumpTextScale = { naturePrefs.bumpTextScale(it) },
                onCycleSleepTimer = { setSleepTimerAll(NatureScenes.cycleSleepTimer(sleepTimerMinutes)) },
                onToggleVoice = { home.toggleVoice() },
                // 点已在放的专辑 → 停；点另一张 → 切过去起播（homeNatureAlbumPress）
                onPressAlbum = { album ->
                    if (music.isPlaying && music.track?.album == album) music.pause()
                    else { val wasPlaying = music.isPlaying; music.selectAlbum(album); if (!wasPlaying) music.toggle() }
                },
                onOpenMenu = {},
            )
            ShellTab.MUSIC -> MusicScreen(player = music, onChromeHidden = { musicChromeHidden = it },
                sleepActive = audio.sleepDeadlineMs != null || music.sleepDeadlineMs != null || home.sleepDeadlineMs != null || ambient.sleepDeadlineMs != null,
                onSleepTimer = { showSleepSheet = true })
            ShellTab.EXPLORE -> ExploreScreen(
                size = size, article = exploreArticle, onOpenArticle = { exploreArticle = it },
                auth = auth, locale = appLocale, onOpenLogin = { authRoute = "login" },
                localeOverride = localeOverride, onSetLocale = { choice ->
                    // RN applyLocaleWithTranslationPrefs：语言、主译本（自动）、副译本清空、首页金句译本与朗读一起换；之后手动改译本不再受语言影响
                    val next = choice ?: systemLocale
                    AppLocale.current = next
                    localeOverride = choice
                    me.askbible.native_.data.AppLocalePrefs.write(context, choice)
                    val primary = AppLocale.primaryTranslationId(next)
                    ScriptureTranslation.find(primary)?.let { translation = it }
                    secondary = null
                    translationPrefs.write(translation, null)
                    home.setTranslation(primary, AppLocale.goldenVerseAudioTranslationId(next))
                },
                activity = activity, onSignOut = { scope.launch { syncEngine.prepareSignOut(); auth.signOut() } },
                onOpenChapter = { id, ch ->
                    // 文章里的经文链接：切到读经 Tab 直接开章
                    BibleCatalog.book(id)?.let { b ->
                        planFlowActive = false; listenBook = null; chapterFromPlan = false; pickingBook = null; chapter = ch; openedBook = b; tab = ShellTab.READ
                    }
                })
            ShellTab.PLAN -> if (showSearch) SearchScreen(
                locale = displayLocale,
                prefs = searchPrefs, translationId = translation.id, size = size, chapterRef = searchRef,
                onBack = { showSearch = false },
                onOpenHit = { hit ->
                    // 播放页坞的搜索键：搜到的章在读经 Tab 打开，返回回计划页
                    showSearch = false
                    BibleCatalog.book(hit.bookId)?.let { b ->
                        planFlowActive = false; listenBook = null; pickingBook = null; chapterFromPlan = true; planFlowListen = false
                        focusVerse = hit.verse; chapter = hit.chapter; openedBook = b; tab = ShellTab.READ
                    }
                })
            else when (planRoute) {
                "plans" -> PlansListScreen(plans, onOpenPlan = { planDetailId = it; planRoute = "detail" }, onBack = { planRoute = "play" },
                    onOpenArticle = { slug -> exploreArticle = ExploreArticles.article(context, slug); tab = ShellTab.EXPLORE })
                "detail" -> PlanDetailScreen(plans, planDetailId,
                    onBack = { planRoute = "plans" }, onOpenPlan = { planDetailId = it },
                    onOpenChapter = { chapterFromPlan = true; planFlowListen = false; planFlowActive = false; listenBook = null; openPlanChapter(it, false); tab = ShellTab.READ },
                    onGoHome = { planRoute = "play" })
                else -> PlanPlayScreen(plans, audio, appLocale, planPageQueue, planActiveIndex, planActivePlaying,
                    viewAhead = planViewAhead, onViewAhead = { planViewAhead = it }, cursor = planCursor, onCursor = { planCursor = it },
                    onPlayChapter = { planPlay(it) }, onReadChapter = { planRead(it) },
                    onOpenPlans = { planRoute = "plans" },
                    bookLabel = bookLabel,
                    onConfirmDay = { plans.setAheadDays(planContentAhead); planViewAhead = 0 },
                    onStageSet = { planViewAhead = 0; planCursor = 0 }, habitDates = activity.completedDateSet)
            }
            ShellTab.READ -> if (showSearch) SearchScreen(
                locale = displayLocale,
                prefs = searchPrefs, translationId = translation.id, size = size, chapterRef = searchRef,
                onBack = { showSearch = false },
                onOpenHit = { hit ->
                    showSearch = false
                    BibleCatalog.book(hit.bookId)?.let { b ->
                        planFlowActive = false; listenBook = null; chapterFromPlan = false; pickingBook = null; focusVerse = hit.verse; chapter = hit.chapter; openedBook = b
                    }
                })
            else if (showFavorites) FavoritesScreen(
                locale = displayLocale,
                bookmarks = bookmarks, size = size,
                onBack = { showFavorites = false },
                onOpen = { item ->
                    showFavorites = false
                    BibleCatalog.book(item.bookId)?.let { b ->
                        planFlowActive = false; listenBook = null; chapterFromPlan = false; pickingBook = null; focusVerse = item.verse; chapter = item.chapter; openedBook = b
                    }
                })
            else if (book == null) CatalogScreen(
                bookLabel = bookLabel,
                locale = readChromeLocale,
                size = size,
                onOpenBook = { pickingBook = it },
                onOpenSettings = { showTranslationPanel = true },
                onSizeUp = { size.next?.let { size = it } },
                onSizeDown = { size.previous?.let { size = it } },
                onOpenSearch = { searchRef = null; showSearch = true },
                onOpenFavorites = { showFavorites = true },
            )
            else {
                // RN writeLastReadPosition + pushReadRecentChapter：最后位置 + 探索页「最近阅读」
                LaunchedEffect(book.id, chapter) { activity.recordOpened(book.id, chapter, book.name(displayLocale)) }
                ChapterScreen(
                    locale = displayLocale,
                    uiLocale = appLocale,
                    foreignText = ReadDisplayLocale.isForeign(translation.language),
                    bookId = book.id,
                    bookName = bookLabel(book),
                    chapter = chapter,
                    verses = data.verses,
                    translationId = translation.id, loading = data.loading, failed = data.failed, onRetry = { reloadToken += 1 },
                    xrefVerses = data.xrefs,
                    size = size,
                    activeVerse = audio.activeVerse,
                    onBack = {
                        openedBook = null
                        // 从计划页进来的章页：回计划 Tab、不停播（RN 返回上一页仍在放）
                        if (chapterFromPlan) { chapterFromPlan = false; planFlowListen = true; tab = ShellTab.PLAN; if (!planFlowActive) listenBook = null }
                        else { audio.pause(); planFlowActive = false; listenBook = null }
                    },
                    onOpenSettings = { showTranslationPanel = true },
                    onSizeUp = { size.next?.let { size = it } },
                    onSizeDown = { size.previous?.let { size = it } },
                    isPlaying = audio.isPlaying,
                    contrast = data.contrast,
                    onTapVerse = { xrefVerse = it },
                    bookmarked = bookmarks.bookmarkedVerses(translation.id, book.id, chapter),
                    focusVerse = focusVerse,
                    onDoubleTapVerse = { v ->
                        // 双击收藏：新加时顺手复制（RN「已收藏，经文已复制」）
                        val added = bookmarks.toggle(book.id, book.name(displayLocale), chapter, v.number, translation.id, v.text)
                        if (added) copyText(context, VerseShareText.clipboard(book.name(displayLocale), chapter, v.number, v.text))
                        toast = SiteCopy.t(if (added) "pages.read.verseBookmarkSaved" else "pages.read.verseBookmarkRemoved", appLocale)
                    },
                    onLongPressVerse = { actionVerse = it },
                    onOpenSearch = { searchRef = SearchChapterRef(book.id, chapter); showSearch = true },
                    onOpenFavorites = { showFavorites = true },
                    onOpenCatalog = { openedBook = null; audio.pause(); planFlowActive = false; listenBook = null; chapterFromPlan = false },
                    onNavigate = { id, ch ->
                        // 结尾的上一章 / 下一章：手动翻页就退出计划流
                        BibleCatalog.book(id)?.let { b -> planFlowActive = false; listenBook = null; chapterFromPlan = false; chapter = ch; openedBook = b }
                    },
                )
            }
        }

        // RN：只有读经坞出现时才在坞 + 底栏后面铺羊皮（整屏图钉在屏幕底，与页面底图像素重合，看不出接缝）；
        // 其余羊皮页底栏透明，正文靠 parchmentFade 在底栏前渐隐 —— 之前整块铺一层会在坞顶露出一条硬边
        // 读经计划目录 / 详情 / 今日读经是独立子页，不放底栏（Josh「独立页下面无需放图标」，靠左上返回键回来；章页打开后照常）
        // 计划目录 / 详情是独立子页，不放底栏；播放页是主页级页面，底栏照常
        val standalonePage = (onPlanTab && planRoute != "play" && !showSearch) || authRoute != null || (tab == ShellTab.MUSIC && musicChromeHidden)
        val anyDock = showDock || showPlanDock
        if (!standalonePage) Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth()) {
        if (anyDock) ParchmentPinnedBottom(Modifier.matchParentSize())
        Column(Modifier.fillMaxWidth()) {
            if (showDock) {
                PlaybackDock(
                    audio = audio,
                    available = audioUrl != null,
                    onSearch = { targetBook?.let { b -> searchRef = SearchChapterRef(b.id, targetChapter) }; showSearch = true },
                    onSkipNext = skipNext,
                )
                // RN shellTabBarStyles.wrap.gap：坞与 Tab 行之间 6
                Spacer(Modifier.height(ShellMetrics.tabBarDockGap.dp))
            } else if (showPlanDock) {
                // 播放页的坞：左键是经文搜索（带当前章上下文）；播放键没建池时从选中章起播
                PlaybackDock(
                    audio = audio,
                    available = planActiveAudioAvailable,
                    onSearch = { searchRef = planPageQueue.getOrNull(planActiveIndex)?.let { SearchChapterRef(it.bookId, it.chapter) }; showSearch = true },
                    onSkipNext = { planNext() },
                    onToggle = { planTogglePlay() },
                )
                Spacer(Modifier.height(ShellMetrics.tabBarDockGap.dp))
            }
            ShellTabBar(
                selected = tab,
                onSelect = { tab = it },
                // 中央键：切到读经计划 Tab（主页级页面，底栏照常；Josh「中间计划与旁边的圣经，要直接就切换过来」）
                onCenterTap = { tab = ShellTab.PLAN; planFlowListen = true },
                // 羊皮底由外层 bottomScrim 连坞带导航栏一起铺；这里不再铺第二层，
                // 否则两层纹理错位会在 Tab 行底边露出一条横线
                parchmentScrim = false,
                modifier = Modifier
                    .padding(bottom = shellTabBarBottomInset())
                    .height(ShellMetrics.tabRowHeight.dp),
            )
        }
        }

        when (authRoute) {
            "login" -> LoginScreen(auth, appLocale, onBack = { authRoute = null }, onRegister = { authRoute = "register" }, onDone = { authRoute = null })
            "register" -> RegisterScreen(auth, appLocale, onBack = { authRoute = null }, onLogin = { authRoute = "login" }, onDone = { authRoute = null })
        }

        pickingBook?.let { b ->
            ChapterPickerSheet(
                bookLabel = bookLabel,
                locale = readChromeLocale,
                book = b,
                chapterCount = b.chapterCount,
                onPick = { n -> chapter = n; openedBook = b; pickingBook = null },
                onClose = { pickingBook = null },
            )
        }

        if (showTranslationPanel) {
            TranslationPanel(
                current = translation,
                secondary = secondary,
                // 界面文案目前只有中文：面板里的译本名与分组名按中文界面走（系统英文时不混一行英文），繁体系统给繁体
                locale = appLocale, downloader = downloader, catalogRevision = catalogRevision,
                onSelect = { translation = it; translationPrefs.write(it, secondary) },
                onSelectSecondary = { secondary = it; translationPrefs.write(translation, it) },
                onClose = { showTranslationPanel = false },
            )
        }

        actionVerse?.let { v ->
            val b = book
            if (b != null) VerseActionSheet(
                verse = v.number, bookmarked = bookmarks.isBookmarked(translation.id, b.id, chapter, v.number), size = size,
                onCopy = { copyText(context, VerseShareText.clipboard(b.name(displayLocale), chapter, v.number, v.text)); toast = SiteCopy.t("pages.read.verseCopied", appLocale); actionVerse = null },
                onBookmark = {
                    val added = bookmarks.toggle(b.id, b.name(displayLocale), chapter, v.number, translation.id, v.text)
                    if (added) copyText(context, VerseShareText.clipboard(b.name(displayLocale), chapter, v.number, v.text))
                    toast = SiteCopy.t(if (added) "pages.read.verseBookmarkSaved" else "pages.read.verseBookmarkRemoved", appLocale); actionVerse = null
                },
                onShare = {
                    val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                        type = "text/plain"; putExtra(android.content.Intent.EXTRA_TEXT, VerseShareText.share(b.name(displayLocale), chapter, v.number, v.text))
                    }
                    context.startActivity(android.content.Intent.createChooser(intent, null)); actionVerse = null
                },
                onClose = { actionVerse = null },
            )
        }
        toast?.let { msg ->
            // RN ReadVerseBookmarkFeedback：底部 108 + 安全区之上，居中胶囊
            Box(Modifier.fillMaxSize().navigationBarsPadding().padding(bottom = (108f + ShellMetrics.tabRowHeight + ShellMetrics.dockContentHeight).dp, start = 24.dp, end = 24.dp),
                contentAlignment = Alignment.BottomCenter) { VerseFeedbackToast(msg) }
        }

        val xd = xrefData
        if (xrefVerse != null && book != null && xd != null) {
            VerseXrefSheet(
                locale = displayLocale,
                bookName = book.name(displayLocale), chapter = chapter, xrefs = xd, size = size,
                snippet = { ref ->
                    ScriptureDatabase.open(context, translation.id)?.let { db ->
                        try { db.loadChapter(ref.bookId, ref.chapter).firstOrNull { it.number == ref.verseStart }?.text }
                        finally { db.close() }
                    }
                },
                onOpen = { ref ->
                    xrefVerse = null
                    BibleCatalog.book(ref.bookId)?.let { b -> chapter = ref.chapter; openedBook = b }
                },
                onClose = { xrefVerse = null },
            )
        }

        if (showSleepSheet) {
            SleepTimerSheet(
                remainingLabel = audio.sleepRemainingLabel ?: music.sleepRemainingLabel,
                onPick = { m -> setSleepTimerAll(m ?: 0) },
                onClose = { showSleepSheet = false })
        }
    }
}

/** 复制到系统剪贴板 */
private fun copyText(context: android.content.Context, text: String) {
    val cm = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
    cm.setPrimaryClip(android.content.ClipData.newPlainText("verse", text))
}
