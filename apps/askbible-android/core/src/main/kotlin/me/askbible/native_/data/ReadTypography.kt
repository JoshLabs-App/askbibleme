package me.askbible.native_.data

/**
 * 读经排版档位。与 iOS 的 `ReadTypography.swift` 对等双写，
 * 真源是 RN 的 `read-bible-typography-prefs.ts` 的 PX 表。共 15 档。
 */
data class ReadTypographyMetrics(
    val verseFontSize: Float,
    val verseLineHeight: Float,
    val verseNumFontSize: Float,
    val chapterTitleSize: Float,
    val catalogBookSize: Float,
    val catalogBookLine: Float,
)

enum class ReadSize(val raw: String, val metrics: ReadTypographyMetrics) {
    XS("xs", ReadTypographyMetrics(15f, 26f, 14f, 21f, 16f, 22f)),
    S("s", ReadTypographyMetrics(17f, 29f, 15f, 23f, 18f, 24f)),
    M("m", ReadTypographyMetrics(19f, 33f, 16f, 26f, 20f, 26f)),
    L("l", ReadTypographyMetrics(21f, 36f, 17f, 28f, 21f, 27f)),
    XL("xl", ReadTypographyMetrics(24f, 41f, 18f, 31f, 22f, 29f)),
    XXL("xxl", ReadTypographyMetrics(27f, 46f, 19f, 34f, 23f, 30f)),
    XXXL("xxxl", ReadTypographyMetrics(30f, 51f, 20f, 37f, 24f, 32f)),
    XXXXL("xxxxl", ReadTypographyMetrics(34f, 58f, 21f, 41f, 25f, 33f)),
    XXXXXL("xxxxxl", ReadTypographyMetrics(37f, 63f, 22f, 44f, 26f, 34f)),
    XXXXXXL("xxxxxxl", ReadTypographyMetrics(42f, 71f, 23f, 49f, 27f, 35f)),
    XXXXXXXL("xxxxxxxl", ReadTypographyMetrics(46f, 78f, 24f, 53f, 28f, 37f)),
    XXXXXXXXL("xxxxxxxxl", ReadTypographyMetrics(52f, 88f, 26f, 58f, 29f, 38f)),
    XXXXXXXXXL("xxxxxxxxxl", ReadTypographyMetrics(58f, 98f, 28f, 64f, 30f, 40f)),
    XXXXXXXXXXL("xxxxxxxxxxl", ReadTypographyMetrics(64f, 108f, 30f, 70f, 31f, 41f)),
    XXXXXXXXXXXL("xxxxxxxxxxxl", ReadTypographyMetrics(72f, 120f, 32f, 78f, 32f, 42f)),
    ;

    val next: ReadSize? get() = ALL.getOrNull(ordinal + 1)
    val previous: ReadSize? get() = ALL.getOrNull(ordinal - 1)

    companion object {
        private val ALL = values()

        /** 默认档，与 RN 版一致 */
        val DEFAULT = M
    }
}

/**
 * 首页金句排版。搬自 verseTextStyle.ts 的 verseTypography()：
 * body 24×scale / 行高 ×1.55，ref 18×scale / 行高 ×1.45，两者都是 700。
 */
object HomeVerseTypography {
    fun bodySize(scale: Float = 1f): Float = Math.round(24 * scale).toFloat()
    fun bodyLineHeight(scale: Float = 1f): Float = Math.round(bodySize(scale) * 1.55f).toFloat()
    fun refSize(scale: Float = 1f): Float = Math.round(18 * scale).toFloat()
    fun refLineHeight(scale: Float = 1f): Float = Math.round(refSize(scale) * 1.45f).toFloat()
    fun refTopGap(scale: Float = 1f): Float = Math.round(12 * scale).toFloat()
}

/**
 * 壳层几何。搬自 shellTabBarStyles.ts / shellPlaybackTransportLayout.ts / readTopChrome.ts。
 * 这几个数字决定各页切换时控件不跳位，禁止单边改。
 */
object ShellMetrics {
    // 底栏
    const val tabRowMaxWidth = 400f
    const val tabRowPaddingH = 12f
    const val tabRowHeight = 60f
    const val tabButtonHeight = 52f
    const val tabIconSize = 36f
    const val fabSize = 60f
    const val fabIconSize = 30f
    const val fabMarginH = 8f
    const val tabBarDockGap = 6f
    const val tabBarMinBottomInset = 8f

    // 读经顶部竖排
    const val topChromeOffset = 6f
    const val topChromeButton = 50f
    const val topChromeIcon = 32f
    const val topChromeSizeLabel = 32f
    const val topChromeGap = 5f
    const val topChromeSideInset = 8f

    // 播放坞
    const val dockPaddingTop = 4f
    const val dockPaddingH = 20f
    const val dockMarginBottom = 2f
    const val scrubberRowHeight = 23f
    const val scrubberTimeGap = 8f
    const val timeFontSize = 12f
    const val timeLabelMinWidth = 36f
    const val transportMainGap = 28f
    const val loopButtonSize = 44f
    const val transportButtonSize = 48f
    const val playButtonSize = 64f
    const val skipIconSize = 36f
    const val playIconSize = 34f
    const val loopIconSize = 24f
    const val speedButtonSize = 56f
    /** RN 是 3；Josh 2026-09-09 看真机「播放三角偏了」：字形本身框中心已偏右约 2dp，再挪 3 就明显偏，改成 0 */
    const val playIconNudge = 0f

    /** 坞内容高度（SHELL_SCRIPTURE_DOCK_CONTENT_HEIGHT） */
    const val dockContentHeight =
        dockPaddingTop + scrubberRowHeight + dockMarginBottom + 2f + playButtonSize + dockMarginBottom

    /** 右上竖排第 index 个按钮的顶边（index 0 = 设置） */
    fun topChromeTop(safeTop: Float, index: Int): Float =
        safeTop + topChromeOffset + index * (topChromeButton + topChromeGap)

    /** 播放坞离屏幕底的距离 */
    fun dockBottomPad(safeBottom: Float): Float =
        dockMarginBottom + tabBarDockGap + tabRowHeight + maxOf(safeBottom, tabBarMinBottomInset)
}
