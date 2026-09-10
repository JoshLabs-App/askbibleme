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
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.MediaSession
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import me.askbible.native_.data.VerseTiming
import me.askbible.native_.data.VerseTimingLookup

/** 循环模式。与 iOS 的 LoopMode、RN 的 ReadScripturePlaybackDock 一致。 */
enum class LoopMode { OFF, CHAPTER, ALL;
    val next: LoopMode get() = when (this) { OFF -> CHAPTER; CHAPTER -> ALL; ALL -> OFF }
}

/**
 * 整章朗读播放器（ExoPlayer）。与 iOS 的 ChapterAudioPlayer 对等。
 *
 * 与 iOS 的实现差异（同一需求两端手段不同，是纯双写的日常）：
 * · 音频焦点：iOS 是 AVAudioSession.interruptionNotification；
 *   这里用 ExoPlayer 的 setAudioAttributes(handleAudioFocus = true)，
 *   由播放器自己处理暂停/恢复，`wantsPlayback` 仍由我们保留意图。
 * · 锁屏控制：iOS 是 MPRemoteCommandCenter；这里是 MediaSession。
 * · 进度回调：iOS 有 addPeriodicTimeObserver；ExoPlayer 没有等价物，
 *   用协程轮询（250ms，与 iOS 的间隔一致）。
 */
class ChapterAudioPlayer(context: Context, private val scope: CoroutineScope) {
    private val appContext = context.applicationContext

    var isPlaying by mutableStateOf(false); private set
    var isLoading by mutableStateOf(false); private set
    /** 用户点过播放（RN wantsPlayback）：开章时预载会短暂 BUFFERING，没点播放前不该转圈 */
    var wantsPlayback by mutableStateOf(false); private set
    /** 被系统「永久」夺走焦点而停的（还想播）：外部声音停了 / 回前台就续播（AudioInterruptionMonitor） */
    private var focusLost = false
    /** 播放位置回调（累计听读时长：RN useFollowNativeProgress → noteScriptureListenProgress） */
    var onProgress: ((Double, Boolean) -> Unit)? = null
    var currentTime by mutableStateOf(0.0); private set
    var duration by mutableStateOf(0.0); private set
    var errorMessage by mutableStateOf<String?>(null); private set
    var activeVerse by mutableStateOf<Int?>(null); private set
    var loopMode by mutableStateOf(LoopMode.OFF); private set
    var rate by mutableStateOf(1.0f); private set

    var onSkipNext: (() -> Unit)? = null
    /** 不循环时一章播完：读经计划流靠它顺到下一章 */
    var onFinished: (() -> Unit)? = null

    /** 睡眠定时到期时刻（epoch ms）；null = 未设。到期只暂停不停止，与 RN 的 SleepTimerFired 一致。 */
    var sleepDeadlineMs by mutableStateOf<Long?>(null); private set
    private var sleepJob: Job? = null

    private var loadedKey: String? = null
    private var timings: List<VerseTiming> = emptyList()
    private var ticker: Job? = null
    private val timingDb = VerseTimingDatabase.open(context)

    private val player: ExoPlayer = ExoPlayer.Builder(context)
        .setMediaSourceFactory(
            DefaultMediaSourceFactory(
                DefaultHttpDataSource.Factory()
                    // fhl.net 需要这个 UA，与 iOS / RN 侧一致
                    .setUserAgent("AskBible.me/1.0 (Android ExoPlayer)")
                    .setAllowCrossProtocolRedirects(true)
            )
        )
        .build()

    // 同进程两个 MediaSession（朗读 / 音乐）id 必须不同，重复会直接抛异常
    private val mediaSession = MediaSession.Builder(context, player).setId("chapter").build()
        .also { PlaybackSessions.register(it) }

    /** 开播前先让别的播放器（音乐）停下：两个播放器不能同时出声 */
    var onWillPlay: (() -> Unit)? = null

    init {
        // handleAudioFocus=true：来电等打断时 ExoPlayer 自动暂停，结束后按需恢复
        player.setAudioAttributes(
            AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
                .setUsage(C.USAGE_MEDIA)
                .build(),
            true
        )
        // listener 写在 init 而不是 apply 块里：apply 里的 this 是 ExoPlayer，
        // isPlaying / duration 会解析到它自己的只读属性而不是本类的状态。
        player.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                this@ChapterAudioPlayer.isPlaying = playing
            }

