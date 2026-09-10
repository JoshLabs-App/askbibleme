package me.askbible.native_.data

/**
 * 界面语言（RN `i18n/config.ts` 的 AppLocale：en / zh-CN / zh-TW）。跟系统语言走，不另设开关：
 * zh-TW / zh-HK / zh-MO / 带 Hant 的 → 繁体；其它 zh → 简体；其它 → 英文（RN DEFAULT_LOCALE = en）。
 * 与 iOS 的 AppLocale.swift 对等。
 */
enum class AppLocale(val tag: String) {
    EN("en"), ZH_CN("zh-CN"), ZH_TW("zh-TW");

    val isZh: Boolean get() = this != EN

    /** RN localeZhText：繁体面把简体文案转繁 */
    fun zh(text: String): String = if (this == ZH_TW) ZhTw.convert(text) else text

    fun pick(t: TriText): String = when (this) { EN -> t.en; ZH_TW -> t.zhTw; ZH_CN -> t.zh }

    /** 设置项上的名字，各用自己的文字（探索页语言设置；原生版新增，RN 只跟系统） */
    val settingLabel: String get() = when (this) { EN -> "English"; ZH_CN -> "简体中文"; ZH_TW -> "繁體中文" }

    companion object {
        /** 当前界面语言（壳在 appLocale 变化时更新；SiteCopy / 目录表的默认取值）。Compose 层仍应显式传 locale 触发重组。 */
        @Volatile var current: AppLocale = ZH_CN

        /** 切语言时联动的主译本（RN pickTranslationIdForLocale：简 → 和合本简体，繁 → 和合本繁體，英 → WEB） */
        fun primaryTranslationId(locale: AppLocale): String = when (locale) { ZH_CN -> "cuv-simp"; ZH_TW -> "cuv-trad"; EN -> "web-en" }

        /** 首页金句朗读译本（RN resolveGoldenVerseAudioTranslationForLocale：中文 → 和合本，英文 → WEB） */
        fun goldenVerseAudioTranslationId(locale: AppLocale): String = if (locale == EN) "web-en" else "cuv-simp"

        /** 简 / 英两份文案按当前语言取一份（繁体面把简体转繁） */
        fun pick(zh: String, en: String, locale: AppLocale = current): String = if (locale == EN) en else locale.zh(zh)

        /** RN mapLanguageTagToAppLocale */
        fun fromLanguageTag(tag: String): AppLocale {
            val t = tag.trim().lowercase()
            if (t.isEmpty()) return EN
            if (t == "en" || t.startsWith("en-")) return EN
            if (t == "zh-tw" || t == "zh-hk" || t == "zh-mo" || t.contains("hant")) return ZH_TW
            if (t.startsWith("zh")) return ZH_CN
            return EN
        }
    }
}

/**
 * 读经展示语言（RN `resolveReadDisplayLocale`）：跟主译本走 —— 英文译本 → 英文面，中文译本 → 中文面
 * （繁简按界面语言），不强制改 App 全局界面语言。译本语言未知时跟界面语言。
 */
object ReadDisplayLocale {
    /**
     * 译本语言既不是中文也不是英文（西语等全量放开进来的那些）：
     * 我们没有这个语种的段落小标题，章标题也不该写成「Génesis 第1章」
     */
    fun isForeign(translationLanguage: String?): Boolean {
        val lang = (translationLanguage ?: "").trim().lowercase()
        return lang.isNotEmpty() && !lang.startsWith("zh") && !lang.startsWith("en")
    }

    fun resolve(appLocale: AppLocale, translationLanguage: String?): AppLocale {
        val lang = (translationLanguage ?: "").trim().lowercase()
        if (lang.startsWith("en")) return AppLocale.EN
        if (lang.startsWith("zh")) return if (appLocale == AppLocale.ZH_TW) AppLocale.ZH_TW else AppLocale.ZH_CN
        return appLocale
    }
}

/** 简→繁（RN `toZhTwText`）：词组替换 → 逐字 → 词组修正（后/里/仆等多义字） */
object ZhTw {
    fun convert(input: String): String {
        var out = input
        for ((from, to) in LocaleTables.zhTwPhrases) out = out.replace(from, to)
        val sb = StringBuilder(out.length)
        for (ch in out) sb.append(LocaleTables.zhTwChars[ch] ?: ch.toString())
        out = sb.toString()
        for ((from, to) in LocaleTables.zhTwFixups) out = out.replace(from, to)
        return out
    }
}

/** 读经页固定文案按展示语言（RN createT(readDisplayLocale) 的那几条 + chapterTitleText / formatNeighborChapterLabel） */
object ReadChrome {
    fun catalogTitle(l: AppLocale) = l.pick(LocaleTables.catalogTitle)
    fun testamentOld(l: AppLocale) = l.pick(LocaleTables.testamentOld)
    fun testamentNew(l: AppLocale) = l.pick(LocaleTables.testamentNew)
    /** 「创世记 第1章」/「Genesis 1」 */
    fun chapterTitle(bookName: String, chapter: Int, locale: AppLocale) =
        if (locale == AppLocale.EN) "$bookName $chapter" else "$bookName 第${chapter}章"
    /** 章末上一章 / 下一章的小字：「第N章」/「Chapter N」 */
    fun chapterLabel(chapter: Int, locale: AppLocale) = if (locale == AppLocale.EN) "Chapter $chapter" else "第${chapter}章"
}

/** 按展示语言取书名（RN getScriptureBookDisplayName） */
fun BookRef.name(locale: AppLocale): String = when (locale) {
    AppLocale.EN -> nameEn
    AppLocale.ZH_TW -> LocaleTables.bookNameZhTw[id] ?: nameZh
    AppLocale.ZH_CN -> nameZh
}

/** 目录分组标题按展示语言（RN canonSectionTitle） */
fun BookGroup.title(locale: AppLocale): String = LocaleTables.sectionTitles[id]?.let { locale.pick(it) } ?: name
