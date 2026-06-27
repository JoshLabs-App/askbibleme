package me.askbible.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

object ReadingAlarmScheduler {
  private const val REQUEST_CODE = 9108

  fun scheduleNext(context: Context) {
    if (!ReadingAlarmPrefs.isEnabled(context)) {
      cancel(context)
      return
    }

    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val triggerAt =
      nextTriggerMillis(
        ReadingAlarmPrefs.hour(context),
        ReadingAlarmPrefs.minute(context),
        ReadingAlarmPrefs.weekdays(context),
      )
    val pendingIntent = pendingIntent(context)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
      alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
      return
    }

    val showIntent =
      PendingIntent.getActivity(
        context,
        REQUEST_CODE + 1,
        Intent(context, ReadingAlarmActivity::class.java),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    alarmManager.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAt, showIntent), pendingIntent)
  }

  fun cancel(context: Context) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarmManager.cancel(pendingIntent(context))
  }

  private fun pendingIntent(context: Context): PendingIntent {
    val intent =
      Intent(context, ReadingAlarmReceiver::class.java).apply {
        action = ReadingAlarmReceiver.ACTION_FIRE
      }
    return PendingIntent.getBroadcast(
      context,
      REQUEST_CODE,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun nextTriggerMillis(hour: Int, minute: Int, weekdays: Set<Int>): Long {
    if (weekdays.isEmpty()) {
      return System.currentTimeMillis() + 24 * 60 * 60 * 1000L
    }

    val cal =
      Calendar.getInstance().apply {
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
        set(Calendar.HOUR_OF_DAY, hour)
        set(Calendar.MINUTE, minute)
      }

    repeat(8) { attempt ->
      if (attempt > 0) {
        cal.add(Calendar.DAY_OF_MONTH, 1)
      }
      val weekday = cal.get(Calendar.DAY_OF_WEEK)
      if (weekday in weekdays && cal.timeInMillis > System.currentTimeMillis()) {
        return cal.timeInMillis
      }
    }

    cal.add(Calendar.DAY_OF_MONTH, 1)
    return cal.timeInMillis
  }
}
