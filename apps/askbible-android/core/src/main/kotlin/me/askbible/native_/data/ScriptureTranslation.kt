package me.askbible.native_.data

/** 译本交付方式：内置 sqlite / 按需下载整本 sqlite（R2）/ 在线逐章抓 bible.com 公开页（RN delivery：bundled / local-download / chapter-api） */
enum class TranslationDelivery { BUNDLED, DOWNLOAD, ONLINE }

/**
 * 译本目录一条。清单由 tools/gen-translation-catalog.mts 从 RN 生产目录（OFFLINE_BUNDLED_INDEX）生成，
 * 与 iOS 的 ScriptureTranslation.swift 对等；`check:translation-catalog` 保证两端表不过期。
 */
data class ScriptureTranslation(
    val id: String,
    val labelZh: String,
    val labelEn: String,
    /** 译本语言（RN BibleTranslationMeta.language：zh-Hans / zh-Hant / en），读经展示语言跟它走 */
    val language: String,
    val delivery: TranslationDelivery,
    /** local / youversion */
    val provider: String,
    /** YouVersion 版本号（在线译本抓页用） */
    val remoteId: String,
    /** bible.com 页面语言前缀（zh-CN / zh-TW），空 = 不带 */
    val pageLocale: String,
    /** bible.com 页面缩写（CCB / NIV…），空 = 不带 */
    val abbreviation: String,
    /** 下载型译本的整本 sqlite 地址（R2） */
    val downloadUrl: String,
    /** 有整章朗读（RN translationSupportsChapterAudio：和合本两版 / WEBP / KJV） */
    val hasChapterAudio: Boolean,
    val shortZh: String,
    val shortZhTw: String,
    val shortEn: String,
) {
    val isZh: Boolean get() = language.lowercase().startsWith("zh")
    /** 正文在本机（内置或已下载）才能搜索 / 取对照预览 */
    val isLocalText: Boolean get() = delivery != TranslationDelivery.ONLINE

    /** RN translationOptionLabel：英文界面用英文名，中文界面用中文名（繁体面转繁） */
    fun label(locale: AppLocale): String = if (locale == AppLocale.EN) labelEn else locale.zh(labelZh)
    /** RN shortLabel */
    fun shortLabel(locale: AppLocale): String = when (locale) { AppLocale.EN -> shortEn; AppLocale.ZH_TW -> shortZhTw; AppLocale.ZH_CN -> shortZh }

    companion object {
        /** 全目录（RN 生产环境拿得到正文的那些） */
        val all: List<ScriptureTranslation> get() = TranslationCatalog.entries
        /** 随安装包内置的（BUNDLED_SCRIPTURE_TRANSLATION_IDS 的顺序） */
        val bundled: List<ScriptureTranslation> get() = all.filter { it.delivery == TranslationDelivery.BUNDLED }
        /** DEFAULT_SCRIPTURE_TRANSLATION_ID */
        val DEFAULT: ScriptureTranslation get() = find("cuv-simp") ?: all[0]

        fun find(id: String): ScriptureTranslation? = all.firstOrNull { it.id == id }

        /** 选择器顺序（RN sortPickerTranslations，按界面语言） */
        fun pickerOrder(locale: AppLocale): List<ScriptureTranslation> =
            (TranslationCatalog.pickerOrder[locale.tag] ?: TranslationCatalog.pickerOrder["en"] ?: emptyList()).mapNotNull { find(it) }

        /** RN languageDisplayName：简中 / 繁中 / 英文（英文界面 Simp. Chinese / Trad. Chinese / English） */
        fun languageName(language: String, locale: AppLocale): String {
            val lang = language.trim().lowercase()
            if (locale == AppLocale.EN) {
                return when {
                    lang.startsWith("zh-hant") -> "Trad. Chinese"
                    lang.startsWith("zh") -> "Simp. Chinese"
                    lang.startsWith("en") -> "English"
                    else -> lang.ifEmpty { "Other" }
                }
            }
            return when {
                lang.startsWith("zh-hant") -> locale.zh("繁中")
                lang.startsWith("zh") -> locale.zh("简中")
                lang.startsWith("en") -> SiteCopy.t("native.langEnglish", locale)
                else -> SiteCopy.t("admin.mediaLibrary.kindOther", locale)
            }
        }
    }
}

/** 首页金句 */
data class GoldenVerse(val text: String, val reference: String) {
    companion object {
        val SAMPLE = GoldenVerse("凡自高的，必降为卑；自卑的，必升为高。", "马太福音 23:12")
    }
}
