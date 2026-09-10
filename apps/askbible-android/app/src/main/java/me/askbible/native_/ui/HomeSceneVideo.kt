package me.askbible.native_.ui

import android.view.TextureView
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.exoplayer.ExoPlayer
import me.askbible.native_.data.NatureScenes

/**
 * 首页全屏循环场景视频（RN FullBleedCoverVideo.android）：静音、无缝循环、object-fit cover。
 * 不拿音频焦点（静音视频抢会话会掐掉读经）；出首帧前透明，让底下的海报顶住，避免黑闪。
 */
@Composable
fun HomeSceneVideo(sceneId: String, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val player = remember {
        ExoPlayer.Builder(context).build().apply {
            setAudioAttributes(
                AudioAttributes.Builder().setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).setUsage(C.USAGE_MEDIA).build(),
                false,
            )
            volume = 0f
            repeatMode = Player.REPEAT_MODE_ONE
        }
    }
    var videoSize by remember { mutableStateOf(IntSize.Zero) }
    var firstFrame by remember { mutableStateOf(false) }

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onVideoSizeChanged(size: VideoSize) {
                if (size.width > 0 && size.height > 0) videoSize = IntSize(size.width, size.height)
            }
            override fun onRenderedFirstFrame() { firstFrame = true }
        }
        player.addListener(listener)
        // 退到后台停解码，回来接着播
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_STOP -> player.playWhenReady = false
                Lifecycle.Event.ON_START -> player.playWhenReady = true
                else -> Unit
            }
        }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            player.removeListener(listener)
            player.release()
        }
    }

    LaunchedEffect(sceneId) {
        firstFrame = false
        player.setMediaItem(MediaItem.fromUri(NatureScenes.videoAssetUri(sceneId)))
        player.prepare()
        player.playWhenReady = true
    }

    BoxWithConstraints(modifier.clipToBounds()) {
        val density = LocalDensity.current
        val boxW = constraints.maxWidth.toFloat()
        val boxH = constraints.maxHeight.toFloat()
        val (w, h) = if (videoSize.width > 0) {
            val s = maxOf(boxW / videoSize.width, boxH / videoSize.height)
            Pair(videoSize.width * s, videoSize.height * s)
        } else Pair(boxW, boxH)
        AndroidView(
            factory = { ctx -> TextureView(ctx).also { player.setVideoTextureView(it) } },
            modifier = Modifier
                .align(Alignment.Center)
                .requiredSize(with(density) { w.toDp() }, with(density) { h.toDp() })
                .alpha(if (firstFrame) 1f else 0f),
        )
    }
}
