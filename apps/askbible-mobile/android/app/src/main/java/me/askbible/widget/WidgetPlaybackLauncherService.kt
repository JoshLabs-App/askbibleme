package me.askbible.widget

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

/** 旧版 broadcast 点击回落：前台服务内拉起 MainActivity，绕过 Android 14 BAL 限制。 */
class WidgetPlaybackLauncherService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val bridgeAction =
      intent?.getStringExtra(EXTRA_BRIDGE_ACTION)?.trim()?.ifEmpty { null } ?: run {
        stopSelf()
        return START_NOT_STICKY
      }

    ensureChannel()
    val verseKey =
      if (bridgeAction == WidgetPlaybackBridge.ACTION_VERSE) {
        WidgetPlaybackBridge.peekPendingVerseKey(this)
      } else {
        null
      }
    val launchIntent =
      WidgetPlaybackBridge.buildPlaybackActivityIntent(this, bridgeAction, verseKey)
    val pendingIntent =
      PendingIntent.getActivity(
        this,
        9301,
        launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    val notification =
      NotificationCompat.Builder(this, CHANNEL_ID)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle(getString(R.string.app_name))
        .setContentText(getString(R.string.widget_playback_starting))
        .setContentIntent(pendingIntent)
        .setOngoing(true)
        .setSilent(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .build()

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
      startActivity(launchIntent)
    } catch (_: Exception) {
      /* ignore */
    }

    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
    return START_NOT_STICKY
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    manager.createNotificationChannel(
      NotificationChannel(
        CHANNEL_ID,
        getString(R.string.widget_playback_channel_name),
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        setSound(null, null)
        enableVibration(false)
      },
    )
  }

  companion object {
    private const val CHANNEL_ID = "widget-playback-launcher"
    private const val NOTIFICATION_ID = 9302
    private const val EXTRA_BRIDGE_ACTION = "bridge_action"

    fun start(context: Context, bridgeAction: String) {
      val appContext = context.applicationContext
      val intent =
        Intent(appContext, WidgetPlaybackLauncherService::class.java).apply {
          putExtra(EXTRA_BRIDGE_ACTION, bridgeAction)
        }
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          appContext.startForegroundService(intent)
        } else {
          appContext.startService(intent)
        }
      } catch (_: Exception) {
        /* ignore */
      }
    }
  }
}
