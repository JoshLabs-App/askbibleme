package me.askbible.alarm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import me.askbible.R

class ReadingAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    when (intent?.action) {
      ACTION_AUTO_CONTINUE -> {
        ReadingAlarmAutoContinue.run(context)
        return
      }
      ACTION_FIRE -> fireReadingAlarm(context)
      else -> return
    }
  }

  companion object {
    const val ACTION_FIRE = "me.askbible.alarm.ACTION_FIRE"
    const val ACTION_AUTO_CONTINUE = "me.askbible.alarm.ACTION_AUTO_CONTINUE"
    const val CHANNEL_ID = "reading-alarm-fullscreen"
    const val NOTIFICATION_ID = 9108
    const val SCRIPTURE_HANDOFF_NOTIFICATION_ID = 9115
    const val EXTRA_AUTO_PLAY = "askbible_reading_alarm_auto_play"
    const val EXTRA_PRELUDE_SESSION = "askbible_reading_alarm_prelude_session"

    /** AlarmManager / Expo 备用通知统一入口；始终尝试重排下一次闹钟。 */
    fun fireReadingAlarm(context: Context) {
      val appContext = context.applicationContext
      if (!ReadingAlarmPrefs.isEnabled(appContext)) {
        ReadingAlarmScheduler.cancel(appContext)
        return
      }
      if (ReadingAlarmPrefs.isPreludeActive(appContext) && !ReadingAlarmPrefs.peekPendingAutoPlay(appContext)) {
        return
      }
      try {
        deliverReadingAlarm(appContext)
      } catch (_: Exception) {
        try {
          ReadingAlarmPrefs.clearSessionForNewAlarm(appContext)
          ReadingAlarmAutoContinue.resetSession(appContext)
          if (ReadingAlarmPrefs.isScriptureMode(appContext)) {
            ReadingAlarmAutoContinue.run(appContext, directScripture = true)
          } else {
            ReadingAlarmPreludePlayer.start(appContext)
          }
        } catch (_: Exception) {
          /* last resort */
        }
      } finally {
        try {
          ReadingAlarmScheduler.scheduleNext(appContext)
        } catch (_: Exception) {
          /* ignore */
        }
      }
    }

    private fun deliverReadingAlarm(context: Context) {
      ensureChannel(context)
      if (ReadingAlarmPrefs.isScriptureMode(context)) {
        deliverScriptureAlarm(context)
      } else {
        deliverMusicAlarm(context)
      }
    }

    private fun deliverMusicAlarm(context: Context) {
      ReadingAlarmPrefs.clearSessionForNewAlarm(context)
      ReadingAlarmAutoContinue.resetSession(context)

      try {
        ReadingAlarmPreludeService.start(context)
      } catch (_: Exception) {
        ReadingAlarmPrefs.setPreludeActive(context, true)
        ReadingAlarmPreludePlayer.start(context)
      }

      try {
        context.startActivity(
          Intent(context, ReadingAlarmActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
          },
        )
      } catch (_: Exception) {
        /* full-screen notification fallback below */
      }

      postAlarmFullScreenNotification(context, ReadingAlarmActivity::class.java, 9109)
    }

    private fun deliverScriptureAlarm(context: Context) {
      ReadingAlarmPrefs.clearSessionForNewAlarm(context)
      ReadingAlarmAutoContinue.resetSession(context)
      ReadingAlarmPrefs.setPreludeActive(context, false)
      ReadingAlarmAutoContinue.run(context, directScripture = true)
    }

    private fun postAlarmFullScreenNotification(
      context: Context,
      activityClass: Class<*>,
      requestCode: Int,
    ) {
      val fullScreenIntent =
        Intent(context, activityClass).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
      val fullScreenPendingIntent =
        PendingIntent.getActivity(
          context,
          requestCode,
          fullScreenIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

      val label = ReadingAlarmPrefs.label(context)
      val title = context.getString(R.string.reading_alarm_notification_title)
      val body =
        if (label.isNotBlank()) label
        else context.getString(R.string.reading_alarm_notification_body)

      val notification =
        NotificationCompat.Builder(context, CHANNEL_ID)
          .setSmallIcon(R.mipmap.ic_launcher)
          .setContentTitle(title)
          .setContentText(body)
          .setPriority(NotificationCompat.PRIORITY_MAX)
          .setCategory(NotificationCompat.CATEGORY_ALARM)
          .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
          .setAutoCancel(true)
          .setSilent(true)
          .setFullScreenIntent(fullScreenPendingIntent, true)
          .setContentIntent(fullScreenPendingIntent)
          .build()

      try {
        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
      } catch (_: Exception) {
        /* POST_NOTIFICATIONS denied — prelude / activity may still run */
      }
    }

    fun ensureChannel(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (manager.getNotificationChannel(CHANNEL_ID) != null) return
      val channel =
        NotificationChannel(
          CHANNEL_ID,
          context.getString(R.string.reading_alarm_channel_name),
          NotificationManager.IMPORTANCE_HIGH,
        ).apply {
          description = context.getString(R.string.reading_alarm_notification_body)
          enableVibration(true)
          vibrationPattern = longArrayOf(0, 500, 250, 500)
          setSound(null, null)
          setBypassDnd(false)
          lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }
      manager.createNotificationChannel(channel)
    }

    /** 预备音乐结束后：全屏通知 + 内容 Intent，确保三星等机型能拉起 RN 播放经文。 */
    fun showScriptureHandoffNotification(context: Context) {
      ensureChannel(context)
      val launchIntent =
        Intent(context, me.askbible.MainActivity::class.java).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
          putExtra(EXTRA_AUTO_PLAY, true)
        }
      val fullScreenPendingIntent =
        PendingIntent.getActivity(
          context,
          9114,
          launchIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
      val label = ReadingAlarmPrefs.label(context)
      val body =
        if (label.isNotBlank()) label
        else context.getString(R.string.reading_alarm_scripture_starting)
      val notification =
        NotificationCompat.Builder(context, CHANNEL_ID)
          .setSmallIcon(R.mipmap.ic_launcher)
          .setContentTitle(context.getString(R.string.reading_alarm_notification_title))
          .setContentText(body)
          .setPriority(NotificationCompat.PRIORITY_MAX)
          .setCategory(NotificationCompat.CATEGORY_ALARM)
          .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
          .setAutoCancel(true)
          .setSilent(true)
          .setFullScreenIntent(fullScreenPendingIntent, true)
          .setContentIntent(fullScreenPendingIntent)
          .build()
      NotificationManagerCompat.from(context).notify(SCRIPTURE_HANDOFF_NOTIFICATION_ID, notification)
    }
  }
}
