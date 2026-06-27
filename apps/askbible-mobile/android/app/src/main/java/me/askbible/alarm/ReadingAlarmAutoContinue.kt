package me.askbible.alarm

import android.app.Activity
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.app.NotificationManagerCompat
import me.askbible.MainActivity

/** 预备音乐 60 秒后自动进入今日读经；AlarmManager + Handler 双保险。 */
object ReadingAlarmAutoContinue {
  private const val PRELUDE_MS = 60_000L
  private const val REQUEST_CODE = 9113
  private val handler = Handler(Looper.getMainLooper())
  @Volatile private var sessionContinued = false

  private val autoContinueRunnable = Runnable {
    val ctx = appContext ?: return@Runnable
    run(ctx)
  }

  @Volatile private var appContext: Context? = null

  fun resetSession(context: Context) {
    sessionContinued = false
    appContext = context.applicationContext
    cancelSchedule(context)
  }

  fun schedule(context: Context) {
    val appContext = context.applicationContext
    this.appContext = appContext
    cancelSchedule(appContext)
    scheduleAlarm(appContext)
    handler.postDelayed(autoContinueRunnable, PRELUDE_MS)
  }

  /** 锁屏 Activity 可见时由界面倒计时负责交接，取消 Handler 避免抢先停音乐却不拉起 App。 */
  fun cancelHandlerOnly() {
    handler.removeCallbacks(autoContinueRunnable)
  }

  fun cancelSchedule(context: Context? = appContext) {
    handler.removeCallbacks(autoContinueRunnable)
    val ctx = context ?: return
    val alarmManager = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarmManager.cancel(autoContinuePendingIntent(ctx))
  }

  fun run(context: Context, directScripture: Boolean = false) {
    synchronized(this) {
      val appContext = context.applicationContext
      val alreadyContinued = sessionContinued

      if (!alreadyContinued) {
        if (!directScripture &&
          !ReadingAlarmPrefs.isPreludeActive(appContext) &&
          !ReadingAlarmPrefs.peekPendingAutoPlay(appContext)
        ) {
          return
        }
        sessionContinued = true
        cancelSchedule(appContext)
        ReadingAlarmPrefs.setPendingAutoPlay(appContext, true)
        ReadingAlarmPrefs.setPreludeActive(appContext, false)

        if (!directScripture) {
          ReadingAlarmPreludePlayer.stop()
          ReadingAlarmPreludeService.stop(appContext)
          ReadingAlarmSound.stop(appContext)
        }
        NotificationManagerCompat.from(appContext).cancel(ReadingAlarmReceiver.NOTIFICATION_ID)
      } else if (!ReadingAlarmPrefs.peekPendingAutoPlay(appContext)) {
        return
      }

      launchMainActivityForScripture(context)
      if (!alreadyContinued) {
        ReadingAlarmReceiver.showScriptureHandoffNotification(appContext)
      }
      AskBibleReadingAlarmModule.emitAutoContinue(appContext)
    }
  }

  private fun launchMainActivityForScripture(context: Context) {
    val intent =
      Intent(context, MainActivity::class.java).apply {
        var launchFlags =
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
            Intent.FLAG_ACTIVITY_SINGLE_TOP or
            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        if (context !is Activity) {
          launchFlags = launchFlags or Intent.FLAG_ACTIVITY_NEW_TASK
        }
        flags = launchFlags
        putExtra(ReadingAlarmReceiver.EXTRA_AUTO_PLAY, true)
      }
    try {
      context.startActivity(intent)
    } catch (_: Exception) {
      ReadingAlarmReceiver.showScriptureHandoffNotification(context.applicationContext)
    }
  }

  private fun scheduleAlarm(context: Context) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val triggerAt = System.currentTimeMillis() + PRELUDE_MS
    val pendingIntent = autoContinuePendingIntent(context)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
      } else {
        @Suppress("DEPRECATION")
        alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
      }
    } catch (_: SecurityException) {
      alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
    }
  }

  private fun autoContinuePendingIntent(context: Context): PendingIntent {
    val intent =
      Intent(context, ReadingAlarmReceiver::class.java).apply {
        action = ReadingAlarmReceiver.ACTION_AUTO_CONTINUE
      }
    return PendingIntent.getBroadcast(
      context,
      REQUEST_CODE,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }
}