            override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
                if (playWhenReady) focusLost = false
                else if (reason == Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_FOCUS_LOSS && wantsPlayback) focusLost = true
            }

            override fun onPlaybackStateChanged(state: Int) {
                this@ChapterAudioPlayer.isLoading = state == Player.STATE_BUFFERING
                if (state == Player.STATE_READY && this@ChapterAudioPlayer.duration <= 0) {
                    val d = player.duration
                    if (d > 0) this@ChapterAudioPlayer.duration = d / 1000.0
                }
                if (state == Player.STATE_ENDED) onEnded()
            }

            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                this@ChapterAudioPlayer.errorMessage = error.errorCodeName
                this@ChapterAudioPlayer.isPlaying = false
            }
        })
    }

    /** 装载一章。同一章重复调用不重新装载。 */
    fun load(url: String, key: String, title: String,
             translationId: String, bookId: String, chapter: Int) {
        if (loadedKey == key) return
        loadedKey = key
        wantsPlayback = false
        errorMessage = null
        currentTime = 0.0
        duration = 0.0
        activeVerse = null
        timings = timingDb?.timings(translationId, bookId, chapter) ?: emptyList()

        player.setMediaItem(
            MediaItem.Builder()
                .setUri(url)
                .setMediaMetadata(
                    MediaMetadata.Builder().setTitle(title).setArtist("AskBible").build())
                .build()
        )
        player.prepare()
        startTicker()
    }

    fun toggle() = if (isPlaying) pause() else resume()

    fun resume() {
        onWillPlay?.invoke()
        PlaybackSessions.ensureStarted(appContext)
        wantsPlayback = true
        player.playWhenReady = true
        player.playbackParameters = player.playbackParameters.withSpeed(rate)
    }

    fun pause() { wantsPlayback = false; focusLost = false; player.playWhenReady = false }

    /** 外部声音停了 / 回到前台：永久失焦停掉的、还想播的，叫回来（RN tryResumeScriptureAfterInterruption） */
    fun recoverAfterInterruption() {
        if (!focusLost || !wantsPlayback || isPlaying) return
        if (AudioInterruptionMonitor.callLike || AudioInterruptionMonitor.foreignAudioActive) return
        focusLost = false
        resume()
    }

    fun seekTo(seconds: Double) {
        val clamped = if (duration > 0) seconds.coerceIn(0.0, duration) else maxOf(0.0, seconds)
        player.seekTo((clamped * 1000).toLong())
        currentTime = clamped
        activeVerse = VerseTimingLookup.activeVerse(clamped, timings)
    }

    fun cycleLoop() { loopMode = loopMode.next }

    /**
     * 与 RN 版 musicCopy 的档位一致：30m / 60m。
     * 这里走协程延时：MediaSession 让进程带前台媒体服务时主线程持续运行，
     * 与 RN 版 ShellSleepTimer 注释里「Handler 是精确的那一路」同理。
     * 深度休眠场景的 AlarmManager 兜底尚未加（RN 版有）。
     */
    fun setSleepTimer(minutes: Int?) {
        sleepJob?.cancel(); sleepJob = null
        if (minutes == null || minutes <= 0) { sleepDeadlineMs = null; return }
        val deadline = System.currentTimeMillis() + minutes * 60_000L
        sleepDeadlineMs = deadline
        sleepJob = scope.launch(Dispatchers.Main) {
            delay(deadline - System.currentTimeMillis())
            sleepDeadlineMs = null
            pause()
        }
    }

    val sleepRemainingLabel: String?
        get() {
            val d = sleepDeadlineMs ?: return null
            val s = ((d - System.currentTimeMillis()) / 1000).coerceAtLeast(0)
            return "%d:%02d".format(s / 60, s % 60)
        }



    fun cycleRate() {
        val steps = listOf(0.75f, 1.0f, 1.25f, 1.5f, 1.75f, 2.0f)
        val i = steps.indexOf(rate).let { if (it < 0) 1 else it }
        rate = steps[(i + 1) % steps.size]
        if (isPlaying) player.playbackParameters = player.playbackParameters.withSpeed(rate)
    }

    val hasTimings: Boolean get() = timings.isNotEmpty()

    val progress: Double get() = if (duration > 0) (currentTime / duration).coerceIn(0.0, 1.0) else 0.0

    /** ExoPlayer 没有 addPeriodicTimeObserver，用协程轮询（间隔与 iOS 一致） */
    private fun startTicker() {
        ticker?.cancel()
        ticker = scope.launch(Dispatchers.Main) {
            while (true) {
                val pos = player.currentPosition / 1000.0
                currentTime = pos
                onProgress?.invoke(pos, isPlaying)
                if (duration <= 0 && player.duration > 0) duration = player.duration / 1000.0
                val next = VerseTimingLookup.activeVerse(pos, timings)
                if (next != activeVerse) activeVerse = next
                delay(250)
            }
        }
    }

    private fun onEnded() {
        when (loopMode) {
            LoopMode.CHAPTER -> { seekTo(0.0); resume() }
            LoopMode.ALL -> { currentTime = duration; onSkipNext?.invoke() }
            LoopMode.OFF -> { currentTime = duration; activeVerse = null; onFinished?.invoke() }
        }
    }

    fun release() {
        sleepJob?.cancel()
        ticker?.cancel()
        PlaybackSessions.unregister(mediaSession)
        mediaSession.release()
        player.release()
        timingDb?.close()
    }

    companion object {
        val SLEEP_OPTIONS_MINUTES = listOf(30, 60)

        /** 秒 → m:ss，与播放坞时间标签一致 */
        fun timeLabel(seconds: Double): String {
            if (!seconds.isFinite() || seconds < 0) return "\u2014:\u2014"
            val total = Math.round(seconds).toInt()
            return "%d:%02d".format(total / 60, total % 60)
        }
    }
}
