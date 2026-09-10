package me.askbible.native_.audio

import me.askbible.native_.data.SiteCopy
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
import me.askbible.native_.data.MusicAlbumRules
import me.askbible.native_.data.MusicAudioSource
import me.askbible.native_.data.MusicCatalog
import me.askbible.native_.data.MusicRepeatMode
import me.askbible.native_.data.MusicTrack

/**
 * 音乐页播放器（ExoPlayer）。与 iOS 的 MusicPlayer 对等：曲库 MusicCatalog（内置 5 首 + R2 点播），
 * 队列 = 当前专辑全部曲目；专辑规则见 MusicAlbumRules（与 RN useMusicHomeAlbum 一致）。
 *
 * 与整章朗读的 ChapterAudioPlayer 是两个独立播放器，互斥靠 onWillPlay 由 RootScreen 接线；
 * 各自一个 MediaSession（id 不同），系统媒体控制显示最近活跃的那个。
 */
class MusicPlayer(context: Context, private val scope: CoroutineScope) {
    private val appContext = context.applicationContext

    var album by mutableStateOf(MusicCatalog.DEFAULT_ALBUM); private set
    /** 当前曲在 MusicCatalog.tracks 里的下标 */
    var trackIndex by mutableStateOf(0); private set
    var isPlaying by mutableStateOf(false); private set
    var isLoading by mutableStateOf(false); private set
    var currentTime by mutableStateOf(0.0); private set
    var duration by mutableStateOf(0.0); private set
    var errorMessage by mutableStateOf<String?>(null); private set
    var repeatMode by mutableStateOf(MusicRepeatMode.ALL); private set
    var sleepDeadlineMs by mutableStateOf<Long?>(null); private set
    /** 用户选的睡眠档位（0 = 未设），切专辑的联动规则要看它 */
    private var sleepMinutes = 0
    private var sleepJob: Job? = null

    /** 开播前先让别的播放器（整章朗读）停下 */
    var onWillPlay: (() -> Unit)? = null

    private var loadedId: String? = null
    private var wantsPlayback = false
    /** 被系统「永久」夺走焦点而停的（还想播）：外部声音停了 / 回前台就续播 */
    private var focusLost = false
    private var gain = 1f
    private var ticker: Job? = null

    private val player: ExoPlayer = ExoPlayer.Builder(context)
        .setMediaSourceFactory(
            DefaultMediaSourceFactory(
                // DefaultDataSource 同时认 asset:///（内置曲）与 http(s)（R2 / Hymn Commons）
                DefaultDataSource.Factory(
                    context,
                    DefaultHttpDataSource.Factory()
                        .setUserAgent(MusicAudioSource.USER_AGENT)
                        .setAllowCrossProtocolRedirects(true)
                )
            )
        )
        .build()

    private val mediaSession = MediaSession.Builder(context, player).setId("music").build()
        .also { PlaybackSessions.register(it) { wantsPlayback } }

    init {
        val a = MusicCatalog.DEFAULT_ALBUM
        trackIndex = MusicAlbumRules.startIndex(MusicCatalog.tracks, a, -1) ?: 0
        repeatMode = MusicAlbumRules.defaultRepeatMode(a) ?: MusicRepeatMode.ALL
        gain = MusicAlbumRules.defaultGain(a)
        player.setAudioAttributes(
            AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .setUsage(C.USAGE_MEDIA)
                .build(),
            true
        )
        player.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                this@MusicPlayer.isPlaying = playing
            }

