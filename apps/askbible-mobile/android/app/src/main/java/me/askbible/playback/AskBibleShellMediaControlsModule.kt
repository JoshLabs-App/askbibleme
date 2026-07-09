package me.askbible.playback

import android.content.Intent
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
    ShellPlaybackSession.updateFromJson(json)
    ShellPlaybackService.startOrRefresh(reactApplicationContext.applicationContext)
  }

  @ReactMethod
  fun clearSession() {
    ShellPlaybackService.stop(reactApplicationContext.applicationContext)
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

    fun emitRemote(event: String) {
      tryEmitRemote(event)
    }

    fun tryEmitRemote(event: String): Boolean {
      val module = moduleInstance ?: return false
      if (!module.reactContext.hasActiveReactInstance()) return false
      module.reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(event, null)
      return true
    }

    fun minimizeAppToBackground() {
      moduleInstance?.reactContext?.currentActivity?.moveTaskToBack(true)
    }
  }

  override fun initialize() {
    super.initialize()
    bind(this)
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
    super.invalidate()
  }
}
