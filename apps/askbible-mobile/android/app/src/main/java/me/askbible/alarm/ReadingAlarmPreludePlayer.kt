package me.askbible.alarm

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.PowerManager
import android.util.Log

/** 读经闹钟预备：从本地曲池随机选曲（filesDir），失败时回退 APK raw / 系统闹钟声。 */
object ReadingAlarmPreludePlayer {
  private const val TAG = "ReadingAlarmPrelude"
  private var player: MediaPlayer? = null
  private var focusRequest: AudioFocusRequest? = null
  private var audioContext: Context? = null
  private var wakeLock: PowerManager.WakeLock? = null

  fun start(context: Context) {
    stop()
    val appContext = context.applicationContext
    audioContext = appContext
    acquireWakeLock(appContext)
    requestFocus(appContext)
    ensureAudible(appContext)

    val file = ReadingAlarmPreludeCache.pickRandomPlayableFile(appContext)
    if (file != null) {
      try {
        player =
          MediaPlayer().apply {
            setAudioAttributes(
              AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build(),
            )
            setDataSource(file.absolutePath)
            isLooping = true
            setVolume(1f, 1f)
            setWakeMode(appContext, PowerManager.PARTIAL_WAKE_LOCK)
            setOnPreparedListener {
              try {
                it.start()
              } catch (e: Exception) {
                Log.w(TAG, "start prepared failed", e)
                startFallbackAlarmTone(appContext)
              }
            }
            setOnErrorListener { _, what, extra ->
              Log.w(TAG, "MediaPlayer error what=$what extra=$extra")
              stop()
              startFallbackAlarmTone(appContext)
              true
            }
            prepareAsync()
          }
        return
      } catch (e: Exception) {
        Log.w(TAG, "file player setup failed", e)
        stop()
      }
    }
    startFallbackAlarmTone(appContext)
  }

  private fun startFallbackAlarmTone(context: Context) {
    try {
      val uri =
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
          ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
          ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
      player =
        MediaPlayer().apply {
          setDataSource(context, uri)
          setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_ALARM)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build(),
          )
          isLooping = true
          prepare()
          start()
        }
    } catch (e: Exception) {
      Log.w(TAG, "fallback alarm tone failed", e)
      stop()
    }
  }

  fun isPlaying(): Boolean = player?.isPlaying == true

  fun stop() {
    releaseWakeLock()
    abandonFocus()
    player?.run {
      try {
        if (isPlaying) stop()
      } catch (_: Exception) {
      }
      release()
    }
    player = null
    audioContext = null
  }

  private fun ensureAudible(context: Context) {
    val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    @Suppress("DEPRECATION")
    val stream = AudioManager.STREAM_MUSIC
    if (am.getStreamVolume(stream) == 0) {
      val half = am.getStreamMaxVolume(stream) / 2
      if (half > 0) am.setStreamVolume(stream, half, 0)
    }
  }

  private fun acquireWakeLock(context: Context) {
    val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock =
      pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AskBible:ReadingAlarmPrelude").apply {
        acquire(75_000L)
      }
  }

  private fun releaseWakeLock() {
    wakeLock?.run {
      if (isHeld) release()
    }
    wakeLock = null
  }

  private fun requestFocus(context: Context) {
    val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      focusRequest =
        AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
          .setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_MEDIA)
              .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
              .build(),
          )
          .build()
      am.requestAudioFocus(focusRequest!!)
    } else {
      @Suppress("DEPRECATION")
      am.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
    }
  }

  private fun abandonFocus() {
    val context = audioContext ?: return
    val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      focusRequest?.let { am.abandonAudioFocusRequest(it) }
      focusRequest = null
    } else {
      @Suppress("DEPRECATION")
      am.abandonAudioFocus(null)
    }
  }
}
