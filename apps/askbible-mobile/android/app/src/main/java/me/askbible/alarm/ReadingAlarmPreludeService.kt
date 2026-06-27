package me.askbible.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import me.askbible.R

/** 闹钟预备音乐前台服务：保证仅通知弹出时也能播 App 内音乐。 */
class ReadingAlarmPreludeService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    ensureChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopPreludeSession()
        return START_NOT_STICKY
      }
    }

    ReadingAlarmPrefs.setPreludeActive(this, true)
    val notification = buildNotification()
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
        )
      } else {
        @Suppress("DEPRECATION")
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (_: Exception) {
      /* 通知权限缺失时仍尝试播预备音乐 */
    }

    ReadingAlarmPreludeCache.warmAsync(this)
    ReadingAlarmPreludePlayer.start(this)
    return START_STICKY
  }

  override fun onDestroy() {
    ReadingAlarmPreludePlayer.stop()
    super.onDestroy()
  }

  private fun stopPreludeSession() {
    ReadingAlarmAutoContinue.cancelSchedule(this)
    ReadingAlarmPrefs.setPreludeActive(this, false)
    ReadingAlarmPreludePlayer.stop()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun buildNotification(): Notification {
    val openAlarm =
      PendingIntent.getActivity(
        this,
        9110,
        Intent(this, ReadingAlarmActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    val stopIntent =
      PendingIntent.getService(
        this,
        9111,
        Intent(this, ReadingAlarmPreludeService::class.java).apply { action = ACTION_STOP },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(getString(R.string.reading_alarm_notification_title))
      .setContentText(getString(R.string.reading_alarm_prelude_hint))
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setOngoing(true)
      .setSilent(true)
      .setContentIntent(openAlarm)
      .addAction(0, getString(R.string.reading_alarm_stop), stopIntent)
      .build()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    manager.createNotificationChannel(
      NotificationChannel(
        CHANNEL_ID,
        getString(R.string.reading_alarm_channel_name),
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = getString(R.string.reading_alarm_prelude_hint)
        setSound(null, null)
        enableVibration(false)
      },
    )
  }

  companion object {
    const val ACTION_STOP = "me.askbible.alarm.PRELUDE_STOP"
    const val CHANNEL_ID = "reading-alarm-prelude-service"
    const val NOTIFICATION_ID = 9112

    fun start(context: Context) {
      val appContext = context.applicationContext
      val intent = Intent(appContext, ReadingAlarmPreludeService::class.java)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          appContext.startForegroundService(intent)
        } else {
          appContext.startService(intent)
        }
      } catch (_: Exception) {
        ReadingAlarmPrefs.setPreludeActive(appContext, true)
        ReadingAlarmPreludePlayer.start(appContext)
      }
    }

    fun stop(context: Context) {
      context.startService(
        Intent(context, ReadingAlarmPreludeService::class.java).apply { action = ACTION_STOP },
      )
    }
  }
}
