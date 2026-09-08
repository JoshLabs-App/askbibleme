package me.askbible.playback

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.util.Log

/**
 * 全 App 唯一的系统音频焦点持有者。
 *
 * 为什么必须共享（2026-09-07 实测，别再拆回各播各的）：
 * `AUDIOFOCUS_GAIN` 是**独占**语义——谁后申请，系统就给前一个持有者发 `AUDIOFOCUS_LOSS`。
 * 音乐（ShellMainNativePlayer）和金句（ShellVerseNativePlayer）各自申请一份时，
 * **系统分不清它们同属一个 App**，于是后开的那个把先开的踢掉。logcat 里就是这一行：
 *
 *   I/ShellMainNative: playing kind=music …
 *   I/ShellVerseNative: audio focus lost permanently; pausing
 *
 * 用户看到的是「音乐一响，金句就没声了，但按钮还黄着」——因为原生已暂停、JS 那边不知道。
 *
 * 正确模型：**App 内部谁在播由 App 自己记账，只向系统申请一份焦点**。
 * 首个成员开播时申请，最后一个成员停时归还；中途再有成员加入不重新申请，
 * 因此不会自踢。系统真的把焦点收走（来电、别的 App 抢）时，一次通知所有在册成员。
 *
 * 注意：`ShellSleepTimer.silenceExpoAv()` 故意绕开这里单独抢焦点——它的目的就是让
 * expo-av 闭嘴，「踢掉自己人」正是它要的效果，不要把它并进来。
 */
object ShellAudioFocus {
  private const val TAG = "ShellAudioFocus"

  /** 成员播放器：焦点被外部夺走时由这里统一通知。 */
  interface Member {
    /** permanent=true 表示 AUDIOFOCUS_LOSS（该放弃），false 表示 LOSS_TRANSIENT（只暂停）。 */
    fun onShellAudioFocusLost(permanent: Boolean)
  }

  /** 成员 id → 回调；同 id 重复 acquire 只更新回调，不重复申请焦点。 */
  private val members = LinkedHashMap<String, MemberEntry>()
  private var focusRequest: AudioFocusRequest? = null
  private var holding = false
  private var appContext: Context? = null

  private data class MemberEntry(val member: Member, val speech: Boolean)

  /**
   * 登记成员并确保 App 持有焦点。已持有时直接返回 true——**不重新申请**，
   * 否则又会把自家另一个播放器踢掉（就是本文件开头那个 bug）。
   */
  @Synchronized
  fun acquire(context: Context, id: String, speech: Boolean, member: Member): Boolean {
    appContext = context.applicationContext
    members[id] = MemberEntry(member, speech)
    if (holding) return true
    val granted = requestSystemFocus()
    if (!granted) {
      Log.w(TAG, "system audio focus not granted for $id")
    }
    return granted
  }

  /** 注销成员；没有成员在播了才把焦点还给系统。 */
  @Synchronized
  fun release(id: String) {
    members.remove(id)
    if (members.isEmpty()) abandonSystemFocus()
  }

  /** 供旧代码问一句「现在还拿着吗」。 */
  @Synchronized
  fun isHolding(): Boolean = holding

  private fun requestSystemFocus(): Boolean {
    val context = appContext ?: return false
    val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return false
    /** 全是朗读才标 SPEECH；混了音乐就按 MUSIC。只影响系统的闪避提示，不影响仲裁。 */
    val allSpeech = members.values.all { it.speech }
    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val req =
          AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(
              AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(
                  if (allSpeech) AudioAttributes.CONTENT_TYPE_SPEECH
                  else AudioAttributes.CONTENT_TYPE_MUSIC,
                )
                .build(),
            )
            .setOnAudioFocusChangeListener { change -> onSystemFocusChange(change) }
            .build()
        val res = am.requestAudioFocus(req)
        if (res == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
          focusRequest = req
          holding = true
          true
        } else {
          Log.w(TAG, "requestAudioFocus refused: $res")
          false
        }
      } else {
        @Suppress("DEPRECATION")
        val res =
          am.requestAudioFocus(
            legacyListener,
            AudioManager.STREAM_MUSIC,
            AudioManager.AUDIOFOCUS_GAIN,
          )
        holding = res == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        holding
      }
    } catch (e: Exception) {
      Log.w(TAG, "requestAudioFocus failed", e)
      false
    }
  }

  @Suppress("DEPRECATION")
  private val legacyListener =
    AudioManager.OnAudioFocusChangeListener { change -> onSystemFocusChange(change) }

  private fun abandonSystemFocus() {
    val context = appContext ?: return
    val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        focusRequest?.let { am.abandonAudioFocusRequest(it) }
        focusRequest = null
      } else {
        @Suppress("DEPRECATION")
        am.abandonAudioFocus(legacyListener)
      }
    } catch (_: Exception) {
      /* ignore */
    }
    holding = false
  }

  /**
   * 系统焦点变化。走到这里说明是**外部**原因（来电、别的 App 抢、睡眠定时器），
   * 因为自家成员之间已经不再互相申请了。
   */
  private fun onSystemFocusChange(change: Int) {
    val snapshot: List<Member>
    val permanent: Boolean
    synchronized(this) {
      when (change) {
        AudioManager.AUDIOFOCUS_LOSS -> {
          permanent = true
          snapshot = members.values.map { it.member }
          members.clear()
          abandonSystemFocus()
        }
        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
          permanent = false
          snapshot = members.values.map { it.member }
        }
        else -> return
      }
    }
    Log.i(TAG, "system focus ${if (permanent) "lost" else "lost transiently"}; notifying ${snapshot.size}")
    /** 回调放在锁外：成员的 pause 会转头调 release()，在锁内会死锁。 */
    for (m in snapshot) {
      try {
        m.onShellAudioFocusLost(permanent)
      } catch (_: Exception) {
        /* ignore */
      }
    }
  }
}
