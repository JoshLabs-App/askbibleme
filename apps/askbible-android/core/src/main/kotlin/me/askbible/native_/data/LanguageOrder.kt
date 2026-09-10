// 由 tools/gen-language-order.mjs 从 data/language-speakers.json 生成，勿手改。
package me.askbible.native_.data

/**
 * 译本面板语言行的排序与名字：使用人数多的语言排前面（表里没有的排在后面，再按版本数）；
 * 名字自带中英两份 —— 目录接口老版本只给中文名，英文界面不该显示中文语言名。
 */
object LanguageOrder {
    data class Entry(val rank: Int, val zh: String, val en: String)

    /** 语言码 → 名次（0 最靠前）+ 中英名字 */
    val table: Map<String, Entry> = mapOf(
        "en" to Entry(0, "英语", "English"),
        "zh" to Entry(1, "中文", "Chinese"),
        "hi" to Entry(2, "印地语", "Hindi"),
        "es" to Entry(3, "西班牙语", "Spanish"),
        "ar" to Entry(4, "阿拉伯语", "Arabic"),
        "fr" to Entry(5, "法语", "French"),
        "bn" to Entry(6, "孟加拉语", "Bengali"),
        "pt" to Entry(7, "葡萄牙语", "Portuguese"),
        "ru" to Entry(8, "俄语", "Russian"),
        "ur" to Entry(9, "乌尔都语", "Urdu"),
        "id" to Entry(10, "印尼语", "Indonesian"),
        "ms" to Entry(11, "马来语", "Malay"),
        "de" to Entry(12, "德语", "German"),
        "ja" to Entry(13, "日语", "Japanese"),
        "pa" to Entry(14, "旁遮普语", "Punjabi"),
        "mr" to Entry(15, "马拉地语", "Marathi"),
        "te" to Entry(16, "泰卢固语", "Telugu"),
        "tr" to Entry(17, "土耳其语", "Turkish"),
        "ta" to Entry(18, "泰米尔语", "Tamil"),
        "tl" to Entry(19, "他加禄语", "Tagalog"),
        "vi" to Entry(20, "越南语", "Vietnamese"),
        "yue" to Entry(21, "粤语", "Cantonese"),
        "ko" to Entry(22, "韩语", "Korean"),
        "ha" to Entry(23, "豪萨语", "Hausa"),
        "fa" to Entry(24, "波斯语", "Persian"),
        "sw" to Entry(25, "斯瓦希里语", "Swahili"),
        "it" to Entry(26, "意大利语", "Italian"),
        "jv" to Entry(27, "爪哇语", "Javanese"),
        "gu" to Entry(28, "古吉拉特语", "Gujarati"),
        "th" to Entry(29, "泰语", "Thai"),
        "kn" to Entry(30, "卡纳达语", "Kannada"),
        "am" to Entry(31, "阿姆哈拉语", "Amharic"),
        "bho" to Entry(32, "博杰普尔语", "Bhojpuri"),
        "uz" to Entry(33, "乌兹别克语", "Uzbek"),
        "my" to Entry(34, "缅甸语", "Burmese"),
        "pl" to Entry(35, "波兰语", "Polish"),
        "ps" to Entry(36, "普什图语", "Pashto"),
        "uk" to Entry(37, "乌克兰语", "Ukrainian"),
        "or" to Entry(38, "奥里亚语", "Odia"),
        "ml" to Entry(39, "马拉雅拉姆语", "Malayalam"),
        "ne" to Entry(40, "尼泊尔语", "Nepali"),
        "sd" to Entry(41, "信德语", "Sindhi"),
        "az" to Entry(42, "阿塞拜疆语", "Azerbaijani"),
        "ku" to Entry(43, "库尔德语", "Kurdish"),
        "ceb" to Entry(44, "宿务语", "Cebuano"),
        "mg" to Entry(45, "马达加斯加语", "Malagasy"),
        "nl" to Entry(46, "荷兰语", "Dutch"),
        "ro" to Entry(47, "罗马尼亚语", "Romanian"),
        "si" to Entry(48, "僧伽罗语", "Sinhala"),
        "so" to Entry(49, "索马里语", "Somali"),
        "km" to Entry(50, "高棉语", "Khmer"),
        "el" to Entry(51, "希腊语", "Greek"),
        "hu" to Entry(52, "匈牙利语", "Hungarian"),
        "sv" to Entry(53, "瑞典语", "Swedish"),
        "sr" to Entry(54, "塞尔维亚语", "Serbian"),
        "cs" to Entry(55, "捷克语", "Czech"),
        "he" to Entry(56, "希伯来语", "Hebrew"),
        "bg" to Entry(57, "保加利亚语", "Bulgarian"),
        "sq" to Entry(58, "阿尔巴尼亚语", "Albanian"),
        "da" to Entry(59, "丹麦语", "Danish"),
        "hr" to Entry(60, "克罗地亚语", "Croatian"),
        "hy" to Entry(61, "亚美尼亚语", "Armenian"),
        "fi" to Entry(62, "芬兰语", "Finnish"),
        "mn" to Entry(63, "蒙古语", "Mongolian"),
        "nb" to Entry(64, "书面挪威语", "Norwegian Bokmål"),
        "no" to Entry(65, "挪威语", "Norwegian"),
        "sk" to Entry(66, "斯洛伐克语", "Slovak"),
        "ka" to Entry(67, "格鲁吉亚语", "Georgian"),
        "lt" to Entry(68, "立陶宛语", "Lithuanian"),
        "lv" to Entry(69, "拉脱维亚语", "Latvian"),
        "mk" to Entry(70, "马其顿语", "Macedonian"),
        "sl" to Entry(71, "斯洛文尼亚语", "Slovenian"),
        "et" to Entry(72, "爱沙尼亚语", "Estonian"),
        "is" to Entry(73, "冰岛语", "Icelandic"),
        "cy" to Entry(74, "威尔士语", "Welsh"),
        "eo" to Entry(75, "世界语", "Esperanto"),
        "grc" to Entry(76, "古希腊语", "Ancient Greek"),
        "haw" to Entry(77, "夏威夷语", "Hawaiian"),
        "hbo" to Entry(78, "圣经希伯来语", "Biblical Hebrew"),
        "la" to Entry(79, "拉丁语", "Latin"),
        "rmn" to Entry(80, "巴尔干罗姆语", "Balkan Romani"),
        "sa" to Entry(81, "梵语", "Sanskrit"),
    )

    /** 表里没有的排在所有登记语言之后 */
    fun rank(tag: String): Int = table[tag.trim().lowercase()]?.rank ?: Int.MAX_VALUE

    /** 内置的语言名（按界面语言）；表里没有返回 null */
    fun name(tag: String, locale: AppLocale): String? {
        val hit = table[tag.trim().lowercase()] ?: return null
        return if (locale == AppLocale.EN) hit.en else locale.zh(hit.zh)
    }
}
