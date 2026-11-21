package me.askbible.native_.ui

import android.graphics.Matrix
import android.view.TextureView
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.platform.LocalContext
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
 * 首页全屏循环场景视频（RN FullBleedCoverVideo.android）：静音、无缝循环、竖屏贴左裁切（left center）、横屏居中裁切。
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
        player.setMediaItem(MediaItem.fromUri(NatureScenes.videoUri(sceneId)))
        player.prepare()
        player.playWhenReady = true
    }

    Box(modifier.clipToBounds()) {
        AndroidView(
            factory = { ctx ->
                TextureView(ctx).also { tv ->
                    player.setVideoTextureView(tv)
                    tv.addOnLayoutChangeListener { v, _, _, _, _, _, _, _, _ ->
                        val view = v as TextureView
                        applyCoverTransform(view, videoSize.width, videoSize.height)
                    }
                }
            },
            update = { tv ->
                applyCoverTransform(tv, videoSize.width, videoSize.height)
            },
            modifier = Modifier
                .fillMaxSize()
                .alpha(if (firstFrame) 1f else 0f),
        )
    }
}

private fun applyCoverTransform(tv: TextureView, videoW: Int, videoH: Int) {
    val viewW = tv.width.toFloat()
    val viewH = tv.height.toFloat()
    if (viewW <= 0f || viewH <= 0f) return
    val mw = if (videoW > 0) videoW.toFloat() else 16f
    val mh = if (videoH > 0) videoH.toFloat() else 9f
    val scale = maxOf(viewW / mw, viewH / mh)
    val sx = (mw * scale) / viewW
    val sy = (mh * scale) / viewH
    // 竖屏贴左（x=0，与 Web object-position: left center 及 coverMediaRectLeft 一致），横屏居中
    val pivotX = if (viewW > viewH) viewW / 2f else 0f
    val matrix = Matrix()
    matrix.setScale(sx, sy, pivotX, viewH / 2f)
    tv.setTransform(matrix)
}
