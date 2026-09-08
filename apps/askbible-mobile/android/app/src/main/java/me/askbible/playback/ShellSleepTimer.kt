package me.askbible.playback

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import me.askbible.playback.model.PlaybackStore

/**
 * 锁屏睡眠定时：JS 线程会被冻住，必须在原生一次性到期。
 *
 * 双路到期，先到者生效：
 * - Handler：有媒体前台服务时主线程会继续走，播放中设备不深睡，所以它是精确的那一路。
 * - AlarmManager：postDelayed 走的是开机运行时钟，设备深度休眠时不前进；用 RTC_WAKEUP 墙钟兜住这段。
 *   刻意不用 setExactAndAllowWhileIdle——那在 Android 12+ 要精确闹钟权限，为睡眠定时不值得。
 */
object ShellSleepTimer {
  private const val TAG = "ShellSleepTimer"
  private const val ALARM_ACTION = "me.askbible.playback.SLEEP_TIMER_FIRE"
  private const val ALARM_REQUEST_CODE = 4711
  private val handler = Handler(Looper.getMainLooper())
  private var pending: Runnable? = null
  private var deadlineMs: Long = 0L
  private var alarmReceiver: BroadcastReceiver? = null
  private var focusRequest: AudioFocusRequest? = null
  private var appContext: Context? = null

  fun arm(deadlineMs: Long, context: Context) {
    cancel()
    if (deadlineMs <= 0L) return
    val app = context.applicationContext
    // 先存下来：下次 arm 开头的 cancel() 要靠它撤掉上一轮的闹钟和 receiver。
    appContext = app
    this.deadlineMs = deadlineMs
    val delay = deadlineMs - System.currentTimeMillis()
    val run = Runnable { fire(app) }
    pending = run
    if (delay <= 0L) {
      handler.post(run)
      return
    }
    handler.postDelayed(run, delay)
    armAlarm(app, deadlineMs)
    Log.i(TAG, "armed delayMs=$delay")
  }

  fun cancel() {
    pending?.let { handler.removeCallbacks(it) }
    pending = null
    deadlineMs = 0L
    cancelAlarm()
    abandonFocus()
  }

  /** 墙钟兜底。不需要任何权限；设备深睡时会被唤醒，误差几分钟内，足够纠正 uptime 停摆。 */
  private fun armAlarm(context: Context, deadlineMs: Long) {
    val am = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    /** 防御性：`arm()` 开头的 `cancel()` 已经 cancelAlarm 过，这里只防将来新增的调用路径。 */
    cancelAlarm()
    try {
      val receiver =
        object : BroadcastReceiver() {
          override fun onReceive(ctx: Context, intent: Intent) {
            fire(context)
          }
        }
      val filter = IntentFilter(ALARM_ACTION)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
      } else {
        @Suppress("UnspecifiedRegisterReceiverFlag")
        context.registerReceiver(receiver, filter)
      }
      alarmReceiver = receiver
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, deadlineMs, alarmIntent(context))
    } catch (_: Exception) {
      /* 兜底失败不影响 Handler 那一路 */
    }
  }

  private fun cancelAlarm() {
    val context = appContext ?: return
    try {
      (context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager)?.cancel(alarmIntent(context))
    } catch (_: Exception) {
      /* ignore */
    }
    alarmReceiver?.let {
      try {
        context.unregisterReceiver(it)
      } catch (_: Exception) {
        /* ignore */
      }
    }
    alarmReceiver = null
  }

  private fun alarmIntent(context: Context): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      ALARM_REQUEST_CODE,
      Intent(ALARM_ACTION).setPackage(context.packageName),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  private fun fire(context: Context) {
    // 两路都可能到；先到的那一路把闸门关上，后到的直接返回。
    if (deadlineMs == 0L) return
    deadlineMs = 0L
    pending?.let { handler.removeCallbacks(it) }
    pending = null
    appContext = context.applicationContext
    cancelAlarm()
    Log.i(TAG, "fired")
    PlaybackStore.dispatch(me.askbible.playback.model.Intent.SleepTimerFired)
    silenceExpoAv(context)
    if (ShellPlaybackSession.active) {
      ShellPlaybackService.startOrRefresh(context)
    }
    AskBibleShellMediaControlsModule.emitRemote("ShellMediaSleepTimerFired")
  }

  /** 音乐 / 环境音走 expo-av：抢焦点并先占住，避免 JS 解冻后保活把环境音拉回。 */
  private fun silenceExpoAv(context: Context) {
    val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
    try {
      /**
       * 防御性：`arm()` 开头的 `cancel()` 已经 abandonFocus 过，正常路径不会泄漏。
       * 这里再撤一次，是为了将来若出现绕过 arm 的调用路径也不会覆盖掉未释放的 request。
       */
      abandonFocus()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val req =
          AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(
              AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build(),
            )
            /** 本类只抢焦点让 expo-av 静音、自身不播内容，故无需响应焦点变化。 */
            .setOnAudioFocusChangeListener { }
            .build()
        val res = am.requestAudioFocus(req)
        if (res == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
          focusRequest = req
        } else {
          Log.w(TAG, "silenceExpoAv: audio focus not granted: $res")
        }
      } else {
        @Suppress("DEPRECATION")
        am.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
      }
    } catch (_: Exception) {
      /* ignore */
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
