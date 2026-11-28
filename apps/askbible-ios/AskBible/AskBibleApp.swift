import SwiftUI

@main
struct AskBibleApp: App {
    /// 方向闸：默认竖屏，只有首页放开横屏观影（见 OrientationGate）
    @UIApplicationDelegateAdaptor(OrientationAppDelegate.self) private var orientationDelegate
    var body: some Scene {
        WindowGroup {
            // 不再锁浅色（2026-09-16 起支持深色模式）：主题跟随系统，由 ParchmentSchemeInjector 注入
            RootView()
                .modifier(ParchmentSchemeInjector())
                .modifier(AppTextSizeHost())
        }
    }
}

struct RootView: View {
    @Environment(\.parchment) private var parchmentTheme
    @StateObject private var store = ScriptureStore()
    @StateObject private var devotionals = SolidJoys()
    @StateObject private var devotional = DevotionalPlayer()
    @State private var planListeningDate: String?
    @StateObject private var audio = ChapterAudioPlayer()
    @StateObject private var music = MusicPlayer()
    @StateObject private var home = HomeVerseController()
    @StateObject private var ambient = AmbientPlayer()
    @StateObject private var plans = ReadingPlanStore()
    @StateObject private var bookmarks = VerseBookmarkStore()
    @StateObject private var searchPrefs = SearchPrefs()
    @StateObject private var naturePrefs = NatureHomePrefs()
    /// 会员登录（AskBible Sync Worker + D1，D-44）
    @StateObject private var auth = MemberAuthStore()
    /// 读经活动（习惯日 / 累计听 / 使用时长 / 最近阅读）与会员读经进度同步
    @StateObject private var activity = ReadingActivityStore()
    /// 首页回归卡正占着顶部：勋章 / 升级横幅让位，等它退场再弹
    @StateObject private var sync = MemberReadingSyncEngine()
    @Environment(\.scenePhase) private var scenePhase
    /// 15 秒一跳：使用时长打点 + 记当天为读经日；每三跳（45 秒）轮询一次同步（RN AppUsageTimeBridge / useMemberReadingSync）
    private let usageTicker = Timer.publish(every: 15, on: .main, in: .common).autoconnect()
    @State private var usageTicks = 0
    /// 界面语言跟系统走；读经展示语言再跟主译本走（英文译本 → 英文面）
    // 界面语言：手动设置（探索页）优先，否则跟系统
    @State private var showHomeMusic = false
    @State private var panoramaLocate = 0
    @State private var deviceLocale = AppLocale.device
    @State private var localeOverride = AppLocale.storedOverride
    private var appLocale: AppLocale { localeOverride ?? deviceLocale }

    init() {
        // 目录表 / 文案表 / 译本默认值都看 AppLocale.current，要在各 StateObject 建起来之前定好
        AppLocale.current = AppLocale.storedOverride ?? AppLocale.device
    }

    /// 探索页选了语言（nil = 跟随系统）：RN applyLocaleWithTranslationPrefs —— 语言、主译本（自动）、副译本清空、首页金句译本与朗读一起换；
    /// 之后用户手动改译本不再受语言影响，直到下次切语言
    /// 读经同步那一行的右侧细节
    private var syncDetailText: String {
        if let at = sync.lastSyncedAt, let t = ISO8601DateFormatter.flexible(at) {
            let f = DateFormatter()
            f.dateFormat = appLocale == .en ? "MMM d, HH:mm" : "M月d日 HH:mm"
            return SiteCopy.t("native.syncLast", appLocale).replacingOccurrences(of: "{{time}}", with: f.string(from: t))
        }
        if sync.lastError != nil { return SiteCopy.t("native.syncIncomplete", appLocale) }
        return SiteCopy.t("native.syncNever", appLocale)
    }

    /// 发送反馈：RN 是 mailto，打不开就算了（原生没有站内反馈页）
    private func openSupportMail() {
        guard let url = URL(string: "mailto:hello@askbible.me") else { return }
        UIApplication.shared.open(url)
    }

    private func applyLocaleChoice(_ choice: AppLocale?) {
        let next = choice ?? deviceLocale
        AppLocale.current = next
        localeOverride = choice
        AppLocale.storeOverride(choice)
        let primary = AppLocale.primaryTranslationId(for: next)
        if let t = ScriptureTranslation.find(primary) { store.translation = t }
        store.secondary = nil
        // 首页金句跟读经版本走，换完译本由 onChange(store.translation.id) 接手
    }
    /// 计划 Tab（底栏中央键）里的子页：播放页 / 每日灵修目录 / 计划目录 / 计划详情
    enum PlanRoute: Equatable { case play, devotional(Date), plans, planDetail(String) }
    @State private var planRoute: PlanRoute = .play
    /// 播放页状态：日历上看的那天（相对系统今天）与选中的章
    @State private var planViewAhead = 0
    @State private var planCursor = 0
    /// 计划流在哪一页听：播放页（不开章页、顺队列换音源）还是章页（顺队列开下一章）—— RN PlanFlowUiHost
    enum PlanFlowHost { case listen, chapter }
    @State private var planFlowHost: PlanFlowHost = .chapter
    /// 播放页在听的章（章页没开时的音源目标）
    @State private var listenChapter: (book: BookRef, chapter: Int)?
    /// 章页是从计划页开的：返回回计划 Tab、不停播
    @State private var chapterFromPlan = false
    /// 章页是从首页「读上下文 ›」点进来的：返回直接回首页风景
    @State private var chapterFromHome = false
    /// 章页是从搜索结果点进来的：记下当时的关键词，返回时回到搜索页并恢复结果
    @State private var searchReturnQuery: String?
    /// 串珠跳转来源：在串珠弹层跳往另一章时记录原位置，支持左上「↩ 回 原书卷 章:节」一键归位
    @State private var xrefReturnOrigin: (book: BookRef, chapter: Int, verse: Int)?
    /// 羊皮卷金句书签分享卡弹层载荷
    @State private var shareCardPayload: VerseSharePayload?
    /// 探索页当前打开的文章（计划目录页的「麦克阿瑟研经法」链接要能直接打开一篇）
    @State private var exploreArticle: ExploreArticle?
    /// 登录 / 注册页：盖在整个壳上的全屏页（RN 是 stack 路由，无底栏）
    enum AuthRoute { case login, register }
    @State private var authRoute: AuthRoute?
    /// 首页左上的用户菜单
    @State private var showMenu = false
    /// 删除账户的二次确认
    @State private var confirmDeleteAccount = false
    /// 每日读经提醒
    @StateObject private var reminder = ReadingReminder.shared
    @State private var showReminderTime = false
    /// 客户端自动/手动升级检查
    @StateObject private var updateChecker = AppUpdateChecker()
    @State private var checkingUpdates = false
    @State private var updateStatusDetail: String?
    /// 首次打开的欢迎页（语言 + 登录），完成后写盘不再出
    @State private var showWelcome = !OnboardingPrefs.completed
    /// 读经计划流：今日逐章队列，一章播完顺到下一章并记已读
    @State private var planQueue: [PlanPointer] = []
    @State private var planQueueIndex = 0
    @State private var planFlowActive = false
    @State private var autoPlayPending = false
    @State private var tab: ShellTab = .home
    /// 睡眠专辑放着时音乐页把按钮藏起来了，底栏一起藏（RN musicAutoHideChrome）
    @State private var musicChromeHidden = false
    /// 首页闲置后连底栏一起淡出（Josh 2026-09-18：首页要全景，不要底色和文字压着）
    @State private var homeChromeHidden = false
    /// iPhone 首页正横着：观影模式，底栏、状态栏、Home 条都收起
    @State private var homeLandscape = false
    @State private var readSize: ReadSize = .default
    @State private var openedBook: BookRef?
    @State private var pickerStartInBooks = false
    @State private var openedChapter: (book: BookRef, chapter: Int)?
    @State private var showTranslationPanel = false
    /// 在线译本的书卷名取到后 +1，目录页 / 章页据此重画
    @State private var bookNamesRevision = 0
    @State private var xrefVerse: Int?
    /// 经文搜索 / 收藏页：盖在读经 Tab 当前内容之上，关掉就回到原来的页
    @State private var showSearch = false
    @State private var searchRef: SearchChapterRef?
    @State private var showFavorites = false
    /// 从搜索 / 收藏跳进章页要定位的节
    @State private var focusVerse: Int?
    /// 从搜索跳进章页时的关键词（章页只标它，不铺整节框）
    @State private var focusKeyword: String?
    /// 长按弹出操作单的那节；收藏 / 复制后的轻提示
    @State private var actionVerse: LoadedVerse?
    /// 划重点：开关 + 当前颜色 + 擦除态
    @StateObject private var highlights = VerseHighlightStore()
    /// 成就 / XP（DECISIONS「成就系统」「XP 要一直在涨」）
    @StateObject private var achievements = AchievementStore()
    @State private var showAchievements = false
    /// 听读每 15 秒记一次 XP 用的上一次落点
    @State private var lastListenTickAt: Double = -1
    @State private var highlighting = false
    @State private var highlightColor = VerseHighlightRules.defaultColor
    @State private var erasing = false
    @State private var toast: String?
    @State private var toastTask: Task<Void, Never>?
    @State private var showSleepSheet = false
    /// 睡眠定时四路（读经 / 音乐 / 金句 / 环境音）同一份分钟数；0 = 未设
    @State private var sleepTimerMinutes = 0

