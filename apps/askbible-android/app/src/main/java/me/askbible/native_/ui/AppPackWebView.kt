package me.askbible.native_.ui

import android.content.Context
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.systemBars
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.ViewCompat
import kotlinx.coroutines.delay
import me.askbible.native_.audio.AmbientPlayer
import me.askbible.native_.audio.ChapterAudioPlayer
import me.askbible.native_.audio.MusicPlayer
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.AppPackStore
import me.askbible.native_.data.MemberAuthStore
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ShellMetrics
import me.askbible.native_.data.TranslationDownloader
import me.askbible.native_.home.HomeVerseController
import org.json.JSONObject
import kotlin.math.roundToInt

/**
 * D-47 统一纯静态内核轻壳容器（与 iOS `AppPackWebView` / `NativeMediaBridge.loadAppPack` 对称）：
 * - 通过 `https://pack.askbible.local/index.html?route=<encoded>` 挂载 [AppPackStore] 同源离线静态内核；
 * - 底层铺 [ParchmentBackground] 并预置羊皮卷底色 + 首帧提交后再显形，彻底消除首帧闪白；
 * - 实时同步明暗主题、界面语言与状态快照，接入软键盘托底（`imePadding` + `shell.keyboardHeight`）；
 * - 接通 `onOpenChapter`、`onSelectTab`、`onBack` 与 `pack.readyToSwap` 静默热更推送。
 */
