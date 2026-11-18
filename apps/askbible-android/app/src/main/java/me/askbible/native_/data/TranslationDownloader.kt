package me.askbible.native_.data

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

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
                SQLiteDownload.install(Endpoints.rebasedMedia(t.downloadUrl), localFile(context, t.id)) { progress ->
                    states[t.id] = State.Downloading(progress)
                }
                // 完成状态在 IO 块里写：调用方被取消时 withContext 会丢掉返回值，写在外面就永远卡「下载中」
                states[t.id] = State.Done
                true
            } catch (e: Exception) {
                states[t.id] = State.Failed(e.message ?: "download failed"); false
            }
        }
        return ok
    }

    companion object {
        fun localFile(context: Context, id: String) = File(File(context.filesDir, "scripture"), "$id.sqlite")
        fun isInstalled(context: Context, id: String) = SQLiteDownload.isComplete(localFile(context, id))
    }
}
