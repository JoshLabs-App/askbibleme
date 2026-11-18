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

    /** Validate complete SQLite pages, including chunked transfers without Content-Length. */
    fun isInstalled(context: Context) = SQLiteDownload.isComplete(localFile(context))

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
            try {
                SQLiteDownload.install(R2_URL, dest) { progress ->
                    state = State.Downloading(progress)
                }
                InfoEditionDatabase.resetShared()
                state = State.Done
            } catch (e: Exception) {
                state = State.Failed(e.message ?: "download failed")
            }
        }
    }
}
