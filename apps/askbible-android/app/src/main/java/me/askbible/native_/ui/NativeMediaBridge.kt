package me.askbible.native_.ui

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Base64
import android.util.Log
import android.view.HapticFeedbackConstants
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import me.askbible.native_.ReadingReminder
import me.askbible.native_.audio.AmbientPlayer
import me.askbible.native_.audio.ChapterAudioPlayer
import me.askbible.native_.audio.MusicPlayer
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.AppPackManifestRules
import me.askbible.native_.data.AppPackStore
import me.askbible.native_.data.BibleCatalog
import me.askbible.native_.data.Endpoints
import me.askbible.native_.data.MemberAuthRules
import me.askbible.native_.data.MemberAuthStore
import me.askbible.native_.data.NativeBridgeContract
import me.askbible.native_.data.PackStore
import me.askbible.native_.data.SQLiteDownload
import me.askbible.native_.data.ScriptureDatabase
import me.askbible.native_.data.ScriptureSearchRules
import me.askbible.native_.data.ScriptureSearchScope
import me.askbible.native_.data.ScriptureTranslation
import me.askbible.native_.data.SearchChapterRef
import me.askbible.native_.data.TranslationDelivery
import me.askbible.native_.data.TranslationDownloader
import me.askbible.native_.data.XrefDatabase
import me.askbible.native_.data.name
import me.askbible.native_.home.HomeVerseController
import me.askbible.native_.widget.DailyVerseWidget
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileOutputStream
import java.lang.ref.WeakReference

/**
 * 极薄原生底座桥（DECISIONS D-44 / D-47，与 iOS `NativeMediaBridge.swift` 对称）：
 * 1. `https://pack.askbible.local/` 同源离线资源加载器（优先读 D-47 `AppPackStore` 增量热更包，兼容 `PackStore` 单文件胶囊与内置 `assets/`），所有本地拦截响应强制附带 `Cache-Control: no-store, no-cache`；
 * 2. `/local-db/chapter`、`/local-db/search`、`/local-db/translations` 本地 SQLite 直查路由（复用 `ScriptureDatabase`）；
 * 3. `window.AskBibleBridge` 5 组最小双向契约（`audio` / `shell` / `pack` / `auth` / `sys`）与 `window.__askbibleEmit` 原生事件推送，并完整保留 `window.askbibleNative` 兼容旧胶囊。
 */
