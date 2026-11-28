package me.askbible.native_.ui

import android.net.Uri
import android.view.ViewGroup
import android.webkit.WebView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.AppPackStore
import me.askbible.native_.data.PackStore
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ShellMetrics
import org.json.JSONObject
import kotlin.math.roundToInt

/**
 * 救赎全景（D-47 / D-44 同源离线胶囊宿主，与 iOS `BiblePanoramaView.swift` 对称）：
 * - 优先检测 [AppPackStore.hasAvailablePack]：有 D-47 同源内核包则直接通过 [AppPackWebView] 以 `initialRoute = "/panorama"` 渲染；
 * - 无 D-47 内核包时无缝回退至现有 [PackStore] `web-pack.json` 路径；
 * - 极简兜底：若本地 WebView 组件异常或胶囊缺失，自动呈现羊皮纸入口按钮，永不崩溃。
 */
@Composable
fun BiblePanoramaScreen(
    locale: AppLocale,
    currentBook: String?,
    currentChapter: Int,
    locateRequest: Int,
    onReturnReading: () -> Unit,
    onRead: (String, Int) -> Unit,
    musicPlaying: Boolean = false,
    onToggleMusic: () -> Unit = {},
    theme: Parchment = LocalParchment.current,
    onSelectTab: ((String) -> Unit)? = null,
) {
    val context = LocalContext.current
    var appPackFailed by remember { mutableStateOf(false) }
    val hasAppPack = remember(context) { AppPackStore.hasAvailablePack(context) }

    if (hasAppPack && !appPackFailed) {
        AppPackWebView(
            initialRoute = "/panorama",
            locale = locale,
            theme = theme,
            currentBook = currentBook,
            currentChapter = currentChapter,
            locateRequest = locateRequest,
            handleSystemBack = false,
            onOpenChapter = onRead,
            onSelectTab = { tab ->
                if (onSelectTab != null) {
                    onSelectTab(tab)
                } else if (tab == "read" || tab == "home") {
                    onReturnReading()
                }
            },
            onBack = onReturnReading,
            onLoadFailed = { appPackFailed = true },
        )
        return
    }

    val latestOnReturn by rememberUpdatedState(onReturnReading)
    val latestOnRead by rememberUpdatedState(onRead)

    val insets = WindowInsets.systemBars.asPaddingValues()
    val topInsetDp = insets.calculateTopPadding().value.roundToInt()
    val bottomInsetDp = (ShellMetrics.tabRowHeight.dp + shellTabBarBottomInset() + 36.dp).value.roundToInt()
    val hasPack = remember { PackStore.loadWebPackFiles(context) != null }
    var webViewFailed by remember { mutableStateOf(false) }

    val stateJson = remember(locale, theme.isDark, currentBook, currentChapter, locateRequest, topInsetDp, bottomInsetDp) {
        JSONObject().apply {
            put("locale", locale.tag)
            put("dark", theme.isDark)
            put("scale", 1)
            put("book", currentBook ?: "")
            put("ch", maxOf(1, currentChapter))
            put("hasHistory", currentBook != null)
            put("locateRequest", locateRequest)
            put("topInset", topInsetDp)
            put("bottomInset", bottomInsetDp)
        }.toString()
    }

    val bridge = remember(context) { NativeMediaBridge(context.applicationContext) }
    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    var pageFinished by remember { mutableStateOf(false) }
    var latestStateRef by remember { mutableStateOf(stateJson) }
    latestStateRef = stateJson

    bridge.onResumeReading = { latestOnReturn() }
    bridge.onOpenChapter = { bookId, ch -> latestOnRead(bookId, ch) }
    bridge.onPageFinishedCallback = { wv ->
        pageFinished = true
        wv.evaluateJavascript("window.askbibleUpdateState && window.askbibleUpdateState($latestStateRef);", null)
    }

    LaunchedEffect(stateJson, pageFinished) {
        if (pageFinished) {
            webViewRef?.evaluateJavascript(
                "window.askbibleUpdateState && window.askbibleUpdateState($stateJson);",
                null,
            )
        }
    }

    DisposableEffect(bridge) {
        onDispose {
            bridge.cancelWatchdog()
            webViewRef?.let { wv ->
                wv.stopLoading()
                wv.destroy()
            }
            webViewRef = null
        }
    }

    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)

        if (!hasPack || webViewFailed) {
            PanoramaFallbackView(
                locale = locale,
                theme = theme,
                hasHistory = currentBook != null,
                onAction = {
                    if (currentBook != null) onReturnReading() else onRead("GEN", 1)
                },
            )
        } else {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx ->
                    runCatching {
                        WebView(ctx).apply {
                            layoutParams = ViewGroup.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT,
                            )
                            bridge.configureWebView(this, isDark = theme.isDark)
                            webViewRef = this
                            if (!bridge.loadInlinePack(this, stateJson)) {
                                webViewFailed = true
                            }
                        }
                    }.getOrElse {
                        webViewFailed = true
                        android.view.View(ctx)
                    }
                },
                update = { wv ->
                    wv.setBackgroundColor(
                        if (theme.isDark) android.graphics.Color.parseColor("#1A1512")
                        else android.graphics.Color.parseColor("#ECD9B9"),
                    )
                },
            )
        }
    }
}

@Composable
private fun PanoramaFallbackView(
    locale: AppLocale,
    theme: Parchment,
    hasHistory: Boolean,
    onAction: () -> Unit,
) {
    val gold = if (theme.isDark) Color(0xFFE2A84B) else Color(0xFFB56A18)
    val ink = theme.ink.toColor()
    fun t(zh: String, en: String) = AppLocale.pick(zh, en, locale)

    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(t("救赎全景", "Redemption Story"), color = ink, fontSize = 24.sp, fontWeight = FontWeight.Bold)
            Box(
                Modifier
                    .clip(CircleShape)
                    .background(gold)
                    .clickableNoRipple { onAction() }
                    .padding(horizontal = 20.dp, vertical = 10.dp),
            ) {
                Text(
                    if (hasHistory) t("继续阅读", "Continue Reading") else t("从创世记第 1 章开始", "Begin from Genesis 1"),
                    color = if (theme.isDark) Color(0xFF1A1511) else Color(0xFFFFFDF9),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}
