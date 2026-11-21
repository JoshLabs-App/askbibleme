package me.askbible.native_.audio

import android.content.Context
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.ForwardingPlayer
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
import me.askbible.native_.data.SiteCopy
import me.askbible.native_.data.VerseTiming
import me.askbible.native_.data.VerseTimingLookup

/**
 * 播放坞的循环键三档（Josh 2026-09-11）：CHAPTER 重复本章、BOOK 重复本书（读到本书末回第 1 章）、
 * FORWARD 继续往前（默认；在读经计划流里跟计划池走，否则顺到下一章）。与 iOS 的 LoopMode 一致。
 */
enum class LoopMode { FORWARD, CHAPTER, BOOK;
    val next: LoopMode get() = when (this) { FORWARD -> CHAPTER; CHAPTER -> BOOK; BOOK -> FORWARD }
    /** 循环键上的小角标：本章「1」、本书「B」、继续往前不标 */
    val badge: String? get() = when (this) { CHAPTER -> "1"; BOOK -> "B"; FORWARD -> null }
}

/**
 * 整章朗读播放器（ExoPlayer）。与 iOS 的 ChapterAudioPlayer 对等。
 */
@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
class ChapterAudioPlayer(context: Context, private val scope: CoroutineScope) {
    private val appContext = context.applicationContext

    var isPlaying by mutableStateOf(false); private set
    var isLoading by mutableStateOf(false); private set
    /** 用户点过播放（RN wantsPlayback）：锁屏换章期间保持 true，防止前台服务在章间空档降级 */
    var wantsPlayback by mutableStateOf(false); private set
    /** 被系统「永久」夺走焦点而停的（还想播）：外部声音停了 / 回前台就续播（AudioInterruptionMonitor） */
    private var focusLost = false
    /** 播放位置回调（累计听读时长：RN useFollowNativeProgress → noteScriptureListenProgress） */
    var onProgress: ((Double, Boolean) -> Unit)? = null
    var currentTime by mutableStateOf(0.0); private set
    var duration by mutableStateOf(0.0); private set
    var errorMessage by mutableStateOf<String?>(null); private set
    var activeVerse by mutableStateOf<Int?>(null); private set
    /** 跟读高亮：当前节内的朗读进度（0…1）。时间轴只精确到节，靠它再插值到句。 */
    var activeVerseProgress by mutableStateOf(0.0); private set
    var loopMode by mutableStateOf(LoopMode.FORWARD); private set
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