            override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
                if (playWhenReady) focusLost = false
                else if (reason == Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_FOCUS_LOSS && wantsPlayback) focusLost = true
            }

            override fun onPlaybackStateChanged(state: Int) {
                this@MusicPlayer.isLoading = state == Player.STATE_BUFFERING
                if (state == Player.STATE_READY && this@MusicPlayer.duration <= 0) {
                    val d = player.duration
                    if (d > 0) this@MusicPlayer.duration = d / 1000.0
                }
                if (state == Player.STATE_ENDED) onEnded()
            }

            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                this@MusicPlayer.errorMessage = error.errorCodeName
                this@MusicPlayer.isPlaying = false
            }
        })
    }

    // ---- 队列 ----

    /** 当前专辑的全部曲目（全曲库下标） */
    val queue: List<Int> get() = MusicCatalog.tracks.indices.filter { MusicCatalog.tracks[it].album == album }

    val track: MusicTrack? get() = MusicCatalog.tracks.getOrNull(trackIndex)

    /** 队列里的邻居，首尾相接；队列不足两首返回 null */
    private fun neighbor(step: Int): Int? {
        val q = queue
        if (q.size < 2) return null
        val pos = q.indexOf(trackIndex)
        if (pos < 0) return null
        return q[((pos + step) % q.size + q.size) % q.size]
    }

    val previousTrack: MusicTrack? get() = neighbor(-1)?.let { MusicCatalog.tracks[it] }
    val nextTrack: MusicTrack? get() = neighbor(1)?.let { MusicCatalog.tracks[it] }

    /** 还没探到真实时长前先用曲库元数据，进度条右侧不闪「—:—」 */
    val displayDuration: Double get() = if (duration > 0) duration else (track?.durationSec ?: 0).toDouble()

    val progress: Double get() {
        val d = displayDuration
        return if (d > 0) (currentTime / d).coerceIn(0.0, 1.0) else 0.0
    }

    // ---- 专辑 ----

    /**
     * 切专辑（RN useMusicHomeAlbum.selectAlbum）：换循环模式、联动睡眠定时、换音量、
     * 跳到该专辑起播曲；正在播就接着播，不然停在暂停态。
     */
    fun selectAlbum(raw: String) {
        val next = MusicAlbumRules.normalize(raw)
        if (next == album) return
        album = next
        MusicAlbumRules.defaultRepeatMode(next)?.let { repeatMode = it }
        MusicAlbumRules.sleepTimerOnSwitch(next, sleepMinutes)?.let { setSleepTimer(if (it == 0) null else it) }
        gain = MusicAlbumRules.defaultGain(next)
        player.volume = gain
        MusicAlbumRules.startIndex(MusicCatalog.tracks, next, trackIndex)?.let { play(it, isPlaying || wantsPlayback) }
    }

    // ---- 传输 ----

    /**
     * 音乐页播放键（RN resolveMusicPageToggleAction）：
     * 正在播且当前曲就在选中专辑 → 暂停；否则在选中专辑里起播（当前曲在专辑内就接着它）。
     */
    fun toggle() {
        val t = track
        if (isPlaying && t?.album == album) { pause(); return }
        if (t != null && t.album == album) {
            if (loadedId == t.id) resume() else play(trackIndex, true)
            return
        }
        MusicAlbumRules.startIndex(MusicCatalog.tracks, album, trackIndex)?.let { play(it, true) }
    }

    fun next() {
        val n = neighbor(1) ?: run { seekTo(0.0); return }
        play(n, isPlaying || wantsPlayback)
    }

    fun previous() {
        // 与常见播放器一致：播过 3 秒先回本曲开头
        if (currentTime > 3) { seekTo(0.0); return }
        val p = neighbor(-1) ?: run { seekTo(0.0); return }
        play(p, isPlaying || wantsPlayback)
    }

    fun select(index: Int) {
        if (index !in MusicCatalog.tracks.indices) return
        play(index, true)
    }

    fun toggleRepeatOne() { repeatMode = if (repeatMode == MusicRepeatMode.ONE) MusicRepeatMode.OFF else MusicRepeatMode.ONE }
    fun toggleRepeatAll() { repeatMode = if (repeatMode == MusicRepeatMode.ALL) MusicRepeatMode.OFF else MusicRepeatMode.ALL }

    /** 装载并（可选）起播某一首 */
    fun play(index: Int, autoPlay: Boolean) {
        val t = MusicCatalog.tracks.getOrNull(index) ?: return
        trackIndex = index
        if (loadedId != t.id) load(t)
        if (autoPlay) resume()
    }

    private fun load(t: MusicTrack) {
        loadedId = t.id
        errorMessage = null
        currentTime = 0.0
        duration = 0.0
        val uri = MusicAudioSource.uri(t)
        if (uri == null) {
            errorMessage = SiteCopy.t("native.trackNoSource")
            player.stop(); player.clearMediaItems()
            return
        }
        player.setMediaItem(
            MediaItem.Builder()
                .setUri(uri)
                .setMediaMetadata(
                    MediaMetadata.Builder()
                        .setTitle(t.localizedTitle)
                        .setArtist(t.artist.ifEmpty { "AskBible" })
                        .setAlbumTitle(t.album)
                        .build())
                .build()
        )
        player.volume = gain
        player.prepare()
        startTicker()
    }

    /** 播完一首：单曲循环回头；整专辑循环顺延（首尾相接）；不循环则顺延到队尾停下 */
    private fun onEnded() {
        when (repeatMode) {
            MusicRepeatMode.ONE -> { seekTo(0.0); resume() }
            MusicRepeatMode.ALL -> { val n = neighbor(1); if (n != null) play(n, true) else { seekTo(0.0); resume() } }
            MusicRepeatMode.OFF -> {
                val q = queue
                val pos = q.indexOf(trackIndex)
                if (pos >= 0 && pos + 1 < q.size) play(q[pos + 1], true)
                else { wantsPlayback = false; currentTime = duration }
            }
        }
    }

    fun resume() {
        if (loadedId == null) { track?.let { load(it) } ?: return }
        wantsPlayback = true
        onWillPlay?.invoke()
        PlaybackSessions.ensureStarted(appContext)
        player.volume = gain
        player.playWhenReady = true
    }

    fun pause() {
        wantsPlayback = false
        focusLost = false
        player.playWhenReady = false
    }

    /** 外部声音停了 / 回到前台：永久失焦停掉的、还想播的，叫回来（RN recoverMusicPlaybackAfterBackground） */
    fun recoverAfterInterruption() {
        if (!focusLost || !wantsPlayback || isPlaying) return
        if (AudioInterruptionMonitor.callLike || AudioInterruptionMonitor.foreignAudioActive) return
        focusLost = false
        resume()
    }

    fun seekRatio(ratio: Double) {
        val d = displayDuration
        if (d <= 0) return
        seekTo(ratio.coerceIn(0.0, 1.0) * d)
    }

    fun seekTo(seconds: Double) {
        val d = displayDuration
        val clamped = if (d > 0) seconds.coerceIn(0.0, d) else maxOf(0.0, seconds)
        player.seekTo((clamped * 1000).toLong())
        currentTime = clamped
    }

    // ---- 睡眠定时（与 ChapterAudioPlayer 同一套：到期只暂停） ----

    fun setSleepTimer(minutes: Int?) {
        sleepJob?.cancel(); sleepJob = null
        if (minutes == null || minutes <= 0) { sleepMinutes = 0; sleepDeadlineMs = null; return }
        sleepMinutes = minutes
        val deadline = System.currentTimeMillis() + minutes * 60_000L
        sleepDeadlineMs = deadline
        sleepJob = scope.launch(Dispatchers.Main) {
            delay(deadline - System.currentTimeMillis())
            sleepDeadlineMs = null
            sleepMinutes = 0
            pause()
        }
    }

    val sleepRemainingLabel: String?
        get() {
            val d = sleepDeadlineMs ?: return null
            val s = ((d - System.currentTimeMillis()) / 1000).coerceAtLeast(0)
            return "%d:%02d".format(s / 60, s % 60)
        }

    /** ExoPlayer 没有 addPeriodicTimeObserver，用协程轮询（间隔与 iOS 一致） */
    private fun startTicker() {
        ticker?.cancel()
        ticker = scope.launch(Dispatchers.Main) {
            while (true) {
                currentTime = player.currentPosition / 1000.0
                if (duration <= 0 && player.duration > 0) duration = player.duration / 1000.0
                delay(250)
            }
        }
    }

    fun release() {
        sleepJob?.cancel()
        ticker?.cancel()
        PlaybackSessions.unregister(mediaSession)
        mediaSession.release()
        player.release()
    }
}
