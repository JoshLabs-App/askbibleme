// 由 tools/gen-language-order.mjs 从 data/language-speakers.json 生成，勿手改。

/// 译本面板语言行的排序与名字：使用人数多的语言排前面（表里没有的排在后面，再按版本数）；
/// 名字自带中英两份 —— 目录接口老版本只给中文名，英文界面不该显示中文语言名。
enum LanguageOrder {
    /// 语言码 → (名次（0 最靠前）, 中文名, 英文名)
    static let table: [String: (rank: Int, zh: String, en: String)] = [
        "en": (0, "英语", "English"),
        "zh": (1, "中文", "Chinese"),
        "hi": (2, "印地语", "Hindi"),
        "es": (3, "西班牙语", "Spanish"),
        "ar": (4, "阿拉伯语", "Arabic"),
        "fr": (5, "法语", "French"),
        "bn": (6, "孟加拉语", "Bengali"),
        "pt": (7, "葡萄牙语", "Portuguese"),
        "ru": (8, "俄语", "Russian"),
        "ur": (9, "乌尔都语", "Urdu"),
        "id": (10, "印尼语", "Indonesian"),
        "ms": (11, "马来语", "Malay"),
        "de": (12, "德语", "German"),
        "ja": (13, "日语", "Japanese"),
        "pa": (14, "旁遮普语", "Punjabi"),
        "mr": (15, "马拉地语", "Marathi"),
        "te": (16, "泰卢固语", "Telugu"),
        "tr": (17, "土耳其语", "Turkish"),
        "ta": (18, "泰米尔语", "Tamil"),
        "tl": (19, "他加禄语", "Tagalog"),
        "vi": (20, "越南语", "Vietnamese"),
        "yue": (21, "粤语", "Cantonese"),
        "ko": (22, "韩语", "Korean"),
        "ha": (23, "豪萨语", "Hausa"),
        "fa": (24, "波斯语", "Persian"),
        "sw": (25, "斯瓦希里语", "Swahili"),
        "it": (26, "意大利语", "Italian"),
        "jv": (27, "爪哇语", "Javanese"),
        "gu": (28, "古吉拉特语", "Gujarati"),
        "th": (29, "泰语", "Thai"),
        "kn": (30, "卡纳达语", "Kannada"),
        "am": (31, "阿姆哈拉语", "Amharic"),
        "bho": (32, "博杰普尔语", "Bhojpuri"),
        "uz": (33, "乌兹别克语", "Uzbek"),
        "my": (34, "缅甸语", "Burmese"),
        "pl": (35, "波兰语", "Polish"),
        "ps": (36, "普什图语", "Pashto"),
        "uk": (37, "乌克兰语", "Ukrainian"),
        "or": (38, "奥里亚语", "Odia"),
        "ml": (39, "马拉雅拉姆语", "Malayalam"),
        "ne": (40, "尼泊尔语", "Nepali"),
        "sd": (41, "信德语", "Sindhi"),
        "az": (42, "阿塞拜疆语", "Azerbaijani"),
        "ku": (43, "库尔德语", "Kurdish"),
        "ceb": (44, "宿务语", "Cebuano"),
        "mg": (45, "马达加斯加语", "Malagasy"),
        "nl": (46, "荷兰语", "Dutch"),
        "ro": (47, "罗马尼亚语", "Romanian"),
        "si": (48, "僧伽罗语", "Sinhala"),
        "so": (49, "索马里语", "Somali"),
        "km": (50, "高棉语", "Khmer"),
        "el": (51, "希腊语", "Greek"),
        "hu": (52, "匈牙利语", "Hungarian"),
        "sv": (53, "瑞典语", "Swedish"),
        "sr": (54, "塞尔维亚语", "Serbian"),
        "cs": (55, "捷克语", "Czech"),
        "he": (56, "希伯来语", "Hebrew"),
        "bg": (57, "保加利亚语", "Bulgarian"),
        "sq": (58, "阿尔巴尼亚语", "Albanian"),
        "da": (59, "丹麦语", "Danish"),
        "hr": (60, "克罗地亚语", "Croatian"),
        "hy": (61, "亚美尼亚语", "Armenian"),
        "fi": (62, "芬兰语", "Finnish"),
        "mn": (63, "蒙古语", "Mongolian"),
        "nb": (64, "书面挪威语", "Norwegian Bokmål"),
        "no": (65, "挪威语", "Norwegian"),
        "sk": (66, "斯洛伐克语", "Slovak"),
        "ka": (67, "格鲁吉亚语", "Georgian"),
        "lt": (68, "立陶宛语", "Lithuanian"),
        "lv": (69, "拉脱维亚语", "Latvian"),
        "mk": (70, "马其顿语", "Macedonian"),
        "sl": (71, "斯洛文尼亚语", "Slovenian"),
        "et": (72, "爱沙尼亚语", "Estonian"),
        "is": (73, "冰岛语", "Icelandic"),
        "cy": (74, "威尔士语", "Welsh"),
        "eo": (75, "世界语", "Esperanto"),
        "grc": (76, "古希腊语", "Ancient Greek"),
        "haw": (77, "夏威夷语", "Hawaiian"),
        "hbo": (78, "圣经希伯来语", "Biblical Hebrew"),
        "la": (79, "拉丁语", "Latin"),
        "rmn": (80, "巴尔干罗姆语", "Balkan Romani"),
        "sa": (81, "梵语", "Sanskrit"),
    ]

    private static func key(_ tag: String) -> String { tag.trimmingCharacters(in: .whitespaces).lowercased() }

    /// 表里没有的排在所有登记语言之后
    static func rank(_ tag: String) -> Int { table[key(tag)]?.rank ?? Int.max }

    /// 内置的语言名（按界面语言）；表里没有返回 nil
    static func name(_ tag: String, _ locale: AppLocale) -> String? {
        guard let hit = table[key(tag)] else { return nil }
        return locale == .en ? hit.en : locale.zh(hit.zh)
    }
}