    /// 音源目标：章页开着就是那一章；否则是播放页在听的章
    private var audioTarget: (book: BookRef, chapter: Int)? { openedChapter ?? listenChapter }

    /// 当前章的可播音源；译本不支持时为 nil，播放键置灰
    private var audioURL: URL? {
        guard let opened = audioTarget else { return nil }
        return ChapterAudioSource.resolve(
            translationId: store.translation.id,
            bookId: opened.book.id,
            bookNumber: opened.book.number,
            bookName: opened.book.name,
            chapter: opened.chapter
        )
    }

    /// 直接向 AVPlayer 装载并按需起播目标章——严禁依赖前台 SwiftUI `.onChange(of: audioURL)`：
    /// 锁屏切入 `.background` 后 SwiftUI 停止刷新 `body` 与 `onChange`，只有命令式直调才能在锁屏下顺畅连播下一章。
    private func loadChapterAudioNow(book: BookRef, chapter: Int, autoPlay: Bool) {
        let tr = store.translation
        guard let url = ChapterAudioSource.resolve(
            translationId: tr.id,
            bookId: book.id,
            bookNumber: book.number,
            bookName: book.name,
            chapter: chapter
        ) else { return }
        let key = "\(tr.id).\(book.id).\(chapter)"
        let title = ReadChrome.chapterTitle(bookName: bookLabel(book), chapter: chapter, locale: titleLocale)
        if ChapterAudioSource.isResolverURL(url) {
            let tid = tr.id, bookId = book.id
            audio.beginResolving(key: key, title: title, autoPlay: autoPlay)
            Task { @MainActor in
                if let src = await ChapterAudioSource.fetchResolved(url, cacheKey: key) {
                    audio.load(url: src, key: key, title: title, translationId: tid, bookId: bookId, chapter: chapter, resolved: true, autoPlay: autoPlay)
                } else {
                    audio.failResolving(key: key)
                }
            }
        } else {
            audio.load(url: url, key: key, title: title, translationId: tr.id, bookId: book.id, chapter: chapter, autoPlay: autoPlay)
        }
    }

    private func skipToNextChapter() {
        if planFlowActive {
            if let cur = audioTarget {
                plans.markChapterRead(cur.book.id, cur.chapter)
                achievements.noteChapterRead(bookId: cur.book.id, chapter: cur.chapter)
                if achievements.foreground { RatePrompt.maybeAsk(chaptersRead: achievements.chaptersReadCount) }
            }
            let next = planQueueIndex + 1
            if next < planQueue.count {
                planQueueIndex = next
                // 在播放页听（章页没开）→ 只换音源不开章页；在章页 → 顺到下一章页
                if planFlowHost == .listen, openedChapter == nil { listenPlanChapter(planQueue[next], autoPlay: true) }
                else { openPlanChapter(planQueue[next], autoPlay: true) }
            } else {
                planFlowActive = false
            }
            return
        }
        guard let opened = audioTarget else { return }
        let count = store.chapterCount(translationId: store.translation.id, bookId: opened.book.id)
        let limit = count > 0 ? count : opened.book.chapterCount
        // 本书循环：读到末章回本书第 1 章；继续往前：到末章就停
        let nextChapter: Int
        if opened.chapter < limit { nextChapter = opened.chapter + 1 }
        else if audio.loopMode == .book { nextChapter = 1 }
        else { return }
        if nextChapter == opened.chapter {
            // 单章书循环：音源没变，onChange 不会触发，直接回开头续播
            audio.seek(to: 0); audio.resume()
        } else {
            autoPlayPending = false
            if openedChapter != nil {
                openedChapter = (opened.book, nextChapter)
            } else {
                listenChapter = (opened.book, nextChapter)
            }
            loadChapterAudioNow(book: opened.book, chapter: nextChapter, autoPlay: true)
        }
    }

    /// 睡眠定时：首页定时角标与音乐页睡眠单同一份分钟数，四路播放器一起设（0 = 关）
    private func setSleepTimerAll(_ minutes: Int) {
        sleepTimerMinutes = minutes
        let m: Int? = minutes > 0 ? minutes : nil
        audio.setSleepTimer(minutes: m)
        music.setSleepTimer(minutes: m)
        home.setSleepTimer(minutes: m)
        ambient.setSleepTimer(minutes: m)
        devotional.setSleepTimer(minutes: m)
    }

    /// 双击 / 操作单收藏：新加时顺手复制（RN「已收藏，经文已复制」）
    private func toggleBookmark(_ v: LoadedVerse, in opened: (book: BookRef, chapter: Int)) {
        let added = bookmarks.toggle(bookId: opened.book.id, bookName: opened.book.name(displayLocale), chapter: opened.chapter, verse: v.number,
                                     translationId: store.translation.id, text: v.text)
        if added { UIPasteboard.general.string = VerseShareText.clipboard(bookName: opened.book.name(displayLocale), chapter: opened.chapter, verse: v.number, text: v.text) }
        UINotificationFeedbackGenerator().notificationOccurred(added ? .success : .warning)
        showToast(SiteCopy.t(added ? "pages.read.verseBookmarkSaved" : "pages.read.verseBookmarkRemoved", appLocale))
    }

    private func copyVerse(_ v: LoadedVerse, in opened: (book: BookRef, chapter: Int)) {
        UIPasteboard.general.string = VerseShareText.clipboard(bookName: opened.book.name(displayLocale), chapter: opened.chapter, verse: v.number, text: v.text)
        showToast(SiteCopy.t("pages.read.verseCopied", appLocale))
    }

    /// 当前章的划重点：节号 → （节内字符下标 → 颜色）
    private func chapterHighlights(_ opened: (book: BookRef, chapter: Int)) -> [Int: [Int: String]] {
        var out: [Int: [Int: String]] = [:]
        let prefix = "\(store.translation.id):\(opened.book.id):\(opened.chapter):"
        for (key, byIndex) in highlights.store where key.hasPrefix(prefix) {
            if let verse = Int(key.dropFirst(prefix.count)), !byIndex.isEmpty { out[verse] = byIndex }
        }
        return out
    }

    private func shareVerse(_ v: LoadedVerse, in opened: (book: BookRef, chapter: Int)) {
        let ref = "\(opened.book.name(displayLocale)) \(opened.chapter):\(v.number)"
        shareCardPayload = VerseSharePayload(
            reference: ref,
            translationName: store.translation.label(appLocale),
            text: v.text.trimmingCharacters(in: .whitespacesAndNewlines)
        )
    }