@Composable
fun AppPackWebView(
    initialRoute: String,
    modifier: Modifier = Modifier,
    locale: AppLocale = AppLocale.current,
    theme: Parchment = LocalParchment.current,
    currentBook: String? = null,
    currentChapter: Int = 1,
    locateRequest: Int = 0,
    topInsetDp: Int? = null,
    bottomInsetDp: Int? = null,
    handleSystemBack: Boolean = true,
    chapterAudio: ChapterAudioPlayer? = null,
    musicPlayer: MusicPlayer? = null,
    homeController: HomeVerseController? = null,
    ambientPlayer: AmbientPlayer? = null,
    authStore: MemberAuthStore? = null,
    translationDownloader: TranslationDownloader? = null,
    onSetSleepTimer: ((Int) -> Unit)? = null,
    onPlayChapter: ((String, Int, String?) -> Unit)? = null,
    onAuthSignIn: ((String) -> Unit)? = null,
    onAuthSignOut: (() -> Unit)? = null,
    onSetTheme: ((String) -> Unit)? = null,
    onOpenChapter: (String, Int) -> Unit = { _, _ -> },
    onSelectTab: (String) -> Unit = {},
    onBack: () -> Unit = {},
    onPackReadyToSwap: ((String) -> Unit)? = null,
    onLoadFailed: (() -> Unit)? = null,
) {
    val context = LocalContext.current
    val appContext = context.applicationContext
    val density = LocalDensity.current

    val latestOnOpenChapter by rememberUpdatedState(onOpenChapter)
    val latestOnSelectTab by rememberUpdatedState(onSelectTab)
    val latestOnBack by rememberUpdatedState(onBack)
    val latestOnPackReadyToSwap by rememberUpdatedState(onPackReadyToSwap)
    val latestOnLoadFailed by rememberUpdatedState(onLoadFailed)
    val latestOnSetTheme by rememberUpdatedState(onSetTheme)
    val latestOnSetSleepTimer by rememberUpdatedState(onSetSleepTimer)
    val latestOnPlayChapter by rememberUpdatedState(onPlayChapter)
    val latestOnAuthSignIn by rememberUpdatedState(onAuthSignIn)
    val latestOnAuthSignOut by rememberUpdatedState(onAuthSignOut)

    val normalizedRoute = remember(initialRoute) { normalizeKernelRoute(initialRoute) }
    val sysInsets = WindowInsets.systemBars.asPaddingValues()
    val resolvedTopInsetDp = topInsetDp ?: sysInsets.calculateTopPadding().value.roundToInt()
    val resolvedBottomInsetDp = bottomInsetDp
        ?: (ShellMetrics.tabRowHeight.dp + shellTabBarBottomInset() + 36.dp).value.roundToInt()

    val imeBottomPx = WindowInsets.ime.getBottom(density)
    val imeDp = (imeBottomPx / density.density.coerceAtLeast(1f)).roundToInt()

    val stateJson = remember(
        normalizedRoute,
        locale,
        theme.isDark,
        currentBook,
        currentChapter,
        locateRequest,
        resolvedTopInsetDp,
        resolvedBottomInsetDp,
    ) {
        JSONObject().apply {
            put("route", normalizedRoute)
            put("locale", locale.tag)
            put("theme", if (theme.isDark) "dark" else "light")
            put("dark", theme.isDark)
            put("scale", 1)
            put("book", currentBook ?: "")
            put("ch", maxOf(1, currentChapter))
            put("hasHistory", currentBook != null)
            put("locateRequest", locateRequest)
            put("topInset", resolvedTopInsetDp)
            put("bottomInset", resolvedBottomInsetDp)
        }.toString()
    }

    val bridge = remember(appContext) {
        NativeMediaBridge(
            context = appContext,
            chapterAudio = chapterAudio,
            musicPlayer = musicPlayer,
            homeController = homeController,
            ambientPlayer = ambientPlayer,
            authStore = authStore,
            translationDownloader = translationDownloader,
        )
    }

    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    var pageFinished by remember { mutableStateOf(false) }
    var pageVisible by remember { mutableStateOf(false) }
    var canGoBack by remember { mutableStateOf(false) }

    var latestStateRef by remember { mutableStateOf(stateJson) }
    var latestDarkRef by remember { mutableStateOf(theme.isDark) }
    var latestLocaleRef by remember { mutableStateOf(locale.tag) }
    latestStateRef = stateJson
    latestDarkRef = theme.isDark
    latestLocaleRef = locale.tag

    bridge.onOpenChapter = { bookId, ch -> latestOnOpenChapter(bookId, ch) }
    bridge.onSetTab = { tab -> latestOnSelectTab(tab) }
    bridge.onResumeReading = { latestOnBack() }
    bridge.onBack = { latestOnBack() }
    bridge.onSetTheme = { mode -> latestOnSetTheme?.invoke(mode) }
    bridge.onSetSleepTimer = { mins -> latestOnSetSleepTimer?.invoke(mins) }
    bridge.onPlayChapter = { b, c, t -> latestOnPlayChapter?.invoke(b, c, t) }
    bridge.onAuthSignIn = { provider -> latestOnAuthSignIn?.invoke(provider) }
    bridge.onAuthSignOut = { latestOnAuthSignOut?.invoke() }
    bridge.onPackReadyToSwap = { bundleId -> latestOnPackReadyToSwap?.invoke(bundleId) }

    bridge.onPageStartedCallback = { wv ->
        canGoBack = wv.canGoBack()
        wv.evaluateJavascript(
            buildKernelSyncScript(latestStateRef, latestDarkRef, latestLocaleRef),
            null,
        )
    }
    bridge.onPageCommitVisibleCallback = { _ ->
        pageVisible = true
    }
    bridge.onPageFinishedCallback = { wv ->
        pageFinished = true
        pageVisible = true
        canGoBack = wv.canGoBack()
        wv.evaluateJavascript(
            buildKernelSyncScript(latestStateRef, latestDarkRef, latestLocaleRef),
            null,
        )
        AppPackStore.pendingBundleId(appContext)?.let { pendingId ->
            bridge.emitPackReadyToSwap(pendingId)
            latestOnPackReadyToSwap?.invoke(pendingId)
        }
    }

    LaunchedEffect(stateJson, theme.isDark, locale.tag, pageFinished) {
        if (pageFinished) {
            webViewRef?.evaluateJavascript(
                buildKernelSyncScript(stateJson, theme.isDark, locale.tag),
                null,
            )
        }
    }

    LaunchedEffect(imeDp, pageFinished) {
        if (pageFinished) {
            bridge.emitKeyboardHeight(imeDp)
        }
    }

    // 安全兜底：极端机型未及时触发 onPageCommitVisible 时，避免长久停留在透明态
    LaunchedEffect(webViewRef) {
        if (webViewRef != null && !pageVisible) {
            delay(700L)
            pageVisible = true
        }
    }

    BackHandler(enabled = canGoBack || handleSystemBack) {
        val wv = webViewRef
        if (wv != null && wv.canGoBack()) {
            wv.goBack()
        } else {
            bridge.emitBackPressed()
            latestOnBack()
        }
    }

    DisposableEffect(bridge) {
        onDispose {
            bridge.release()
            webViewRef?.let { wv ->
                wv.stopLoading()
                wv.destroy()
            }
            webViewRef = null
        }
    }

    val coverAlpha by animateFloatAsState(
        targetValue = if (pageVisible) 0f else 1f,
        animationSpec = tween(durationMillis = 140),
        label = "appPackCoverAlpha",
    )
    val bgColorInt = theme.canvas.argb.toInt()

    Box(modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)

        // 严禁对 AndroidView(WebView) 本体设置 .alpha(0f)，三星 One UI 硬件图层会导致黑屏/透明图层丢失；
        // 改为让 WebView 恒定全不透明，首帧由上方羊皮纸遮罩平稳淡出。
        AndroidView(
            modifier = Modifier
                .fillMaxSize()
                .imePadding(),
            factory = { ctx ->
                runCatching {
                    WebView(ctx).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT,
                        )
                        bridge.configureWebView(this, isDark = theme.isDark)
                        setBackgroundColor(bgColorInt)
                        webViewRef = this
                        ViewCompat.requestApplyInsets(this)
                        bridge.loadLocalPack(
                            this,
                            buildAppPackUrl(ctx, normalizedRoute, locale = locale, isDark = theme.isDark),
                        )
                    }
                }.getOrElse {
                    latestOnLoadFailed?.invoke()
                    View(ctx)
                }
            },
            update = { view ->
                (view as? WebView)?.let { wv ->
                    wv.setBackgroundColor(bgColorInt)
                    canGoBack = wv.canGoBack()
                }
            },
        )

        if (coverAlpha > 0.01f) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .alpha(coverAlpha),
            ) {
                ParchmentBackground(theme = theme)
            }
        }
    }
}

