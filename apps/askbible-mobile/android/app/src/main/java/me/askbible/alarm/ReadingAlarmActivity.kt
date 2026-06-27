package me.askbible.alarm

import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import me.askbible.R

/** 音乐模式锁屏闹钟：只播放预备音乐，直到用户停止。 */
class ReadingAlarmActivity : AppCompatActivity() {
  private val stopSoundHandler = { ReadingAlarmPreludePlayer.stop() }
  private var dismissed = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setupWindowFlags()
    setContentView(R.layout.activity_reading_alarm)
    ReadingAlarmSound.registerStopHandler(stopSoundHandler)

    val label = ReadingAlarmPrefs.label(this).ifBlank { getString(R.string.reading_alarm_notification_body) }
    findViewById<TextView>(R.id.alarm_title).text = label
    findViewById<TextView>(R.id.alarm_subtitle).text = getString(R.string.reading_alarm_music_only_hint)
    findViewById<TextView>(R.id.alarm_countdown).visibility = View.GONE
    findViewById<Button>(R.id.alarm_continue_button).visibility = View.GONE

    findViewById<Button>(R.id.alarm_stop_button).setOnClickListener {
      dismissAlarm()
    }

    if (!ReadingAlarmPreludePlayer.isPlaying()) {
      ReadingAlarmPreludePlayer.start(this)
    }
  }

  private fun dismissAlarm() {
    if (dismissed || isFinishing) return
    dismissed = true
    ReadingAlarmAutoContinue.cancelSchedule()
    ReadingAlarmPrefs.markDismissed(this)
    ReadingAlarmPrefs.setPreludeActive(this, false)
    ReadingAlarmPreludeService.stop(this)
    ReadingAlarmSound.stop(this)
    AskBibleReadingAlarmModule.emitDismissed(applicationContext)
    finish()
  }

  override fun onDestroy() {
    ReadingAlarmSound.unregisterStopHandler(stopSoundHandler)
    if (!dismissed) {
      ReadingAlarmPreludePlayer.stop()
    }
    super.onDestroy()
  }

  private fun setupWindowFlags() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      val keyguard = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
      keyguard.requestDismissKeyguard(this, null)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }
}
