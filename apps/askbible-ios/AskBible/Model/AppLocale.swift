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

    /// 当前界面语言（壳在 appLocale 变化时更新；SiteCopy / 目录表的默认取值）。
    /// 视图层仍应显式传 locale，让 SwiftUI 在切语言时重绘；这里给模型层与临时弹层用。
    nonisolated(unsafe) static var current: AppLocale = .zhCN  // 默认简体：对拍 harness 不受机器语言影响；App 启动时改成真实值

    /// 切语言时联动的主译本（RN pickTranslationIdForLocale：简 → 和合本简体，繁 → 和合本繁體，英 → WEB）
    static func primaryTranslationId(for locale: AppLocale) -> String {
        switch locale { case .zhCN: return "cuv-simp"; case .zhTW: return "cuv-trad"; case .en: return "web-en" }
    }

    /// 首页金句朗读译本（RN resolveGoldenVerseAudioTranslationForLocale：中文 → 和合本，英文 → WEB）
    static func goldenVerseAudioTranslationId(for locale: AppLocale) -> String {
        locale == .en ? "web-en" : "cuv-simp"
    }

    /// 简 / 英两份文案按当前语言取一份（繁体面把简体转繁）
    static func pick(_ zh: String, _ en: String, _ locale: AppLocale = AppLocale.current) -> String {
        locale == .en ? en : locale.zh(zh)
    }

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
    /// 译本语言既不是中文也不是英文（西语等全量放开进来的那些）：
    /// 我们没有这个语种的段落小标题，章标题也不该写成「Génesis 第1章」
    static func isForeign(_ translationLanguage: String?) -> Bool {
        let lang = (translationLanguage ?? "").trimmingCharacters(in: .whitespaces).lowercased()
        return !lang.isEmpty && !lang.hasPrefix("zh") && !lang.hasPrefix("en")
    }

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

/// 界面语言的手动设置（原生版新增，RN 没有：RN 只跟系统语言）。nil = 跟随系统。
/// Josh 2026-09-10：「在探索页也放入语言的设置」。
extension AppLocale {
    static let overrideKey = "askbible.app-locale-override.v1"

    static var storedOverride: AppLocale? {
        UserDefaults.standard.string(forKey: overrideKey).flatMap(AppLocale.init(rawValue:))
    }

    static func storeOverride(_ locale: AppLocale?) {
        if let locale { UserDefaults.standard.set(locale.rawValue, forKey: overrideKey) }
        else { UserDefaults.standard.removeObject(forKey: overrideKey) }
    }

    /// 设置项上的名字，各用自己的文字
    var settingLabel: String {
        switch self { case .en: return "English"; case .zhCN: return "简体中文"; case .zhTW: return "繁體中文" }
    }
}
