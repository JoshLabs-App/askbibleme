package me.askbible.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import com.facebook.react.bridge.Promise
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
    if (WidgetRotationState.isFollowFrozen(context)) {
      WidgetAlarmScheduler.cancel(context)
    } else {
      WidgetAlarmScheduler.schedule(context)
    }
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

  @ReactMethod
  fun setReadingAudioSnapshot(json: String) {
    val context = reactApplicationContext.applicationContext
    context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(READING_AUDIO_SNAPSHOT_KEY, json)
      .apply()
    AskBibleDailyVerseWidgetProvider.refreshAll(context)
  }

  /**
   * App 首页当前金句 → 桌面挂件同步。
   * freeze=true：金句朗读中，挂件钉住该句并停墙钟轮换。
   */
  @ReactMethod
  fun setDisplayedVerseFollow(verseKey: String?, freeze: Boolean) {
    val context = reactApplicationContext.applicationContext
    val keys = AskBibleDailyVerseWidgetProvider.verseKeysFromSnapshot(context)
    WidgetRotationState.followAppVerse(context, verseKey, keys, freeze)
    if (freeze) {
      WidgetAlarmScheduler.cancel(context)
    } else {
      WidgetAlarmScheduler.schedule(context)
    }
    AskBibleDailyVerseWidgetProvider.refreshAll(context)
  }

  /** 小挂件冷启动：同步读取 pending（music / reading / verse），无则 null。 */
  @ReactMethod(isBlockingSynchronousMethod = true)
  fun peekWidgetPlaybackActionSync(): String? {
    return WidgetPlaybackBridge.peekPendingAction(reactApplicationContext.applicationContext)
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun peekWidgetPlaybackVerseKeySync(): String? {
    return WidgetPlaybackBridge.peekPendingVerseKey(reactApplicationContext.applicationContext)
  }

  @ReactMethod
  fun peekWidgetPlaybackAction(promise: Promise) {
    promise.resolve(WidgetPlaybackBridge.peekPendingAction(reactApplicationContext.applicationContext))
  }

  @ReactMethod
  fun clearWidgetPlaybackAction() {
    WidgetPlaybackBridge.clearPendingAction(reactApplicationContext.applicationContext)
  }

  @ReactMethod
  fun minimizeAfterWidgetPlayback() {
    WidgetPlaybackBridge.requestMinimizeNow(reactApplicationContext.applicationContext)
  }

  companion object {
    const val PREFS_NAME = "askbible_widget"
    const val SNAPSHOT_KEY = "askbible-daily-verse-widget-v1"
    const val TEXT_SCALE_KEY = "askbible-daily-verse-widget-text-scale-v1"
    const val ROTATION_INTERVAL_SEC_KEY = "askbible-widget-rotation-interval-sec"
    const val READING_AUDIO_SNAPSHOT_KEY = "askbible-reading-audio-widget-v1"
  }
}