    private func openVerseByKey(_ rawKey: String, fromHome: Bool = false) {
        guard let loc = GoldenVerseAudioSource.parseVerseKey(rawKey),
              let b = BibleCatalog.book(id: loc.bookId) else { return }
        planFlowActive = false
        listenChapter = nil
        chapterFromPlan = false
        chapterFromHome = fromHome
        xrefReturnOrigin = nil
        openedBook = nil
        showSearch = false
        showFavorites = false
        searchReturnQuery = nil
        focusKeyword = nil
        focusVerse = loc.verse
        openedChapter = (b, loc.chapter)
        tab = .read
    }

    /// 轻提示：进 160ms · 停 1400ms · 出 220ms（RN ReadVerseBookmarkFeedback）
    private func showToast(_ message: String) {
        toastTask?.cancel()
        withAnimation(.easeOut(duration: 0.16)) { toast = message }
        toastTask = Task {
            try? await Task.sleep(nanoseconds: 1_560_000_000)
            if Task.isCancelled { return }
            await MainActor.run { withAnimation(.easeIn(duration: 0.22)) { toast = nil } }
        }
    }

    /// 中央键：切到读经计划 Tab（主页级页面，底栏照常；Josh「中间计划与旁边的圣经，要直接就切换过来」）
    private func openToday() {
        tab = .plan
        planFlowHost = .listen
    }

    private func openPlanChapter(_ p: PlanPointer, autoPlay: Bool) {
        guard let b = BibleCatalog.book(id: p.bookId) else { return }
        focusVerse = nil; focusKeyword = nil
        autoPlayPending = false
        listenChapter = (b, p.chapter)
        searchReturnQuery = nil; openedChapter = (b, p.chapter)
        loadChapterAudioNow(book: b, chapter: p.chapter, autoPlay: autoPlay)
    }

    /// 播放页点播：不开章页，只把音源换到这一章（同章已载入就直接续播）
    private func listenPlanChapter(_ p: PlanPointer, autoPlay: Bool) {
        guard let b = BibleCatalog.book(id: p.bookId) else { return }
        if let t = audioTarget, t.book.id == b.id, t.chapter == p.chapter {
            loadChapterAudioNow(book: b, chapter: p.chapter, autoPlay: autoPlay)
            return
        }
        autoPlayPending = false
        listenChapter = (b, p.chapter)
        loadChapterAudioNow(book: b, chapter: p.chapter, autoPlay: autoPlay)
    }

    // MARK: 播放页（RN ReadPlanPlayScreen：本页队列 vs 全局播放池，谁在播就跟谁的游标）

    private var planContentAhead: Int { PlanPlay.contentAhead(view: planViewAhead, committed: plans.prefs.ahead) }
    /// 播放页正在看的那天的逐章队列
    private var planPageQueue: [PlanPointer] { plans.readings(atContentAhead: planContentAhead).flatMap { $0.chapters } }
    /// 池在播的就是本页队列 → 高亮跟池的下标
    private var planPoolMatchesView: Bool { planFlowActive && !planQueue.isEmpty && planQueue == planPageQueue }
    private var planActiveIndex: Int { planPoolMatchesView ? planQueueIndex : planCursor }
    private var planActivePlaying: Bool {
        guard planPoolMatchesView, audio.isPlaying, let t = audioTarget, planQueue.indices.contains(planQueueIndex) else { return false }
        return planQueue[planQueueIndex] == PlanPointer(bookId: t.book.id, chapter: t.chapter)
    }
    /// 读经 Tab 的坞：章页照常；目录页只在播放中才出（RN 非章页只在播放中才出坞，计划页点播后切到圣经页也能控制）
    /// 播放页当前高亮那章有没有整章音源（UST 等无音源译本：播放键置灰，与章页一致；RN 朗读永远跟随正文译本、不跨译本回退）
    private var planActiveAudioAvailable: Bool {
        let q = planPageQueue
        guard q.indices.contains(planActiveIndex), let b = BibleCatalog.book(id: q[planActiveIndex].bookId) else { return false }
        return ChapterAudioSource.resolve(translationId: store.translation.id, bookId: b.id, bookNumber: b.number, bookName: b.name, chapter: q[planActiveIndex].chapter) != nil
    }
    private var readDockActive: Bool {
        guard tab == .read, !(showSearch || showFavorites) || audio.isPlaying else { return false }
        return openedChapter != nil || (audio.isPlaying && audioTarget != nil)
    }
    /// 计划播放页坞上的标题：当前队列项的「卷名 章」
    private var planDockTitle: String {
        let q = planPageQueue
        guard q.indices.contains(planActiveIndex),
              let book = BibleCatalog.book(id: q[planActiveIndex].bookId) else { return "" }
        return "\(book.name(displayLocale)) \(q[planActiveIndex].chapter)"
    }

    private var planDockActive: Bool { tab == .plan && planRoute == .play && !showSearch && !planPageQueue.isEmpty }

    /// 日历上看的那天算「听过」（月历标黄）
    private func markPlanListened() {
        let date = PlanDates.addDays(Date(), planViewAhead)
        plans.markListened(PlanPlay.isoDate(date))
        planListeningDate = PlanDates.localDateString(date)
    }

    /// 行点播 / 行尾「声音」：建池（或复用）从第 index 章起播
    private func planPlay(at index: Int) {
        let q = planPageQueue
        guard q.indices.contains(index) else { return }
        markPlanListened()
        planFlowHost = .listen
        if !planPoolMatchesView { planQueue = q; planFlowActive = true }
        planQueueIndex = index
        planCursor = index
        listenPlanChapter(q[index], autoPlay: true)
    }

    /// 行尾「阅读」/ 双击：进这一章的阅读页；正在播的那章不停播；返回回计划 Tab
    private func planRead(at index: Int) {
        let q = planPageQueue
        guard q.indices.contains(index), let b = BibleCatalog.book(id: q[index].bookId) else { return }
        chapterFromPlan = true
        planFlowHost = .chapter
        focusVerse = nil; focusKeyword = nil
        if !(planPoolMatchesView && index == planQueueIndex) { planFlowActive = false; listenChapter = nil }
        searchReturnQuery = nil; openedChapter = (b, q[index].chapter)
        tab = .read
    }

    /// 坞的播放键：播中就停；池对上本页就续播；否则从选中章起播
    private func planTogglePlay() {
        if audio.isPlaying { audio.pause(); return }
        if planPoolMatchesView, audioTarget != nil { markPlanListened(); audio.resume(); return }
        planPlay(at: planActiveIndex)
    }

    private func planNext() {
        if planFlowActive { skipToNextChapter(); return }
        planCursor = min(max(0, planPageQueue.count - 1), planCursor + 1)
    }

    private func startPlanFlow(_ queue: [PlanPointer], at index: Int) {
        guard queue.indices.contains(index) else { return }
        planQueue = queue
        planQueueIndex = index
        planFlowActive = true
        openPlanChapter(queue[index], autoPlay: true)
    }

    /// 只有首页本身露在最上面时才放开横屏；菜单、登录、引导、音乐页等一律竖屏
    private var homeLandscapeAllowed: Bool {
        tab == .home && !showHomeMusic && !showMenu && authRoute == nil && !showWelcome
            && !showTranslationPanel && shareCardPayload == nil
    }
    private var homeLandscapeActive: Bool { homeLandscapeAllowed && homeLandscape }

