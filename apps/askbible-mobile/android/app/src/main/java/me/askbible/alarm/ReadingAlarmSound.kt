package me.askbible.alarm

import android.content.Context
import androidx.core.app.NotificationManagerCompat

object ReadingAlarmSound {
  @Volatile private var stopAlertSound: (() -> Unit)? = null

  fun registerStopHandler(handler: () -> Unit) {
    stopAlertSound = handler
  }

  fun unregisterStopHandler(handler: () -> Unit) {
    if (stopAlertSound === handler) stopAlertSound = null
  }

  fun stop(context: Context) {
    stopAlertSound?.invoke()
    NotificationManagerCompat.from(context).cancel(ReadingAlarmReceiver.NOTIFICATION_ID)
  }
}