    // 锁屏与蓝牙耳机支持「下一章 / 回本章开头」（ExoPlayer 单 MediaItem 默认把 NEXT 置灰，用 ForwardingPlayer 补齐）
    private val sessionPlayer: Player = object : ForwardingPlayer(player) {
        override fun getAvailableCommands(): Player.Commands =
            super.getAvailableCommands().buildUpon()
                .add(COMMAND_SEEK_TO_NEXT)
                .add(COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
                .add(COMMAND_SEEK_TO_PREVIOUS)
                .add(COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
                .build()

        override fun isCommandAvailable(command: Int): Boolean =
            when (command) {
                COMMAND_SEEK_TO_NEXT,
                COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
                COMMAND_SEEK_TO_PREVIOUS,
                COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM -> true
                else -> super.isCommandAvailable(command)
            }

        override fun seekToNext() {
            onSkipNext?.invoke()
        }

        override fun seekToNextMediaItem() {
            onSkipNext?.invoke()
        }

        override fun seekToPrevious() {
            this@ChapterAudioPlayer.seekTo(0.0)
        }

        override fun seekToPreviousMediaItem() {
            this@ChapterAudioPlayer.seekTo(0.0)
        }
    }

    // 同进程多个 MediaSession id 必须不同
    private val mediaSession = MediaSession.Builder(context, sessionPlayer).setId("chapter").build()
        .also { PlaybackSessions.register(it) { wantsPlayback } }

    /** 开播前先让别的播放器（音乐压低 / 灵修停下 / 金句停下）协调 */
    var onWillPlay: (() -> Unit)? = null
    /** 朗读停下来（暂停 / 播完 / 换章卸载）时通知壳：音乐可以把音量还原 */
    var onStopped: (() -> Unit)? = null

    init {
        player.setWakeMode(C.WAKE_MODE_NETWORK)
        // handleAudioFocus=true：来电等打断时 ExoPlayer 自动暂停，结束后按需恢复
        player.setAudioAttributes(
            AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
                .setUsage(C.USAGE_MEDIA)
                .build(),
            true
        )
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
                Log.w(TAG, "player error key=$loadedKey code=${error.errorCodeName}")
                this@ChapterAudioPlayer.errorMessage = error.errorCodeName
                this@ChapterAudioPlayer.isPlaying = false
            }
        })
    }

    /** YouVersion 译本：先问代理拿 mp3；若 [autoPlay] 为真（如锁屏顺章），保持 wantsPlayback=true 保活前台服务 */
    fun beginResolving(key: String, title: String, autoPlay: Boolean = false) {
        if (loadedKey == key) {
            if (autoPlay) wantsPlayback = true
            return
        }
        Log.i(TAG, "beginResolving key=$key autoPlay=$autoPlay")
        loadedKey = key
        wantsPlayback = autoPlay
        if (autoPlay) PlaybackSessions.ensureStarted(appContext)
        errorMessage = null
        currentTime = 0.0; duration = 0.0; activeVerse = null; activeVerseProgress = 0.0; timings = emptyList()
        player.stop(); player.clearMediaItems()
        isLoading = true
    }

    /** 代理没拿到地址 */
    fun failResolving(key: String) {
        if (loadedKey != key) return
        isLoading = false
        errorMessage = SiteCopy.t("native.audioLoadFailed")
    }

    /**
     * 装载一章。同一章重复调用不重新装载；若 [autoPlay] 为真则直接起播（不依赖前台 Compose 重组）。
     */
    fun load(
        url: String,
        key: String,
        title: String,
        translationId: String,
        bookId: String,
        chapter: Int,
        resolved: Boolean = false,
        autoPlay: Boolean = false,
    ) {
        if (loadedKey == key && !(resolved && player.mediaItemCount == 0)) {
            if (autoPlay) {
                if (player.playbackState == Player.STATE_ENDED) seekTo(0.0)
                resume()
            }
            return
        }
        val shouldStart = autoPlay || (resolved && wantsPlayback)
        Log.i(TAG, "load key=$key autoPlay=$autoPlay shouldStart=$shouldStart")
        loadedKey = key
        wantsPlayback = shouldStart
        errorMessage = null
        currentTime = 0.0
        duration = 0.0
        activeVerse = null
        activeVerseProgress = 0.0
        timings = timingDb?.timings(translationId, bookId, chapter) ?: emptyList()

        player.setMediaItem(
            MediaItem.Builder()
                .setUri(url)
                .setMediaMetadata(
                    MediaMetadata.Builder().setTitle(title).setArtist("AskBible").build()
                )
                .build()
        )
        player.prepare()
        if (shouldStart) {
            resume()
        }
        startTicker()
    }

    fun toggle() {
        if (isPlaying) {
            pause()
        } else {
            if (player.playbackState == Player.STATE_ENDED) seekTo(0.0)
            resume()
        }
    }

    fun resume() {
        onWillPlay?.invoke()
        PlaybackSessions.ensureStarted(appContext)
        wantsPlayback = true
        if (player.playbackState == Player.STATE_ENDED) {
            player.seekTo(0)
            currentTime = 0.0
        }
        player.playWhenReady = true
        player.playbackParameters = player.playbackParameters.withSpeed(rate)
    }

    fun pause() {
        wantsPlayback = false
        focusLost = false
        player.playWhenReady = false
        onStopped?.invoke()
    }

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
        val seekHit = VerseTimingLookup.activeVerseProgress(clamped, timings)
        activeVerse = seekHit?.first
        activeVerseProgress = seekHit?.second ?: 0.0
    }

    fun cycleLoop() { loopMode = loopMode.next }

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
                val hit = VerseTimingLookup.activeVerseProgress(pos, timings)
                if (hit?.first != activeVerse) activeVerse = hit?.first
                val progress = hit?.second ?: 0.0
                if (kotlin.math.abs(progress - activeVerseProgress) > 0.02) activeVerseProgress = progress
                delay(250)
            }
        }
    }

    private fun onEnded() {
        Log.i(TAG, "onEnded key=$loadedKey loop=$loopMode")
        when (loopMode) {
            LoopMode.CHAPTER -> { seekTo(0.0); resume() }
            // 往下走由壳决定：计划流跟计划池，否则下一章；本书循环读到末章回本书第 1 章
            LoopMode.BOOK, LoopMode.FORWARD -> {
                currentTime = duration
                val prevKey = loadedKey
                (onFinished ?: onSkipNext)?.invoke()
                // 若已是最后一章且未进入下一章/灵修，收掉 wantsPlayback 让前台通知回到完成暂停态
                if (loadedKey == prevKey && player.playbackState == Player.STATE_ENDED) {
                    wantsPlayback = false
                    player.playWhenReady = false
                    onStopped?.invoke()
                }
            }
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
        private const val TAG = "AskBiblePlayback"
        val SLEEP_OPTIONS_MINUTES = listOf(30, 60)

        /** 秒 → m:ss，与播放坞时间标签一致 */
        fun timeLabel(seconds: Double): String {
            if (!seconds.isFinite() || seconds < 0) return "\u2014:\u2014"
            val total = Math.round(seconds).toInt()
            return "%d:%02d".format(total / 60, total % 60)
        }
    }
}