class NativeMediaBridge(
    private val context: Context,
    private val chapterAudio: ChapterAudioPlayer? = null,
    private val musicPlayer: MusicPlayer? = null,
    private val homeController: HomeVerseController? = null,
    private val ambientPlayer: AmbientPlayer? = null,
    var onSetSleepTimer: ((Int) -> Unit)? = null,
    var onOpenChapter: ((String, Int) -> Unit)? = null,
    var onResumeReading: (() -> Unit)? = null,
    var onBootHealthy: (() -> Unit)? = null,
    var onPageFinishedCallback: ((WebView) -> Unit)? = null,
    private val authStore: MemberAuthStore? = null,
    private val translationDownloader: TranslationDownloader? = null,
    var onSetTab: ((String) -> Unit)? = null,
    var onSetTheme: ((String) -> Unit)? = null,
    var onPlayChapter: ((String, Int, String?) -> Unit)? = null,
    var onAuthSignIn: ((String) -> Unit)? = null,
    var onAuthSignOut: (() -> Unit)? = null,
) {
    companion object {
        const val HOST = "pack.askbible.local"
        const val BASE_ORIGIN = "https://$HOST"
        const val BRIDGE_NAME = "askbibleNativeBridge"
        const val WATCHDOG_TIMEOUT_MS = 3_000L
        private const val TAG_PACK = "AskBiblePack"
        private const val TAG_PLAYBACK = "AskBiblePlayback"
    }

    private val appContext = context.applicationContext
    private val mainHandler = Handler(Looper.getMainLooper())
    private val bridgeJob = SupervisorJob()
    private val bridgeScope = CoroutineScope(bridgeJob + Dispatchers.IO)
    private var observedWebView: WeakReference<WebView>? = null
    private var watchdogUrl: String? = null
    private var watchdogRunnable: Runnable? = null
    private var watchdogInitStateJson: String? = null
    @Volatile
    private var bootHealthyReceived = false

    private val readyToSwapListener: (String) -> Unit = { bundleId ->
        emitPackReadyToSwap(bundleId)
    }

    private val bootstrapJS = """
        (function(){
          if (document.documentElement) {
            document.documentElement.style.overscrollBehavior = 'none';
          }
          if (!window.__askbibleCtxHooked) {
            window.__askbibleCtxHooked = true;
            document.addEventListener('contextmenu', function(e){ e.preventDefault(); }, { passive: false });
          }
          if (!window.__askbibleBridgeReady) {
            window.__askbibleBridgeReady = true;
            var pending = {};
            var seq = 0;
            var listeners = {};
            window.__askbibleEmit = function(event, payload) {
              try {
                var list = listeners[event];
                if (list) {
                  for (var i = 0; i < list.length; i++) {
                    try { list[i](payload); } catch (err) {}
                  }
                }
                window.dispatchEvent(new CustomEvent('askbible:' + event, { detail: payload }));
              } catch (e) {}
            };
            window.__askbibleResolve = function(id, ok, valueOrError) {
              var entry = pending[id];
              if (!entry) return;
              delete pending[id];
              if (ok) entry.resolve(valueOrError);
              else entry.reject(new Error(typeof valueOrError === 'string' ? valueOrError : 'Bridge error'));
            };
            window.AskBibleBridge = {
              platform: 'android',
              call: function(method, params) {
                return new Promise(function(resolve, reject) {
                  if (!window.$BRIDGE_NAME || !window.$BRIDGE_NAME.callBridge) {
                    reject(new Error('AskBibleBridge unavailable'));
                    return;
                  }
                  var id = 'cb_' + (++seq);
                  pending[id] = { resolve: resolve, reject: reject };
                  try {
                    window.$BRIDGE_NAME.callBridge(id, String(method || ''), JSON.stringify(params || {}));
                  } catch (err) {
                    delete pending[id];
                    reject(err);
                  }
                });
              },
              on: function(event, fn) {
                if (typeof fn !== 'function') return function(){};
                if (!listeners[event]) listeners[event] = [];
                listeners[event].push(fn);
                return function() {
                  var arr = listeners[event];
                  if (!arr) return;
                  var idx = arr.indexOf(fn);
                  if (idx >= 0) arr.splice(idx, 1);
                };
              }
            };
          }
          window.askbibleNative = {
            platform: 'android',
            send: function(action, payload) {
              if (window.$BRIDGE_NAME) {
                window.$BRIDGE_NAME.postMessage(action, JSON.stringify(payload || {}));
              }
            }
          };
        })();
    """.trimIndent()

    @SuppressLint("SetJavaScriptEnabled")
    fun configureWebView(webView: WebView, isDark: Boolean = false) {
        observedWebView = WeakReference(webView)
        AppPackStore.addReadyToSwapListener(readyToSwapListener)
        webView.setBackgroundColor(if (isDark) Color.parseColor("#1A1512") else Color.parseColor("#ECD9B9"))
        webView.overScrollMode = View.OVER_SCROLL_NEVER
        webView.isVerticalScrollBarEnabled = false
        webView.isHorizontalScrollBarEnabled = false
        webView.setOnLongClickListener { true }
        webView.isLongClickable = false
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
        }
        webView.addJavascriptInterface(this, BRIDGE_NAME)
        ViewCompat.setOnApplyWindowInsetsListener(webView) { v, insets ->
            val imeBottomPx = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
            val density = v.resources.displayMetrics.density.coerceAtLeast(1f)
            val imeDp = (imeBottomPx / density).toInt()
            v.post {
                val js = """
                    if (document.documentElement) {
                      document.documentElement.style.setProperty('--askbible-ime-height', '${imeDp}px');
                    }
                    if (window.__askbibleEmit) {
                      window.__askbibleEmit('shell.keyboardHeight', { heightDp: $imeDp });
                    }
                """.trimIndent()
                (v as? WebView)?.evaluateJavascript(js, null)
            }
            insets
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(cm: ConsoleMessage?): Boolean {
                if (cm != null) {
                    Log.i(TAG_PACK, "[JS:${cm.messageLevel()}] ${cm.message()} @${cm.lineNumber()}")
                }
                return true
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                val url = request?.url ?: return null
                if (url.host != HOST) return null
                val rawPath = (url.path ?: "").trim('/')
                if (rawPath.contains("..") || rawPath.contains("\\")) {
                    return notFound()
                }
                if (rawPath == "local-db" || rawPath.startsWith("local-db/")) {
                    return handleLocalDbRequest(url)
                }
                val resolvedPath = rawPath.ifEmpty {
                    AppPackStore.activeSnapshot(appContext)?.manifest?.entry ?: "index.html"
                }
                return serveLocalAsset(resolvedPath)
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                view?.evaluateJavascript(bootstrapJS, null)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                val wv = view ?: return
                wv.evaluateJavascript(bootstrapJS, null)
                onPageFinishedCallback?.invoke(wv)
            }
        }
    }

    /** 直接以内存内联自包含 HTML 加载胶囊（零网络/零拦截器子请求/防三星透明图层丢失）并启动 3 秒看门狗 */
    fun loadInlinePack(webView: WebView, initialStateJson: String): Boolean {
        val snap = PackStore.loadWebPackFiles(appContext) ?: return false
        val rawHtmlBytes = snap.files["index.html"] ?: return false
        var html = String(rawHtmlBytes, Charsets.UTF_8)
        val cssBytes = snap.files["app.css"]
        if (cssBytes != null && html.contains("<link rel='stylesheet' href='app.css'>")) {
            html = html.replace("<link rel='stylesheet' href='app.css'>", "<style>${String(cssBytes, Charsets.UTF_8)}</style>")
        }
        val jsBytes = snap.files["app.js"]
        if (jsBytes != null && html.contains("<script src='app.js'></script>")) {
            html = html.replace("<script src='app.js'></script>", "<script>${String(jsBytes, Charsets.UTF_8)}</script>")
        }
        val initScript = "<script>$bootstrapJS;window.__ASKBIBLE_INIT__=$initialStateJson;</script>"
        html = if (html.contains("<!--__ASKBIBLE_INIT_SLOT__-->")) {
            html.replace("<!--__ASKBIBLE_INIT_SLOT__-->", initScript)
        } else {
            html.replace("</head>", "$initScript</head>")
        }

        observedWebView = WeakReference(webView)
        watchdogUrl = null
        watchdogInitStateJson = initialStateJson
        beginWatchdogIfHotPack()
        webView.loadDataWithBaseURL("$BASE_ORIGIN/", html, "text/html", "UTF-8", null)
        return true
    }

    /** 加载本地胶囊 / 静态内核 URL 并启动 3 秒防变砖看门狗（仅加载热更包时启用） */
    fun loadLocalPack(webView: WebView, url: String = "$BASE_ORIGIN/") {
        observedWebView = WeakReference(webView)
        watchdogUrl = url
        watchdogInitStateJson = null
        beginWatchdogIfHotPack()
        webView.loadUrl(url)
    }

    private fun beginWatchdogIfHotPack() {
        cancelWatchdog()
        bootHealthyReceived = false
        val isHotAppPack = AppPackStore.activeSnapshot(appContext)?.isHotPack == true
        val isHotWebPack = PackStore.loadWebPackFiles(appContext)?.isHotPack == true
        if (!isHotAppPack && !isHotWebPack) return

        val task = Runnable {
            if (bootHealthyReceived) return@Runnable
            Log.w(TAG_PACK, "Watchdog timeout on hot pack; rolling back to builtin")
            if (isHotAppPack) AppPackStore.rollbackHotAppPack(appContext)
            if (isHotWebPack) PackStore.rollbackHotWebPack(appContext)
            val wv = observedWebView?.get() ?: return@Runnable
            val initJson = watchdogInitStateJson
            if (initJson != null) {
                loadInlinePack(wv, initJson)
            } else {
                watchdogUrl?.let { wv.loadUrl(it) }
            }
        }
        watchdogRunnable = task
        mainHandler.postDelayed(task, WATCHDOG_TIMEOUT_MS)
    }

    fun cancelWatchdog() {
        watchdogRunnable?.let { mainHandler.removeCallbacks(it) }
        watchdogRunnable = null
    }

    fun release() {
        cancelWatchdog()
        bridgeJob.cancel()
    }

    // ---- 原生向 JS 推送事件（`window.__askbibleEmit`） ----

    fun emit(event: String, payload: JSONObject = JSONObject()) {
        val escapedEvent = JSONObject.quote(event)
        val jsonPayload = payload.toString()
        mainHandler.post {
            val wv = observedWebView?.get() ?: return@post
            wv.evaluateJavascript("window.__askbibleEmit && window.__askbibleEmit($escapedEvent, $jsonPayload);", null)
        }
    }

    fun emitAudioState() {
        mainHandler.post {
            emit("audio.state", buildAudioStateJson())
        }
    }

    fun emitTabSelected(tab: String) {
        emit("shell.tabSelected", JSONObject().put("tab", tab))
    }

    fun emitBackPressed() {
        emit("shell.backPressed", JSONObject())
    }

    fun emitPackReadyToSwap(bundleId: String) {
        emit("pack.readyToSwap", JSONObject().put("bundleId", bundleId))
    }

    // ---- D-47 `window.AskBibleBridge.call(...)` 双向 RPC ----

    @JavascriptInterface
    fun callBridge(callId: String, method: String, paramsJson: String?) {
        val params = runCatching {
            if (paramsJson.isNullOrBlank()) JSONObject() else JSONObject(paramsJson)
        }.getOrDefault(JSONObject())

        when (method.trim()) {
            "audio.intent" -> mainHandler.post {
                runCatching { handleAudioIntent(params) }
                    .onSuccess { resolveBridgeOk(callId, it) }
                    .onFailure { resolveBridgeErr(callId, it.message ?: "audio_intent_failed") }
            }
            "shell.setTab" -> mainHandler.post {
                val tab = params.optString("tab", "").trim()
                if (tab.isEmpty()) {
                    resolveBridgeErr(callId, "missing_tab")
                } else {
                    onSetTab?.invoke(tab)
                    emitTabSelected(tab)
                    resolveBridgeOk(callId, JSONObject().put("tab", tab))
                }
            }
            "shell.setTheme" -> mainHandler.post {
                val mode = params.optString("mode", "system").trim().lowercase()
                val normalized = when (mode) {
                    "dark", "light", "system" -> mode
                    else -> "system"
                }
                appContext.getSharedPreferences("askbible.appearance", Context.MODE_PRIVATE)
                    .edit()
                    .putString("mode", normalized)
                    .apply()
                onSetTheme?.invoke(normalized)
                observedWebView?.get()?.let { wv ->
                    val isDark = normalized == "dark"
                    wv.setBackgroundColor(if (isDark) Color.parseColor("#1A1512") else Color.parseColor("#ECD9B9"))
                }
                resolveBridgeOk(callId, JSONObject().put("mode", normalized))
            }
            "shell.haptic" -> mainHandler.post {
                val style = params.optString("style", "light").trim().lowercase()
                triggerHaptic(style)
                resolveBridgeOk(callId, JSONObject().put("style", style))
            }
            "shell.bootHealthy", "pack.bootHealthy" -> mainHandler.post {
                markBootHealthy()
                resolveBridgeOk(callId, JSONObject().put("ok", true))
            }
            "pack.status" -> bridgeScope.launch {
                val status = PackStore.appPackStatusJson(appContext)
                resolveBridgeOk(callId, status)
            }
            "pack.checkNow" -> bridgeScope.launch {
                val result = PackStore.refreshAppPackSync(appContext, force = true)
                PackStore.refreshInstalledPacksSync(appContext, force = true)
                val out = JSONObject()
                    .put("reachable", result.reachable)
                    .put("bundleId", result.bundleId ?: JSONObject.NULL)
                    .put("downloadedFiles", result.downloadedFiles)
                    .put("reusedFiles", result.reusedFiles)
                    .put("readyToSwap", result.readyToSwap)
                if (result.readyToSwap && result.bundleId != null) {
                    emitPackReadyToSwap(result.bundleId)
                }
                resolveBridgeOk(callId, out)
            }
            "pack.downloadTranslation" -> bridgeScope.launch {
                val id = params.optString("id", "").trim()
                if (id.isEmpty()) {
                    resolveBridgeErr(callId, "missing_translation_id")
                    return@launch
                }
                val t = ScriptureTranslation.find(id)
                if (t == null) {
                    resolveBridgeErr(callId, "unknown_translation:$id")
                    return@launch
                }
                if (t.delivery == TranslationDelivery.BUNDLED || TranslationDownloader.isInstalled(appContext, t.id)) {
                    resolveBridgeOk(callId, JSONObject().put("ok", true).put("id", t.id).put("installed", true))
                    return@launch
                }
                if (t.delivery != TranslationDelivery.DOWNLOAD || t.downloadUrl.isEmpty()) {
                    resolveBridgeErr(callId, "translation_not_downloadable:$id")
                    return@launch
                }
                runCatching {
                    SQLiteDownload.install(
                        url = Endpoints.rebasedMedia(t.downloadUrl),
                        destination = TranslationDownloader.localFile(appContext, t.id),
                    )
                    resolveBridgeOk(callId, JSONObject().put("ok", true).put("id", t.id).put("installed", true))
                }.onFailure { err ->
                    resolveBridgeErr(callId, err.message ?: "download_failed")
                }
            }
            "pack.commitSwap" -> bridgeScope.launch {
                val swappedId = PackStore.commitPendingSwap(appContext)
                if (swappedId != null) {
                    mainHandler.post {
                        observedWebView?.get()?.clearCache(false)
                    }
                }
                resolveBridgeOk(
                    callId,
                    JSONObject()
                        .put("swapped", swappedId != null)
                        .put("bundleId", swappedId ?: JSONObject.NULL),
                )
            }
            "auth.signIn" -> mainHandler.post {
                val provider = params.optString("provider", "email").trim().lowercase()
                onAuthSignIn?.invoke(provider)
                resolveBridgeOk(callId, JSONObject().put("started", true).put("provider", provider))
            }
            "auth.getSession" -> mainHandler.post {
                resolveBridgeOk(callId, readSessionJson())
            }
            "auth.signOut" -> bridgeScope.launch {
                val store = authStore
                if (store != null) {
                    store.signOut()
                } else {
                    appContext.getSharedPreferences("member-auth", Context.MODE_PRIVATE)
                        .edit()
                        .remove(MemberAuthRules.SESSION_KEY)
                        .apply()
                }
                mainHandler.post {
                    onAuthSignOut?.invoke()
                    resolveBridgeOk(callId, JSONObject().put("signedOut", true))
                }
            }
            "sys.setReminder" -> mainHandler.post {
                val enabled = params.optBoolean("enabled", false)
                val h = params.optInt("hour", ReadingReminder.hour(appContext))
                val m = params.optInt("minute", ReadingReminder.minute(appContext))
                val applied = ReadingReminder.apply(appContext, enabled, h, m)
                resolveBridgeOk(
                    callId,
                    JSONObject()
                        .put("applied", applied)
                        .put("enabled", ReadingReminder.enabled(appContext))
                        .put("hour", ReadingReminder.hour(appContext))
                        .put("minute", ReadingReminder.minute(appContext)),
                )
            }
            "sys.syncWidget" -> mainHandler.post {
                val verseObj = params.optJSONObject("verse")
                if (verseObj != null) {
                    val text = verseObj.optString("text", "").trim()
                    val reference = verseObj.optString("reference", "").trim()
                    val verseKey = verseObj.optString("verseKey", "MAT.23.12").trim().ifEmpty { "MAT.23.12" }
                    if (text.isNotEmpty() && reference.isNotEmpty()) {
                        DailyVerseWidget.push(appContext, text, reference, verseKey)
                    } else {
                        DailyVerseWidget.refreshAll(appContext)
                    }
                } else {
                    DailyVerseWidget.refreshAll(appContext)
                }
                resolveBridgeOk(callId, JSONObject().put("ok", true))
            }
            "sys.shareImage" -> bridgeScope.launch {
                val dataUrl = params.optString("dataUrl", "").trim()
                val text = params.optString("text", "").trim()
                val ok = shareImageOrText(dataUrl, text)
                if (ok) {
                    resolveBridgeOk(callId, JSONObject().put("ok", true))
                } else {
                    resolveBridgeErr(callId, "share_failed")
                }
            }
            else -> resolveBridgeErr(callId, "unknown_method:$method")
        }
    }

    private fun resolveBridgeOk(callId: String, value: JSONObject) {
        val quotedId = JSONObject.quote(callId)
        val payload = value.toString()
        mainHandler.post {
            observedWebView?.get()?.evaluateJavascript(
                "window.__askbibleResolve && window.__askbibleResolve($quotedId, true, $payload);",
                null,
            )
        }
    }

    private fun resolveBridgeErr(callId: String, message: String) {
        val quotedId = JSONObject.quote(callId)
        val quotedErr = JSONObject.quote(message)
        mainHandler.post {
            observedWebView?.get()?.evaluateJavascript(
                "window.__askbibleResolve && window.__askbibleResolve($quotedId, false, $quotedErr);",
                null,
            )
        }
    }

    /** 兼容旧版单文件胶囊 `window.askbibleNative.send(action, payload)` */
    @JavascriptInterface
    fun postMessage(action: String, payloadJson: String?) {
        val payload = runCatching {
            if (payloadJson.isNullOrBlank()) JSONObject() else JSONObject(payloadJson)
        }.getOrDefault(JSONObject())

        mainHandler.post {
            when (action) {
                "bootHealthy" -> markBootHealthy()
                "openChapter" -> {
                    val bookId = payload.optString("bookId", "").trim()
                    val chapter = maxOf(1, payload.optInt("chapter", 1))
                    if (bookId.isNotEmpty()) {
                        onOpenChapter?.invoke(bookId, chapter)
                    }
                }
                "resumeReading" -> onResumeReading?.invoke()
                "pauseChapter" -> chapterAudio?.pause()
                "resumeChapter" -> chapterAudio?.resume()
                "seekChapter" -> chapterAudio?.seekTo(payload.optDouble("seconds", 0.0))
                "toggleMusic" -> musicPlayer?.toggle()
                "pauseMusic" -> musicPlayer?.pause()
                "stopGoldenVerse" -> homeController?.stopVoice()
                "stopAmbient" -> ambientPlayer?.stop()
                "setSleepTimer" -> onSetSleepTimer?.invoke(maxOf(0, payload.optInt("minutes", 0)))
                "refreshWidget" -> DailyVerseWidget.refreshAll(appContext)
                "setReminder" -> {
                    val enabled = payload.optBoolean("enabled", false)
                    val h = payload.optInt("hour", ReadingReminder.hour(appContext))
                    val m = payload.optInt("minute", ReadingReminder.minute(appContext))
                    ReadingReminder.apply(appContext, enabled, h, m)
                }
            }
        }
    }

    private fun markBootHealthy() {
        bootHealthyReceived = true
        cancelWatchdog()
        onBootHealthy?.invoke()
    }

    // ---- Group 2: 三路音频意图分发与状态快照 ----

    private fun handleAudioIntent(params: JSONObject): JSONObject {
        val stream = params.optString("stream", "").trim().lowercase()
        val action = params.optString("action", "").trim().lowercase()
        val origin = params.optString("origin", "kernel").trim().ifEmpty { "kernel" }
        val payload = params.optJSONObject("payload") ?: JSONObject()
        Log.i(TAG_PLAYBACK, "bridge audio.intent stream=$stream action=$action origin=$origin")

        when (stream) {
            "scripture" -> when (action) {
                "play", "resume" -> {
                    val bookId = payload.optString("bookId", "").trim().uppercase()
                    val chapter = payload.optInt("chapter", 0)
                    val translationId = payload.optString("translationId", "").trim().ifEmpty { null }
                    if (bookId.isNotEmpty() && chapter >= 1 && onPlayChapter != null) {
                        onPlayChapter?.invoke(bookId, chapter, translationId)
                    } else {
                        chapterAudio?.resume()
                    }
                }
                "pause" -> chapterAudio?.pause()
                "toggle" -> chapterAudio?.toggle()
                "seek" -> chapterAudio?.seekTo(payload.optDouble("seconds", 0.0))
                "next", "skipnext" -> chapterAudio?.onSkipNext?.invoke()
                "cycleloop" -> chapterAudio?.cycleLoop()
                "cyclerate" -> chapterAudio?.cycleRate()
                "sleeptimer" -> onSetSleepTimer?.invoke(maxOf(0, payload.optInt("minutes", 0)))
            }
            "music" -> when (action) {
                "play", "resume" -> {
                    if (payload.has("index")) {
                        musicPlayer?.select(payload.optInt("index", 0))
                    } else {
                        val album = payload.optString("album", "").trim()
                        if (album.isNotEmpty()) {
                            musicPlayer?.selectAlbum(album)
                        }
                        musicPlayer?.resume()
                    }
                }
                "pause" -> musicPlayer?.pause()
                "toggle" -> musicPlayer?.toggle()
                "next" -> musicPlayer?.next()
                "previous", "prev" -> musicPlayer?.previous()
                "selectalbum" -> {
                    val album = payload.optString("album", "").trim()
                    if (album.isNotEmpty()) musicPlayer?.selectAlbum(album)
                }
                "selecttrack" -> musicPlayer?.select(payload.optInt("index", 0))
                "seek" -> musicPlayer?.seekTo(payload.optDouble("seconds", 0.0))
                "seekratio" -> musicPlayer?.seekRatio(payload.optDouble("ratio", 0.0))
                "togglerepeatone" -> musicPlayer?.toggleRepeatOne()
                "togglerepeatall" -> musicPlayer?.toggleRepeatAll()
                "sleeptimer" -> onSetSleepTimer?.invoke(maxOf(0, payload.optInt("minutes", 0)))
            }
            "verse" -> when (action) {
                "play", "start", "resume" -> homeController?.startVoice()
                "pause", "stop" -> homeController?.stopVoice()
                "toggle" -> homeController?.toggleVoice()
                "advance", "next" -> homeController?.advance(
                    play = payload.optBoolean("play", homeController.voiceOn),
                )
                "sleeptimer" -> onSetSleepTimer?.invoke(maxOf(0, payload.optInt("minutes", 0)))
            }
            "ambient" -> when (action) {
                "play", "start" -> ambientPlayer?.start(payload.optString("slotId", "rain"))
                "pause", "stop" -> ambientPlayer?.stop()
                "toggle" -> ambientPlayer?.toggle()
            }
        }
        val snapshot = buildAudioStateJson()
        emit("audio.state", snapshot)
        return snapshot
    }

    private fun buildAudioStateJson(): JSONObject {
        val sc = chapterAudio
        val mu = musicPlayer
        val hv = homeController
        val am = ambientPlayer

        val scriptureJson = JSONObject().apply {
            put("isPlaying", sc?.isPlaying == true)
            put("isLoading", sc?.isLoading == true)
            put("wantsPlayback", sc?.wantsPlayback == true)
            put("currentTime", sc?.currentTime ?: 0.0)
            put("duration", sc?.duration ?: 0.0)
            put("activeVerse", sc?.activeVerse ?: JSONObject.NULL)
            put("activeVerseProgress", sc?.activeVerseProgress ?: 0.0)
            put("loopMode", sc?.loopMode?.name?.lowercase() ?: "forward")
            put("rate", sc?.rate?.toDouble() ?: 1.0)
        }
        val musicJson = JSONObject().apply {
            put("isPlaying", mu?.isPlaying == true)
            put("isLoading", mu?.isLoading == true)
            put("album", mu?.album ?: "")
            put("trackIndex", mu?.trackIndex ?: 0)
            put("trackId", mu?.track?.id ?: JSONObject.NULL)
            put("trackTitle", mu?.track?.localizedTitle ?: JSONObject.NULL)
            put("currentTime", mu?.currentTime ?: 0.0)
            put("duration", mu?.displayDuration ?: 0.0)
            put("repeatMode", mu?.repeatMode?.raw ?: "all")
        }
        val verseJson = JSONObject().apply {
            put("voiceOn", hv?.voiceOn == true)
            put("isPlaying", hv?.player?.isPlaying == true)
            put("voiceAvailable", hv?.voiceAvailable == true)
            put("verseKey", hv?.verseKey ?: "")
            put("text", hv?.verse?.text ?: "")
            put("reference", hv?.verse?.reference ?: "")
        }
        val ambientJson = JSONObject().apply {
            put("isOn", am?.isOn == true)
            put("slotId", am?.slotId ?: JSONObject.NULL)
        }
        return JSONObject()
            .put("scripture", scriptureJson)
            .put("music", musicJson)
            .put("verse", verseJson)
            .put("ambient", ambientJson)
    }

    // ---- Group 3: 原生触觉（HapticFeedbackConstants + VibrationEffect） ----

    private fun triggerHaptic(style: String) {
        val wv = observedWebView?.get()
        if (wv != null) {
            val constant = when (style) {
                "success" -> if (Build.VERSION.SDK_INT >= 30) {
                    HapticFeedbackConstants.CONFIRM
                } else {
                    HapticFeedbackConstants.LONG_PRESS
                }
                "medium" -> HapticFeedbackConstants.CONTEXT_CLICK
                else -> HapticFeedbackConstants.CLOCK_TICK
            }
            if (wv.performHapticFeedback(constant)) {
                if (style != "success") return
            }
        }
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (appContext.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            appContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        } ?: return
        if (!vibrator.hasVibrator()) return
        val effect = when (style) {
            "success" -> VibrationEffect.createOneShot(22L, 190)
            "medium" -> VibrationEffect.createOneShot(18L, 130)
            else -> VibrationEffect.createOneShot(12L, 60)
        }
        runCatching { vibrator.vibrate(effect) }
    }

    // ---- Group 5: 会话读取 & 图片/文本原生分享 ----

    private fun readSessionJson(): JSONObject {
        val storeUser = authStore?.user
        if (storeUser != null) {
            return JSONObject()
                .put("signedIn", true)
                .put("isAdmin", authStore.isAdmin)
                .put("user", userToJson(storeUser))
        }
        val raw = appContext.getSharedPreferences("member-auth", Context.MODE_PRIVATE)
            .getString(MemberAuthRules.SESSION_KEY, null)
        val parsed = raw?.let { MemberAuthRules.parseSession(it) }
        if (parsed != null) {
            return JSONObject()
                .put("signedIn", true)
                .put("isAdmin", parsed.user.isAdmin == true)
                .put("expiresAt", parsed.expiresAt)
                .put("user", userToJson(parsed.user))
        }
        return JSONObject().put("signedIn", false).put("user", JSONObject.NULL)
    }

    private fun userToJson(u: me.askbible.native_.data.MemberUser): JSONObject =
        JSONObject()
            .put("id", u.id)
            .put("email", u.email)
            .put("name", u.name)
            .put("locale", u.locale ?: JSONObject.NULL)
            .put("createdAt", u.createdAt ?: JSONObject.NULL)
            .put("isAdmin", u.isAdmin ?: JSONObject.NULL)

    private fun shareImageOrText(dataUrl: String, text: String): Boolean = runCatching {
        val shareIntent = if (dataUrl.isNotEmpty()) {
            val base64Part = dataUrl.substringAfter("base64,", "")
            if (base64Part.isEmpty()) return false
            val bytes = Base64.decode(base64Part, Base64.DEFAULT)
            val ext = if (dataUrl.startsWith("data:image/jpeg", ignoreCase = true)) "jpg" else "png"
            val mime = if (ext == "jpg") "image/jpeg" else "image/png"
            val dir = File(appContext.cacheDir, "share").apply { if (!exists()) mkdirs() }
            val outFile = File(dir, "askbible-share-card.$ext")
            FileOutputStream(outFile).use { it.write(bytes) }
            val uri = FileProvider.getUriForFile(appContext, "${appContext.packageName}.fileprovider", outFile)
            Intent(Intent.ACTION_SEND).apply {
                type = mime
                putExtra(Intent.EXTRA_STREAM, uri)
                if (text.isNotEmpty()) putExtra(Intent.EXTRA_TEXT, text)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
        } else if (text.isNotEmpty()) {
            Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, text)
            }
        } else {
            return false
        }

        val chooser = Intent.createChooser(shareIntent, null).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        mainHandler.post {
            runCatching { context.startActivity(chooser) }
                .onFailure { appContext.startActivity(chooser) }
        }
        true
    }.getOrDefault(false)

    // ---- Group 1: `/local-db/*` 本地 SQLite 直查路由 ----

    private fun handleLocalDbRequest(url: Uri): WebResourceResponse {
        val path = url.path ?: ""
        return when (path) {
            "/local-db/chapter" -> handleLocalDbChapter(url)
            "/local-db/search" -> handleLocalDbSearch(url)
            "/local-db/translations" -> handleLocalDbTranslations()
            else -> jsonResponse(404, "Not Found", JSONObject().put("error", "unknown_local_db_route"))
        }
    }

    private fun handleLocalDbChapter(url: Uri): WebResourceResponse {
        val translationId = url.getQueryParameter("t")?.trim().orEmpty()
            .ifEmpty { ScriptureTranslation.DEFAULT.id }
        val bookId = url.getQueryParameter("b")?.trim()?.uppercase().orEmpty()
        val chapter = url.getQueryParameter("c")?.trim()?.toIntOrNull() ?: 0
        val book = BibleCatalog.book(bookId)
        if (bookId.isEmpty() || chapter < 1) {
            return jsonResponse(400, "Bad Request", JSONObject().put("error", "invalid_params"))
        }

        val db = ScriptureDatabase.open(appContext, translationId)
            ?: return jsonResponse(
                404,
                "Not Found",
                JSONObject().put("error", "translation_not_installed").put("translationId", translationId),
            )
        return try {
            val verses = db.loadChapter(bookId, chapter)
            val xrefVerses = XrefDatabase.open(appContext)?.let { xdb ->
                try {
                    xdb.versesWithXrefs(bookId, chapter)
                } finally {
                    xdb.close()
                }
            } ?: emptySet()

            val versesArr = JSONArray()
            for (v in verses) {
                val item = JSONObject()
                    .put("number", v.number)
                    .put("text", v.text)
                    .put("themeRepeatCount", v.themeRepeatCount)
                    .put("isGolden", v.isGolden)
                if (v.speechParts != null) {
                    val partsArr = JSONArray()
                    for (p in v.speechParts) {
                        partsArr.put(
                            JSONObject()
                                .put("kind", p.kind.raw)
                                .put("text", p.text),
                        )
                    }
                    item.put("speechParts", partsArr)
                }
                versesArr.put(item)
            }
            val xrefArr = JSONArray()
            for (xv in xrefVerses) xrefArr.put(xv)

            val body = JSONObject()
                .put("translationId", translationId)
                .put("bookId", bookId)
                .put("bookName", book?.name(AppLocale.current) ?: bookId)
                .put("chapter", chapter)
                .put("verses", versesArr)
                .put("xrefVerses", xrefArr)
            jsonResponse(200, "OK", body)
        } finally {
            db.close()
        }
    }

    private fun handleLocalDbSearch(url: Uri): WebResourceResponse {
        val translationId = url.getQueryParameter("t")?.trim().orEmpty()
            .ifEmpty { ScriptureTranslation.DEFAULT.id }
        val query = url.getQueryParameter("q")?.trim().orEmpty()
        val limit = (url.getQueryParameter("limit")?.trim()?.toIntOrNull() ?: 50)
            .coerceIn(1, ScriptureSearchRules.LIMIT)
        val scope = ScriptureSearchScope.parse(url.getQueryParameter("scope"))
        val refBook = url.getQueryParameter("b")?.trim()?.uppercase().orEmpty()
        val refChapter = url.getQueryParameter("c")?.trim()?.toIntOrNull() ?: 0
        val chapterRef = if (refBook.isNotEmpty() && refChapter >= 1) SearchChapterRef(refBook, refChapter) else null

        if (query.isEmpty()) {
            return jsonResponse(
                200,
                "OK",
                JSONObject()
                    .put("translationId", translationId)
                    .put("query", "")
                    .put("total", 0)
                    .put("hits", JSONArray()),
            )
        }

        val db = ScriptureDatabase.open(appContext, translationId)
            ?: return jsonResponse(
                404,
                "Not Found",
                JSONObject().put("error", "translation_not_installed").put("translationId", translationId),
            )
        return try {
            val result = db.search(query, scope, chapterRef)
            val hitsArr = JSONArray()
            for (hit in result.hits.take(limit)) {
                hitsArr.put(
                    JSONObject()
                        .put("bookId", hit.bookId)
                        .put("bookName", hit.bookName)
                        .put("chapter", hit.chapter)
                        .put("verse", hit.verse)
                        .put("text", hit.text),
                )
            }
            val body = JSONObject()
                .put("translationId", translationId)
                .put("query", query)
                .put("total", result.total)
                .put("hits", hitsArr)
            jsonResponse(200, "OK", body)
        } finally {
            db.close()
        }
    }

    private fun handleLocalDbTranslations(): WebResourceResponse {
        val arr = JSONArray()
        for (t in ScriptureTranslation.all) {
            val installed = when (t.delivery) {
                TranslationDelivery.BUNDLED -> true
                TranslationDelivery.DOWNLOAD -> TranslationDownloader.isInstalled(appContext, t.id)
                TranslationDelivery.ONLINE -> false
            }
            arr.put(
                JSONObject()
                    .put("id", t.id)
                    .put("labelZh", t.labelZh)
                    .put("labelEn", t.labelEn)
                    .put("shortZh", t.shortZh)
                    .put("shortZhTw", t.shortZhTw)
                    .put("shortEn", t.shortEn)
                    .put("language", t.language)
                    .put("delivery", t.delivery.name.lowercase())
                    .put("isLocalText", t.isLocalText)
                    .put("installed", installed)
                    .put("hasChapterAudio", t.hasChapterAudio)
                    .put("downloadUrl", t.downloadUrl),
            )
        }
        return jsonResponse(200, "OK", JSONObject().put("translations", arr))
    }

    // ---- 静态资源本地拦截（所有响应强制带 `Cache-Control: no-store, no-cache`） ----

    private fun serveLocalAsset(relativePath: String): WebResourceResponse {
        val cleanPath = AppPackManifestRules.normalizeRelativePath(relativePath) ?: return notFound()
        val ext = cleanPath.substringAfterLast('/', "").substringAfterLast('.', "")

        // 1. 优先读 D-47 `AppPackStore`（热更沙盒包 -> 内置 `assets/app-pack/`）
        AppPackStore.openFile(appContext, cleanPath)?.let { opened ->
            return WebResourceResponse(
                mimeType(ext),
                "utf-8",
                200,
                "OK",
                responseHeaders(),
                opened.stream,
            )
        }

        // 2. 兼容旧版 `PackStore.loadWebPackFiles` 单文件内存胶囊
        val packBytes = PackStore.loadWebPackFiles(appContext)?.files?.get(cleanPath)
        if (packBytes != null) {
            return WebResourceResponse(
                mimeType(ext),
                "utf-8",
                200,
                "OK",
                responseHeaders(),
                ByteArrayInputStream(packBytes),
            )
        }

        // 3. 本地 SQLite 数据库直出
        val fileName = cleanPath.substringAfterLast('/')
        val baseName = fileName.substringBeforeLast('.')
        if (ext == "sqlite") {
            val f = if (baseName == "info-edition") File(appContext.filesDir, "info-edition.sqlite")
            else TranslationDownloader.localFile(appContext, baseName)
            if (f.exists()) {
                return WebResourceResponse(mimeType(ext), "utf-8", 200, "OK", responseHeaders(), f.inputStream())
            }
        }

        val hotWeb = File(File(appContext.filesDir, "web-pack"), cleanPath)
        if (hotWeb.exists()) {
            return WebResourceResponse(mimeType(ext), "utf-8", 200, "OK", responseHeaders(), hotWeb.inputStream())
        }

        val assetHit = runCatching {
            val stream = appContext.assets.open(cleanPath)
            WebResourceResponse(mimeType(ext), "utf-8", 200, "OK", responseHeaders(), stream)
        }.getOrNull()
        if (assetHit != null) return assetHit

        // 4. SPA 无扩展名路由回退到 `app-pack` 的入口 `index.html`
        if (ext.isEmpty()) {
            val entry = AppPackStore.activeSnapshot(appContext)?.manifest?.entry ?: "index.html"
            AppPackStore.openFile(appContext, entry)?.let { opened ->
                return WebResourceResponse("text/html", "utf-8", 200, "OK", responseHeaders(), opened.stream)
            }
        }

        return notFound()
    }

    private fun jsonResponse(statusCode: Int, reason: String, body: JSONObject): WebResourceResponse =
        WebResourceResponse(
            "application/json",
            "utf-8",
            statusCode,
            reason,
            responseHeaders(),
            ByteArrayInputStream(body.toString().toByteArray(Charsets.UTF_8)),
        )

    private fun notFound(): WebResourceResponse =
        WebResourceResponse(
            "text/plain",
            "utf-8",
            404,
            "Not Found",
            responseHeaders(),
            ByteArrayInputStream("Not Found".toByteArray(Charsets.UTF_8)),
        )

    private fun responseHeaders(): Map<String, String> = mapOf(
        "Access-Control-Allow-Origin" to "*",
        "Cache-Control" to NativeBridgeContract.CACHE_CONTROL,
    )

    private fun mimeType(ext: String): String = when (ext.lowercase()) {
        "html" -> "text/html"
        "js", "mjs" -> "application/javascript"
        "css" -> "text/css"
        "json" -> "application/json"
        "sqlite" -> "application/vnd.sqlite3"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "webp" -> "image/webp"
        "woff2" -> "font/woff2"
        "woff" -> "font/woff"
        "mp3" -> "audio/mpeg"
        "m4a" -> "audio/mp4"
        else -> "application/octet-stream"
    }
}
