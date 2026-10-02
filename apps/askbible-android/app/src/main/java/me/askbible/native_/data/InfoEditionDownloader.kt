package me.askbible.native_.data

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * 「读后两版」内容库（info-edition.sqlite）按需下载器。
 * 首次点进「陪你探索 / 查找资料」时触发，显示「首次准备中」进度条，下载到 filesDir/info-edition.sqlite 后离线可读。
 */
object InfoEditionDownloader {
    private val R2_URL: String get() = Endpoints.mediaBase + "/bible/info-edition.sqlite"

    sealed class State {
        object Idle : State()
        data class Downloading(val progress: Double) : State()
        object Done : State()
        data class Failed(val message: String) : State()
    }

    var state: State by mutableStateOf(State.Idle)
        private set

    fun localFile(context: Context) = File(context.filesDir, "info-edition.sqlite")

    /** 文件头必须是 "SQLite format 3\0"，挡住 404 页面、截断文件（对齐 iOS isValidSQLite） */
    fun isInstalled(context: Context) = isValidSQLite(localFile(context))

    private fun isValidSQLite(f: File): Boolean = runCatching {
        f.length() >= 16 && f.inputStream().use { i -> ByteArray(16).also { i.read(it) } }.contentEquals("SQLite format 3\u0000".toByteArray())
    }.getOrDefault(false)

    fun initState(context: Context) {
        if (state !is State.Done && isInstalled(context)) state = State.Done
    }

    fun resetForRetry() {
        if (state is State.Failed) state = State.Idle
    }

    /**
     * 下载跑在自己的作用域里，不跟界面走。原来挂在 LaunchedEffect(dlState) 上：
     * 进度一变 dlState 就变，effect 被取消重启，IO 读完回到被取消的协程，`state = Done` 永远不执行，
     * 满圈卡在「首次准备中」直到杀进程（2026-09-29 三星实测）。
     */
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var job: Job? = null

    fun download(context: Context) {
        val app = context.applicationContext
        if (isInstalled(app)) { state = State.Done; return }
        if (job?.isActive == true) return
        state = State.Downloading(0.0)
        job = scope.launch {
            val dest = localFile(app)
            val tmp = File(dest.path + ".part")
            try {
                val conn = URL(R2_URL).openConnection() as HttpURLConnection
                conn.connectTimeout = 20_000; conn.readTimeout = 120_000
                if (conn.responseCode !in 200..299)
                    throw IllegalStateException("HTTP ${conn.responseCode}")
                val total = conn.contentLengthLong
                var read = 0L
                conn.inputStream.use { input ->
                    tmp.outputStream().use { out ->
                        val buf = ByteArray(1 shl 16); var lastPct = -1
                        while (true) {
                            val n = input.read(buf); if (n < 0) break
                            out.write(buf, 0, n); read += n
                            val pct = if (total > 0) (read * 100 / total).toInt() else -1
                            if (pct != lastPct) { lastPct = pct; state = State.Downloading(pct / 100.0) }
                        }
                    }
                }
                if (total > 0 && read != total) throw IllegalStateException("truncated $read/$total")
                if (!isValidSQLite(tmp)) throw IllegalStateException("invalid sqlite")
                if (!tmp.renameTo(dest)) { tmp.copyTo(dest, overwrite = true); tmp.delete() }
                InfoEditionDatabase.resetShared()
                state = State.Done
            } catch (e: Exception) {
                tmp.delete()
                state = State.Failed(e.message ?: "download failed")
            }
        }
    }
}
