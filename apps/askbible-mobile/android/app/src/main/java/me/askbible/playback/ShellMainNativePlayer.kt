package me.askbible.playback

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.PlaybackParams
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import com.facebook.react.bridge.Arguments

/**
 * Android 音乐 / 读经主轨：前台服务内 MediaPlayer 播 HTTPS / 本地 / raw。
 * 关屏不依赖 expo-av；读经章末可原生接 nextAssetUri。
 */
object ShellMainNativePlayer {
  private const val TAG = "ShellMainNative"
  private const val PROGRESS_MS = 400L

  private var player: MediaPlayer? = null
  private var currentUri: String? = null
  private var preparing: Boolean = false
  private var pendingSeekSec: Double = 0.0
  private var appliedRate: Float = 1f
  /** 专辑基准音量（JS setMusicGain 写下来，如睡眠专辑 0.3）；读经不受影响。 */
  private var musicBaseVolume: Float = 1f
  /** 金句垫底时压音乐，对齐 iOS musicDuckWhileVerse。 */
  private const val MUSIC_DUCK_WHILE_VERSE = 0.3f
  private var appContext: Context? = null
  private var focusRequest: AudioFocusRequest? = null
  private val handler = Handler(Looper.getMainLooper())
  /** 读经队列空：等 JS 补下一章（关屏时 JS 常冻住，硬停会像播半小时后无声）。 */
  private var awaitingJsAdvance: Boolean = false
  private var lastCompletedUri: String? = null
  private var jsAdvanceRetryCount: Int = 0
  private val progressRunnable =
    object : Runnable {
      override fun run() {
        emitProgress()
        maybeStopAtBoundary()
        if (player != null) handler.postDelayed(this, PROGRESS_MS)
      }
    }
  private val jsAdvanceRetryRunnable =
    object : Runnable {
      override fun run() {
        if (!awaitingJsAdvance) return
        if (ShellPlaybackSession.kind != "scripture" && ShellPlaybackSession.kind != "music") {
          clearAwaitingJsAdvance()
          return
        }
        if (ShellPlaybackSession.userPaused) {
          clearAwaitingJsAdvance()
          return
        }
        // JS 已补上队列：直接接播。
        val queued = ShellPlaybackSession.peekNextQueuedUri()
        if (!queued.isNullOrBlank()) {
          val ctx = appContext ?: return
          awaitingJsAdvance = false
          lastCompletedUri = null
          jsAdvanceRetryCount = 0
          val next = ShellPlaybackSession.consumeQueuedUri()
          if (!next.isNullOrBlank()) {
            ShellPlaybackSession.assetUri = next
            ShellPlaybackSession.positionSec = 0.0
            ShellPlaybackSession.playing = true
            startUri(ctx, next)
          }
          return
        }
        jsAdvanceRetryCount += 1
        if (jsAdvanceRetryCount > 12) {
          Log.w(TAG, "scripture JS advance timeout; stop")
          clearAwaitingJsAdvance()
          ShellPlaybackSession.playing = false
          stop()
          appContext?.let { ShellPlaybackService.refreshIfRunning(it) }
          return
        }
        // 再捅一次 JS（关屏后偶发第一次事件丢失）。
        val eventName =
          if (ShellPlaybackSession.kind == "music") "ShellMediaNativeMusicEnded"
          else "ShellMediaNativeScriptureEnded"
        AskBibleShellMediaControlsModule.emitRemote(
          eventName,
          Arguments.createMap().apply {
            putDouble("positionSec", ShellPlaybackSession.durationSec)
            putDouble("durationSec", ShellPlaybackSession.durationSec)
            putBoolean("awaitingJs", true)
          },
        )
        handler.postDelayed(this, 2_500L)
      }
    }

  private fun clearAwaitingJsAdvance() {
    awaitingJsAdvance = false
    lastCompletedUri = null
    jsAdvanceRetryCount = 0
    handler.removeCallbacks(jsAdvanceRetryRunnable)
  }

