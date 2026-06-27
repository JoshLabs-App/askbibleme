package me.askbible.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.SystemClock

object WidgetAlarmScheduler {
  private const val REQUEST_CODE = 8801

  fun schedule(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    val component = ComponentName(context, AskBibleDailyVerseWidgetProvider::class.java)
    val ids = manager.getAppWidgetIds(component)
    if (ids.isEmpty()) {
      cancel(context)
      return
    }

    val intervalMs = WidgetRotationState.rotationIntervalMs(context)
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val intent =
      Intent(context, AskBibleDailyVerseWidgetProvider::class.java).apply {
        action = AskBibleDailyVerseWidgetProvider.ACTION_ROTATE_TICK
      }
    val pendingIntent =
      PendingIntent.getBroadcast(
        context,
        REQUEST_CODE,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

    alarmManager.cancel(pendingIntent)
    alarmManager.setRepeating(
      AlarmManager.ELAPSED_REALTIME,
      SystemClock.elapsedRealtime() + intervalMs,
      intervalMs,
      pendingIntent,
    )
  }

  fun cancel(context: Context) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val intent =
      Intent(context, AskBibleDailyVerseWidgetProvider::class.java).apply {
        action = AskBibleDailyVerseWidgetProvider.ACTION_ROTATE_TICK
      }
    val pendingIntent =
      PendingIntent.getBroadcast(
        context,
        REQUEST_CODE,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    alarmManager.cancel(pendingIntent)
  }
}
