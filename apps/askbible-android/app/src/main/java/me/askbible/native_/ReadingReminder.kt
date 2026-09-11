package me.askbible.native_

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.SiteCopy
import java.util.Calendar

/**
 * 每日读经提醒（对齐 RN notification-prefs + localNotificationScheduler 的 readingReminder 那一路）：
 * 每天同一时刻一条本地通知，文案「读经提醒 / 今天可以安静读一会儿经。」。
 * 偏好只存本机（RN 也一样，不进会员同步）。与 iOS 的 ReadingReminder 对等。
 */
object ReadingReminder {
    private const val FILE = "reading-reminder"
    private const val KEY_ENABLED = "askbible-reading-reminder-enabled-v1"
    private const val KEY_HOUR = "askbible-reading-reminder-hour-v1"
    private const val KEY_MINUTE = "askbible-reading-reminder-minute-v1"
    private const val CHANNEL_ID = "askbible-reading-reminder"
    private const val NOTIFICATION_ID = 4101
    private const val REQUEST_CODE = 4101

    private fun prefs(context: Context) = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    fun enabled(context: Context): Boolean = prefs(context).getBoolean(KEY_ENABLED, false)
    /** RN DEFAULT_NOTIFICATION_PREFS：07:00 */
    fun hour(context: Context): Int = prefs(context).getInt(KEY_HOUR, 7)
    fun minute(context: Context): Int = prefs(context).getInt(KEY_MINUTE, 0)
    fun timeLabel(context: Context): String = String.format("%02d:%02d", hour(context), minute(context))

    /** 通知权限（Android 13+ 才要）；没有就先不排，界面提示去设置里开 */
    fun canNotify(context: Context): Boolean =
        NotificationManagerCompat.from(context).areNotificationsEnabled()

    /**
     * 开关 + 改时间统一走这里：关就撤销，开就排下一次（收到后再排下一天，
     * 用 setExactAndAllowWhileIdle 的重复靠自己续，不用 setRepeating —— 后者在打盹模式下会漂）。
     * 返回 false 表示系统通知没开。
     */
    fun apply(context: Context, enabled: Boolean, hour: Int, minute: Int): Boolean {
        val h = hour.coerceIn(0, 23)
        val m = minute.coerceIn(0, 59)
        prefs(context).edit().putInt(KEY_HOUR, h).putInt(KEY_MINUTE, m).apply()
        cancelAlarm(context)
        if (!enabled) {
            prefs(context).edit().putBoolean(KEY_ENABLED, false).apply()
            return true
        }
        if (!canNotify(context)) {
            prefs(context).edit().putBoolean(KEY_ENABLED, false).apply()
            return false
        }
        ensureChannel(context)
        scheduleNext(context, h, m)
        prefs(context).edit().putBoolean(KEY_ENABLED, true).apply()
        return true
    }

    /** 开机 / 收到提醒后续排下一天 */
    fun rescheduleIfEnabled(context: Context) {
        if (!enabled(context)) return
        scheduleNext(context, hour(context), minute(context))
    }

    private fun alarmIntent(context: Context): PendingIntent {
        val intent = Intent(context, ReadingReminderReceiver::class.java)
        return PendingIntent.getBroadcast(
            context, REQUEST_CODE, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun cancelAlarm(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(alarmIntent(context))
    }

    private fun scheduleNext(context: Context, hour: Int, minute: Int) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val next = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1)
        }.timeInMillis
        // 提醒不是闹钟，不申请精确闹钟权限：窗口对齐即可（系统可能推迟几分钟）
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, alarmIntent(context))
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, SiteCopy.t("native.reminderTitle", AppLocale.current),
                                NotificationManager.IMPORTANCE_DEFAULT),
        )
    }

    /** 提醒到点：发通知，并排下一天 */
    fun fire(context: Context) {
        ensureChannel(context)
        val locale = AppLocale.current
        val open = PendingIntent.getActivity(
            context, 0, Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val n = Notification.Builder(context, CHANNEL_ID)
            .setContentTitle(SiteCopy.t("native.reminderTitle", locale))
            .setContentText(SiteCopy.t("native.reminderBody", locale))
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        if (canNotify(context)) {
            (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .notify(NOTIFICATION_ID, n)
        }
        rescheduleIfEnabled(context)
    }
}

/** 到点的广播 + 开机重排 */
class ReadingReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED) {
            ReadingReminder.rescheduleIfEnabled(context)
            return
        }
        ReadingReminder.fire(context)
    }
}
