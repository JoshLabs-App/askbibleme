package me.askbible.playback

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import com.facebook.react.bridge.Arguments
import me.askbible.playback.model.Intent
import me.askbible.playback.model.PlaybackStore
import me.askbible.playback.model.StreamId

/**
 * 一条流的播放器。三路各持一个实例，**互相不知道对方存在**。
 *
 * 旧的 `ShellMainNativePlayer` / `ShellVerseNativePlayer` 都要自己读一袋全局标志去猜
 * 「现在轮不轮到我播」，两个播放器隔着这袋标志互相干扰。现在职责收窄成一句话：
 * **把这一条流放成 [PlaybackStore] 说的样子**，别的一概不管。
 *
 * 保留了旧实现里用真机换来的几处细节，改动它们前先看注释：
 * - `setWakeMode(PARTIAL_WAKE_LOCK)`：否则关屏后播放会被 Doze 掐断。
 * - 远端 URI 必须带 User-Agent：R2 对空 UA 的请求有时直接断。
 * - 起播失败要退避，不能立刻重试——失败常是整批的，密集重试会把 MediaPlayer 拖死。
 * - 队列自接（[playNext]）必须由原生做：关屏后 JS 被冻住，靠它补队列金句会哑掉。
 */
class StreamPlayer(
  private val streamId: StreamId,
  private val speech: Boolean,
  private val tag: String,
) : ShellAudioFocus.Member {

  private val handler = Handler(Looper.getMainLooper())

  private var player: MediaPlayer? = null
  private var currentUri: String? = null
  private var preparing = false
  private var appContext: Context? = null

  /** 起播失败的 URI 与时刻：短时间内不再重试同一条。 */
  private var lastFailedUri: String? = null
  private var lastFailedAtMs = 0L

  /** 间隔等待中（金句两句之间的静默）。 */
  private var gapRunnable: Runnable? = null

  private val focusId = "stream-${streamId.name.lowercase()}"

  // ------------------------------------------------------------------ 对外

  /** 让这条流播 [uri]（从 [positionSec] 开始）。已经在播同一条就不动。 */
  fun play(context: Context, uri: String, positionSec: Double) {
    appContext = context.applicationContext
    if (uri == currentUri && !preparing) {
      val mp = player
      if (mp != null) {
        try {
          if (!mp.isPlaying) mp.start()
          return
        } catch (e: Exception) {
          Log.w(tag, "resume failed; restarting", e)
        }
      }
    }
    if (uri == lastFailedUri && System.currentTimeMillis() - lastFailedAtMs < FAIL_BACKOFF_MS) {
      return
    }
    start(uri, positionSec)
  }

  fun pause() {
    cancelGap()
    handler.removeCallbacks(progressRunnable)
    try {
      player?.pause()
    } catch (_: Exception) {
      /* ignore */
    }
  }

  fun stop() {
    cancelGap()
    handler.removeCallbacks(progressRunnable)
    if (currentUri != null) emit("ShellMediaNativeStopped")
    preparing = false
    currentUri = null
    release()
    ShellAudioFocus.release(focusId)
  }

  fun seekTo(positionSec: Double) {
    try {
      player?.seekTo((positionSec * 1000).toInt())
    } catch (_: Exception) {
      /* ignore */
    }
  }

  fun setVolume(volume: Float) {
    val v = volume.coerceIn(0f, 1f)
    try {
      player?.setVolume(v, v)
    } catch (_: Exception) {
      /* ignore */
    }
  }

  fun setRate(rate: Float) {
    val mp = player ?: return
    try {
      val was = mp.isPlaying
      mp.playbackParams = mp.playbackParams.setSpeed(rate.coerceIn(0.5f, 2f))
      if (!was) mp.pause()
    } catch (e: Exception) {
      Log.w(tag, "setRate failed", e)
    }
  }

  fun positionSec(): Double =
    try {
      (player?.currentPosition ?: 0) / 1000.0
    } catch (_: Exception) {
      0.0
    }

  fun durationSec(): Double =
    try {
      val d = player?.duration ?: 0
      if (d > 0) d / 1000.0 else 0.0
    } catch (_: Exception) {
      0.0
    }

  fun isPreparing(): Boolean = preparing

  fun isPlayingNow(): Boolean =
    try {
      player?.isPlaying == true
    } catch (_: Exception) {
      false
    }

  // ------------------------------------------------------------------ 内部

  private fun start(uri: String, positionSec: Double) {
    val context = appContext ?: return
    cancelGap()
    release()
    preparing = true
    currentUri = uri

    /** 拿不到焦点就别播——旧代码忽略返回值照播，表现就是「点了没声音」。 */
    if (!ShellAudioFocus.acquire(context, focusId, speech, this)) {
      preparing = false
      Log.w(tag, "no audio focus; not starting")
      return
    }

    try {
      val mp = MediaPlayer()
      player = mp
      mp.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(
            if (speech) AudioAttributes.CONTENT_TYPE_SPEECH else AudioAttributes.CONTENT_TYPE_MUSIC,
          )
          .build(),
      )
      /** 关屏续播必需，去掉会在 Doze 下被掐。 */
      mp.setWakeMode(context, PowerManager.PARTIAL_WAKE_LOCK)
      applyDataSource(mp, context, uri)
      mp.setOnPreparedListener { prepared ->
        if (player !== prepared || currentUri != uri) {
          runCatching { prepared.release() }
          return@setOnPreparedListener
        }
        preparing = false
        if (positionSec > 0.05) {
          runCatching { prepared.seekTo((positionSec * 1000).toInt()) }
        }
        runCatching { prepared.start() }
        Log.i(tag, "playing ${uri.takeLast(48)}")
        emit("ShellMediaNativeTakeover")
        armProgress()
      }
      mp.setOnCompletionListener { completed ->
        if (player !== completed) return@setOnCompletionListener
        onCompleted()
      }
      mp.setOnErrorListener { errored, what, extra ->
        if (player === errored) {
          Log.w(tag, "MediaPlayer error what=$what extra=$extra uri=${uri.takeLast(48)}")
          markFailed(uri)
        }
        true
      }
      mp.prepareAsync()
    } catch (e: Exception) {
      Log.w(tag, "start failed uri=${uri.takeLast(48)}", e)
      markFailed(uri)
    }
  }

  private fun applyDataSource(mp: MediaPlayer, context: Context, uri: String) {
    /** R2 对空 User-Agent 的请求偶发直接断连，必须带上。 */
    val headers =
      hashMapOf(
        "User-Agent" to "AskBible.me/1.0 (Android MediaPlayer)",
        "Accept" to "*/*",
      )
    when {
      uri.startsWith("http://") || uri.startsWith("https://") ->
        mp.setDataSource(context, Uri.parse(uri), headers)
      uri.startsWith("file://") ||
        uri.startsWith("content://") ||
        uri.startsWith("android.resource://") -> mp.setDataSource(context, Uri.parse(uri))
      uri.startsWith("/") -> mp.setDataSource(uri)
      else -> {
        val resId = context.resources.getIdentifier(uri, "raw", context.packageName)
        if (resId != 0) {
          mp.setDataSource(context, Uri.parse("android.resource://${context.packageName}/$resId"))
        } else {
          mp.setDataSource(context, Uri.parse(uri), headers)
        }
      }
    }
  }

  private fun markFailed(uri: String) {
    lastFailedUri = uri
    lastFailedAtMs = System.currentTimeMillis()
    preparing = false
    release()
    /** 失败也要往下走，否则金句会卡在坏的一条上再不前进。 */
    scheduleNext(gapSecOverride = 0.0)
  }

  private fun onCompleted() {
    scheduleNext(gapSecOverride = PlaybackStore.state[streamId].gapSec)
  }

  /**
   * 只在「播完且队列里没有下一条」时通知 JS。
   *
   * 队列里还有就自己接上，JS 从状态里看到 uri 变了即可跟随——不必打扰它。
   * 一度是每次播完都发，而 JS 那边靠事件里的 `nativeChained` 标志判断原生有没有接上；
   * 新播放器没带这个标志，JS 就以为没接，自己又推进了一章，于是原生刚接的 GEN-3
   * 被 JS 重新点播一次并把队列清成 q=0（2026-09-08 真机账本）。
   * 事件名不变，JS 侧的既有处理继续有效。
   */
  private fun emitEndedNeedingJs() {
    when (streamId) {
      StreamId.SCRIPTURE -> emit("ShellMediaNativeScriptureEnded")
      StreamId.MUSIC -> emit("ShellMediaNativeMusicEnded")
      StreamId.VERSE -> emit("ShellMediaNativeVerseAdvance")
    }
  }

  /** 定期把进度写回状态并上报 JS；只在真的在播时继续排下一拍。 */
  private val progressRunnable =
    object : Runnable {
      override fun run() {
        if (!isPlayingNow()) return
        val pos = positionSec()
        val dur = durationSec()
        PlaybackStore.dispatch(Intent.Progress(streamId, pos, dur))
        emit("ShellMediaNativeProgress")
        handler.postDelayed(this, PROGRESS_TICK_MS)
      }
    }

  private fun armProgress() {
    handler.removeCallbacks(progressRunnable)
    handler.postDelayed(progressRunnable, PROGRESS_TICK_MS)
  }

  private fun emit(event: String) {
    val map =
      Arguments.createMap().apply {
        putString("kind", streamId.name.lowercase())
        putString("assetUri", currentUri)
        putDouble("positionSec", positionSec())
        putDouble("durationSec", durationSec())
      }
    AskBibleShellMediaControlsModule.emitRemote(event, map)
  }

  /**
   * 接下一条。
   *
   * 队列取自 [PlaybackStore]，取到就用 [Intent.NativeAdvanced] 回报——**原生是唯一真相**，
   * JS 只能听。旧代码里 JS 会拿着慢一拍的答案把刚起头的新句顶掉（实测 0.9 秒被掐）。
   */
  private fun scheduleNext(gapSecOverride: Double) {
    val next = PlaybackStore.state[streamId].queue.firstOrNull()
    if (next.isNullOrBlank()) {
      PlaybackStore.dispatch(Intent.Ended(streamId))
      emitEndedNeedingJs()
      return
    }
    val delayMs = (gapSecOverride * 1000.0).toLong().coerceIn(0L, 15_000L)
    val runnable =
      Runnable {
        gapRunnable = null
        PlaybackStore.dispatch(Intent.NativeAdvanced(streamId, next))
      }
    gapRunnable = runnable
    handler.postDelayed(runnable, delayMs)
  }

  private fun cancelGap() {
    gapRunnable?.let { handler.removeCallbacks(it) }
    gapRunnable = null
  }

  private fun release() {
    val mp = player
    player = null
    if (mp != null) {
      runCatching {
        mp.setOnPreparedListener(null)
        mp.setOnCompletionListener(null)
        mp.setOnErrorListener(null)
        mp.reset()
        mp.release()
      }
    }
  }

  /** 系统把焦点收走（来电、别的 App）。自家几路之间不会走到这里，见 [ShellAudioFocus]。 */
  override fun onShellAudioFocusLost(permanent: Boolean) {
    Log.i(tag, if (permanent) "focus lost; pausing" else "focus lost transiently; pausing")
    pause()
    if (permanent) ShellAudioFocus.release(focusId)
  }

  private companion object {
    const val FAIL_BACKOFF_MS = 2_500L
    const val PROGRESS_TICK_MS = 1_000L
  }
}
