package me.askbible.native_.ui

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
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
import me.askbible.native_.data.TranslationDownloader
import me.askbible.native_.home.HomeVerseController
import me.askbible.native_.widget.DailyVerseWidget
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File

/**
 * 亲儿子极薄原生底座桥（DECISIONS D-44，与 iOS `NativeMediaBridge.swift` 对称）：
 * 1. `https://pack.askbible.local/` 本地离线资源加载器（优先读取 [PackStore] 热更目录，回退 APK `assets/`，0ms 离线秒开，严防路径穿越）；
 * 2. `window.askbibleNative` JS 接口：将三路后台音频引擎（读经 / 音乐 / 金句）、睡眠定时、本地提醒与桌面小组件能力暴露给共享内容层；
 * 3. 锁死过度滚动露白与系统默认长按菜单。
 */
class NativeMediaBridge(
    private val context: Context,
    private val chapterAudio: ChapterAudioPlayer? = null,
    private val musicPlayer: MusicPlayer? = null,
    private val homeController: HomeVerseController? = null,
    private val ambientPlayer: AmbientPlayer? = null,
    private val onSetSleepTimer: ((Int) -> Unit)? = null,
) {
    companion object {
        const val HOST = "pack.askbible.local"
        const val BRIDGE_NAME = "askbibleNativeBridge"
    }

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

            override fun onPageFinished(view: WebView?, url: String?) {
                view?.evaluateJavascript(
                    """
                    (function(){
                      document.documentElement.style.overscrollBehavior = 'none';
                      document.addEventListener('contextmenu', function(e){ e.preventDefault(); }, { passive: false });
                      window.askbibleNative = {
                        platform: 'android',
                        send: function(action, payload) {
                          if (window.$BRIDGE_NAME) {
                            window.$BRIDGE_NAME.postMessage(action, JSON.stringify(payload || {}));
                          }
                        }
                      };
                    })();
                    """.trimIndent(),
                    null
                )
            }
        }
    }

    @JavascriptInterface
    fun postMessage(action: String, payloadJson: String?) {
        val payload = runCatching { if (payloadJson.isNullOrBlank()) JSONObject() else JSONObject(payloadJson) }.getOrDefault(JSONObject())
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            when (action) {
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
        val fileName = relativePath.substringAfterLast('/')
        val ext = fileName.substringAfterLast('.', "")
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
