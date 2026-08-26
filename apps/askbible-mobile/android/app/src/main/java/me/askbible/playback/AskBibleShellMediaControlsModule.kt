package me.askbible.playback

import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import me.askbible.widget.WidgetPlaybackBridge

class AskBibleShellMediaControlsModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AskBibleShellMediaControls"

  @ReactMethod
  fun updateSession(json: String) {
    val app = reactApplicationContext.applicationContext
    ShellPlaybackSession.updateFromJson(json)
    if (ShellPlaybackSession.playing) {
      ShellCallAudioMonitor.clearStaleInterruptIfIdle(app)
    }
    ShellPlaybackService.startOrRefresh(app)
  }

  @ReactMethod
  fun clearSession() {
    ShellPlaybackService.stop(reactApplicationContext.applicationContext)
  }

  @ReactMethod
  fun pauseAppMusic() {
    val app = reactApplicationContext.applicationContext
    Handler(Looper.getMainLooper()).post { ShellPlaybackService.pauseFromJs(app) }
  }

  @ReactMethod
  fun resumeAppMusic() {
    val app = reactApplicationContext.applicationContext
    Handler(Looper.getMainLooper()).post { ShellPlaybackService.resumeFromJs(app) }
  }

  @ReactMethod
  fun seekTo(positionSec: Double) {
    Handler(Looper.getMainLooper()).post { ShellMainNativePlayer.seekTo(positionSec) }
  }

  @ReactMethod
  fun setPlaybackRate(rate: Double) {
    Handler(Looper.getMainLooper()).post {
      ShellMainNativePlayer.setRate(rate.toFloat())
    }
  }

  @ReactMethod
  fun setMusicVolume(volume: Double) {
    Handler(Looper.getMainLooper()).post {
      ShellMainNativePlayer.setMusicVolume(volume.toFloat())
    }
  }

  @ReactMethod
  fun setSleepTimerDeadlineMs(deadlineMs: Double) {
    val ms = deadlineMs.toLong()
    if (ms <= 0L) {
      ShellSleepTimer.cancel()
      return
    }
    ShellSleepTimer.arm(ms, reactApplicationContext)
  }

  @ReactMethod
  fun addListener(eventName: String) {
    /* NativeEventEmitter */
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    /* NativeEventEmitter */
  }

  companion object {
    @Volatile private var moduleInstance: AskBibleShellMediaControlsModule? = null

    fun bind(module: AskBibleShellMediaControlsModule) {
      moduleInstance = module
    }

    fun unbind(module: AskBibleShellMediaControlsModule) {
      if (moduleInstance === module) moduleInstance = null
    }

    fun emitRemote(event: String, payload: Any? = null) {
      tryEmitRemote(event, payload)
    }

    fun tryEmitRemote(event: String, payload: Any? = null): Boolean {
      val module = moduleInstance ?: return false
      if (!module.reactContext.hasActiveReactInstance()) return false
      module.reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(event, payload)
      return true
    }

    fun minimizeAppToBackground() {
      try {
        moduleInstance?.reactContext?.currentActivity?.moveTaskToBack(true)
      } catch (_: Exception) {
        /* ignore */
      }
    }
  }

  override fun initialize() {
    super.initialize()
    bind(this)
    ShellCallAudioMonitor.start(reactApplicationContext.applicationContext)
    reactContext.addLifecycleEventListener(
      object : LifecycleEventListener {
        override fun onHostResume() {
          WidgetPlaybackBridge.onMainActivityReady(reactApplicationContext.applicationContext)
        }

        override fun onHostPause() {}

        override fun onHostDestroy() {
          unbind(this@AskBibleShellMediaControlsModule)
        }
      },
    )
  }

  override fun invalidate() {
    unbind(this)
    ShellCallAudioMonitor.stop(reactApplicationContext.applicationContext)
    super.invalidate()
  }
}
