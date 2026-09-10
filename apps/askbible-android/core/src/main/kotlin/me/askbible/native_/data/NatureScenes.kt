package me.askbible.native_.data

/**
 * 首页自然场景。搬自 RN assets/content/nature-settings.json（顺序 = 配置顺序）
 * + nature/ambientSceneSlots.ts（每景默认环境音、英文名）+ natureHomeVerseAppearancePrefs.ts（字号档）。
 * 海报 / 柔焦海报 / 循环视频都随安装包内置（assets/nature/…），文件名就是场景 id。
 */
data class NatureScene(
    val id: String,
    val title: String,
    val titleEn: String,
    /** 用户点选该景时默认打开的环境音；循环自动切景不触发 */
    val defaultAmbient: String?,
)

object NatureScenes {
    val scenes: List<NatureScene> = listOf(
        NatureScene("9cc949f2-3c1d-49c0-8357-2dc1d32bd954", "雪山湖", "Snow Lake", "scene-water"),
        NatureScene("3c8150de-7baa-4334-9c89-4042781ced66", "雨夜城", "Rain City", "scene-rain"),
        NatureScene("7536456b-50fe-42c0-ad70-e78c9710e762", "云海", "Cloud Sea", "scene-wind"),
        NatureScene("d721567f-395f-41d0-b022-7f78a4ef456e", "层峦", "Ridges", "scene-wind"),
        NatureScene("d86754f9-2c16-4896-a00f-31a29858b547", "晨光", "Dawn", "scene-white-noise"),
        NatureScene("3ebc424b-5a1b-48dd-accb-0906186dfda0", "雾林", "Mist Forest", "scene-birds"),
        NatureScene("c6eed3e9-7b57-4fd8-9843-4af6fb321b0c", "雨窗", "Rain Window", "scene-rain"),
        NatureScene("260b958e-f95a-4900-80b5-3ae9e7b2d720", "晨读", "Morning", "scene-white-noise"),
        NatureScene("8132b70e-f9dc-44a3-9cb0-35f43a46ef33", "暮湖", "Dusk Lake", "scene-water"),
    )

    /** nature-settings.json activeVideoId */
    const val DEFAULT_SCENE_ID = "9cc949f2-3c1d-49c0-8357-2dc1d32bd954"

    fun scene(id: String): NatureScene? = scenes.firstOrNull { it.id == id }

    fun posterAsset(id: String) = "nature/posters/$id.jpg"
    fun softPosterAsset(id: String) = "nature/posters-soft/$id.jpg"
    fun videoAssetUri(id: String) = "asset:///nature/videos/$id.mp4"

    /** RN sortNatureScenesByUsage：按点选次数降序，同次数保持配置顺序 */
    fun sortedByUsage(usage: Map<String, Int>): List<NatureScene> =
        scenes.withIndex().sortedWith(compareByDescending<IndexedValue<NatureScene>> { usage[it.value.id] ?: 0 }.thenBy { it.index })
            .map { it.value }

    /** RN NATURE_HOME_TEXT_SCALE_STEPS；默认档 12（= 1.0） */
    val textScaleSteps = listOf(
        0.5f, 0.54f, 0.58f, 0.62f, 0.66f, 0.7f, 0.74f, 0.78f, 0.82f, 0.86f, 0.91f, 0.96f, 1f, 1.05f, 1.1f, 1.15f, 1.22f,
        1.29f, 1.36f, 1.44f, 1.54f, 1.64f, 1.75f, 1.86f, 2f, 2.12f, 2.25f, 2.38f, 2.55f, 2.72f, 2.9f, 3.1f, 3.35f, 3.6f, 3.65f,
        3.7f, 3.75f, 3.82f, 3.89f, 3.96f, 4.04f, 4.14f, 4.24f, 4.35f, 4.46f, 4.6f, 4.72f, 4.85f, 4.98f, 5.15f, 5.32f, 5.5f,
        5.7f, 5.95f, 6.2f,
    )
    const val DEFAULT_TEXT_SCALE_INDEX = 12

    /** RN cycleShellSleepTimerMinutes：0 → 15 → 30 → 60 → 120 → 0 */
    fun cycleSleepTimer(current: Int): Int = when (current) {
        0 -> 15; 15 -> 30; 30 -> 60; 60 -> 120; else -> 0
    }
}
