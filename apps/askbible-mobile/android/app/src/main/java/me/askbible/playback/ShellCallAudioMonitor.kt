package me.askbible.playback

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.AudioPlaybackConfiguration
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.util.concurrent.Executor

/**
 * 来电 / 通话：不抢 expo-av 的 AudioFocus，只听系统通话模式与铃声占用。
 * 打断时暂停原生金句，并通知 JS 不要把音乐/环境音抢回来。
 */
object ShellCallAudioMonitor {
  private const val TAG = "ShellCallAudio"

  @Volatile var interrupted: Boolean = false
    private set

  private var started = false
  private var owners = 0
  private val handler = Handler(Looper.getMainLooper())
  private var appContext: Context? = null
  private var audioManager: AudioManager? = null
  private var playbackCallback: AudioManager.AudioPlaybackCallback? = null
  private var modeListener: AudioManager.OnModeChangedListener? = null
  private val modeReceiver =
    object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        refresh(audioManager ?: return)
      }
    }

  fun start(context: Context) {
    owners += 1
    appContext = context.applicationContext
    if (started) {
      if (interrupted) {
        AskBibleShellMediaControlsModule.emitRemote("AudioSessionInterruptionBegan")
      }
      return
    }
    val app = context.applicationContext
    val am = app.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
    appContext = app
    audioManager = am
    started = true

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val callback =
        object : AudioManager.AudioPlaybackCallback() {
          override fun onPlaybackConfigChanged(configs: MutableList<AudioPlaybackConfiguration>) {
            refresh(am, configs)
          }
        }
      playbackCallback = callback
      am.registerAudioPlaybackCallback(callback, handler)
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val listener = AudioManager.OnModeChangedListener { refresh(am) }
      modeListener = listener
      val executor = Executor { command -> handler.post(command) }
      am.addOnModeChangedListener(executor, listener)
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val filter = IntentFilter("android.media.MODE_CHANGED")
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          app.registerReceiver(modeReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
          app.registerReceiver(modeReceiver, filter)
        }
      } catch (_: Exception) {
        /* ignore */
      }
    }

    refresh(am)
    Log.i(TAG, "started mode=${am.mode}")
  }

  fun stop(context: Context) {
    if (owners > 0) owners -= 1
    if (owners > 0 || !started) return
    val app = context.applicationContext
    val am = audioManager
    playbackCallback?.let { callback ->
      try {
        am?.unregisterAudioPlaybackCallback(callback)
      } catch (_: Exception) {
        /* ignore */
      }
    }
    playbackCallback = null
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      modeListener?.let { listener ->
        try {
          am?.removeOnModeChangedListener(listener)
        } catch (_: Exception) {
          /* ignore */
        }
      }
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      try {
        app.unregisterReceiver(modeReceiver)
      } catch (_: Exception) {
        /* ignore */
      }
    }
    modeListener = null
    audioManager = null
    appContext = null
    started = false
  }

  fun isCallLikeNow(context: Context): Boolean {
    val am =
      audioManager
        ?: context.applicationContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        ?: return interrupted
    return isCallLike(am, null)
  }

  /** expo-av setSpeakerphoneOn 会把 mode 打成 IN_COMMUNICATION，那不是真来电。 */
  fun clearStaleInterruptIfIdle(context: Context): Boolean {
    if (isCallLikeNow(context)) return false
    if (!interrupted && !ShellPlaybackSession.systemInterrupted) return false
    interrupted = false
    ShellPlaybackSession.systemInterrupted = false
    Log.i(TAG, "cleared stale call interrupt")
    AskBibleShellMediaControlsModule.emitRemote("AudioSessionInterruptionEnded")
    return true
  }

  private fun refresh(
    am: AudioManager,
    configs: List<AudioPlaybackConfiguration>? = null,
  ) {
    val next = isCallLike(am, configs)
    if (next == interrupted) return
    interrupted = next
    ShellPlaybackSession.systemInterrupted = next
    if (next) {
      Log.i(TAG, "call interrupt begin mode=${am.mode}")
      ShellVerseNativePlayer.pause()
      AskBibleShellMediaControlsModule.emitRemote("AudioSessionInterruptionBegan")
    } else {
      Log.i(TAG, "call interrupt end mode=${am.mode}")
      AskBibleShellMediaControlsModule.emitRemote("AudioSessionInterruptionEnded")
    }
    if (ShellPlaybackSession.active) {
      appContext?.let { ShellPlaybackService.startOrRefresh(it) }
    }
  }

  private fun isCallLike(
    am: AudioManager,
    configs: List<AudioPlaybackConfiguration>?,
  ): Boolean {
    if (isCallLikeMode(am.mode)) return true
    val playback = configs ?: if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      try {
        am.activePlaybackConfigurations
      } catch (_: Exception) {
        emptyList()
      }
    } else {
      emptyList()
    }
    return playback.any { config ->
      val usage = config.audioAttributes.usage
      usage == AudioAttributes.USAGE_NOTIFICATION_RINGTONE ||
        usage == AudioAttributes.USAGE_VOICE_COMMUNICATION
    }
  }

  private fun isCallLikeMode(mode: Int): Boolean {
    // 不要把 MODE_IN_COMMUNICATION 当来电：expo-av playThroughEarpiece=false
    // 会 setSpeakerphoneOn，三星会进这个 mode，读经/音乐会被误标打断后一直没声。
    // 真 VoIP 仍会被下面的 USAGE_VOICE_COMMUNICATION 捕获。
    return mode == AudioManager.MODE_RINGTONE || mode == AudioManager.MODE_IN_CALL
  }
}