  private fun onMain(block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) {
      block()
    } else {
      handler.post(block)
    }
  }

  fun syncFromSession(context: Context) {
    onMain { syncFromSessionLocked(context) }
  }

  private fun syncFromSessionLocked(context: Context) {
    appContext = context.applicationContext
    ShellCallAudioMonitor.clearStaleInterruptIfIdle(context)
    if (ShellPlaybackSession.userPaused || ShellPlaybackSession.systemInterrupted) {
      clearAwaitingJsAdvance()
      pause()
      return
    }
    val kind = ShellPlaybackSession.kind
    if (kind != "music" && kind != "scripture") {
      clearAwaitingJsAdvance()
      stop()
      return
    }
    if (!ShellPlaybackSession.playing) {
      if (!awaitingJsAdvance) pause()
      return
    }
    val uri = ShellPlaybackSession.assetUri?.trim().orEmpty()
    if (uri.isEmpty()) return

    if (awaitingJsAdvance) {
      if (uri == lastCompletedUri) {
        // 仍是刚播完那章：看队列有没有新下一章。
        val queued = ShellPlaybackSession.peekNextQueuedUri()
        if (!queued.isNullOrBlank()) {
          clearAwaitingJsAdvance()
          val next = ShellPlaybackSession.consumeQueuedUri()
          if (!next.isNullOrBlank()) {
            ShellPlaybackSession.assetUri = next
            ShellPlaybackSession.positionSec = 0.0
            startUri(context.applicationContext, next)
          }
        }
        return
      }
      // JS 已换成新章 URI。
      clearAwaitingJsAdvance()
    }

    val same = uri == currentUri && player != null && !preparing
    if (same) {
      applyRate(player)
      applyVolume(player)
      if (player?.isPlaying != true) {
        try {
          player?.start()
        } catch (e: Exception) {
          Log.w(TAG, "resume same uri failed", e)
        }
      }
      if (ShellPlaybackSession.forceRestartUri) {
        ShellPlaybackSession.forceRestartUri = false
        val pos = ShellPlaybackSession.positionSec
        if (pos > 0.05) {
          seekTo(pos)
        } else {
          // userPlay 同 URI 且要从头：seek 0（勿只 resume 半章）
          seekTo(0.0)
        }
      }
      armProgress()
      return
    }
    startUri(context.applicationContext, uri)
  }

  fun isPreparing(): Boolean = preparing

  fun pause() {
    onMain { pauseLocked() }
  }

  private fun pauseLocked() {
    handler.removeCallbacks(progressRunnable)
    try {
      if (player?.isPlaying == true) player?.pause()
    } catch (_: Exception) {
      /* ignore */
    }
  }

  fun resume(context: Context) {
    onMain { resumeLocked(context) }
  }

  private fun resumeLocked(context: Context) {
    appContext = context.applicationContext
    ShellCallAudioMonitor.clearStaleInterruptIfIdle(context)
    if (ShellPlaybackSession.userPaused || ShellPlaybackSession.systemInterrupted) return
    requestFocus(context)
    val mp = player
    if (mp != null && currentUri != null) {
      try {
        applyRate(mp)
        applyVolume(mp)
        if (!mp.isPlaying) mp.start()
        ShellPlaybackSession.playing = true
        armProgress()
        emitProgress(playing = true)
        return
      } catch (e: Exception) {
        Log.w(TAG, "resume failed", e)
      }
    }
    syncFromSession(context)
  }

  fun seekTo(positionSec: Double) {
    onMain { seekToLocked(positionSec) }
  }

  private fun seekToLocked(positionSec: Double) {
    val sec = positionSec.coerceAtLeast(0.0)
    pendingSeekSec = sec
    val mp = player ?: return
    if (preparing) return
    try {
      val dur = mp.duration
      val ms =
        if (dur > 0) (sec * 1000.0).toInt().coerceIn(0, (dur - 40).coerceAtLeast(0))
        else (sec * 1000.0).toInt().coerceAtLeast(0)
      mp.seekTo(ms)
      ShellPlaybackSession.positionSec = sec
      emitProgress(playing = mp.isPlaying)
    } catch (e: Exception) {
      Log.w(TAG, "seek failed", e)
    }
  }

  fun setRate(rate: Float) {
    onMain {
      ShellPlaybackSession.rate = rate.coerceIn(0.5f, 2f)
      applyRate(player)
    }
  }

  fun setMusicVolume(volume: Float) {
    onMain {
      musicBaseVolume = volume.coerceIn(0f, 1f)
      applyVolume(player)
    }
  }

  private fun applyVolume(mp: MediaPlayer?) {
    if (mp == null) return
    val v =
      if (ShellPlaybackSession.kind == "music") {
        if (ShellPlaybackSession.verseUnderlayPlaying) {
          minOf(MUSIC_DUCK_WHILE_VERSE, musicBaseVolume)
        } else {
          musicBaseVolume
        }
      } else {
        1f
      }
    try {
      mp.setVolume(v, v)
    } catch (e: Exception) {
      Log.w(TAG, "setVolume failed", e)
    }
  }

  fun stop() {
    onMain { stopLocked() }
  }

  private fun stopLocked() {
    clearAwaitingJsAdvance()
    handler.removeCallbacks(progressRunnable)
    abandonFocus()
    releasePlayerLocked()
  }

  private fun releasePlayerLocked() {
    preparing = false
    pendingSeekSec = 0.0
    currentUri = null
    val mp = player
    player = null
    if (mp != null) {
      try {
        mp.reset()
      } catch (_: Exception) {
        /* ignore */
      }
      try {
        mp.release()
      } catch (_: Exception) {
        /* ignore */
      }
    }
  }

  private fun startUri(context: Context, uri: String) {
    handler.removeCallbacks(progressRunnable)
    releasePlayerLocked()
    preparing = true
    currentUri = uri
    pendingSeekSec = ShellPlaybackSession.positionSec
    val app = context.applicationContext
    appContext = app
    ShellCallAudioMonitor.clearStaleInterruptIfIdle(app)
    requestFocus(app)
    try {
      val mp = MediaPlayer()
      player = mp
      val speech = ShellPlaybackSession.kind == "scripture"
      mp.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(
            if (speech) AudioAttributes.CONTENT_TYPE_SPEECH
            else AudioAttributes.CONTENT_TYPE_MUSIC,
          )
          .build(),
      )
      mp.setWakeMode(app, PowerManager.PARTIAL_WAKE_LOCK)
      applyDataSource(mp, app, uri)
      mp.setOnPreparedListener { prepared ->
        if (player !== prepared || currentUri != uri) {
          try {
            prepared.release()
          } catch (_: Exception) {
            /* ignore */
          }
          return@setOnPreparedListener
        }
        preparing = false
        val dur = prepared.duration
        if (dur > 0) ShellPlaybackSession.durationSec = dur / 1000.0
        val seek = pendingSeekSec
        if (seek > 0.05) {
          try {
            val ms =
              if (dur > 0) (seek * 1000.0).toInt().coerceIn(0, (dur - 40).coerceAtLeast(0))
              else (seek * 1000.0).toInt().coerceAtLeast(0)
            prepared.seekTo(ms)
          } catch (_: Exception) {
            /* ignore */
          }
        }
        pendingSeekSec = 0.0
        applyRate(prepared)
        applyVolume(prepared)
        if (ShellPlaybackSession.userPaused || ShellPlaybackSession.systemInterrupted) {
          try {
            prepared.pause()
          } catch (_: Exception) {
            /* ignore */
          }
          return@setOnPreparedListener
        }
        try {
          prepared.start()
          ShellPlaybackSession.playing = true
          ShellPlaybackSession.forceRestartUri = false
          ShellPlaybackService.refreshIfRunning(app)
          emitTakeover()
          armProgress()
          Log.i(TAG, "playing kind=${ShellPlaybackSession.kind} uri=$uri")
        } catch (e: Exception) {
          Log.w(TAG, "start prepared failed", e)
          stop()
          AskBibleShellMediaControlsModule.emitRemote(
            "ShellMediaNativeStopped",
            Arguments.createMap().apply { putString("reason", "start-failed") },
          )
        }
      }
      mp.setOnCompletionListener { completed ->
        if (player !== completed) return@setOnCompletionListener
        onCompleted(app)
      }
      mp.setOnErrorListener { errored, what, extra ->
        if (player === errored || currentUri == uri) {
          Log.w(TAG, "MediaPlayer error what=$what extra=$extra uri=$uri")
          stop()
          AskBibleShellMediaControlsModule.emitRemote(
            "ShellMediaNativeStopped",
            Arguments.createMap().apply { putString("reason", "decode-error") },
          )
        }
        true
      }
      mp.prepareAsync()
    } catch (e: Exception) {
      Log.w(TAG, "startUri failed uri=$uri", e)
      preparing = false
      stop()
      AskBibleShellMediaControlsModule.emitRemote(
        "ShellMediaNativeStopped",
        Arguments.createMap().apply { putString("reason", "datasource") },
      )
    }
  }

  private fun applyDataSource(mp: MediaPlayer, context: Context, uri: String) {
    val headers = HashMap<String, String>()
    headers["User-Agent"] = "AskBible.me/1.0 (Android MediaPlayer)"
    headers["Accept"] = "*/*"
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
          mp.setDataSource(
            context,
            Uri.parse("android.resource://${context.packageName}/$resId"),
          )
        } else {
          mp.setDataSource(context, Uri.parse(uri), headers)
        }
      }
    }
  }

  private fun applyRate(mp: MediaPlayer?) {
    if (mp == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
    val rate = ShellPlaybackSession.rate.coerceIn(0.5f, 2f)
    if (kotlin.math.abs(rate - appliedRate) < 0.01f && rate == 1f) return
    try {
      val params = PlaybackParams()
      params.speed = rate
      params.pitch = 1f
      mp.playbackParams = params
      appliedRate = rate
    } catch (e: Exception) {
      Log.w(TAG, "set rate failed", e)
    }
  }

  private fun onCompleted(context: Context) {
    handler.removeCallbacks(progressRunnable)
    val kind = ShellPlaybackSession.kind
    val finished = currentUri
    ShellPlaybackSession.markAssetPlayed(finished)
    if (kind == "scripture") {
      val next = ShellPlaybackSession.consumeQueuedUri()
      if (!next.isNullOrBlank()) {
        ShellPlaybackSession.assetUri = next
        ShellPlaybackSession.positionSec = 0.0
        ShellPlaybackSession.playing = true
        val map = Arguments.createMap()
        map.putBoolean("nativeChained", true)
        map.putString("assetUri", next)
        map.putDouble("positionSec", 0.0)
        AskBibleShellMediaControlsModule.emitRemote("ShellMediaNativeScriptureEnded", map)
        startUri(context, next)
        return
      }
      // 队列空：先等 JS 补章（对齐金句 awaitingJsAdvance），勿立刻硬停。
      awaitingJsAdvance = true
      lastCompletedUri = finished
      jsAdvanceRetryCount = 0
      ShellPlaybackSession.playing = true
      releasePlayerLocked()
      AskBibleShellMediaControlsModule.emitRemote(
        "ShellMediaNativeScriptureEnded",
        Arguments.createMap().apply {
          putDouble("positionSec", ShellPlaybackSession.durationSec)
          putDouble("durationSec", ShellPlaybackSession.durationSec)
          putBoolean("awaitingJs", true)
        },
      )
      ShellPlaybackService.refreshIfRunning(context)
      handler.removeCallbacks(jsAdvanceRetryRunnable)
      handler.postDelayed(jsAdvanceRetryRunnable, 1_200L)
      Log.i(TAG, "scripture queue empty; wait JS advance uri=$finished")
      return
    }
    if (kind == "music") {
      val next = ShellPlaybackSession.consumeQueuedUri()
      if (!next.isNullOrBlank()) {
        ShellPlaybackSession.assetUri = next
        ShellPlaybackSession.positionSec = 0.0
        ShellPlaybackSession.playing = true
        val map = Arguments.createMap()
        map.putBoolean("nativeChained", true)
        map.putString("assetUri", next)
        map.putDouble("positionSec", 0.0)
        AskBibleShellMediaControlsModule.emitRemote("ShellMediaNativeMusicEnded", map)
        startUri(context, next)
        return
      }
      awaitingJsAdvance = true
      lastCompletedUri = finished
      jsAdvanceRetryCount = 0
      ShellPlaybackSession.playing = true
      releasePlayerLocked()
      AskBibleShellMediaControlsModule.emitRemote("RemoteNext")
      AskBibleShellMediaControlsModule.emitRemote(
        "ShellMediaNativeMusicEnded",
        Arguments.createMap().apply {
          putDouble("positionSec", ShellPlaybackSession.durationSec)
          putDouble("durationSec", ShellPlaybackSession.durationSec)
          putBoolean("awaitingJs", true)
        },
      )
      ShellPlaybackService.refreshIfRunning(context)
      handler.removeCallbacks(jsAdvanceRetryRunnable)
      handler.postDelayed(jsAdvanceRetryRunnable, 1_200L)
      Log.i(TAG, "music queue empty; wait JS advance uri=$finished")
      return
    }
    ShellPlaybackSession.playing = false
    stop()
    AskBibleShellMediaControlsModule.emitRemote("RemoteNext")
    ShellPlaybackService.refreshIfRunning(context)
  }

  private fun maybeStopAtBoundary() {
    val stopAt = ShellPlaybackSession.stopAtSec
    if (stopAt <= 0.2) return
    if (ShellPlaybackSession.kind != "scripture") return
    val mp = player ?: return
    try {
      val pos = mp.currentPosition / 1000.0
      if (pos + 0.05 < stopAt) return
      try {
        mp.pause()
      } catch (_: Exception) {
        /* ignore */
      }
      handler.removeCallbacks(progressRunnable)
      val map = Arguments.createMap()
      map.putBoolean("segmentEnd", true)
      map.putDouble("positionSec", stopAt)
      map.putDouble("durationSec", ShellPlaybackSession.durationSec)
      AskBibleShellMediaControlsModule.emitRemote("ShellMediaNativeScriptureEnded", map)
    } catch (_: Exception) {
      /* ignore */
    }
  }

  private fun armProgress() {
    handler.removeCallbacks(progressRunnable)
    handler.post(progressRunnable)
  }

  private fun emitTakeover() {
    val map = Arguments.createMap()
    map.putDouble("positionSec", currentPositionSec())
    map.putString("assetUri", currentUri)
    map.putString("kind", ShellPlaybackSession.kind)
    AskBibleShellMediaControlsModule.emitRemote("ShellMediaNativeTakeover", map)
  }

  private fun emitProgress(playing: Boolean? = null) {
    val mp = player ?: return
    val pos = currentPositionSec()
    val dur =
      try {
        val d = mp.duration
        if (d > 0) d / 1000.0 else ShellPlaybackSession.durationSec
      } catch (_: Exception) {
        ShellPlaybackSession.durationSec
      }
    val isPlaying =
      playing
        ?: try {
          mp.isPlaying
        } catch (_: Exception) {
          ShellPlaybackSession.playing
        }
    // JS 换章时 updateSession() 会把 assetUri 改成新章、positionSec 清 0，但那次调用
    // 发生在 RN bridge 线程；真正取消本 Runnable（在 startUri 里）要等 Intent 异步
    // 转到 service 才执行。这段窗口内，仍在跑的旧 MediaPlayer 的这次 tick 若照常把
    // positionSec 写回旧进度，会在新章 startUri() 读 positionSec 当 seek 目标时把
    // 旧章进度带过去。用 assetUri 是否还等于本实例的 currentUri 判断换章是否已经
    // 发生，一旦不等就不再写 positionSec（仍可正常上报本地 progress 事件）。
    if (ShellPlaybackSession.assetUri == currentUri) {
      ShellPlaybackSession.positionSec = pos
    }
    if (dur > 0) ShellPlaybackSession.durationSec = dur
    val map = Arguments.createMap()
    map.putBoolean("playing", isPlaying)
    map.putDouble("positionSec", pos)
    map.putDouble("durationSec", dur)
    map.putDouble("rate", ShellPlaybackSession.rate.toDouble())
    map.putString("kind", ShellPlaybackSession.kind)
    AskBibleShellMediaControlsModule.emitRemote("ShellMediaNativeProgress", map)
  }

  private fun currentPositionSec(): Double {
    return try {
      val ms = player?.currentPosition ?: 0
      if (ms > 0) ms / 1000.0 else 0.0
    } catch (_: Exception) {
      ShellPlaybackSession.positionSec
    }
  }

  private fun requestFocus(context: Context) {
    val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val req =
          AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(
              AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(
                  if (ShellPlaybackSession.kind == "scripture") AudioAttributes.CONTENT_TYPE_SPEECH
                  else AudioAttributes.CONTENT_TYPE_MUSIC,
                )
                .build(),
            )
            .setOnAudioFocusChangeListener { }
            .build()
        focusRequest = req
        am.requestAudioFocus(req)
      } else {
        @Suppress("DEPRECATION")
        am.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
      }
    } catch (e: Exception) {
      Log.w(TAG, "requestAudioFocus failed", e)
    }
  }

  private fun abandonFocus() {
    val context = appContext ?: return
    val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        focusRequest?.let { am.abandonAudioFocusRequest(it) }
        focusRequest = null
      } else {
        @Suppress("DEPRECATION")
        am.abandonAudioFocus(null)
      }
    } catch (_: Exception) {
      /* ignore */
    }
  }
}
