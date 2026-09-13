package me.askbible.native_.data

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * 「读后两版」内容库（info-edition.sqlite）按需下载器。
 * 首次点进「陪你探索 / 查找资料」时触发，下载到 filesDir/info-edition.sqlite 后离线可读。
 */
object InfoEditionDownloader {
    private const val R2_URL =
        "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev/bible/info-edition.sqlite"

    sealed class State {
        object Idle : State()
        data class Downloading(val progress: Double) : State()
        object Done : State()
        data class Failed(val message: String) : State()
    }

    var state: State by mutableStateOf(State.Idle)
        private set

    fun localFile(context: Context) = File(context.filesDir, "info-edition.sqlite")

    fun isInstalled(context: Context) = localFile(context).let { it.exists() && it.length() > 0 }

    fun initState(context: Context) {
        if (state is State.Idle && isInstalled(context)) state = State.Done
    }

    fun resetForRetry() {
        if (state is State.Failed) state = State.Idle
    }

    suspend fun download(context: Context) {
        if (state is State.Downloading || isInstalled(context)) return
        state = State.Downloading(0.0)
        val ok = withContext(Dispatchers.IO) {
            try {
                val conn = URL(R2_URL).openConnection() as HttpURLConnection
                conn.connectTimeout = 20_000; conn.readTimeout = 120_000
                if (conn.responseCode !in 200..299)
                    throw IllegalStateException("HTTP ${conn.responseCode}")
                val total = conn.contentLengthLong
                val dest = localFile(context)
                val tmp = File(dest.path + ".part")
                conn.inputStream.use { input ->
                    tmp.outputStream().use { out ->
                        val buf = ByteArray(1 shl 16); var read = 0L
                        while (true) {
                            val n = input.read(buf); if (n < 0) break
                            out.write(buf, 0, n); read += n
                            if (total > 0) state = State.Downloading(read.toDouble() / total)
                        }
                    }
                }
                if (!tmp.renameTo(dest)) { tmp.copyTo(dest, overwrite = true); tmp.delete() }
                true
            } catch (e: Exception) {
                state = State.Failed(e.message ?: "download failed"); false
            }
        }
        if (ok) state = State.Done
    }
}
