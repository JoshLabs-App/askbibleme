import Foundation

/// 界面语言（RN `i18n/config.ts` 的 AppLocale：en / zh-CN / zh-TW）。跟系统语言走，不另设开关：
/// zh-TW / zh-HK / zh-MO / 带 Hant 的 → 繁体；其它 zh → 简体；其它 → 英文（RN DEFAULT_LOCALE = en）。
enum AppLocale: String {
    case en
    case zhCN = "zh-CN"
    case zhTW = "zh-TW"

    /// RN mapLanguageTagToAppLocale
    static func fromLanguageTag(_ tag: String) -> AppLocale {
        let t = tag.trimmingCharacters(in: .whitespaces).lowercased()
        if t.isEmpty { return .en }
        if t == "en" || t.hasPrefix("en-") { return .en }
        if t == "zh-tw" || t == "zh-hk" || t == "zh-mo" || t.contains("hant") { return .zhTW }
        if t.hasPrefix("zh") { return .zhCN }
        return .en
    }

    /// 系统首选语言（RN 取 AppleLanguages[0]）
    static var device: AppLocale { fromLanguageTag(Locale.preferredLanguages.first ?? "") }

    var isZh: Bool { self != .en }

    /// RN localeZhText：繁体面把简体文案转繁
    func zh(_ text: String) -> String { self == .zhTW ? ZhTw.convert(text) : text }

    /// 从 (zh, zhTw, en) 三语里挑
    func pick(_ t: (zh: String, zhTw: String, en: String)) -> String {
        switch self { case .en: return t.en; case .zhTW: return t.zhTw; case .zhCN: return t.zh }
    }
}

/// 读经展示语言（RN `resolveReadDisplayLocale`）：跟主译本走 —— 英文译本 → 英文面，中文译本 → 中文面
/// （繁简按界面语言），不强制改 App 全局界面语言。译本语言未知时跟界面语言。
enum ReadDisplayLocale {
    static func resolve(appLocale: AppLocale, translationLanguage: String?) -> AppLocale {
        let lang = (translationLanguage ?? "").trimmingCharacters(in: .whitespaces).lowercased()
        if lang.hasPrefix("en") { return .en }
        if lang.hasPrefix("zh") { return appLocale == .zhTW ? .zhTW : .zhCN }
        return appLocale
    }
}

/// 简→繁（RN `toZhTwText`）：词组替换 → 逐字 → 词组修正（后/里/仆等多义字）
enum ZhTw {
    static func convert(_ input: String) -> String {
        var out = input
        for (from, to) in LocaleTables.zhTwPhrases { out = out.replacingOccurrences(of: from, with: to) }
        var mapped = ""
        mapped.reserveCapacity(out.count)
        for ch in out { mapped += LocaleTables.zhTwChars[ch] ?? String(ch) }
        out = mapped
        for (from, to) in LocaleTables.zhTwFixups { out = out.replacingOccurrences(of: from, with: to) }
        return out
    }
}

/// 读经页固定文案按展示语言（RN createT(readDisplayLocale) 的那几条 + chapterTitleText / formatNeighborChapterLabel）
enum ReadChrome {
    static func catalogTitle(_ l: AppLocale) -> String { l.pick(LocaleTables.catalogTitle) }
    static func testamentOld(_ l: AppLocale) -> String { l.pick(LocaleTables.testamentOld) }
    static func testamentNew(_ l: AppLocale) -> String { l.pick(LocaleTables.testamentNew) }
    /// 「创世记 第1章」/「Genesis 1」
    static func chapterTitle(bookName: String, chapter: Int, locale: AppLocale) -> String {
        locale == .en ? "\(bookName) \(chapter)" : "\(bookName) 第\(chapter)章"
    }
    /// 章末上一章 / 下一章的小字：「第N章」/「Chapter N」
    static func chapterLabel(_ chapter: Int, locale: AppLocale) -> String {
        locale == .en ? "Chapter \(chapter)" : "第\(chapter)章"
    }
}

extension BookRef {
    /// 按展示语言取书名（RN getScriptureBookDisplayName）
    func name(_ locale: AppLocale) -> String {
        switch locale {
        case .en: return nameEn
        case .zhTW: return LocaleTables.bookNameZhTw[id] ?? nameZh
        case .zhCN: return nameZh
        }
    }
}

extension BookGroup {
    /// 目录分组标题按展示语言（RN canonSectionTitle）
    func title(_ locale: AppLocale) -> String {
        guard let t = LocaleTables.sectionTitles[id] else { return name }
        return locale.pick(t)
    }
}