    var body: some View {
        content
            .statusBarHidden(homeLandscapeActive)
            .persistentSystemOverlays(homeLandscapeActive ? .hidden : .automatic)
            .onChange(of: homeLandscapeAllowed, initial: true) { _, allow in OrientationGate.allowLandscape(allow) }
            .environmentObject(store)
            .environmentObject(achievements)
            .onOpenURL { url in
                guard url.scheme?.lowercased() == "askbible",
                      let comps = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return }
                OnboardingPrefs.complete()
                showWelcome = false
                homeChromeHidden = false
                if url.host?.lowercased() == "verse",
                   let key = comps.queryItems?.first(where: { $0.name == "key" })?.value {
                    openVerseByKey(key, fromHome: false)
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: NSLocale.currentLocaleDidChangeNotification)) { _ in
                deviceLocale = .device
                if localeOverride == nil { AppLocale.current = deviceLocale }
            }
            .onChange(of: localeOverride) { _, _ in sync.localeTag = { [appLocale] in appLocale.rawValue } }
            .onChange(of: store.translation.id) { _, _ in
                // 换到在线译本：把它自己的书卷名取回来（盘里有就只读盘）
                Task {
                    if await RemoteBookNames.ensure(store.translation) { bookNamesRevision += 1 }
                    home.setSource(store.translation)
                }
                home.setSource(store.translation)
            }
            .onChange(of: audioURL) { _, _ in
                guard let opened = audioTarget else { return }
                let shouldStart = autoPlayPending
                autoPlayPending = false
                loadChapterAudioNow(book: opened.book, chapter: opened.chapter, autoPlay: shouldStart)
            }
            // 整章朗读时环境音压半音量继续放，停了恢复
            .onChange(of: audio.isPlaying) { _, playing in ambient.setDucked(playing || devotional.isPlaying) }
            .onChange(of: devotional.isPlaying) { _, playing in ambient.setDucked(playing || audio.isPlaying) }
            .task(id: "\(appLocale.rawValue).\(auth.user?.id ?? "").\(auth.isAdmin)") {
                await auth.refreshAdminFlag()
                if SolidJoys.available(locale: appLocale, isAdmin: auth.isAdmin) { await devotionals.load(locale: appLocale) }
            }
            .task {
                // 防封换线：先挑线路，后面的登录校验 / 同步 / 自动升级与离线包热更才不会打到已经不通的域
                await Endpoints.refresh()
                await auth.verifyRemote()
                await sync.flushNow(reason: "foreground")
                _ = await updateChecker.check(force: false)
                _ = await PackStore.refreshInstalledPacksIfNeeded(force: false)
            }
            .onChange(of: scenePhase) { _, phase in
                // 听读 XP 只在前台给（A 方案防刷：后台放整夜不算）
                achievements.foreground = phase == .active
                if phase == .active {
                    audio.recoverAfterInterruption(); music.recoverAfterInterruption()
                    activity.noteForeground(); activity.touchHabitDay(); naturePrefs.rotateIfNewDay()
                    Task {
                        await Endpoints.refresh()
                        await sync.flushNow(reason: "foreground")
                        _ = await updateChecker.check(force: false)
                        _ = await PackStore.refreshInstalledPacksIfNeeded(force: false)
                    }
                } else {
                    music.saveResume()
                    activity.noteBackground()
                }
            }
            .onChange(of: auth.user?.id) { old, new in
                // 刚登录：立即拉云端进度（RN syncMemberReadingAfterLogin）
                if old != nil, old != new { sync.resetForAccountChange() }
                if new != nil, old != new { Task { await sync.flushNow(reason: "login") } }
            }
            .onChange(of: plans.listenedDates) { _, dates in activity.mergeRemoteHabit(Array(dates)) }
            .onReceive(usageTicker) { _ in
                guard scenePhase == .active else { return }
                activity.flushUsageTick(); activity.touchHabitDay()
                usageTicks += 1
                if usageTicks % 3 == 0 { sync.schedule(reason: "poll") }
            }
            .onAppear {
                Task { await store.refreshRemoteCatalog() }
                home.setSource(store.translation)
                achievements.attach(activity: activity, plans: plans, bookmarks: bookmarks, highlights: highlights)
                sync.attach(auth: auth, plans: plans, bookmarks: bookmarks, activity: activity,
                            search: searchPrefs, highlights: highlights, achievements: achievements)
                sync.localeTag = { [appLocale] in appLocale.rawValue }
                activity.noteForeground(); activity.touchHabitDay()
                activity.mergeRemoteHabit(Array(plans.listenedDates))
                audio.onProgress = { [weak activity, weak achievements] t, playing in
                    activity?.noteListenProgress(positionSec: t, isPlaying: playing)
                    // 每 listenTickSeconds 给一次 XP：读经的时候进度条肉眼在动
                    guard playing, t.isFinite, t >= 0 else { lastListenTickAt = -1; return }
                    if lastListenTickAt < 0 { lastListenTickAt = t; return }
                    if t - lastListenTickAt >= MedalXP.listenTickSeconds {
                        lastListenTickAt = t
                        // 每章封顶在 store 里判（A 方案防刷）；音源跟着 audioTarget 走
                        if let target = audioTarget {
                            achievements?.noteListenTick(bookId: target.book.id, chapter: target.chapter)
                        }
                    }
                    if t < lastListenTickAt { lastListenTickAt = t }   // 拖回去了重新起算
                }
                audio.onSkipNext = skipToNextChapter
                audio.onFinished = {
                    let handoff = PlanDevotionalHandoff.shouldPlay(naturalEnd: true, active: planFlowActive,
                        count: planQueue.count, index: planQueueIndex, listeningDay: planListeningDate,
                        today: PlanDates.localDateString(Date()),
                        enabled: (UserDefaults.standard.object(forKey: "devotional.after-reading") as? Bool) ?? true,
                        available: SolidJoys.available(locale: appLocale, isAdmin: auth.isAdmin))
                    skipToNextChapter()
                    if handoff, let day = devotionals.day(Date()) {
                        devotional.play(day)
                    }
                }
                devotional.onWillPlay = { audio.pause(); home.stopVoice(); music.setDucked(true) }
                devotional.onStopped = { music.setDucked(audio.isPlaying) }
                // 互斥：整章朗读 ↔ 音乐（RN shell 单一 playbackMode）；整章朗读 ↔ 金句（都是人声）。
                // 首页最多两路同时出声（RN homeGoldenVerseTwoSourceMutex）：
                // 开音乐 / 开金句时另外两路都在 → 关环境音；开环境音时人声与音乐都在 → 停音乐。
                // 读经朗读与音乐可以同时放：音乐压到 30%，不再直接暂停（Josh 2026-09-11）；金句人声仍然互斥
                audio.onWillPlay = { [weak music, weak home] in devotional.stop(); music?.setDucked(true); home?.stopVoice() }
                audio.onStopped = { [weak music] in music?.setDucked(false) }
                music.onWillPlay = { [weak audio, weak home, weak ambient] in
                    // 音乐起播时朗读在放 → 保持两路，音乐压低
                    music.setDucked((audio?.isPlaying ?? false) || devotional.isPlaying)
                    if home?.voiceOn == true, ambient?.isOn == true { ambient?.stop() }
                }
                home.player.onWillPlay = { [weak audio, weak music, weak ambient] in
                    audio?.pause(); devotional.stop()
                    if music?.isPlaying == true, ambient?.isOn == true { ambient?.stop() }
                }
                ambient.onWillPlay = { [weak audio, weak home, weak music] in
                    let voice = (home?.voiceOn ?? false) || (audio?.isPlaying ?? false) || devotional.isPlaying
                    if voice, music?.isPlaying == true { music?.pause() }
                }
                music.restorePlaybackIfNeeded()
                AppPackStore.shared.startPeriodicChecks()
            }
    }

    private var displayLocale: AppLocale { ReadDisplayLocale.resolve(appLocale: appLocale, translationLanguage: store.translation.language) }

    /// 书卷名：在线译本（目录接口来的那些）用它自己那套，正文是西语、书名也该是 Génesis；其余用目录里的中英名。
    /// 读 bookNamesRevision 只是为了让取到名字后这些视图重画
    /// 我们自己写的读经面文字（章标题、目录分类）只有中英两套：
    /// 法语这类没有对应语言的译本回退英文，别在法语圣经上写「第1章」「摩西五经」
    private var titleLocale: AppLocale {
        ReadDisplayLocale.chrome(appLocale: appLocale, translationLanguage: store.translation.language)
    }

    private func bookLabel(_ book: BookRef) -> String {
        _ = bookNamesRevision
        return RemoteBookNames.name(store.translation, bookId: book.id) ?? book.name(displayLocale)
    }

    private var content: some View {
        let devotionalDockActive = ((tab == .plan && planRoute == .play) || tab == .read)
            && !showSearch && !showFavorites
            && devotional.currentKey.flatMap({ devotionals.days[$0] }) != nil
        return ZStack {
            AskTabShell(
                selection: $tab,
                locale: appLocale,
                dockActive: readDockActive || planDockActive || devotionalDockActive,
                showTabBar: !(tab == .plan && planRoute != .play && !showSearch) && authRoute == nil && !(tab == .music && musicChromeHidden) && !homeLandscapeActive,
                homeBarHidden: tab == .home && homeChromeHidden,
                onWakeHomeChrome: { withAnimation(.easeInOut(duration: 0.3)) { homeChromeHidden = false } },
                onEnterPlan: openToday,
                onReselectRead: {
                    if showSearch || showFavorites {
                        showSearch = false
                        showFavorites = false
                    } else if let opened = openedChapter {
                        pickerStartInBooks = true
                        openedBook = opened.book
                    }
                }
            ) { which in
                screen(for: which)
            } dock: {
                // 搜索 / 收藏页盖在上面时藏坞（RN 非章页只在播放中才出坞）
                if devotionalDockActive, let key = devotional.currentKey, let day = devotionals.days[key] {
                    DevotionalDock(
                        day: day,
                        player: devotional,
                        locale: appLocale,
                        onOpen: {
                            planRoute = .devotional(SolidJoys.dateForKey(key))
                            tab = .plan
                        }
                    )
                } else if readDockActive {
                    PlaybackDock(
                        audio: audio,
                        available: audioURL != nil,
                        onSearch: {
                            if let o = openedChapter { searchRef = SearchChapterRef(bookId: o.book.id, chapter: o.chapter) }
                            showSearch = true
                        },
                        onSkipNext: skipToNextChapter
                    )
                } else if planDockActive {
                    PlaybackDock(
                        audio: audio,
                        available: planActiveAudioAvailable,
                        onSearch: {
                            let q = planPageQueue
                            searchRef = q.indices.contains(planActiveIndex) ? SearchChapterRef(bookId: q[planActiveIndex].bookId, chapter: q[planActiveIndex].chapter) : nil
                            showSearch = true
                        },
                        onSkipNext: planNext,
                        onToggle: planTogglePlay
                    )
                }
            }
            if let book = openedBook {
                ChapterPickerSheet(
                    book: book,
                    chapterCount: store.chapterCount(
                        translationId: store.translation.id, bookId: book.id),
                    currentChapter: openedChapter?.book.id == book.id ? openedChapter?.chapter : nil,
                    initialShowBooks: pickerStartInBooks,
                    chapterCountForBook: { b in
                        store.chapterCount(translationId: store.translation.id, bookId: b.id)
                    },
                    onPick: { chapter in
                        xrefReturnOrigin = nil
                        openedChapter = (book, chapter)
                        pickerStartInBooks = false
                        openedBook = nil
                    },
                    onPickBookChapter: { pickedBook, chapter in
                        xrefReturnOrigin = nil
                        planFlowActive = false
                        listenChapter = nil
                        chapterFromPlan = false
                        chapterFromHome = false
                        openedChapter = (pickedBook, chapter)
                        pickerStartInBooks = false
                        openedBook = nil
                    },
                    onClose: {
                        pickerStartInBooks = false
                        openedBook = nil
                    },
                    locale: titleLocale,
                    bookLabel: bookLabel
                )
                .zIndex(21)
            }

            if showTranslationPanel {
                // 界面文案目前只有中文：面板里的译本名与分组名按中文界面走（系统英文时不混一行英文），繁体系统给繁体
                TranslationPanel(locale: appLocale, onClose: { showTranslationPanel = false })
                    .zIndex(22)
            }

            if let v = xrefVerse, let opened = openedChapter {
                VerseXrefSheet(
                    bookName: opened.book.name(displayLocale),
                    chapter: opened.chapter,
                    xrefs: store.verseXrefs(bookId: opened.book.id, chapter: opened.chapter, verse: v),
                    size: readSize,
                    snippet: { ref in
                        store.verseText(translationId: store.translation.id,
                                        bookId: ref.bookId, chapter: ref.chapter, verse: ref.verseStart)
                    },
                    onOpen: { ref in
                        xrefVerse = nil
                        if let b = BibleCatalog.book(id: ref.bookId) {
                            xrefReturnOrigin = (opened.book, opened.chapter, v)
                            focusKeyword = nil
                            focusVerse = ref.verseStart
                            openedChapter = (b, ref.chapter)
                        }
                    },
                    onClose: { xrefVerse = nil },
                    locale: displayLocale
                )
                .zIndex(22)
            }

            if let payload = shareCardPayload {
                VerseShareCardSheet(
                    payload: payload,
                    locale: appLocale,
                    onCopied: { showToast(SiteCopy.t("pages.read.verseCopied", appLocale)) },
                    onClose: { shareCardPayload = nil }
                )
                .zIndex(28)
            }

            if let v = actionVerse, let opened = openedChapter {
                VerseActionSheet(
                    verse: v.number,
                    bookmarked: bookmarks.isBookmarked(translationId: store.translation.id, bookId: opened.book.id, chapter: opened.chapter, verse: v.number),
                    size: readSize,
                    onCopy: { copyVerse(v, in: opened); actionVerse = nil },
                    onBookmark: { toggleBookmark(v, in: opened); actionVerse = nil },
                    onShare: { shareVerse(v, in: opened); actionVerse = nil },
                    onHighlight: { highlighting = true; erasing = false; actionVerse = nil },
                    onClose: { actionVerse = nil }
                )
            }
            if let route = authRoute {
                switch route {
                case .login:
                    LoginView(auth: auth, locale: appLocale, onBack: { authRoute = nil }, onRegister: { authRoute = .register }, onDone: { authRoute = nil }).edgeSwipeBack { authRoute = nil }
                case .register:
                    RegisterView(auth: auth, locale: appLocale, onBack: { authRoute = nil }, onLogin: { authRoute = .login }, onDone: { authRoute = nil }).edgeSwipeBack { authRoute = nil }
                }
            }

            if showMenu {
                NavDrawerView(
                    locale: appLocale,
                    localeOverride: localeOverride,
                    userName: auth.user.map { MemberAuthRules.shortAccountName($0.name.isEmpty ? $0.email : $0.name) },
                    translationLabel: store.translation.label(appLocale),
                    syncDetail: auth.user == nil ? nil : syncDetailText,
                    onSetLocale: { applyLocaleChoice($0) },
                    onOpenTranslations: { showMenu = false; showTranslationPanel = true },
                    onLogin: { showMenu = false; authRoute = .login },
                    onRegister: { showMenu = false; authRoute = .register },
                    onLogout: { showMenu = false; Task { if await sync.prepareSignOut() { auth.signOut() } } },
                    onFeedback: { showMenu = false; openSupportMail() },
                    onOpenMusic: { showMenu = false; showHomeMusic = true; homeChromeHidden = false; tab = .home },
                    reminderEnabled: reminder.enabled,
                    reminderTime: reminder.timeLabel,
                    onToggleReminder: {
                        Task {
                            await reminder.apply(enabled: !reminder.enabled, hour: reminder.hour,
                                                 minute: reminder.minute, locale: appLocale)
                            if reminder.denied { showToast(SiteCopy.t("native.reminderDenied", appLocale)) }
                        }
                    },
                    onPickReminderTime: { showMenu = false; showReminderTime = true },
                    updateDetail: checkingUpdates ? SiteCopy.t("native.updateChecking", appLocale) : updateStatusDetail,
                    onCheckUpdates: { checkUpdatesManually() },
                    onDeleteAccount: { showMenu = false; confirmDeleteAccount = true },
                    onClose: { showMenu = false })
                .zIndex(20)
            }

            if highlighting, openedChapter != nil {
                HighlightBar(locale: appLocale, color: $highlightColor, erasing: $erasing,
                             onDone: { highlighting = false; erasing = false })
                .zIndex(23)
            }

            if showReminderTime {
                TimePickerSheet(
                    title: SiteCopy.t("native.reminderTitle", appLocale),
                    hour: reminder.hour, minute: reminder.minute,
                    doneTitle: SiteCopy.t("native.done", appLocale),
                    onDone: { h, m in
                        showReminderTime = false
                        Task {
                            await reminder.apply(enabled: true, hour: h, minute: m, locale: appLocale)
                            if reminder.denied { showToast(SiteCopy.t("native.reminderDenied", appLocale)) }
                        }
                    },
                    onCancel: { showReminderTime = false })
                .zIndex(24)
            }

            if confirmDeleteAccount {
                // 不可逆操作走确认单（RN confirmDeleteAccount 的 Alert）
                ConfirmSheet(
                    title: SiteCopy.t("native.deleteAccount", appLocale),
                    message: SiteCopy.t("native.deleteAccountConfirm", appLocale),
                    confirmTitle: SiteCopy.t("native.deleteAccount", appLocale),
                    cancelTitle: SiteCopy.t("native.cancel", appLocale),
                    onConfirm: {
                        confirmDeleteAccount = false
                        Task {
                            sync.cancelPendingWork()
                            if let err = await auth.deleteAccount() {
                                showToast(SiteCopy.localizeKnown(err, appLocale))
                            } else {
                                sync.resetForAccountChange()
                                showToast(SiteCopy.t("native.deleteAccountDone", appLocale))
                            }
                        }
                    },
                    onCancel: { confirmDeleteAccount = false })
                .zIndex(25)
            }

            if showWelcome {
                WelcomeView(
                    auth: auth,
                    locale: appLocale,
                    localeOverride: localeOverride,
                    onSetLocale: { applyLocaleChoice($0) },
                    onDone: { OnboardingPrefs.complete(); showWelcome = false })
                .zIndex(30)
            }

            if let toast {
                // RN ReadVerseBookmarkFeedback：底部 108 + 安全区之上（在坞与底栏之上），居中胶囊
                VerseFeedbackToast(message: toast)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                    .padding(.horizontal, 24)
                    .padding(.bottom, 108 + ShellMetrics.tabRowHeight + (readDockActive ? ShellMetrics.dockContentHeight : 0))
            }

            if showSleepSheet {
                SleepTimerSheet(
                    remainingLabel: audio.sleepRemainingLabel ?? music.sleepRemainingLabel,
                    onPick: { m in setSleepTimerAll(m ?? 0) },
                    onClose: { showSleepSheet = false })
            }

            // 版本对照：有新版就弹羊皮卡片（放顶层，对齐安卓 UpdateGate.kt）
            AppUpdateGate(checker: updateChecker, locale: appLocale)
                .onAppear { RatePrompt.noteLaunch() }
                .zIndex(28)
        }
        // +XP 飘字：读 / 听的时候几秒跳一次（Josh 2026-09-18「要感觉到 XP 一直在增加」）
        .overlay(alignment: .top) {
            XPFloater().environmentObject(achievements).padding(.top, 90)
        }
        .onChange(of: tab, initial: true) { _, t in achievements.quiet = t == .home }
        // 勋章 / 印章 / 升级的获得提示。首页一律不弹（首页静默，Josh 2026-10-02「保持首页不打扰」）——
        // 事件留在 ach.pending 里不消费，离开首页后照常补上；+XP 飘字在首页直接不进队列（AchievementStore.quiet）
        .overlay(alignment: .top) {
            if tab != .home {
                EarnedToast().environmentObject(achievements).padding(.top, 8).padding(.horizontal, 16)
            }
        }
    }

    /// 手动「检查更新」：强制探测客户端新版本与离线内容包 SHA-256 热更（忽略 6 小时冷却与已跳过标记）。
    private func checkUpdatesManually() {
        guard !checkingUpdates else { return }
        let ver = NavDrawerView.versionLabel
        checkingUpdates = true
        updateStatusDetail = "\(ver) · \(SiteCopy.t("native.updateChecking", appLocale))"
        Task {
            await Endpoints.refresh()
            async let appCheck = updateChecker.check(force: true)
            async let packCheck = PackStore.refreshInstalledPacksIfNeeded(force: true)
            let (appOutcome, packOutcome) = await (appCheck, packCheck)
            let checkedAt = NavDrawerView.formatTimestamp()
            checkingUpdates = false
            switch appOutcome {
            case .updateAvailable(let nextVer):
                updateStatusDetail = "\(SiteCopy.f("native.updateTitle", ["version": nextVer], appLocale)) · \(checkedAt)"
                showMenu = false
            case .upToDate, .throttled:
                if packOutcome.updatedCount > 0 {
                    let appliedText = SiteCopy.f("native.updatePacksApplied", ["count": "\(packOutcome.updatedCount)"], appLocale)
                    updateStatusDetail = "\(ver) · \(appliedText) · \(checkedAt)"
                    showToast("\(appliedText)（\(ver) · \(checkedAt)）")
                } else {
                    let latestText = SiteCopy.t("native.updateUpToDate", appLocale)
                    updateStatusDetail = "\(ver) · \(latestText) · \(checkedAt)"
                    showToast(SiteCopy.f("native.updateUpToDateToast", ["version": "\(ver) · \(checkedAt)"], appLocale))
                }
            case .networkFailed:
                if packOutcome.catalogReachable {
                    if packOutcome.updatedCount > 0 {
                        let appliedText = SiteCopy.f("native.updatePacksApplied", ["count": "\(packOutcome.updatedCount)"], appLocale)
                        updateStatusDetail = "\(ver) · \(appliedText) · \(checkedAt)"
                        showToast("\(appliedText)（\(ver) · \(checkedAt)）")
                    } else {
                        let latestText = SiteCopy.t("native.updateUpToDate", appLocale)
                        updateStatusDetail = "\(ver) · \(latestText) · \(checkedAt)"
                        showToast(SiteCopy.f("native.updateUpToDateToast", ["version": "\(ver) · \(checkedAt)"], appLocale))
                    }
                } else {
                    let failText = SiteCopy.t("native.updateCheckFailed", appLocale)
                    updateStatusDetail = "\(ver) · \(failText) · \(checkedAt)"
                    showToast(failText)
                }
            }
        }
    }

    @ViewBuilder
    private func screen(for which: ShellTab) -> some View {
        switch which {
        case .panorama:
            BiblePanoramaView(locale: appLocale, currentBook: openedChapter?.book.id, currentChapter: openedChapter?.chapter ?? 1, locateRequest: panoramaLocate, onResume: { tab = .read }, onRead: { bookId, chapter in
                guard let b = BibleCatalog.book(id: bookId) else { return }
                planFlowActive = false; listenChapter = nil; chapterFromPlan = false; openedBook = nil
                showSearch = false; showFavorites = false; focusVerse = nil; focusKeyword = nil; searchReturnQuery = nil
                if openedChapter?.book.id != bookId || openedChapter?.chapter != chapter { openedChapter = (b,chapter) }
                tab = .read
            })
        case .home:
            if showHomeMusic {
                MusicView(player: music, sleepActive: audio.sleepDeadline != nil || music.sleepDeadline != nil || home.sleepDeadline != nil || ambient.sleepDeadline != nil, onSleepTimer: { showSleepSheet = true })
                    .overlay(alignment: .topLeading) {
                        Button {
                            showHomeMusic = false; homeChromeHidden = false
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "chevron.left")
                                Text(AppLocale.pick("首页", "Home", appLocale))
                            }
                            .askFont(size: 17, weight: .semibold)
                            .foregroundStyle(.white).shellIconShadow()
                            .frame(width: 120, height: 56, alignment: .leading)
                            .padding(.leading, 16)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain).padding(.top, 12)
                        .accessibilityIdentifier("home.music.back")
                    }
            } else {
            HomeView(
                home: home, music: music, ambient: ambient, prefs: naturePrefs,
                sleepTimerMinutes: sleepTimerMinutes,
                // 环境音关闭时换景保持静音；用户开启后才跟随场景。
                onSelectScene: { id in
                    guard id != naturePrefs.sceneId else { return }
                    naturePrefs.bumpUsage(id)
                    naturePrefs.selectScene(id)
                    if ambient.isOn, let slot = NatureScenes.scene(id: id)?.defaultAmbient { ambient.start(slotId: slot) }
                },
                onToggleAmbient: { id in ambient.slotId == id ? ambient.stop() : ambient.start(slotId: id) },
                onCycleSleepTimer: { setSleepTimerAll(NatureScenes.cycleSleepTimer(sleepTimerMinutes)) },
                // 点已在放的专辑 → 停；点另一张 → 切过去起播（homeNatureAlbumPress）
                onPressAlbum: { album in
                    if music.isPlaying, music.track?.album == album {
                        music.pause()
                    } else {
                        let wasPlaying = music.isPlaying
                        music.selectAlbum(album)
                        if !wasPlaying { music.toggle() }
                    }
                },
                onOpenMenu: { showMenu = true },
                onOpenMusic: { homeChromeHidden = false; showHomeMusic = true },
                onOpenVerseContext: { openVerseByKey(home.verseKey, fromHome: true) },
                onBookmarkVerse: {
                    if let loc = GoldenVerseAudioSource.parseVerseKey(home.verseKey),
                       let b = BibleCatalog.book(id: loc.bookId) {
                        let added = bookmarks.toggle(
                            bookId: b.id,
                            bookName: b.name(displayLocale),
                            chapter: loc.chapter,
                            verse: loc.verse,
                            translationId: store.translation.id,
                            text: home.verse.text
                        )
                        if added {
                            UIPasteboard.general.string = "\(home.verse.reference) \(home.verse.text)"
                        }
                        UINotificationFeedbackGenerator().notificationOccurred(added ? .success : .warning)
                        showToast(SiteCopy.t(added ? "pages.read.verseBookmarkSaved" : "pages.read.verseBookmarkRemoved", appLocale))
                    }
                },
                onChromeHidden: { hidden in withAnimation(.easeInOut(duration: 0.3)) { homeChromeHidden = hidden } },
                onLandscape: { homeLandscape = $0 }
            )
            }
        case .music:
            MusicView(player: music,
                      sleepActive: audio.sleepDeadline != nil || music.sleepDeadline != nil || home.sleepDeadline != nil || ambient.sleepDeadline != nil,
                      onSleepTimer: { showSleepSheet = true },
                      onChromeHidden: { hidden in withAnimation(.easeInOut(duration: 0.3)) { musicChromeHidden = hidden } })
        case .read:
            if showSearch {
                SearchView(prefs: searchPrefs, size: readSize, chapterRef: searchRef, locale: displayLocale,
                           onBack: { showSearch = false },
                           onOpenHit: { hit, keyword in
                               showSearch = false
                               guard let b = BibleCatalog.book(id: hit.bookId) else { return }
                               planFlowActive = false; listenChapter = nil; chapterFromPlan = false; chapterFromHome = false; xrefReturnOrigin = nil; openedBook = nil
                               focusVerse = hit.verse; focusKeyword = keyword.isEmpty ? nil : keyword; searchReturnQuery = keyword.isEmpty ? nil : keyword
                               openedChapter = (b, hit.chapter)
                           })
                .edgeSwipeBack { showSearch = false }
            } else if showFavorites {
                FavoritesView(bookmarks: bookmarks, highlights: highlights, size: readSize, locale: displayLocale,
                              onBack: { showFavorites = false },
                              onOpenVerse: { bookId, ch, vs in
                                  showFavorites = false
                                  guard let b = BibleCatalog.book(id: bookId) else { return }
                                  planFlowActive = false; listenChapter = nil; chapterFromPlan = false; chapterFromHome = false; xrefReturnOrigin = nil; openedBook = nil
                                  focusVerse = vs; focusKeyword = nil
                                  searchReturnQuery = nil; openedChapter = (b, ch)
                              })
                .edgeSwipeBack { showFavorites = false }
            } else if let opened = openedChapter {
                ChapterView(
                    bookId: opened.book.id,
                    bookName: bookLabel(opened.book),
                    locale: displayLocale,
                    uiLocale: appLocale,
                    foreignText: ReadDisplayLocale.isForeign(store.translation.language),
                    bookNumber: opened.book.number,
                    chapter: opened.chapter,
                    size: $readSize,
                    onBack: {
                        highlighting = false
                        xrefReturnOrigin = nil
                        openedChapter = nil
                        if chapterFromHome {
                            chapterFromHome = false
                            tab = .home
                            return
                        }
                        // 从计划页进来的章页：回计划 Tab、不停播（RN 返回上一页仍在放）
                        if chapterFromPlan {
                            chapterFromPlan = false; planFlowHost = .listen; tab = .plan
                            if !planFlowActive { listenChapter = nil }
                        } else {
                            planFlowActive = false; listenChapter = nil
                        }
                        // 从搜索结果进来的：回到搜索页，关键词和结果原样恢复
                        if let q = searchReturnQuery {
                            searchReturnQuery = nil
                            searchPrefs.resumeQuery = q
                            showSearch = true
                        }
                    },
                    onOpenSettings: { showTranslationPanel = true },
                    onOpenPanorama: { panoramaLocate += 1; tab = .panorama },
                    audio: audio,
                    bookmarks: bookmarks,
                    focusVerse: focusVerse,
                    focusKeyword: focusKeyword,
                    onTapVerse: { xrefVerse = $0 },
                    onOpenSearch: { searchRef = SearchChapterRef(bookId: opened.book.id, chapter: opened.chapter); showSearch = true },
                    onOpenFavorites: { showFavorites = true },
                    onDoubleTapVerse: { v in toggleBookmark(v, in: opened) },
                    onLongPressVerse: { v in actionVerse = v },
                    onStartHighlight: { highlighting = true; erasing = false },
                    highlights: chapterHighlights(opened),
                    paintColor: highlighting && !erasing ? highlightColor : nil,
                    eraseMode: highlighting && erasing,
                    onPaint: { verse, range in
                        highlights.paint(translationId: store.translation.id, bookId: opened.book.id,
                                         chapter: opened.chapter, verse: verse, range: range,
                                         color: erasing ? nil : highlightColor)
                    },
                    onInstantPaint: { verse, range, hex in
                        highlights.paint(translationId: store.translation.id, bookId: opened.book.id,
                                         chapter: opened.chapter, verse: verse, range: range, color: hex)
                    },
                    onOpenShareCard: { ref, bodyText in
                        shareCardPayload = VerseSharePayload(
                            reference: ref,
                            translationName: store.translation.label(appLocale),
                            text: bodyText
                        )
                    },
                    onCopiedToast: { showToast(SiteCopy.t("pages.read.verseCopied", appLocale)) },
                    xrefReturnLabel: xrefReturnOrigin.map { "\($0.book.name(displayLocale)) \($0.chapter):\($0.verse)" },
                    onReturnXrefOrigin: {
                        if let orig = xrefReturnOrigin {
                            xrefReturnOrigin = nil
                            focusKeyword = nil
                            focusVerse = orig.verse
                            openedChapter = (orig.book, orig.chapter)
                        }
                    },
                    onOpenChapterPicker: { pickerStartInBooks = false; openedBook = opened.book },
                    onOpenCatalog: { searchReturnQuery = nil; xrefReturnOrigin = nil; chapterFromHome = false; openedChapter = nil; openedBook = nil; planFlowActive = false; listenChapter = nil; chapterFromPlan = false },
                    onNavigate: { id, ch in
                        // 结尾的上一章 / 下一章：手动翻页就退出计划流
                        guard let b = BibleCatalog.book(id: id) else { return }
                        planFlowActive = false; listenChapter = nil; chapterFromPlan = false; chapterFromHome = false; xrefReturnOrigin = nil
                        openedChapter = (b, ch)
                    },
                    onReachedEnd: {
                        achievements.noteChapterRead(bookId: opened.book.id, chapter: opened.chapter)
                        // 读完一章之后才问好评 —— 条件不够时 maybeAsk 自己什么都不做
                        RatePrompt.maybeAsk(chaptersRead: achievements.chaptersReadCount)
                    },
                    onVersesRead: { achievements.noteVersesRead($0) }
                )
                .onChange(of: "\(opened.book.id):\(opened.chapter)", initial: true) { _, _ in
                    // RN writeLastReadPosition + pushReadRecentChapter：最后位置 + 探索页「最近阅读」
                    activity.recordOpened(bookId: opened.book.id, chapter: opened.chapter, bookName: opened.book.name(displayLocale))
                    achievements.noteChapterOpened(bookId: opened.book.id, chapter: opened.chapter)
                }
            } else {
                CatalogView(
                    size: $readSize,
                    locale: titleLocale,
                    translationLabel: store.translation.label(appLocale),
                    lastReadTitle: activity.lastPosition.flatMap { last in
                        BibleCatalog.book(id: last.bookId).map { b in
                            ReadChrome.chapterTitle(bookName: bookLabel(b), chapter: last.chapter, locale: titleLocale)
                        }
                    },
                    bookLabel: bookLabel,
                    onOpenBook: { openedBook = $0 },
                    onOpenSettings: { showTranslationPanel = true },
                    onOpenSearch: { searchRef = nil; showSearch = true },
                    onOpenFavorites: { showFavorites = true },
                    onLastRead: activity.lastPosition.flatMap { last in
                        BibleCatalog.book(id: last.bookId).map { b in
                            {
                                planFlowActive = false; listenChapter = nil; chapterFromPlan = false; chapterFromHome = false; xrefReturnOrigin = nil
                                focusVerse = nil; focusKeyword = nil
                                openedBook = nil
                                searchReturnQuery = nil; openedChapter = (b, last.chapter)
                            }
                        }
                    }
                )
            }
        case .plan:
            if showSearch {
                // 播放页坞的搜索键：搜到的章在读经 Tab 打开，返回回计划页
                SearchView(prefs: searchPrefs, size: readSize, chapterRef: searchRef, locale: displayLocale,
                           onBack: { showSearch = false },
                           onOpenHit: { hit, keyword in
                               showSearch = false
                               guard let b = BibleCatalog.book(id: hit.bookId) else { return }
                               planFlowActive = false; listenChapter = nil; openedBook = nil; xrefReturnOrigin = nil; chapterFromHome = false
                               chapterFromPlan = true; planFlowHost = .chapter
                               focusVerse = hit.verse; focusKeyword = keyword.isEmpty ? nil : keyword; searchReturnQuery = keyword.isEmpty ? nil : keyword
                               openedChapter = (b, hit.chapter)
                               tab = .read
                           })
                .edgeSwipeBack { showSearch = false }
            } else {
                switch planRoute {
                case .play:
                    PlanPlayView(store: plans, devotionals: devotionals, devotionalPlayer: devotional,
                                 showDevotional: SolidJoys.available(locale: appLocale, isAdmin: auth.isAdmin), audio: audio, locale: appLocale, queue: planPageQueue,
                                 activeIndex: planActiveIndex, activePlaying: planActivePlaying,
                                 viewAhead: $planViewAhead, cursor: $planCursor,
                                 onPlayChapter: { planPlay(at: $0) }, onReadChapter: { planRead(at: $0) },
                                 onOpenPlans: { planRoute = .plans },
                                 onOpenDevotional: { planRoute = .devotional($0) },
                                 bookLabel: bookLabel, habitDates: activity.completedDateSet,
                                 onConfirmDay: { plans.setAheadDays(planContentAhead); planViewAhead = 0 },
                                 onStageSet: { planViewAhead = 0; planCursor = 0 })
                case .devotional(let date):
                    DevotionalCatalogView(
                        content: devotionals,
                        player: devotional,
                        initialDate: date,
                        size: readSize,
                        locale: appLocale,
                        onBack: { planRoute = .play },
                        onOpenChapter: { bookId, ch in
                            guard let b = BibleCatalog.book(id: bookId) else { return }
                            planFlowActive = false; listenChapter = nil; openedBook = nil; xrefReturnOrigin = nil; chapterFromHome = false
                            chapterFromPlan = true; planFlowHost = .chapter
                            focusVerse = nil; focusKeyword = nil; searchReturnQuery = nil
                            openedChapter = (b, ch)
                            tab = .read
                        }
                    )
                    .edgeSwipeBack { planRoute = .play }
                case .plans:
                    PlansListView(store: plans, onOpenPlan: { planRoute = .planDetail($0) }, onBack: { planRoute = .play },
                                  onOpenArticle: { slug in exploreArticle = ExploreArticles.article(slug); tab = .explore })
                    .edgeSwipeBack { planRoute = .play }
                case .planDetail(let id):
                    PlanDetailView(store: plans, planId: id,
                                   onBack: { planRoute = .plans },
                                   onOpenPlan: { planRoute = .planDetail($0) },
                                   onOpenChapter: { p in
                                       chapterFromPlan = true; chapterFromHome = false; xrefReturnOrigin = nil; planFlowHost = .chapter; planFlowActive = false; listenChapter = nil
                                       openPlanChapter(p, autoPlay: false)
                                       tab = .read
                                   },
                                   onGoHome: { planRoute = .play })
                    .edgeSwipeBack { planRoute = .plans }
                }
            }
        case .explore:
            ExploreView(article: $exploreArticle, auth: auth, activity: activity, locale: appLocale, onOpenLogin: { authRoute = .login },
                        onSignOut: { Task { if await sync.prepareSignOut() { auth.signOut() } } },
                        onOpenSettings: { showMenu = true },
                        size: readSize,
                        bookmarks: bookmarks,
                        highlights: highlights,
                        onOpenVerse: { id, ch, verse in
                            guard let b = BibleCatalog.book(id: id) else { return }
                            planFlowActive = false; listenChapter = nil; chapterFromPlan = false; chapterFromHome = false; xrefReturnOrigin = nil
                            openedBook = nil
                            focusVerse = verse; focusKeyword = nil
                            searchReturnQuery = nil; openedChapter = (b, ch)
                            tab = .read
                        },
                        onOpenFavorites: { showFavorites = true; tab = .read },
                        onOpenChapter: { id, ch in
                guard let b = BibleCatalog.book(id: id) else { return }
                planFlowActive = false; listenChapter = nil; chapterFromPlan = false; chapterFromHome = false; xrefReturnOrigin = nil
                openedBook = nil
                searchReturnQuery = nil; openedChapter = (b, ch)
                tab = .read
            },
                        onOpenAchievements: { showAchievements = true })
            .sheet(isPresented: $showAchievements) {
                NavigationStack {
                    AchievementsView()
                        .environmentObject(achievements)
                        .toolbar {
                            ToolbarItem(placement: .topBarTrailing) {
                                Button(SiteCopy.t("native.done", appLocale)) { showAchievements = false }
                            }
                        }
                }
            }
        }
    }
}
