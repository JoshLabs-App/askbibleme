package me.askbible.native_.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.AudioPlaybackConfiguration
import android.os.Build
import android.os.Handler
import android.os.Looper
import java.util.concurrent.Executor

/**
 * 外部音频打断监听（RN ShellCallAudioMonitor + scriptureResumeAfterInterruption 的原生版）。
 *
 * ExoPlayer 自己只处理「临时」失焦（来电 / 闹钟：LOSS_TRANSIENT，结束后系统发 GAIN 就续播）。
 * 「永久」失焦（AUDIOFOCUS_LOSS：别的 App / 系统音以独占方式申请焦点）之后 Android 永远不会再发 GAIN，
 * 播放器就停在暂停态 —— Josh 三星 2026-09-10「读经播放被手机其它系统音打断了就不续播」。
 *
 * 这里盯 AudioManager 的通话模式与活动播放配置：外部声音（铃声 / 通话 / 通知 / 闹钟 / 助手 / 别的 App 的媒体）都停了，
 * 且自家还「想播」（wantsPlayback）的播放器被永久失焦停掉了，就把它叫回来（重新申请焦点）。回到前台时也补一次。
 * 自家不抢焦点的播放器（环境音 / 金句，handleAudioFocus=false）用 contentType 标记（MOVIE / SPEECH+FLAG_LOW_LATENCY），不算外部声音。
 */
object AudioInterruptionMonitor {
    /** 通话态（铃声 / 通话中）：RN getShellAudioInterrupted */
    @Volatile var callLike = false; private set
    /** 有外部声音在响（含通话态） */
    @Volatile var foreignAudioActive = false; private set

    private val recoverers = ArrayList<() -> Unit>()
    private val handler = Handler(Looper.getMainLooper())
    private var am: AudioManager? = null
    private var started = false
    private val debounced = Runnable { evaluate(fromChange = true) }

    /** 永久失焦后想续播的播放器登记回调；外部声音一停就会被调用 */
    fun addRecoverer(r: () -> Unit) { recoverers += r }

    fun start(context: Context) {
        if (started) return
        val audio = context.applicationContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
        am = audio; started = true
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audio.registerAudioPlaybackCallback(object : AudioManager.AudioPlaybackCallback() {
                override fun onPlaybackConfigChanged(configs: MutableList<AudioPlaybackConfiguration>) { schedule() }
            }, handler)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            audio.addOnModeChangedListener(Executor { handler.post(it) }, AudioManager.OnModeChangedListener { schedule() })
        }
        evaluate(fromChange = false)
    }

    /** 回到前台：RN recoverScripturePlaybackAfterBackground */
    fun onForeground() { evaluate(fromChange = true) }

    private fun schedule() {
        handler.removeCallbacks(debounced)
        // 通知音 / 系统提示音很短，等它真的停了再叫播放器回来
        handler.postDelayed(debounced, 700)
    }

    private fun evaluate(fromChange: Boolean) {
        val audio = am ?: return
        val configs: List<AudioPlaybackConfiguration> = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try { audio.activePlaybackConfigurations } catch (_: Exception) { emptyList() }
        } else emptyList()
        val mode = audio.mode
        val call = mode == AudioManager.MODE_RINGTONE || mode == AudioManager.MODE_IN_CALL ||
            configs.any { isCallUsage(it.audioAttributes.usage) }
        val foreign = call || configs.any { !isOwnNonFocusPlayer(it.audioAttributes) }
        callLike = call
        foreignAudioActive = foreign
        if (fromChange && !foreign) for (r in recoverers) r()
    }

    private fun isCallUsage(usage: Int) =
        usage == AudioAttributes.USAGE_NOTIFICATION_RINGTONE || usage == AudioAttributes.USAGE_VOICE_COMMUNICATION

    /** 自家环境音（MOVIE）/ 金句（SPEECH + LOW_LATENCY 标记）不算外部声音；朗读 / 音乐失焦时本来就停了，不会出现在活动列表里 */
    private fun isOwnNonFocusPlayer(a: AudioAttributes): Boolean {
        if (a.usage != AudioAttributes.USAGE_MEDIA) return false
        if (a.contentType == AudioAttributes.CONTENT_TYPE_MOVIE) return true
        return a.contentType == AudioAttributes.CONTENT_TYPE_SPEECH && (a.flags and AudioAttributes.FLAG_LOW_LATENCY) != 0
    }
}
