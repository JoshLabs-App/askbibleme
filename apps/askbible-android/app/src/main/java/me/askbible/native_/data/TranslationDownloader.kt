package me.askbible.native_.data

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * 下载型译本（KJV）：从 R2 拉整本 sqlite 到 filesDir/scripture/<id>.sqlite，装好后离线可读
 * （RN scripture-translation-download.ts；RN 2026-09 起 KJV 不再打包、按需下载）。与 iOS 的 TranslationDownloader 对等。
 */
class TranslationDownloader(private val context: Context) {
    sealed class State {
        object Idle : State()
        data class Downloading(val progress: Double) : State()
        object Done : State()
        data class Failed(val message: String) : State()
    }

    val states = mutableStateMapOf<String, State>()

    fun state(id: String): State = states[id] ?: if (isInstalled(context, id)) State.Done else State.Idle

    /** 没装就下；装好返回 true */
    suspend fun ensure(t: ScriptureTranslation): Boolean {
        if (t.delivery != TranslationDelivery.DOWNLOAD || t.downloadUrl.isEmpty()) return true
        if (isInstalled(context, t.id)) { states[t.id] = State.Done; return true }
        if (states[t.id] is State.Downloading) return false
        states[t.id] = State.Downloading(0.0)
        val ok = withContext(Dispatchers.IO) {
            try {
                val conn = URL(t.downloadUrl).openConnection() as HttpURLConnection
                conn.connectTimeout = 20_000; conn.readTimeout = 60_000
                if (conn.responseCode !in 200..299) throw IllegalStateException("HTTP ${conn.responseCode}")
                val total = conn.contentLengthLong
                val dest = localFile(context, t.id); dest.parentFile?.mkdirs()
                val tmp = File(dest.path + ".part")
                conn.inputStream.use { input ->
                    tmp.outputStream().use { out ->
                        val buf = ByteArray(1 shl 16); var read = 0L
                        while (true) {
                            val n = input.read(buf); if (n < 0) break
                            out.write(buf, 0, n); read += n
                            if (total > 0) states[t.id] = State.Downloading(read.toDouble() / total)
                        }
                    }
                }
                if (!tmp.renameTo(dest)) { tmp.copyTo(dest, overwrite = true); tmp.delete() }
                true
            } catch (e: Exception) {
                states[t.id] = State.Failed(e.message ?: "download failed"); false
            }
        }
        if (ok) states[t.id] = State.Done
        return ok
    }

    companion object {
        fun localFile(context: Context, id: String) = File(File(context.filesDir, "scripture"), "$id.sqlite")
        fun isInstalled(context: Context, id: String) = localFile(context, id).let { it.exists() && it.length() > 0 }
    }
}
