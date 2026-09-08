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
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  private companion object {
    const val TAG = "AskBibleMainActivity"
  }


  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    Log.i(TAG, "onCreate saved=${savedInstanceState != null}")
    super.onCreate(null)
    applyEdgeToEdgeWindow()
    handleWidgetPlaybackIntent(intent)
  }

  override fun onResume() {
    super.onResume()
    Log.i(TAG, "onResume")
    applyEdgeToEdgeWindow()
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
