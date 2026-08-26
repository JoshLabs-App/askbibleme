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

/**
 * Android 金句：在前台服务内用 MediaPlayer 播 HTTPS/本地 URI。
 * 关屏不依赖 JS/expo-av；句终用 Handler 间隔再接 next（勿依赖 gap 静音文件，避免 OEM 播失败断链）。
 */
object ShellVerseNativePlayer {
  private const val TAG = "ShellVerseNative"

  private var player: MediaPlayer? = null
  private var currentUri: String? = null
  private var playingGap: Boolean = false
  private var preparing: Boolean = false
  private var lastFailedUri: String? = null
  private var lastFailedAtMs: Long = 0L
  /** 句终且队列空：等 JS 换句，禁止 1s 刷新把同一句再 start。 */
  private var awaitingJsAdvance: Boolean = false
  private var lastCompletedUri: String? = null
  private var appContext: Context? = null
  private val handler = Handler(Looper.getMainLooper())
  private var gapRunnable: Runnable? = null

  fun syncFromSession(context: Context) {
    appContext = context.applicationContext

    if (ShellPlaybackSession.userPaused || ShellPlaybackSession.systemInterrupted) {
      pause()
      return
    }

    // 关音乐后会话常变成 music+paused，垫底金句仍在：升主会话续播，避免有黄标无声。
    // 系统栏用户暂停时不升，否则「停音乐」会把金句顶上来继续出声。
    if (
      !ShellPlaybackSession.userPaused &&
        ShellPlaybackSession.kind == "music" &&
        !ShellPlaybackSession.playing &&
        ShellPlaybackSession.verseUnderlayPlaying &&
        !ShellPlaybackSession.verseUnderlayUri.isNullOrBlank()
    ) {
      ShellPlaybackSession.promoteUnderlayToPrimary()
      Log.i(TAG, "promote underlay verse after music pause")
    }

    val primaryVerse = ShellPlaybackSession.kind == "verse" && ShellPlaybackSession.playing
    // 音乐会话被关屏打成 paused 时，垫底金句仍要继续，不能 stop()。
    val underlay =
      ShellPlaybackSession.verseUnderlayPlaying &&
        !ShellPlaybackSession.userPaused &&
        !primaryVerse

    if (!primaryVerse && !underlay) {
      if (ShellPlaybackSession.kind == "verse" && !ShellPlaybackSession.playing) {
        cancelGap()
        pause()
        return
      }
      stop()
      return
    }

    // 间隔等待中：勿用旧 assetUri 重开，否则会把同一句打回去。
    if (playingGap) return

    val uri =
      if (primaryVerse) {
        ShellPlaybackSession.assetUri
      } else {
        ShellPlaybackSession.verseUnderlayUri
      }
    if (uri.isNullOrBlank()) {
      stop()
      return
    }

    if (ShellPlaybackSession.forceRestartUri) {
      ShellPlaybackSession.forceRestartUri = false
      awaitingJsAdvance = false
      lastCompletedUri = null
      // 同 URI userPlay：从头重开（锁屏 Previous 重开当前句）。
      if (uri == currentUri) {
        val p = player
        if (p != null && !preparing) {
          try {
            p.seekTo(0)
            if (!p.isPlaying) p.start()
            return
          } catch (e: Exception) {
            Log.w(TAG, "forceRestart seek0 failed; restart uri", e)
          }
        }
      }
      startUri(context, uri, isGap = false)
      return
    }

    if (awaitingJsAdvance && uri == lastCompletedUri) {
      return
    }

    if (uri == lastFailedUri && System.currentTimeMillis() - lastFailedAtMs < 2_500L) {
      return
    }

    if (uri == currentUri) {
      if (preparing) return
      if (awaitingJsAdvance || uri == lastCompletedUri) return
      val p = player
      if (p != null) {
        try {
          if (!p.isPlaying) p.start()
        } catch (e: Exception) {
          Log.w(TAG, "resume same uri failed; restart", e)
          startUri(context, uri, isGap = false)
        }
      } else {
        startUri(context, uri, isGap = false)
      }
      return
    }

    awaitingJsAdvance = false
    lastCompletedUri = null
    startUri(context, uri, isGap = false)
  }

