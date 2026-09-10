// 由 tools/gen-translation-catalog.mts 从 RN 的译本目录 / YouVersion 表 / R2 下载表 / 选择器排序生成，勿手改。
package me.askbible.native_.data

/** 译本目录（RN 生产环境 OFFLINE_BUNDLED_INDEX 里拿得到正文的那些）。 */
object TranslationCatalog {
    val entries: List<ScriptureTranslation> = listOf(
        ScriptureTranslation("ccb-zh-hans", "当代译本（简体）", "Contemporary Chinese Bible (Simplified)", "zh-Hans", TranslationDelivery.ONLINE,
            "youversion", "36", "zh-CN", "CCB", "",
            true, "当代译本", "當代譯本", "CCB"),
        ScriptureTranslation("ccb-zh-hant", "當代譯本（繁體）", "Contemporary Chinese Bible (Traditional)", "zh-Hant", TranslationDelivery.ONLINE,
            "youversion", "1392", "zh-TW", "CCB", "",
            true, "当代译本", "當代譯本", "CCB"),
        ScriptureTranslation("cnv-zh-hant", "新譯本（繁體）", "Chinese New Version (Traditional)", "zh-Hant", TranslationDelivery.ONLINE,
            "youversion", "40", "zh-TW", "CNV", "",
            true, "新译本", "新譯本", "CNV"),
        ScriptureTranslation("cnvs-zh-hans", "新译本（简体）", "Chinese New Version (Simplified)", "zh-Hans", TranslationDelivery.ONLINE,
            "youversion", "41", "zh-CN", "CNVS", "",
            true, "新译本", "新譯本", "CNVS"),
        ScriptureTranslation("csbs-zh-hans", "中文标准译本（简体）", "Chinese Standard Bible (Simplified)", "zh-Hans", TranslationDelivery.ONLINE,
            "youversion", "43", "zh-CN", "CSBS", "",
            true, "标准译本", "標準譯本", "CSBS"),
        ScriptureTranslation("csbt-zh-hant", "中文標準譯本（繁體）", "Chinese Standard Bible (Traditional)", "zh-Hant", TranslationDelivery.ONLINE,
            "youversion", "312", "zh-TW", "CSBT", "",
            true, "标准译本", "標準譯本", "CSBT"),
        ScriptureTranslation("rcuv-zh-hant", "和合本修訂版", "Revised Chinese Union Version", "zh-Hant", TranslationDelivery.ONLINE,
            "youversion", "139", "zh-TW", "RCUV", "",
            true, "和合本修订", "和合本修訂", "RCUV"),
        ScriptureTranslation("rcuvss-zh-hans", "和合本修订版", "Revised Chinese Union Version (Simplified)", "zh-Hans", TranslationDelivery.ONLINE,
            "youversion", "140", "zh-CN", "RCUVSS", "",
            true, "和合本修订", "和合本修訂", "RCUVSS"),
        ScriptureTranslation("cunp-zh-hant", "新標點和合本（神版·繁體）", "CUNP (Shen, Traditional)", "zh-Hant", TranslationDelivery.ONLINE,
            "youversion", "46", "zh-TW", "CUNP-Shen", "",
            true, "新标点·神繁", "新標點·神繁", "CUNP Shen"),
        ScriptureTranslation("cunp-zh-hant-god", "新標點和合本（上帝版·繁體）", "CUNP (Shangdi, Traditional)", "zh-Hant", TranslationDelivery.ONLINE,
            "youversion", "414", "zh-TW", "CUNP-Shangti", "",
            true, "新标点·上帝繁", "新標點·上帝繁", "CUNP Shangdi"),
        ScriptureTranslation("cunpss-zh-hant", "新标点和合本（上帝版·简体）", "CUNPSS (Shangdi, Simplified)", "zh-Hans", TranslationDelivery.ONLINE,
            "youversion", "47", "zh-CN", "CUNPSS-Shangti", "",
            true, "新标点·上帝简", "新標點·上帝簡", "CUNPSS Shangdi"),
        ScriptureTranslation("cunpss-zh-hans", "新标点和合本（神版·简体）", "CUNPSS (Shen, Simplified)", "zh-Hans", TranslationDelivery.ONLINE,
            "youversion", "48", "zh-CN", "CUNPSS-Shen", "",
            true, "新标点·神简", "新標點·神簡", "CUNPSS Shen"),
        ScriptureTranslation("mandarin-zh-hans", "普通话本", "Mandarin Bible", "zh-Hans", TranslationDelivery.ONLINE,
            "youversion", "3780", "zh-CN", "", "",
            false, "普通话", "普通話", "Mandarin"),
        ScriptureTranslation("rcv-zh-hant", "恢復本（繁體）", "Recovery Version Traditional Chinese", "zh-Hant", TranslationDelivery.ONLINE,
            "youversion", "4230", "zh-TW", "RCV", "",
            false, "恢复本", "恢復本", "RCV"),
        ScriptureTranslation("cuv-simp", "和合本（简体）", "Chinese Union Version (Simplified)", "zh-Hans", TranslationDelivery.BUNDLED,
            "local", "", "", "", "",
            true, "和合本", "和合本", "CUV"),
        ScriptureTranslation("cuv-trad", "和合本（繁體）", "Chinese Union Version (Traditional)", "zh-Hant", TranslationDelivery.BUNDLED,
            "local", "", "", "", "",
            true, "和合本繁", "和合本繁", "CUV Trad"),
        ScriptureTranslation("web-en", "WEBP 英译本", "World English Bible (WEBP)", "en", TranslationDelivery.BUNDLED,
            "local", "", "", "", "",
            true, "WEBP", "WEBP", "WEBP"),
        ScriptureTranslation("ust-en", "UST 简明英文（学英文版）", "unfoldingWord Simplified Text (UST) – Learn English", "en", TranslationDelivery.BUNDLED,
            "local", "", "", "", "",
            false, "UST", "UST", "UST"),
        ScriptureTranslation("niv", "NIV 英文新国际版", "New International Version (NIV)", "en", TranslationDelivery.ONLINE,
            "youversion", "111", "", "NIV", "",
            true, "NIV", "NIV", "NIV"),
        ScriptureTranslation("kjv", "KJV 英文钦定本", "King James Version (KJV)", "en", TranslationDelivery.DOWNLOAD,
            "", "1", "", "KJV", "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev/bible/kjv.sqlite",
            true, "KJV", "KJV", "KJV"),
    )
    /** 选择器顺序（RN sortPickerTranslations，按界面语言） */
    val pickerOrder: Map<String, List<String>> = mapOf(
        "zh-CN" to listOf("cuv-simp", "cuv-trad", "ccb-zh-hans", "cnvs-zh-hans", "rcuvss-zh-hans", "rcuv-zh-hant", "rcv-zh-hant", "csbs-zh-hans", "cunpss-zh-hans", "cunpss-zh-hant", "cunp-zh-hant", "cunp-zh-hant-god", "csbt-zh-hant", "cnv-zh-hant", "mandarin-zh-hans", "niv", "kjv", "web-en", "ust-en", "ccb-zh-hant"),
        "zh-TW" to listOf("cuv-trad", "cuv-simp", "ccb-zh-hant", "rcuv-zh-hant", "rcuvss-zh-hans", "cnv-zh-hant", "rcv-zh-hant", "csbt-zh-hant", "cunp-zh-hant", "cunp-zh-hant-god", "cunpss-zh-hans", "cunpss-zh-hant", "csbs-zh-hans", "cnvs-zh-hans", "mandarin-zh-hans", "niv", "kjv", "web-en", "ust-en", "ccb-zh-hans"),
        "en" to listOf("niv", "kjv", "web-en", "ust-en", "cuv-simp", "cuv-trad", "ccb-zh-hans", "ccb-zh-hant", "cnv-zh-hant", "cnvs-zh-hans", "csbs-zh-hans", "csbt-zh-hant", "rcuv-zh-hant", "rcuvss-zh-hans", "cunp-zh-hant", "cunp-zh-hant-god", "cunpss-zh-hant", "cunpss-zh-hans", "mandarin-zh-hans", "rcv-zh-hant"),
    )
    /** 抓 bible.com 页面第二次尝试用的浏览器 UA（RN BROWSER_UA） */
    const val BROWSER_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    /** 生产包里 RN 自己也拿不到正文的译本，没列进来 */
    val notListed: List<String> = listOf("esv", "nlt", "nkjv")
}
