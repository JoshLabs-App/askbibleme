package me.askbible.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Reschedule the reading alarm after device reboot. */
class ReadingAlarmBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val action = intent?.action ?: return
    if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    if (!ReadingAlarmPrefs.isEnabled(context)) return
    ReadingAlarmScheduler.scheduleNext(context)
  }
}