  fun stop() {
    cancelGap()
    playingGap = false
    preparing = false
    awaitingJsAdvance = false
    lastCompletedUri = null
    currentUri = null
    val old = player
    player = null
    if (old == null) return
    try {
      old.setOnPreparedListener(null)
      old.setOnCompletionListener(null)
      old.setOnErrorListener(null)
    } catch (_: Exception) {
      /* ignore */
    }
    try {
      old.reset()
    } catch (_: Exception) {
      /* ignore */
    }
    try {
      old.release()
    } catch (_: Exception) {
      /* ignore */
    }
  }

  fun pause() {
    cancelGap()
    playingGap = false
    try {
      player?.pause()
    } catch (_: Exception) {
      /* ignore */
    }
  }

  fun resume(context: Context) {
    if (ShellPlaybackSession.userPaused || ShellPlaybackSession.systemInterrupted) return
    if (preparing) return
    if (playingGap) return
    val p = player
    if (p != null) {
      try {
        p.start()
        return
      } catch (_: Exception) {
        /* fall through */
      }
    }
    syncFromSession(context)
  }

  private fun cancelGap() {
    gapRunnable?.let { handler.removeCallbacks(it) }
    gapRunnable = null
    playingGap = false
  }

  private fun startUri(context: Context, uri: String, isGap: Boolean) {
    // isGap 保留参数兼容；实际间隔改走 scheduleGapThenNext。
    stop()
    playingGap = false
    preparing = true
    currentUri = uri
    val app = context.applicationContext
    try {
      val mp = MediaPlayer()
      player = mp
      mp.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .build(),
      )
      mp.setWakeMode(app, PowerManager.PARTIAL_WAKE_LOCK)
      if (uri.startsWith("http://") || uri.startsWith("https://")) {
        mp.setDataSource(uri)
      } else {
        val headers = HashMap<String, String>()
        headers["User-Agent"] = "AskBible.me/1.0 (Android MediaPlayer)"
        headers["Accept"] = "*/*"
        mp.setDataSource(app, Uri.parse(uri), headers)
      }
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
        lastFailedUri = null
        try {
          if (ShellPlaybackSession.userPaused || ShellPlaybackSession.systemInterrupted) {
            try {
              prepared.pause()
            } catch (_: Exception) {
              /* ignore */
            }
            return@setOnPreparedListener
          }
          prepared.start()
          if (ShellPlaybackSession.kind == "verse") {
            val dur = prepared.duration
            if (dur > 0) {
              ShellPlaybackSession.durationSec = dur / 1000.0
            }
            ShellPlaybackSession.playing = true
            ShellPlaybackService.refreshIfRunning(app)
          }
          Log.i(TAG, "playing uri=$uri next=${ShellPlaybackSession.peekNextQueuedUri() != null}")
        } catch (e: Exception) {
          Log.w(TAG, "start prepared failed", e)
          markFailed(uri)
          stop()
        }
      }
      mp.setOnCompletionListener { completed ->
        if (player !== completed) return@setOnCompletionListener
        onCompleted(app)
      }
      mp.setOnErrorListener { errored, what, extra ->
        if (player === errored || currentUri == uri) {
          Log.w(TAG, "MediaPlayer error what=$what extra=$extra uri=$uri")
          markFailed(uri)
          stop()
          if (ShellPlaybackSession.kind == "verse" && !ShellPlaybackSession.systemInterrupted) {
            emitAdvance(null, nativeChained = false)
          }
        }
        true
      }
      mp.prepareAsync()
    } catch (e: Exception) {
      Log.w(TAG, "setup failed uri=$uri", e)
      markFailed(uri)
      stop()
    }
  }

  private fun markFailed(uri: String) {
    lastFailedUri = uri
    lastFailedAtMs = System.currentTimeMillis()
    preparing = false
  }

  private fun peekNextUri(): String? {
    return if (ShellPlaybackSession.kind == "verse") {
      ShellPlaybackSession.peekNextQueuedUri()
    } else {
      ShellPlaybackSession.peekVerseUnderlayNext()
    }
  }

  private fun peekGapSec(): Double {
    return if (ShellPlaybackSession.kind == "verse") {
      ShellPlaybackSession.gapSec
    } else {
      ShellPlaybackSession.verseUnderlayGapSec
    }
  }

  private fun consumeNextUri(): String? {
    if (ShellPlaybackSession.kind == "verse") {
      val next = ShellPlaybackSession.consumeQueuedUri() ?: return null
      ShellPlaybackSession.assetUri = next
      return next
    }
    val next = ShellPlaybackSession.consumeVerseUnderlayNext() ?: return null
    return next
  }

  private fun emitAdvance(assetUri: String?, nativeChained: Boolean) {
    val map = Arguments.createMap()
    if (!assetUri.isNullOrBlank()) {
      map.putString("assetUri", assetUri)
    }
    if (nativeChained) {
      map.putBoolean("nativeChained", true)
    }
    AskBibleShellMediaControlsModule.emitRemote("ShellMediaNativeVerseAdvance", map)
  }

  private fun playNextOrAdvance(context: Context) {
    if (peekNextUri().isNullOrBlank()) {
      if (ShellPlaybackSession.refillVerseQueuesFromHistory(currentUri)) {
        Log.i(TAG, "queue empty; loop history next=${peekNextUri()}")
      }
    }
    val next = peekNextUri()
    if (next.isNullOrBlank()) {
      awaitingJsAdvance = true
      lastCompletedUri = currentUri ?: ShellPlaybackSession.assetUri
      ShellPlaybackSession.markAssetPlayed(lastCompletedUri)
      releasePlayerKeepingWait()
      Log.i(TAG, "queue empty after verse; wait JS advance uri=$lastCompletedUri")
      emitAdvance(null, nativeChained = false)
      return
    }
    awaitingJsAdvance = false
    lastCompletedUri = null
    val consumed = consumeNextUri() ?: return
    Log.i(TAG, "chain next=$consumed remainNext=${peekNextUri() != null}")
    emitAdvance(consumed, nativeChained = true)
    startUri(context, consumed, isGap = false)
  }

  private fun releasePlayerKeepingWait() {
    preparing = false
    currentUri = null
    val old = player
    player = null
    if (old == null) return
    try {
      old.setOnPreparedListener(null)
      old.setOnCompletionListener(null)
      old.setOnErrorListener(null)
      old.reset()
      old.release()
    } catch (_: Exception) {
      /* ignore */
    }
  }

  private fun scheduleGapThenNext(context: Context, gapSec: Double) {
    cancelGap()
    playingGap = true
    // 停掉当前播放器，保留会话里的 next 队列。
    preparing = false
    currentUri = null
    val old = player
    player = null
    if (old != null) {
      try {
        old.setOnPreparedListener(null)
        old.setOnCompletionListener(null)
        old.setOnErrorListener(null)
        old.reset()
        old.release()
      } catch (_: Exception) {
        /* ignore */
      }
    }
    val delayMs = (gapSec * 1000.0).toLong().coerceIn(50L, 15_000L)
    Log.i(TAG, "gap ${delayMs}ms then next=${peekNextUri() != null}")
    val runnable =
      Runnable {
        gapRunnable = null
        playingGap = false
        if (ShellPlaybackSession.systemInterrupted) return@Runnable
        playNextOrAdvance(context)
      }
    gapRunnable = runnable
    handler.postDelayed(runnable, delayMs)
  }

  private fun onCompleted(context: Context) {
    if (ShellPlaybackSession.systemInterrupted) {
      pause()
      return
    }
    lastCompletedUri = currentUri
    ShellPlaybackSession.markAssetPlayed(currentUri)
    val next = peekNextUri()
    val gapSec = peekGapSec()
    Log.i(
      TAG,
      "completed current=$currentUri next=${next != null} gapSec=$gapSec kind=${ShellPlaybackSession.kind}",
    )
    if (!next.isNullOrBlank() && gapSec > 0.05) {
      scheduleGapThenNext(context, gapSec)
      return
    }
    playNextOrAdvance(context)
  }
}