internal fun normalizeKernelRoute(rawRoute: String): String {
    val trimmed = rawRoute.trim()
    if (trimmed.isEmpty()) return "/"
    return if (trimmed.startsWith("/")) trimmed else "/$trimmed"
}

internal fun buildAppPackUrl(
    context: Context,
    initialRoute: String,
    locale: AppLocale = AppLocale.current,
    isDark: Boolean = false,
): String {
    val route = normalizeKernelRoute(initialRoute)
    val entry = AppPackStore.activeSnapshot(context.applicationContext)
        ?.manifest?.entry?.trim()?.trimStart('/')?.ifEmpty { "index.html" }
        ?: "index.html"
    return Uri.Builder()
        .scheme("https")
        .authority(NativeMediaBridge.HOST)
        .appendEncodedPath(entry)
        .appendQueryParameter("route", route)
        .appendQueryParameter("locale", locale.tag)
        .appendQueryParameter("theme", if (isDark) "dark" else "light")
        .appendQueryParameter("dark", if (isDark) "1" else "0")
        .appendQueryParameter("embedded", "1")
        .build()
        .toString()
}

private fun buildKernelSyncScript(stateJson: String, isDark: Boolean, localeTag: String): String {
    val mode = if (isDark) "dark" else "light"
    val quotedLocale = JSONObject.quote(localeTag)
    val quotedMode = JSONObject.quote(mode)
    return """
        (function(){
          try {
            var root = document.documentElement;
            if (root) {
              root.classList.toggle('dark', $isDark);
              root.dataset.theme = $quotedMode;
              root.lang = $quotedLocale;
              root.style.colorScheme = $quotedMode;
            }
            if (window.localStorage) {
              window.localStorage.setItem('askbible-theme-mode', $quotedMode);
              window.localStorage.setItem('askbible-locale', $quotedLocale);
            }
            var next = $stateJson;
            window.__ASKBIBLE_INIT__ = next;
            if (window.askbibleUpdateState) {
              window.askbibleUpdateState(next);
            }
            if (window.__askbibleEmit) {
              window.__askbibleEmit('shell.stateChanged', next);
              window.__askbibleEmit('shell.themeChanged', { dark: $isDark, mode: $quotedMode });
              window.__askbibleEmit('shell.localeChanged', { locale: $quotedLocale });
            }
          } catch (e) {}
        })();
    """.trimIndent()
}
