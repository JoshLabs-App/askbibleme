import Foundation

/// 译本交付方式：内置 sqlite / 按需下载整本 sqlite（R2）/ 在线逐章抓 bible.com 公开页（RN delivery：bundled / local-download / chapter-api）
enum TranslationDelivery: String {
    case bundled, download, online
}

/// 译本目录一条。清单由 tools/gen-translation-catalog.mts 从 RN 生产目录（OFFLINE_BUNDLED_INDEX）生成，
/// 与 Android 的 ScriptureTranslation.kt 对等；`check:translation-catalog` 保证两端表不过期。
struct ScriptureTranslation: Identifiable, Hashable {
    let id: String
    let labelZh: String
    let labelEn: String
    /// 译本语言（RN BibleTranslationMeta.language：zh-Hans / zh-Hant / en），读经展示语言跟它走
    let language: String
    let delivery: TranslationDelivery
    /// local / youversion
    let provider: String
    /// YouVersion 版本号（在线译本抓页用）
    let remoteId: String
    /// bible.com 页面语言前缀（zh-CN / zh-TW），空 = 不带
    let pageLocale: String
    /// bible.com 页面缩写（CCB / NIV…），空 = 不带
    let abbreviation: String
    /// 下载型译本的整本 sqlite 地址（R2）
    let downloadUrl: String
    /// 有整章朗读（RN translationSupportsChapterAudio：和合本两版 / WEBP / KJV）
    let hasChapterAudio: Bool
    let shortZh: String
    let shortZhTw: String
    let shortEn: String

    /// 全目录（RN 生产环境拿得到正文的那些）
    static let all: [ScriptureTranslation] = TranslationCatalog.entries
    /// 随安装包内置的（BUNDLED_SCRIPTURE_TRANSLATION_IDS 的顺序）
    static let bundled: [ScriptureTranslation] = all.filter { $0.delivery == .bundled }
    /// DEFAULT_SCRIPTURE_TRANSLATION_ID
    static let `default`: ScriptureTranslation = find("cuv-simp") ?? all[0]

    static func find(_ id: String) -> ScriptureTranslation? {
        all.first { $0.id == id }
    }

    /// 选择器顺序（RN sortPickerTranslations，按界面语言）
    static func pickerOrder(_ locale: AppLocale) -> [ScriptureTranslation] {
        (TranslationCatalog.pickerOrder[locale.rawValue] ?? TranslationCatalog.pickerOrder["en"] ?? []).compactMap(find)
    }

    var isZh: Bool { language.lowercased().hasPrefix("zh") }
    /// 正文在本机（内置或已下载）才能搜索 / 取对照预览
    var isLocalText: Bool { delivery != .online }

    /// RN translationOptionLabel：英文界面用英文名，中文界面用中文名（繁体面转繁）
    func label(_ locale: AppLocale) -> String { locale == .en ? labelEn : locale.zh(labelZh) }
    /// RN shortLabel
    func shortLabel(_ locale: AppLocale) -> String {
        switch locale { case .en: return shortEn; case .zhTW: return shortZhTw; case .zhCN: return shortZh }
    }

    /// RN languageDisplayName：简中 / 繁中 / 英文（英文界面 Simp. Chinese / Trad. Chinese / English）
    static func languageName(_ language: String, locale: AppLocale) -> String {
        let lang = language.trimmingCharacters(in: .whitespaces).lowercased()
        if locale == .en {
            if lang.hasPrefix("zh-hant") { return "Trad. Chinese" }
            if lang.hasPrefix("zh") { return "Simp. Chinese" }
            if lang.hasPrefix("en") { return "English" }
            return lang.isEmpty ? "Other" : lang
        }
        if lang.hasPrefix("zh-hant") { return locale.zh("繁中") }
        if lang.hasPrefix("zh") { return locale.zh("简中") }
        if lang.hasPrefix("en") { return "英文" }
        return "其他"
    }
}
