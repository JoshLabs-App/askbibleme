package me.askbible.native_.data

/**
 * 首页环境音（白噪音 / 雨 / 篝火…）。对应 RN 的 ambientSceneSlots.ts + ambientScenePlaybackGain.ts
 * + ambientSceneAudioSource.ts，与 iOS 的 AmbientScenes 对等：不进安装包，R2 点播 + 首次播放缓存到本机。
 */
data class AmbientSlot(
    val id: String,
    val label: String,
    val labelEn: String,
    val file: String,
    /** 源文件响度差很大（-12 ~ -55 LUFS），按 RN 那份增益表压平 */
    val gain: Float,
)

object AmbientScenes {
    const val R2_PUBLIC_BASE = "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev"
    /** 首页照片是「晨光」→ 默认白噪音（NATURE_SCENE_DEFAULT_AMBIENT） */
    const val DEFAULT_SLOT_ID = "scene-white-noise"

    /** 与 RN NATURE_AMBIENT_SCENE_SLOTS 同序 */
    val slots: List<AmbientSlot> = listOf(
        AmbientSlot("scene-water", "水", "Water", "scene-water-lake-120.mp3", 0.8f),
        AmbientSlot("scene-rain", "雨", "Rain", "scene-rain-drops-roof-ofs.mp3", 0.8f),
        AmbientSlot("scene-birds", "鸟", "Birds", "scene-birds-forest-810419.mp3", 0.8f),
        AmbientSlot("scene-white-noise", "白噪音", "White Noise", "scene-white-noise-41.mp3", 0.8f),
        AmbientSlot("scene-wind", "风", "Wind", "scene-wind-hum-1177.mp3", 0.088f),
        AmbientSlot("scene-fire", "火", "Fire", "scene-campfire-forest-452486.mp3", 0.056f),
        AmbientSlot("scene-waves", "海浪", "Waves", "scene-waves-ocean.mp3", 0.16f),
        AmbientSlot("scene-thunder", "雷", "Thunder", "scene-thunderstorm-28.mp3", 0.168f),
        AmbientSlot("scene-cafe", "咖啡厅", "Cafe", "scene-cafe-120.mp3", 0.52f),
    )

    fun slot(id: String): AmbientSlot? = slots.firstOrNull { it.id == id }

    fun remoteUrl(id: String): String? = slot(id)?.let { "$R2_PUBLIC_BASE/audio/scenes/${it.file}" }
}
