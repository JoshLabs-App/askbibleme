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
  /** 共享焦点里的成员 id。 */
  private const val MEDIA_FOCUS_ID = "verse"
  /** 关屏后 JS 可能要经过多次 Doze 唤醒窗口才能补上队列；30s 太短，放宽到约 2 分钟。 */
  private const val JS_ADVANCE_MAX_RETRIES = 40
  private const val JS_ADVANCE_RETRY_INTERVAL_MS = 3_000L

  private var player: MediaPlayer? = null
  private var currentUri: String? = null
  private var playingGap: Boolean = false
  private var preparing: Boolean = false
  private var lastFailedUri: String? = null
  /**
   * 原生自己接上、但 JS 还没确认的那一句。
   *
   * 关屏可靠性要求原生能自行接句（见 playNextOrAdvance），于是「现在在播哪一句」有两个
   * 说法：原生按自己的队列走，JS 要等 emitAdvance 才知道换了。JS 那份滞后的答案若照单执行，
   * 就会把刚起头的新句掐掉换回去——2026-09-07 logcat 实证：`chain next=PRO-3-14` 起播，
   * 3.7s 后被 JS 换成 ISA-58-10。
   *
   * 真正在出声的是原生这一方，所以**以原生为准，直到 JS 送来的句子和它一致**（即已跟上）。
   * 早先用「接句后 3 秒」的时间窗不管用：窗口一过 JS 照样把它顶掉，只是把切断推迟了。
   * 用户显式点播（forceRestartKind="verse"）在上面已先行处理，不受这里限制。
   */
  private var pendingChainAckUri: String? = null
  private var lastFailedAtMs: Long = 0L
  /** 句终且队列空：等 JS 换句，禁止 1s 刷新把同一句再 start。 */
  private var awaitingJsAdvance: Boolean = false
  private var lastCompletedUri: String? = null
  private var appContext: Context? = null
  private val handler = Handler(Looper.getMainLooper())
  private var gapRunnable: Runnable? = null
  private var jsAdvanceRetryCount: Int = 0

  /**
   * 关屏后队列耗尽只 emitAdvance 一次就等 JS：若那次事件恰好在 JS 被系统冻结/降频时丢失，
   * 金句就永久哑掉，音乐（ShellMainNativePlayer 有同款重试）还在响，像是「金句自己停了」。
   * 参照 ShellMainNativePlayer.jsAdvanceRetryRunnable，定时重新 emit 并检查队列，给 JS
   * 多次醒来补队列的机会，而不是赌一次事件必达。
   */
  private val jsAdvanceRetryRunnable =
    object : Runnable {
      override fun run() {
        if (!awaitingJsAdvance) return
        if (ShellPlaybackSession.userPaused || ShellPlaybackSession.systemInterrupted) {
          clearAwaitingJsAdvance()
          return
        }
        val primary = ShellPlaybackSession.kind == "verse" && ShellPlaybackSession.playing
        val underlay = ShellPlaybackSession.verseUnderlayPlaying && !ShellPlaybackSession.userPaused
        if (!primary && !underlay) {
          clearAwaitingJsAdvance()
          return
        }
        val queued = peekNextUri()
        if (!queued.isNullOrBlank()) {
          val ctx = appContext
          awaitingJsAdvance = false
          lastCompletedUri = null
          jsAdvanceRetryCount = 0
          if (ctx != null) {
            val consumed = consumeNextUri()
            if (!consumed.isNullOrBlank()) {
              emitAdvance(consumed, nativeChained = true)
              startUri(ctx, consumed, isGap = false)
            }
          }
          return
        }
        jsAdvanceRetryCount += 1
        if (jsAdvanceRetryCount > JS_ADVANCE_MAX_RETRIES) {
          Log.w(TAG, "verse JS advance timeout; stop")
          clearAwaitingJsAdvance()
          return
        }
        // 再捅一次 JS（关屏后偶发第一次事件丢失；Doze 下 JS 可能要多次心跳才被唤醒）。
        emitAdvance(null, nativeChained = false)
        handler.postDelayed(this, JS_ADVANCE_RETRY_INTERVAL_MS)
      }
    }

  private fun clearAwaitingJsAdvance() {
    awaitingJsAdvance = false
    lastCompletedUri = null
    jsAdvanceRetryCount = 0
    handler.removeCallbacks(jsAdvanceRetryRunnable)
  }

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

    /** 只有金句自己发起的点播才从头重开；音乐/读经的重开旗与本播放器无关。 */
    if (ShellPlaybackSession.consumeForceRestartFor("verse")) {
      clearAwaitingJsAdvance()
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

    val awaitingAck = pendingChainAckUri
    if (awaitingAck != null) {
      when {
        // JS 跟上了，交还主导权。
        uri == awaitingAck -> pendingChainAckUri = null
        // 这句起播失败：必须放行，否则恢复也被一起挡掉。
        currentUri == lastFailedUri -> pendingChainAckUri = null
        // 已经不在播它了（被停/被换），保护失去意义。
        currentUri != awaitingAck -> pendingChainAckUri = null
        // 仍在播原生接的这句：以原生为准，忽略 JS 迟到的旧「当前句」。
        // 注意别在这里加 `player != null`：startUri 里 player 有一瞬是空的，
        // JS 的更新恰好落在那一瞬就会穿过去（2026-09-08 实测 chain 后 0.9s 仍被掐）。
        else -> {
          Log.i(TAG, "hold native verse ${awaitingAck.takeLast(24)}; JS still says ${uri.takeLast(24)}")
          return
        }
      }
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

    clearAwaitingJsAdvance()
    startUri(context, uri, isGap = false)
  }

  fun stop() {
    pendingChainAckUri = null
    cancelGap()
    playingGap = false
    preparing = false
    clearAwaitingJsAdvance()
    currentUri = null
    abandonFocus()
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
    requestFocus(app)
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
          notifyStartFailed()
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
      notifyStartFailed()
    }
  }

  /**
   * setDataSource/prepareAsync/start 同步抛异常时走这里；与 setOnErrorListener 不同，
   * 这两处此前只 markFailed+stop 不通知 JS，导致「点亮但无声」且永远等不到修正事件。
   */
  private fun notifyStartFailed() {
    if (ShellPlaybackSession.kind == "verse" && !ShellPlaybackSession.systemInterrupted) {
      emitAdvance(null, nativeChained = false)
    }
  }

  private fun markFailed(uri: String) {
    lastFailedUri = uri
    lastFailedAtMs = System.currentTimeMillis()
    preparing = false
  }

  /**
   * 请求音频焦点——转交给全 App 共享的 [ShellAudioFocus]。
   *
   * 曾经这里自己 new 一个 AUDIOFOCUS_GAIN request，导致两个原生播放器隔着系统互相踢：
   * 音乐一开播，金句就收到 AUDIOFOCUS_LOSS 自行暂停（logcat 实证，2026-09-07）。
   * GAIN 是独占语义，系统分不清两个 request 同属一个 App——所以 App 内只能持有一份。
   *
   * 仍然保留的两条老教训：只有拿到 GRANTED 才允许播放（此前忽略返回值，被拒也照播 = 无声）；
   * 焦点丢失要真的处理，不能是空 listener。
   */
  private fun requestFocus(context: Context): Boolean {
    return ShellAudioFocus.acquire(context, MEDIA_FOCUS_ID, true, focusMember)
  }

  /** 系统把焦点收走（来电、别的 App、睡眠定时器）时的统一处理。 */
  private val focusMember =
    object : ShellAudioFocus.Member {
      override fun onShellAudioFocusLost(permanent: Boolean) {
        Log.i(TAG, if (permanent) "audio focus lost permanently; pausing" else "audio focus lost transiently; pausing")
        try {
          player?.pause()
        } catch (_: Exception) {
          /* ignore */
        }
        if (permanent) abandonFocus()
      }
    }

  /** 本播放器停了：从共享焦点注销。最后一个成员走时才真的还给系统。 */
  private fun abandonFocus() {
    ShellAudioFocus.release(MEDIA_FOCUS_ID)
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
      jsAdvanceRetryCount = 0
      ShellPlaybackSession.markAssetPlayed(lastCompletedUri)
      releasePlayerKeepingWait()
      Log.i(TAG, "queue empty after verse; wait JS advance uri=$lastCompletedUri")
      emitAdvance(null, nativeChained = false)
      handler.postDelayed(jsAdvanceRetryRunnable, JS_ADVANCE_RETRY_INTERVAL_MS)
      return
    }
    clearAwaitingJsAdvance()
    val consumed = consumeNextUri() ?: return
    Log.i(TAG, "chain next=$consumed remainNext=${peekNextUri() != null}")
    pendingChainAckUri = consumed
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
