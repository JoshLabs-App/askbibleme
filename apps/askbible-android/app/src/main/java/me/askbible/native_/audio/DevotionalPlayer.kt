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
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import me.askbible.native_.data.MusicAudioSource

/**
 * 每日灵修朗读：一次一篇，mp3 直接取 befaithful.net（DECISIONS D-6）。
 * 人声，和整章朗读 / 金句互斥（壳里 onWillPlay 接线）；自己持有音频焦点，挂 MediaSession 出锁屏控件、保住后台。
 */
class DevotionalPlayer(context: Context, private val scope: CoroutineScope) {
    private val appContext = context.applicationContext
    var isPlaying by mutableStateOf(false); private set
    var isLoading by mutableStateOf(false); private set
    var failed by mutableStateOf(false); private set
    /** 当前装载的是哪一篇（md），界面据此判断播放条属不属于正在看的那天 */
    var currentKey by mutableStateOf<String?>(null); private set
    var positionMs by mutableStateOf(0L); private set
    var durationMs by mutableStateOf(0L); private set

    var onWillPlay: (() -> Unit)? = null
    var onStopped: (() -> Unit)? = null

    private val player: ExoPlayer = ExoPlayer.Builder(context)
        .setMediaSourceFactory(
            DefaultMediaSourceFactory(
                DefaultHttpDataSource.Factory()
                    .setUserAgent(MusicAudioSource.USER_AGENT)
                    .setAllowCrossProtocolRedirects(true)
            )
        )
        .build()
    private val mediaSession = MediaSession.Builder(context, player).setId("devotional").build()
        .also { PlaybackSessions.register(it) { player.playWhenReady } }
    private var ticker: Job? = null

    init {
        player.setAudioAttributes(
            AudioAttributes.Builder().setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).setUsage(C.USAGE_MEDIA).build(),
            true
        )
        player.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
                if (playing) startTicker() else { tick(); if (!player.playWhenReady) onStopped?.invoke() }
            }
            override fun onPlaybackStateChanged(state: Int) {
                isLoading = state == Player.STATE_BUFFERING
                if (state == Player.STATE_READY) durationMs = player.duration.coerceAtLeast(0)
                if (state == Player.STATE_ENDED) { player.playWhenReady = false; player.seekTo(0); tick() }
            }
            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                // 对方网站改了路径或打不开：只停音频，文字照常能读
                failed = true; isPlaying = false; isLoading = false
                player.playWhenReady = false
            }
        })
    }

    /** 点播放：同一篇就续播，换了一篇从头 */
    fun play(key: String, url: String, title: String) {
        onWillPlay?.invoke()
        if (currentKey != key) {
            currentKey = key; failed = false; positionMs = 0; durationMs = 0
            player.setMediaItem(
                MediaItem.Builder().setUri(url)
                    .setMediaMetadata(MediaMetadata.Builder().setTitle(title).setArtist(me.askbible.native_.data.AppLocale.current.zh(me.askbible.native_.data.SolidJoys.TITLE)).build())
                    .build()
            )
            player.prepare()
        } else if (failed) {
            failed = false; player.prepare()
        }
        player.playWhenReady = true
        PlaybackSessions.ensureStarted(appContext)
    }

    fun pause() { player.playWhenReady = false }

    fun seekTo(ms: Long) { player.seekTo(ms.coerceIn(0, maxOf(durationMs, 0))); tick() }

    fun stop() {
        player.playWhenReady = false
        player.stop()
        player.clearMediaItems()
        currentKey = null; isPlaying = false; isLoading = false; positionMs = 0; durationMs = 0
    }

    private fun tick() {
        positionMs = player.currentPosition.coerceAtLeast(0)
        if (player.duration > 0) durationMs = player.duration
    }

    private fun startTicker() {
        ticker?.cancel()
        ticker = scope.launch { while (isActive && player.isPlaying) { tick(); delay(500) } }
    }

    fun release() {
        ticker?.cancel()
        PlaybackSessions.unregister(mediaSession)
        mediaSession.release()
        player.release()
    }
}
