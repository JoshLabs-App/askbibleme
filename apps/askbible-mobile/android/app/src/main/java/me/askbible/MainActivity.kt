package me.askbible

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.WindowManager

import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.ReactActivity
import me.askbible.widget.WidgetPlaybackBridge
import me.askbible.alarm.AskBibleReadingAlarmModule
import me.askbible.alarm.ReadingAlarmReceiver
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  private companion object {
    const val TAG = "AskBibleMainActivity"
  }

  private val alarmContinueHandler = Handler(Looper.getMainLooper())

  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    Log.i(TAG, "onCreate saved=${savedInstanceState != null}")
    super.onCreate(null)
    applyEdgeToEdgeWindow()
    handleReadingAlarmIntent(intent)
    handleWidgetPlaybackIntent(intent)
  }

  override fun onResume() {
    super.onResume()
    Log.i(TAG, "onResume")
    applyEdgeToEdgeWindow()
    if (intent != null && intent.getBooleanExtra(ReadingAlarmReceiver.EXTRA_AUTO_PLAY, false)) {
      prepareForReadingAlarmHandoff()
    }
  }

  private fun applyEdgeToEdgeWindow() {
    val win = window ?: return
    WindowCompat.setDecorFitsSystemWindows(win, false)
    win.statusBarColor = Color.TRANSPARENT
    win.navigationBarColor = Color.TRANSPARENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      win.isStatusBarContrastEnforced = false
      win.isNavigationBarContrastEnforced = false
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      win.attributes.layoutInDisplayCutoutMode =
        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
    }
    WindowInsetsControllerCompat(win, win.decorView).isAppearanceLightNavigationBars = true
    win.decorView.setBackgroundColor(getColor(R.color.parchment_window_fill))
    win.decorView.post { reapplyEdgeToEdgeWindow(win) }
  }

  private fun reapplyEdgeToEdgeWindow(win: android.view.Window) {
    WindowCompat.setDecorFitsSystemWindows(win, false)
    win.navigationBarColor = Color.TRANSPARENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      win.isNavigationBarContrastEnforced = false
    }
  }

  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    setIntent(intent)
    Log.i(
      TAG,
      "onNewIntent widget=${intent?.getBooleanExtra(WidgetPlaybackBridge.EXTRA_WIDGET_PLAYBACK, false) == true}",
    )
    handleReadingAlarmIntent(intent)
    handleWidgetPlaybackIntent(intent)
  }

  override fun onDestroy() {
    Log.i(TAG, "onDestroy")
    super.onDestroy()
  }

  private fun handleWidgetPlaybackIntent(intent: Intent?) {
    if (intent?.getBooleanExtra(WidgetPlaybackBridge.EXTRA_WIDGET_PLAYBACK, false) != true) {
      return
    }
    WidgetPlaybackBridge.handleActivityIntent(this, intent)
    // 冷启动播完后回桌面：立刻退后台，后续由 bridge 继续重试。
    window?.decorView?.post { moveTaskToBack(true) }
  }

  private fun handleReadingAlarmIntent(intent: Intent?) {
    if (intent == null) return
    if (intent.getBooleanExtra(ReadingAlarmReceiver.EXTRA_AUTO_PLAY, false)) {
      prepareForReadingAlarmHandoff()
      scheduleReadingAlarmJsContinue()
      return
    }
    if (intent.getBooleanExtra(ReadingAlarmReceiver.EXTRA_PRELUDE_SESSION, false)) {
      AskBibleReadingAlarmModule.emitPreludeSession(applicationContext)
    }
  }

  /** 锁屏闹钟交接：保持亮屏并尝试解除锁屏，便于 RN 直接开始读经。 */
  private fun prepareForReadingAlarmHandoff() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      val keyguard = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
      keyguard.requestDismissKeyguard(this, null)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  /** RN Bridge 冷启动时可能尚未就绪：pending 仍在时有限次通知 JS。 */
  private fun scheduleReadingAlarmJsContinue() {
    val delaysMs = longArrayOf(0L, 400L, 1000L, 2000L, 4000L, 7000L, 12_000L, 20_000L)
    delaysMs.forEach { delay ->
      alarmContinueHandler.postDelayed({
        AskBibleReadingAlarmModule.emitAutoContinue(applicationContext)
      }, delay)
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
