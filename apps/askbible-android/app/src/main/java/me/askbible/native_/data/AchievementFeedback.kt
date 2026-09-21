package me.askbible.native_.data

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import me.askbible.native_.R

/**
 * 成就的「听觉 + 触觉」反馈。与 iOS `AchievementFeedback.swift` 对等双写。
 *
 * 三个音效是本机合成的钟声（非谐波分音 + 指数衰减），不是游戏的电子 ding ——
 * 和羊皮卷 / 修道院的语气对齐。生成脚本见 `tools/gen-achievement-sfx.py`。
 *
 * 三个要点：
 * 1. **不打断正在播的经文 / 音乐**：SoundPool 走 `USAGE_ASSISTANCE_SONIFICATION`
 *    （界面音效），系统不会因此要求音乐让出焦点。
 * 2. **跟随媒体音量**：用 `CONTENT_TYPE_SONIFICATION`，静音 / 免打扰下自然不响。
 * 3. **可以关**：成就墙里一个开关，默认开。
 */
object AchievementFeedback {
    enum class Cue {
        XP,
        /**
         * 读完一章：木与钟之间的一记小钵。GPT 2026-09-20：
         * 「我读完这一章了」比「我获得了 200 XP」重要得多，这该是全 App 最完整的一次反馈。
         */
        CHAPTER,
        EARN,
        LEVEL_UP,
    }

    const val SOUND_ENABLED_KEY = "askbible-achievement-sound-v1"

    private const val PREFS = "askbible"
    private var pool: SoundPool? = null
    private val ids = HashMap<Cue, Int>()
    /** 两次 +XP 之间的最小间隔：真机上连读会密集触发，太密就成噪音了 */
    private var lastXpAt = 0L

    fun soundEnabled(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(SOUND_ENABLED_KEY, true)

    fun setSoundEnabled(context: Context, on: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(SOUND_ENABLED_KEY, on).apply()
    }

    /**
     * +XP 的反馈分两档（2026-09-20）：**声音标记里程碑，触感标记增量。**
     * 小额 XP（读几节、听一小段）几十秒就来一次，连着几十分钟都在响，再轻也累；
     * 但完全没反馈又会觉得「读了没记上」。所以小额只给一记轻触感、不出声，
     * 只有整章读完这种大额才出声。
     */
    fun playXp(context: Context, milestone: Boolean) {
        // 里程碑用小钵而不是木叩：木叩配不上「读完一章」这件事
        if (milestone) play(context, Cue.CHAPTER) else play(context, Cue.XP, silent = true)
    }

    fun play(context: Context, cue: Cue) = play(context, cue, silent = false)

    private fun play(context: Context, cue: Cue, silent: Boolean) {
        haptic(context, cue)
        if (silent || !soundEnabled(context)) return
        if (cue == Cue.XP) {
            val now = System.currentTimeMillis()
            if (now - lastXpAt < 280) return
            lastXpAt = now
        }
        val p = ensurePool(context)
        val id = ids[cue] ?: return
        // GPT 2026-09-20 建议木叩从 0.45 压到 0.30–0.35，免得久了变成「游戏奖励音」
        val volume = when (cue) {
            Cue.XP -> 0.34f
            Cue.CHAPTER -> 0.72f
            else -> 0.85f
        }
        p.play(id, volume, volume, 1, 0, 1f)
    }

    private fun ensurePool(context: Context): SoundPool {
        pool?.let { return it }
        val p = SoundPool.Builder()
            .setMaxStreams(3)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            .build()
        val app = context.applicationContext
        ids[Cue.XP] = p.load(app, R.raw.sfx_xp, 1)
        ids[Cue.CHAPTER] = p.load(app, R.raw.sfx_chapter, 1)
        ids[Cue.EARN] = p.load(app, R.raw.sfx_earn, 1)
        ids[Cue.LEVEL_UP] = p.load(app, R.raw.sfx_levelup, 1)
        pool = p
        return p
    }

    private fun vibrator(context: Context): Vibrator? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }

    private fun haptic(context: Context, cue: Cue) {
        val v = vibrator(context)?.takeIf { it.hasVibrator() } ?: return
        val effect = when (cue) {
            // +XP 只给很轻的一下，它来得太频繁
            Cue.XP -> VibrationEffect.createOneShot(12, 60)
            // 「一次明确但轻柔的 impact」
            Cue.CHAPTER -> VibrationEffect.createOneShot(22, 190)
            Cue.EARN -> VibrationEffect.createOneShot(28, VibrationEffect.DEFAULT_AMPLITUDE)
            // 升级：重—轻—重，做出「咚·哒·咚」的分量
            Cue.LEVEL_UP -> VibrationEffect.createWaveform(
                longArrayOf(0, 34, 70, 18, 60, 40), intArrayOf(0, 255, 0, 140, 0, 255), -1
            )
        }
        runCatching { v.vibrate(effect) }
    }
}
