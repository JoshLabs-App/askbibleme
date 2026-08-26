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

    val kicker = findViewById<TextView>(R.id.alarm_kicker)
    val title = findViewById<TextView>(R.id.alarm_title)
    val subtitle = findViewById<TextView>(R.id.alarm_subtitle)
    val countdown = findViewById<TextView>(R.id.alarm_countdown)
    val verse = ReadingAlarmDailyVerse.load(this)
    if (verse != null) {
      kicker.text = getString(R.string.reading_alarm_verse_kicker)
      title.text = verse.text
      subtitle.text = verse.ref
      countdown.visibility = View.VISIBLE
      countdown.text = getString(R.string.reading_alarm_music_only_hint)
    } else {
      title.text = getString(R.string.reading_alarm_notification_title)
      subtitle.text = getString(R.string.reading_alarm_music_only_hint)
      countdown.visibility = View.GONE
    }
    findViewById<Button>(R.id.alarm_continue_button).visibility = View.GONE

    findViewById<Button>(R.id.alarm_stop_button).setOnClickListener {
      dismissAlarm()
    }

    if (!ReadingAlarmPreludePlayer.isPlaying()) {
      ReadingAlarmPreludePlayer.start(this)
    }
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    dismissAlarm()
  }

  private fun dismissAlarm() {
    if (dismissed || isFinishing) return
    dismissed = true
    ReadingAlarmAutoContinue.cancelSchedule()
    ReadingAlarmPrefs.markDismissed(this)
    ReadingAlarmPrefs.setPreludeActive(this, false)
    ReadingAlarmPreludeService.stop(this)
    ReadingAlarmPreludePlayer.stop()
    ReadingAlarmSound.stop(this)
    AskBibleReadingAlarmModule.emitDismissed(applicationContext)
    finish()
  }

  override fun onDestroy() {
    ReadingAlarmSound.unregisterStopHandler(stopSoundHandler)
    // 不要在这里停播放。三星上此页被主界面盖住时会走 onDestroy，会把已经在响的音乐误杀掉。
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
