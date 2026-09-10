package me.askbible.native_.audio

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.MediaSession
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import me.askbible.native_.data.AmbientScenes
import me.askbible.native_.data.AmbientSlot
import me.askbible.native_.data.MusicAudioSource
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * 首页环境音播放器：一个槽位无缝循环（REPEAT_MODE_ONE），音量按槽位增益压平。与 iOS 的 AmbientPlayer 对等。
 * R2 点播 + 首次播放后缓存到 cacheDir/ambient-scenes，下次直接吃本地（对应 RN remoteMediaCache）。
 * handleAudioFocus = false：要能和音乐 / 金句同时出声，焦点由音乐播放器持有。
 * 挂一个 MediaSession（id "ambient"）只为让前台服务在只有环境音在放时也保住进程。
 */
class AmbientPlayer(context: Context, private val scope: CoroutineScope) {
    private val appContext = context.applicationContext

    var slotId by mutableStateOf<String?>(null); private set
    var sleepDeadlineMs by mutableStateOf<Long?>(null); private set
    val isOn: Boolean get() = slotId != null

    /** 开环境音前的互斥（人声 + 音乐都在时要停音乐），由 RootScreen 接线 */
    var onWillPlay: (() -> Unit)? = null

    private var ducked = false
    private var sleepJob: Job? = null

    private val player: ExoPlayer = ExoPlayer.Builder(context)
        .setMediaSourceFactory(
            DefaultMediaSourceFactory(
                DefaultDataSource.Factory(
                    context,
                    DefaultHttpDataSource.Factory().setUserAgent(MusicAudioSource.USER_AGENT).setAllowCrossProtocolRedirects(true)
                )
            )
        )
        .build()
    private val mediaSession = MediaSession.Builder(context, player).setId("ambient").build()

    init {
        player.setAudioAttributes(
            // MOVIE：AudioInterruptionMonitor 靠它认出「这是自家环境音，不是别的 App 在响」
            AudioAttributes.Builder().setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).setUsage(C.USAGE_MEDIA).build(),
            false
        )
        player.repeatMode = Player.REPEAT_MODE_ONE
        PlaybackSessions.register(mediaSession)
    }

    private fun cacheDir(): File = File(appContext.cacheDir, "ambient-scenes").apply { mkdirs() }

    fun toggle() = if (isOn) stop() else start(AmbientScenes.DEFAULT_SLOT_ID)

    fun start(id: String) {
        val slot = AmbientScenes.slot(id) ?: return
        onWillPlay?.invoke()
        slotId = id
        val local = File(cacheDir(), slot.file)
        val uri = if (local.exists()) "file://${local.absolutePath}" else AmbientScenes.remoteUrl(id) ?: return
        player.setMediaItem(
            MediaItem.Builder().setUri(uri)
                .setMediaMetadata(MediaMetadata.Builder().setTitle(slot.label).setArtist("AskBible · 环境音").build())
                .build()
        )
        player.volume = slot.gain * (if (ducked) DUCK_GAIN else 1f)
        player.prepare()
        player.playWhenReady = true
        PlaybackSessions.ensureStarted(appContext)
        if (!local.exists()) cache(slot, local)
    }

    fun stop() {
        player.playWhenReady = false
        player.stop()
        player.clearMediaItems()
        slotId = null
    }

    /** 整章朗读时压半，停了恢复 */
    fun setDucked(on: Boolean) {
        ducked = on
        val slot = slotId?.let { AmbientScenes.slot(it) } ?: return
        player.volume = slot.gain * (if (on) DUCK_GAIN else 1f)
    }

    fun setSleepTimer(minutes: Int?) {
        sleepJob?.cancel(); sleepJob = null
        if (minutes == null || minutes <= 0) { sleepDeadlineMs = null; return }
        val deadline = System.currentTimeMillis() + minutes * 60_000L
        sleepDeadlineMs = deadline
        sleepJob = scope.launch(Dispatchers.Main) {
            delay(deadline - System.currentTimeMillis())
            sleepDeadlineMs = null
            stop()
        }
    }

    /** 后台把文件下到本机；下次选它不用再等网络 */
    private fun cache(slot: AmbientSlot, local: File) {
        val url = AmbientScenes.remoteUrl(slot.id) ?: return
        scope.launch(Dispatchers.IO) {
            val tmp = File(local.path + ".part")
            try {
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.connectTimeout = 10_000; conn.readTimeout = 30_000
                if (conn.responseCode == 200) {
                    conn.inputStream.use { input -> tmp.outputStream().use { input.copyTo(it) } }
                    tmp.renameTo(local)
                }
                conn.disconnect()
            } catch (_: Exception) {
                tmp.delete()
            }
        }
    }

    fun release() {
        sleepJob?.cancel()
        PlaybackSessions.unregister(mediaSession)
        mediaSession.release()
        player.release()
    }

    companion object { const val DUCK_GAIN = 0.3f }
}
