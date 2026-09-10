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
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.MediaSession
import me.askbible.native_.data.MusicAudioSource

/**
 * 首页金句朗读播放器：一次一句，播完（或取不到音频）回调 onEnded，由 HomeVerseController 决定下一句。
 * 与 iOS 的 GoldenVersePlayer 对等。
 *
 * handleAudioFocus = false：金句要能和音乐同时出声（RN 首页「音乐+金句 均可」），
 * 同进程两个播放器各自抢焦点会互相掐掉；焦点由音乐播放器持有。
 * 也挂一个 MediaSession（id "golden"）：不是为了锁屏控件，是让前台服务在只有金句在放时也保住进程。
 */
class GoldenVersePlayer(context: Context) {
    private val appContext = context.applicationContext
    var isPlaying by mutableStateOf(false); private set
    var isLoading by mutableStateOf(false); private set

    var onEnded: (() -> Unit)? = null
    /** 开播前先让整章朗读停下 */
    var onWillPlay: (() -> Unit)? = null

    private val player: ExoPlayer = ExoPlayer.Builder(context)
        .setMediaSourceFactory(
            DefaultMediaSourceFactory(
                DefaultHttpDataSource.Factory()
                    .setUserAgent(MusicAudioSource.USER_AGENT)
                    .setAllowCrossProtocolRedirects(true)
            )
        )
        .build()
    private val mediaSession = MediaSession.Builder(context, player).setId("golden").build()
        .also { PlaybackSessions.register(it) }

    init {
        player.setAudioAttributes(
            AudioAttributes.Builder()
                .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
                .setUsage(C.USAGE_MEDIA)
                // LOW_LATENCY 只当标记：AudioInterruptionMonitor 靠它认出「这是自家金句，不是别的 App 在响」
                .setFlags(android.media.AudioAttributes.FLAG_LOW_LATENCY)
                .build(),
            false
        )
        player.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) { this@GoldenVersePlayer.isPlaying = playing }
            override fun onPlaybackStateChanged(state: Int) {
                this@GoldenVersePlayer.isLoading = state == Player.STATE_BUFFERING
                if (state == Player.STATE_ENDED) onEnded?.invoke()
            }
            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                // R2 上没这句（404）会走到这里：当作播完，别对着空文件干等
                this@GoldenVersePlayer.isPlaying = false
                onEnded?.invoke()
            }
        })
    }

    fun play(url: String, title: String) {
        onWillPlay?.invoke()
        player.setMediaItem(
            MediaItem.Builder().setUri(url)
                .setMediaMetadata(MediaMetadata.Builder().setTitle(title).setArtist(SiteCopy.t("native.goldenVerseNowPlaying")).build())
                .build()
        )
        player.prepare()
        player.playWhenReady = true
        PlaybackSessions.ensureStarted(appContext)
    }

    fun stop() {
        player.playWhenReady = false
        player.stop()
        player.clearMediaItems()
        isPlaying = false
        isLoading = false
    }

    fun release() {
        PlaybackSessions.unregister(mediaSession)
        mediaSession.release()
        player.release()
    }
}
