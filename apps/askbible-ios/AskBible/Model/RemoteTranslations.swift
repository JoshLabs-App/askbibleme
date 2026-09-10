import Foundation

/// 全量在线译本目录：网站 `/api/mobile/bible/youversion/catalog`（服务端拿 YouVersion 官方平台接口，带密钥）。
///
/// 内置 / 下载型那 20 本仍以 `TranslationCatalog.entries` 为准（离线可用、带朗读与下载信息），
/// 这里只补「多出来的」几百本（各语种，纯在线、正文逐章取）。落盘 Caches/translations-catalog.json，
/// 冷启动先读盘（所以记住的译本一进来就认得），再后台按 TTL 刷新。
/// Josh 2026-09-10：「YouVersion 里有的版本全放开来，不需要人为去选」。
enum RemoteTranslations {
    static let catalogEndpoint = "https://askbible.me/api/mobile/bible/youversion/catalog"
    static let chapterEndpoint = "https://askbible.me/api/mobile/bible/youversion/chapter"
    /// 一天刷一次（目录很少变）
    static let ttl: TimeInterval = 24 * 3600

    struct Entry {
        let translation: ScriptureTranslation
        let languageNameZh: String
        let languageNameEn: String
        let copyright: String
    }

    private static let lock = NSLock()
    nonisolated(unsafe) private static var loadedFromDisk = false
    nonisolated(unsafe) private static var entries: [Entry] = []

    /// 内置目录之外的在线译本（读盘惰性初始化）
    static var extras: [ScriptureTranslation] {
        ensureLoaded()
        lock.lock(); defer { lock.unlock() }
        return entries.map(\.translation)
    }

    /// 语言码 → 显示名（按界面语言；目录里没有就返回语言码本身）
    static func languageName(_ tag: String, _ locale: AppLocale) -> String? {
        ensureLoaded()
        lock.lock(); defer { lock.unlock() }
        let key = tag.lowercased()
        guard let hit = entries.first(where: { $0.translation.language.lowercased() == key }) else { return nil }
        let name = locale == .en ? hit.languageNameEn : hit.languageNameZh
        return name.isEmpty ? nil : (locale == .en ? name : locale.zh(name))
    }

    /// 版权 / 来源声明（YouVersion 条款要求展示）：目录给了版权文本就用它，否则「版本名 · 经文由 YouVersion 提供」；
    /// 内置译本不是 YouVersion 来的，返回 nil
    static func attribution(_ translationId: String, _ locale: AppLocale = AppLocale.current) -> String? {
        ensureLoaded()
        lock.lock()
        let hit = entries.first { $0.translation.id == translationId }
        lock.unlock()
        guard let hit else { return nil }
        if !hit.copyright.isEmpty { return hit.copyright }
        return SiteCopy.f("native.remoteTextAttribution", ["name": hit.translation.label(locale)], locale)
    }

    // MARK: 拉取

    /// App 起来时叫一次：盘里过期了才走网；成功返回 true（壳据此刷新目录相关 UI）
    @discardableResult
    static func refresh(force: Bool = false) async -> Bool {
        ensureLoaded()
        if !force, let at = diskFetchedAt(), Date().timeIntervalSince(at) < ttl { return false }
        guard let url = URL(string: catalogEndpoint) else { return false }
        // 服务端冷启动要现拉一次 YouVersion 目录，给足时间（拉到就缓存一天）
        var req = URLRequest(url: url, timeoutInterval: 90)
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let parsed = parse(data), !parsed.isEmpty else { return false }
        lock.lock(); entries = parsed; lock.unlock()
        writeDisk(data)
        return true
    }

    /// 目录 JSON → 条目（内置目录已有的 YouVersion 版本号跳过，避免同一本出现两次）
    static func parse(_ data: Data) -> [Entry]? {
        guard let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let list = root["translations"] as? [[String: Any]] else { return nil }
        let takenRemoteIds = Set(TranslationCatalog.entries.map(\.remoteId).filter { !$0.isEmpty })
        var out: [Entry] = []
        var seen = Set<String>()
        for item in list {
            let remoteId = ((item["remoteId"] as? String) ?? (item["id"] as? String) ?? "").trimmingCharacters(in: .whitespaces)
            let language = ((item["language"] as? String) ?? "").trimmingCharacters(in: .whitespaces)
            let labelEn = ((item["labelEn"] as? String) ?? "").trimmingCharacters(in: .whitespaces)
            let labelZh = ((item["labelZh"] as? String) ?? "").trimmingCharacters(in: .whitespaces)
            guard !remoteId.isEmpty, !language.isEmpty, language != "und",
                  !(labelEn.isEmpty && labelZh.isEmpty),
                  !takenRemoteIds.contains(remoteId) else { continue }
            let id = "yv-" + remoteId
            guard !seen.contains(id) else { continue }
            seen.insert(id)
            let abbreviation = ((item["abbreviation"] as? String) ?? "").trimmingCharacters(in: .whitespaces)
            let zhName = ((item["languageNameZh"] as? String) ?? (item["languageName"] as? String) ?? language)
            let enName = ((item["languageNameEn"] as? String) ?? (item["languageName"] as? String) ?? language)
            let short = abbreviation.isEmpty ? (labelEn.isEmpty ? labelZh : labelEn) : abbreviation
            out.append(Entry(
                translation: ScriptureTranslation(
                    id: id,
                    labelZh: labelZh.isEmpty ? labelEn : labelZh,
                    labelEn: labelEn.isEmpty ? labelZh : labelEn,
                    language: language,
                    delivery: .online,
                    provider: "youversion",
                    remoteId: remoteId,
                    pageLocale: "",
                    abbreviation: abbreviation,
                    downloadUrl: "",
                    hasChapterAudio: false,
                    shortZh: short, shortZhTw: short, shortEn: short),
                languageNameZh: zhName,
                languageNameEn: enName,
                copyright: ((item["copyright"] as? String) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)))
        }
        return out
    }

    // MARK: 落盘

    private static var file: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("translations-catalog.json")
    }

    private static func diskFetchedAt() -> Date? {
        (try? FileManager.default.attributesOfItem(atPath: file.path)[.modificationDate]) as? Date
    }

    private static func writeDisk(_ data: Data) { try? data.write(to: file, options: .atomic) }

    private static func ensureLoaded() {
        lock.lock()
        let done = loadedFromDisk
        lock.unlock()
        if done { return }
        let parsed = (try? Data(contentsOf: file)).flatMap(parse) ?? []
        lock.lock(); loadedFromDisk = true; if entries.isEmpty { entries = parsed }; lock.unlock()
    }
}
