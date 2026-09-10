import SwiftUI

/// 只读库随开随用。由 `RootView` 以 @StateObject 持有、经 environmentObject 注入 ——
/// 不做成单例：@StateObject 包装单例所有权语义对不上，订阅不可靠（译本切换曾因此不生效）。
@MainActor
final class ScriptureStore: ObservableObject {
    @Published private(set) var lastError: String?
    /// 网站译本目录（几百本在线译本）刷新后 +1：面板等处据此重画
    @Published private(set) var catalogRevision = 0

    /// 起来时刷一次全量目录（盘里没过期就不走网）
    func refreshRemoteCatalog() async {
        if await RemoteTranslations.refresh() { catalogRevision += 1 }
    }
    /// 当前主译本，切换后各页重新取数；与副译本一起落 UserDefaults（RN selah_read_bible_translation_v1），跨启动记住
    @Published var translation: ScriptureTranslation = .default {
        didSet { persistTranslationPrefs() }
    }

    private var databases: [String: ScriptureDatabase] = [:]
    private lazy var xrefs = XrefDatabase()
    /// 下载型译本（KJV）的下载器；面板显示状态、章页等它装好
    let downloader = TranslationDownloader()

    func database(_ translationId: String) -> ScriptureDatabase? {
        if let hit = databases[translationId] { return hit }
        // 在线译本没有本机库；下载型没装好也没有 —— 都不算错误（章页走 loadChapterAsync 异步取数）
        if let t = ScriptureTranslation.find(translationId) {
            if t.delivery == .online { return nil }
            if t.delivery == .download, !TranslationDownloader.isInstalled(translationId) { return nil }
        }
        do {
            let db = try ScriptureDatabase(translationId: translationId)
            databases[translationId] = db
            return db
        } catch {
            lastError = error.localizedDescription
            return nil
        }
    }

    func loadChapter(translationId: String, bookId: String, chapter: Int) -> [LoadedVerse] {
        guard let db = database(translationId) else { return [] }
        do {
            let rows = try db.loadChapter(bookId: bookId, chapter: chapter)
            // 只在真的有旧错误时才清：@Published 无条件赋值也会发布，
            // 而这个方法会被 view body 里的 verseText 调到 —— 在 body 里发布就是渲染死循环。
            if lastError != nil { lastError = nil }
            return rows
        } catch {
            lastError = error.localizedDescription
            return []
        }
    }

    /// 章正文按交付方式取：内置 / 已下载 → sqlite；下载型没装 → 先下再读；在线 → RemoteChapterStore（抓不到返回 nil，章页提示重试）
    func loadChapterAsync(translationId: String, bookId: String, chapter: Int) async -> [LoadedVerse]? {
        guard let t = ScriptureTranslation.find(translationId) else { return loadChapter(translationId: translationId, bookId: bookId, chapter: chapter) }
        switch t.delivery {
        case .bundled:
            return loadChapter(translationId: translationId, bookId: bookId, chapter: chapter)
        case .download:
            guard await downloader.ensure(t) else { return nil }
            return loadChapter(translationId: translationId, bookId: bookId, chapter: chapter)
        case .online:
            guard let rows = await RemoteChapterStore.shared.load(t, bookId: bookId, chapter: chapter) else { return nil }
            return rows.map { LoadedVerse(number: $0.verse, text: $0.text, speechParts: nil, themeRepeatCount: 0, isGolden: false) }
        }
    }

    /// 搜索只能查本机库：在线译本回退到同语言的内置译本（RN pickFallbackTranslationId 的思路），返回回退到的 id；本机有库返回 nil
    func searchFallbackId(for translationId: String) -> String? {
        if database(translationId) != nil { return nil }
        let zh = ScriptureTranslation.find(translationId)?.isZh ?? true
        return zh ? "cuv-simp" : "web-en"
    }

    func chapterCount(translationId: String, bookId: String) -> Int {
        database(translationId)?.chapterCount(bookId: bookId) ?? 0
    }

    func versesWithXrefs(bookId: String, chapter: Int) -> Set<Int> {
        xrefs?.versesWithXrefs(bookId: bookId, chapter: chapter) ?? []
    }

    func verseXrefs(bookId: String, chapter: Int, verse: Int) -> VerseXrefs {
        xrefs?.verseXrefs(bookId: bookId, chapter: chapter, verse: verse)
            ?? VerseXrefs(verse: verse, incoming: [], outgoing: [])
    }

    /// 副译本（对照）。nil = 「无」。切换后章页在每节下方多一行对照文。
    @Published var secondary: ScriptureTranslation? {
        didSet { persistTranslationPrefs() }
    }

    init() {
        let stored = TranslationPrefsRules.parse(UserDefaults.standard.string(forKey: TranslationPrefsRules.key),
                                                 allowed: ScriptureTranslation.all.map(\.id),  // RN 传整个目录：下载型 / 在线译本重启后也要记住
                                                 // 首装没存过：跟界面语言（RN resolveDefaultPrimaryTranslationId(index, locale)）
                                                 defaultId: AppLocale.primaryTranslationId(for: AppLocale.current))
        translation = ScriptureTranslation.find(stored.primaryId) ?? .default
        secondary = stored.secondaryId.flatMap(ScriptureTranslation.find)
    }

    private func persistTranslationPrefs() {
        let sec = secondary?.id == translation.id ? nil : secondary?.id
        UserDefaults.standard.set(TranslationPrefsRules.serialize(primaryId: translation.id, secondaryId: sec), forKey: TranslationPrefsRules.key)
    }

    /// 取某译本某节的原文，给 xref 弹层做预览、给对照行取数
    func verseText(translationId: String, bookId: String, chapter: Int, verse: Int) -> String? {
        // 纯读：不经过 lastError，这个方法在 view body 里被调用，不能碰 @Published
        guard let db = database(translationId) else {
            // 在线译本：只看已抓到本机的章
            return RemoteChapterStore.cached(translationId, bookId: bookId, chapter: chapter)?.first { $0.verse == verse }?.text
        }
        return (try? db.loadChapter(bookId: bookId, chapter: chapter))?
            .first { $0.number == verse }?.text
    }
}
