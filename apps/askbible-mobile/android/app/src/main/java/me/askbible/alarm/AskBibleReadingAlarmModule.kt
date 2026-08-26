package me.askbible.alarm

import android.content.Intent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray
import org.json.JSONObject

class AskBibleReadingAlarmModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AskBibleReadingAlarm"

  @ReactMethod
  fun syncSchedule(json: String) {
    val context = reactApplicationContext.applicationContext
    try {
      val payload = JSONObject(json)
      val enabled = payload.optBoolean("enabled", false)
      val hour = payload.optInt("hour", 8)
      val minute = payload.optInt("minute", 0)
      val weekdays = parseWeekdays(payload.optJSONArray("weekdays"))
      val label = payload.optString("label", "")
      val bookId = payload.optString("bookId", "")
      val chapter = payload.optInt("chapter", 1)
      val bookName = payload.optString("bookName", "")
      val translationId = payload.optString("translationId", "cuv-simp")
      val mode = payload.optString("mode", ReadingAlarmPrefs.MODE_SCRIPTURE)
      val verseText = payload.optString("verseText", "")
      val verseRef = payload.optString("verseRef", "")

      ReadingAlarmPrefs.setSchedule(
        context,
        enabled,
        hour,
        minute,
        weekdays,
        label,
        bookId,
        chapter,
        bookName,
        translationId,
        mode,
        verseText,
        verseRef,
      )

      if (enabled) {
        ReadingAlarmScheduler.scheduleNext(context)
      } else {
        ReadingAlarmScheduler.cancel(context)
        stopPreludeSession(markDismissed = true)
      }
    } catch (_: Exception) {
      /* 保留已有闹钟；不要 cancel */
    }
  }

  @ReactMethod
  fun fireReadingReminderNow() {
    ReadingAlarmReceiver.fireReadingAlarm(reactApplicationContext.applicationContext)
  }

  @ReactMethod
  fun consumeTrigger(promise: Promise) {
    val pending = ReadingAlarmPrefs.consumePendingAutoPlay(reactApplicationContext.applicationContext)
    promise.resolve(pending)
  }

  @ReactMethod
  fun peekTrigger(promise: Promise) {
    promise.resolve(ReadingAlarmPrefs.peekPendingAutoPlay(reactApplicationContext.applicationContext))
  }

  @ReactMethod
  fun isPreludeActive(promise: Promise) {
    promise.resolve(ReadingAlarmPrefs.isPreludeActive(reactApplicationContext.applicationContext))
  }

  @ReactMethod
  fun getScheduledChapterTarget(promise: Promise) {
    val ctx = reactApplicationContext.applicationContext
    val bookId = ReadingAlarmPrefs.bookId(ctx).trim()
    if (bookId.isEmpty()) {
      promise.resolve(null)
      return
    }
    promise.resolve(
      Arguments.createMap().apply {
        putString("bookId", bookId)
        putInt("chapter", ReadingAlarmPrefs.chapter(ctx))
        putString("bookName", ReadingAlarmPrefs.bookName(ctx))
        putString("translationId", ReadingAlarmPrefs.translationId(ctx))
        putString("label", ReadingAlarmPrefs.label(ctx))
      },
    )
  }

  @ReactMethod
  fun stopNativeAlertSound() {
    stopPreludeSession(markDismissed = false)
  }

  @ReactMethod
  fun startPrelude() {
    val context = reactApplicationContext.applicationContext
    ReadingAlarmPrefs.clearSessionForNewAlarm(context)
    ReadingAlarmAutoContinue.resetSession(context)
    ReadingAlarmPreludeService.start(context)
  }

  @ReactMethod
  fun dismissAlarm() {
    stopPreludeSession(markDismissed = true)
    emitDismissed(reactApplicationContext.applicationContext)
  }

  @ReactMethod
  fun getCapabilities(promise: Promise) {
    val context = reactApplicationContext.applicationContext
    val result =
      Arguments.createMap().apply {
        putBoolean("canScheduleExactAlarms", ReadingAlarmCapabilities.canScheduleExactAlarms(context))
        putBoolean("notificationsGranted", ReadingAlarmCapabilities.notificationsGranted(context))
        putBoolean(
          "ignoringBatteryOptimizations",
          ReadingAlarmCapabilities.isIgnoringBatteryOptimizations(context),
        )
      }
    promise.resolve(result)
  }

  @ReactMethod
  fun openExactAlarmSettings() {
    ReadingAlarmCapabilities.openExactAlarmSettings(reactApplicationContext.applicationContext)
  }

  @ReactMethod
  fun openBatteryOptimizationSettings() {
    ReadingAlarmCapabilities.openBatteryOptimizationSettings(reactApplicationContext.applicationContext)
  }

  @ReactMethod
  fun addListener(eventName: String) {
    /* RN EventEmitter */
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    /* RN EventEmitter */
  }

  private fun stopPreludeSession(markDismissed: Boolean) {
    val context = reactApplicationContext.applicationContext
    ReadingAlarmAutoContinue.cancelSchedule()
    ReadingAlarmPrefs.setPreludeActive(context, false)
    if (markDismissed) {
      ReadingAlarmPrefs.markDismissed(context)
    }
    ReadingAlarmPreludeService.stop(context)
    ReadingAlarmPreludePlayer.stop()
    ReadingAlarmSound.stop(context)
  }

  companion object {
    private const val DISMISS_EVENT = "ReadingAlarmDismissed"
    private const val AUTO_CONTINUE_EVENT = "ReadingAlarmAutoContinue"
    private const val PRELUDE_SESSION_EVENT = "ReadingAlarmPreludeSession"
    @Volatile private var reactContextRef: ReactApplicationContext? = null

    private fun parseWeekdays(raw: JSONArray?): Set<Int> {
      if (raw == null || raw.length() == 0) return setOf(1, 2, 3, 4, 5, 6, 7)
      val parsed = mutableSetOf<Int>()
      for (index in 0 until raw.length()) {
        val value = raw.optInt(index, -1)
        if (value in 1..7) parsed.add(value)
      }
      return parsed.ifEmpty { setOf(1, 2, 3, 4, 5, 6, 7) }
    }

    fun bindContext(context: ReactApplicationContext) {
      reactContextRef = context
    }

    fun emitDismissed(appContext: android.content.Context) {
      val ctx = reactContextRef ?: return
      if (!ctx.hasActiveReactInstance()) return
      ctx
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(DISMISS_EVENT, null)
      androidx.core.app.NotificationManagerCompat.from(appContext).cancel(ReadingAlarmReceiver.NOTIFICATION_ID)
    }

    fun emitAutoContinue(appContext: android.content.Context) {
      if (!ReadingAlarmPrefs.peekPendingAutoPlay(appContext)) return
      val ctx = reactContextRef ?: return
      if (!ctx.hasActiveReactInstance()) return
      ctx
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(AUTO_CONTINUE_EVENT, null)
    }

    fun emitPreludeSession(@Suppress("UNUSED_PARAMETER") appContext: android.content.Context) {
      val ctx = reactContextRef ?: return
      if (!ctx.hasActiveReactInstance()) return
      ctx
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(PRELUDE_SESSION_EVENT, null)
    }
  }

  init {
    bindContext(reactContext)
    reactContext.addLifecycleEventListener(
      object : LifecycleEventListener {
        override fun onHostResume() {
          val app = reactContext.applicationContext
          if (ReadingAlarmPrefs.peekPendingAutoPlay(app)) {
            emitAutoContinue(app)
          } else if (ReadingAlarmPrefs.isPreludeActive(app)) {
            emitPreludeSession(app)
          }
        }

        override fun onHostPause() {}

        override fun onHostDestroy() {}
      },
    )
  }
}
