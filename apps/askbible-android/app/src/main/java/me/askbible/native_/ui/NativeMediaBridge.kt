package me.askbible.native_.ui

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import me.askbible.native_.ReadingReminder
import me.askbible.native_.audio.AmbientPlayer
import me.askbible.native_.audio.ChapterAudioPlayer
import me.askbible.native_.audio.MusicPlayer
import me.askbible.native_.data.PackStore
import me.askbible.native_.data.TranslationDownloader
import me.askbible.native_.home.HomeVerseController
import me.askbible.native_.widget.DailyVerseWidget
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.lang.ref.WeakReference

/**
 * 亲儿子极薄原生底座桥（DECISIONS D-44，与 iOS `NativeMediaBridge.swift` 对称）：
 * 1. `https://pack.askbible.local/` 本地离线资源加载器（优先从 [PackStore.loadWebPackFiles] 内存胶囊零拷贝直出，回退 SQLite 与 APK `assets/`，严防路径穿越）；
 * 2. `window.askbibleNative` 双向消息桥：读经跳转 / 继续阅读 / bootHealthy 心跳 / 三路后台音频 / 睡眠定时 / 提醒 / 小组件；
 * 3. 锁死过度滚动露白与系统默认长按菜单，并内置 3 秒防变砖健康看门狗（热更超时自动拉黑坏包并瞬切内置包）。
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
) {
    companion object {
        const val HOST = "pack.askbible.local"
        const val BASE_ORIGIN = "https://$HOST"
        const val BRIDGE_NAME = "askbibleNativeBridge"
        const val WATCHDOG_TIMEOUT_MS = 3_000L
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var observedWebView: WeakReference<WebView>? = null
    private var watchdogUrl: String? = null
    private var watchdogRunnable: Runnable? = null
    @Volatile
    private var bootHealthyReceived = false

    private val bootstrapJS = """
        (function(){
          if (document.documentElement) {
            document.documentElement.style.overscrollBehavior = 'none';
          }
          if (!window.__askbibleCtxHooked) {
            window.__askbibleCtxHooked = true;
            document.addEventListener('contextmenu', function(e){ e.preventDefault(); }, { passive: false });
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
    fun configureWebView(webView: WebView) {
        webView.setBackgroundColor(Color.TRANSPARENT)
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
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                val url = request?.url ?: return null
                if (url.host != HOST) return null
                val rawPath = (url.path ?: "").trim('/')
                if (rawPath.isEmpty() || rawPath.contains("..") || rawPath.contains("\\")) {
                    return notFound()
                }
                return serveLocalAsset(rawPath)
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

    /** 加载本地胶囊 URL 并启动 3 秒防变砖看门狗（仅加载热更胶囊时启用） */
    fun loadLocalPack(webView: WebView, url: String) {
        observedWebView = WeakReference(webView)
        watchdogUrl = url
        beginWatchdogIfHotPack()
        webView.loadUrl(url)
    }

    private fun beginWatchdogIfHotPack() {
        cancelWatchdog()
        bootHealthyReceived = false
        val isHot = PackStore.loadWebPackFiles(context)?.isHotPack == true
        if (!isHot) return

        val task = Runnable {
            if (bootHealthyReceived) return@Runnable
            PackStore.rollbackHotWebPack(context)
            val wv = observedWebView?.get()
            val reloadUrl = watchdogUrl
            if (wv != null && reloadUrl != null) {
                wv.loadUrl(reloadUrl)
            }
        }
        watchdogRunnable = task
        mainHandler.postDelayed(task, WATCHDOG_TIMEOUT_MS)
    }

    fun cancelWatchdog() {
        watchdogRunnable?.let { mainHandler.removeCallbacks(it) }
        watchdogRunnable = null
    }

    @JavascriptInterface
    fun postMessage(action: String, payloadJson: String?) {
        val payload = runCatching {
            if (payloadJson.isNullOrBlank()) JSONObject() else JSONObject(payloadJson)
        }.getOrDefault(JSONObject())

        mainHandler.post {
            when (action) {
                "bootHealthy" -> {
                    bootHealthyReceived = true
                    cancelWatchdog()
                    onBootHealthy?.invoke()
                }
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
                "refreshWidget" -> DailyVerseWidget.refreshAll(context)
                "setReminder" -> {
                    val enabled = payload.optBoolean("enabled", false)
                    val h = payload.optInt("hour", ReadingReminder.hour(context))
                    val m = payload.optInt("minute", ReadingReminder.minute(context))
                    ReadingReminder.apply(context, enabled, h, m)
                }
            }
        }
    }

    private fun serveLocalAsset(relativePath: String): WebResourceResponse {
        val ext = relativePath.substringAfterLast('/', "").substringAfterLast('.', "")
        val packBytes = PackStore.loadWebPackFiles(context)?.files?.get(relativePath)
        if (packBytes != null) {
            return WebResourceResponse(
                mimeType(ext),
                "utf-8",
                200,
                "OK",
                corsHeaders(),
                ByteArrayInputStream(packBytes),
            )
        }

        val fileName = relativePath.substringAfterLast('/')
        val baseName = fileName.substringBeforeLast('.')
        if (ext == "sqlite") {
            val f = if (baseName == "info-edition") File(context.filesDir, "info-edition.sqlite")
            else TranslationDownloader.localFile(context, baseName)
            if (f.exists()) {
                return WebResourceResponse(mimeType(ext), "utf-8", 200, "OK", corsHeaders(), f.inputStream())
            }
        }
        val hotWeb = File(File(context.filesDir, "web-pack"), relativePath)
        if (hotWeb.exists()) {
            return WebResourceResponse(mimeType(ext), "utf-8", 200, "OK", corsHeaders(), hotWeb.inputStream())
        }
        return runCatching {
            val stream = context.assets.open(relativePath)
            WebResourceResponse(mimeType(ext), "utf-8", 200, "OK", corsHeaders(), stream)
        }.getOrElse { notFound() }
    }

    private fun notFound(): WebResourceResponse =
        WebResourceResponse("text/plain", "utf-8", 404, "Not Found", corsHeaders(), ByteArrayInputStream("Not Found".toByteArray()))

    private fun corsHeaders(): Map<String, String> = mapOf(
        "Access-Control-Allow-Origin" to "*",
        "Cache-Control" to "no-cache",
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
        "mp3" -> "audio/mpeg"
        "m4a" -> "audio/mp4"
        else -> "application/octet-stream"
    }
}
