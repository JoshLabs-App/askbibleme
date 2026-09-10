package me.askbible.native_.home

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import me.askbible.native_.data.NatureScenes
import org.json.JSONObject

/**
 * 首页场景相关偏好，对应 RN 的 natureActiveScenePrefs / natureAmbientScenePrefs /
 * natureHomeLiveVideoPrefs / natureHomeVerseAppearancePrefs（字号档）/ natureSceneUsage。
 * 环境音跟 RN 一样不做冷启动恢复：打开 App 不自动出声，点选场景才跟场景默认。
 */
class NatureHomePrefs(context: Context) {
    private val sp = context.getSharedPreferences("nature-home", Context.MODE_PRIVATE)

    var sceneId by mutableStateOf(sp.getString(KEY_SCENE, null)?.takeIf { NatureScenes.scene(it) != null } ?: NatureScenes.DEFAULT_SCENE_ID)
        private set
    /** 默认开：直接播循环视频；点「模糊」切柔焦静帧 */
    var liveVideo by mutableStateOf(sp.getBoolean(KEY_LIVE, true))
        private set
    var textScaleIndex by mutableStateOf(sp.getInt(KEY_SCALE, NatureScenes.DEFAULT_TEXT_SCALE_INDEX).coerceIn(0, NatureScenes.textScaleSteps.lastIndex))
        private set
    var usage by mutableStateOf<Map<String, Int>>(loadUsage())
        private set

    val textScale: Float get() = NatureScenes.textScaleSteps[textScaleIndex]

    fun selectScene(id: String) {
        if (NatureScenes.scene(id) == null) return
        sceneId = id
        sp.edit().putString(KEY_SCENE, id).apply()
    }

    fun bumpUsage(id: String) {
        val next = usage.toMutableMap().apply { put(id, (get(id) ?: 0) + 1) }
        usage = next
        sp.edit().putString(KEY_USAGE, JSONObject(next as Map<*, *>).toString()).apply()
    }

    fun toggleLiveVideo(on: Boolean) {
        liveVideo = on
        sp.edit().putBoolean(KEY_LIVE, on).apply()
    }

    fun bumpTextScale(delta: Int) {
        val next = (textScaleIndex + delta).coerceIn(0, NatureScenes.textScaleSteps.lastIndex)
        if (next == textScaleIndex) return
        textScaleIndex = next
        sp.edit().putInt(KEY_SCALE, next).apply()
    }

    private fun loadUsage(): Map<String, Int> = try {
        val o = JSONObject(sp.getString(KEY_USAGE, null) ?: "{}")
        o.keys().asSequence().associateWith { o.optInt(it, 0) }.filterValues { it > 0 }
    } catch (_: Exception) { emptyMap() }

    private companion object {
        const val KEY_SCENE = "scene-id"
        const val KEY_LIVE = "live-video"
        const val KEY_SCALE = "text-scale-index"
        const val KEY_USAGE = "scene-usage"
    }
}
