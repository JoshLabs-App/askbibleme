package me.askbible.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AskBibleWidgetPrefsModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AskBibleWidgetPrefs"

  @ReactMethod
  fun setDailyVerseSnapshot(json: String) {
    val context = reactApplicationContext.applicationContext
    try {
      val intervalSec = org.json.JSONObject(json).optInt("rotationIntervalSec", 0)
      if (intervalSec > 0) {
        WidgetRotationState.setRotationIntervalSec(context, intervalSec)
      }
    } catch (_: Exception) {
      /* ignore malformed snapshot */
    }
    context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(SNAPSHOT_KEY, json)
      .apply()

    val manager = AppWidgetManager.getInstance(context)
    val component = ComponentName(context, AskBibleDailyVerseWidgetProvider::class.java)
    val ids = manager.getAppWidgetIds(component)
    if (ids.isNotEmpty()) {
      AskBibleDailyVerseWidgetProvider.updateWidgets(context, manager, ids)
    }
    WidgetAlarmScheduler.schedule(context)
  }

  @ReactMethod
  fun setRotationIntervalSec(sec: Double) {
    val context = reactApplicationContext.applicationContext
    WidgetRotationState.setRotationIntervalSec(context, sec.toInt())
    WidgetAlarmScheduler.schedule(context)
    val manager = AppWidgetManager.getInstance(context)
    val component = ComponentName(context, AskBibleDailyVerseWidgetProvider::class.java)
    val ids = manager.getAppWidgetIds(component)
    if (ids.isNotEmpty()) {
      AskBibleDailyVerseWidgetProvider.updateWidgets(context, manager, ids)
    }
  }

  companion object {
    const val PREFS_NAME = "askbible_widget"
    const val SNAPSHOT_KEY = "askbible-daily-verse-widget-v1"
    const val TEXT_SCALE_KEY = "askbible-daily-verse-widget-text-scale-v1"
    const val ROTATION_INTERVAL_SEC_KEY = "askbible-widget-rotation-interval-sec"
  }
}
