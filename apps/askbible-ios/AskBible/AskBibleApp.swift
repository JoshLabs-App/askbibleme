import SwiftUI

@main
struct AskBibleApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(.light)
        }
    }
}

struct RootView: View {
    @StateObject private var store = ScriptureStore()
    @StateObject private var audio = ChapterAudioPlayer()
    @StateObject private var music = MusicPlayer()
    @StateObject private var home = HomeVerseController()
    @StateObject private var ambient = AmbientPlayer()
    @StateObject private var plans = ReadingPlanStore()
    @StateObject private var bookmarks = VerseBookmarkStore()
    @StateObject private var searchPrefs = SearchPrefs()
    @StateObject private var naturePrefs = NatureHomePrefs()
    /// 会员登录（Supabase 直连；RN MemberAuthProvider）
    @StateObject private var auth = MemberAuthStore()
    /// 读经活动（习惯日 / 累计听 / 使用时长 / 最近阅读）与会员读经进度同步
    @StateObject private var activity = ReadingActivityStore()
    @StateObject private var sync = MemberReadingSyncEngine()
    @Environment(\.scenePhase) private var scenePhase
    /// 15 秒一跳：使用时长打点 + 记当天为读经日；每三跳（45 秒）轮询一次同步（RN AppUsageTimeBridge / useMemberReadingSync）
    private let usageTicker = Timer.publish(every: 15, on: .main, in: .common).autoconnect()
    @State private var usageTicks = 0
    /// 界面语言跟系统走；读经展示语言再跟主译本走（英文译本 → 英文面）
    // 界面语言：手动设置（探索页）优先，否则跟系统
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
        guard let url = URL(string: "mailto:askbibleme@gmail.com") else { return }
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
    /// 计划 Tab（底栏中央键）里的子页：播放页 / 计划目录 / 计划详情
    enum PlanRoute: Equatable { case play, plans, planDetail(String) }
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
    @State private var readSize: ReadSize = .default
    @State private var openedBook: BookRef?
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
    /// 长按弹出操作单的那节；收藏 / 复制后的轻提示
    @State private var actionVerse: LoadedVerse?
    /// 多节选择（章页底部条），空集合 = 不在选择态
    @State private var selectedVerses: Set<Int> = []
    /// 划重点：开关 + 当前颜色 + 擦除态
    @StateObject private var highlights = VerseHighlightStore()
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

    private func skipToNextChapter() {
        if planFlowActive {
            if let cur = audioTarget { plans.markChapterRead(cur.book.id, cur.chapter) }
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
        if openedChapter != nil { openedChapter = (opened.book, nextChapter) }
        else { listenChapter = (opened.book, nextChapter); audio.resume() }
    }

    /// 睡眠定时：首页定时角标与音乐页睡眠单同一份分钟数，四路播放器一起设（0 = 关）
    private func setSleepTimerAll(_ minutes: Int) {
        sleepTimerMinutes = minutes
        let m: Int? = minutes > 0 ? minutes : nil
        audio.setSleepTimer(minutes: m)
        music.setSleepTimer(minutes: m)
        home.setSleepTimer(minutes: m)
        ambient.setSleepTimer(minutes: m)
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

    /// 多节复制：按节号顺序，每节一行「书名 章:节 正文」（RN copySelectedVerses）
    private func copySelectedVerses(in opened: (book: BookRef, chapter: Int)) {
        guard !selectedVerses.isEmpty else { return }
        let name = bookLabel(opened.book)
        let lines = selectedVerses.sorted().compactMap { v -> String? in
            guard let text = store.verseText(translationId: store.translation.id, bookId: opened.book.id,
                                             chapter: opened.chapter, verse: v) else { return nil }
            return "\(name) \(opened.chapter):\(v) \(displayLocale.zh(text))"
        }
        UIPasteboard.general.string = lines.joined(separator: "\n")
        showToast(SiteCopy.f("pages.read.verseSelectionCopied", ["count": "\(selectedVerses.count)"], appLocale))
        selectedVerses = []
    }

    private func shareVerse(_ v: LoadedVerse, in opened: (book: BookRef, chapter: Int)) {
        let text = VerseShareText.share(bookName: opened.book.name(displayLocale), chapter: opened.chapter, verse: v.number, text: v.text)
        let vc = UIActivityViewController(activityItems: [text], applicationActivities: nil)
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        var top = scene?.keyWindow?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        vc.popoverPresentationController?.sourceView = top?.view
        top?.present(vc, animated: true)
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
        focusVerse = nil
        autoPlayPending = autoPlay
        listenChapter = (b, p.chapter)
        openedChapter = (b, p.chapter)
    }

    /// 播放页点播：不开章页，只把音源换到这一章（同章已载入就直接续播）
    private func listenPlanChapter(_ p: PlanPointer, autoPlay: Bool) {
        guard let b = BibleCatalog.book(id: p.bookId) else { return }
        if let t = audioTarget, t.book.id == b.id, t.chapter == p.chapter {
            if autoPlay { audio.resume() }
            return
        }
        autoPlayPending = autoPlay
        listenChapter = (b, p.chapter)
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
    private var planDockActive: Bool { tab == .plan && planRoute == .play && !showSearch && !planPageQueue.isEmpty }

    /// 日历上看的那天算「听过」（月历标黄）
    private func markPlanListened() { plans.markListened(PlanPlay.isoDate(PlanDates.addDays(Date(), planViewAhead))) }

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
        focusVerse = nil
        if !(planPoolMatchesView && index == planQueueIndex) { planFlowActive = false; listenChapter = nil }
        openedChapter = (b, q[index].chapter)
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

    var body: some View {
        content
            .environmentObject(store)
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
            .onChange(of: audioURL) { _, url in
                guard let url, let opened = audioTarget else { return }
                let key = "\(store.translation.id).\(opened.book.id).\(opened.chapter)"
                let title = ReadChrome.chapterTitle(bookName: bookLabel(opened.book), chapter: opened.chapter, locale: titleLocale)
                if ChapterAudioSource.isResolverURL(url) {
                    // YouVersion 译本：先问网站代理拿 CDN mp3，再装载
                    let tid = store.translation.id, bookId = opened.book.id, chapter = opened.chapter
                    audio.beginResolving(key: key, title: title)
                    Task {
                        if let src = await ChapterAudioSource.fetchResolved(url, cacheKey: key) {
                            audio.load(url: src, key: key, title: title, translationId: tid, bookId: bookId, chapter: chapter, resolved: true)
                        } else {
                            audio.failResolving(key: key)
                        }
                    }
                } else {
                    audio.load(url: url, key: key, title: title, translationId: store.translation.id, bookId: opened.book.id, chapter: opened.chapter)
                }
                if autoPlayPending {
                    autoPlayPending = false
                    audio.resume()
                }
            }
            // 整章朗读时环境音压半音量继续放，停了恢复
            .onChange(of: audio.isPlaying) { _, playing in ambient.setDucked(playing) }
            .task {
                await auth.verifyRemote()
                await sync.flushNow(reason: "foreground")
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active {
                    audio.recoverAfterInterruption(); music.recoverAfterInterruption()
                    activity.noteForeground(); activity.touchHabitDay()
                    Task { await sync.flushNow(reason: "foreground") }
                } else {
                    activity.noteBackground()
                }
            }
            .onChange(of: auth.user?.id) { old, new in
                // 刚登录：立即拉云端进度（RN syncMemberReadingAfterLogin）
                if old == nil, new != nil { Task { await sync.flushNow(reason: "login") } }
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
                sync.attach(auth: auth, plans: plans, bookmarks: bookmarks, activity: activity,
                            search: searchPrefs, highlights: highlights)
                sync.localeTag = { [appLocale] in appLocale.rawValue }
                activity.noteForeground(); activity.touchHabitDay()
                activity.mergeRemoteHabit(Array(plans.listenedDates))
                audio.onProgress = { [weak activity] t, playing in activity?.noteListenProgress(positionSec: t, isPlaying: playing) }
                audio.onSkipNext = skipToNextChapter
                audio.onFinished = { if planFlowActive { skipToNextChapter() } }
                // 互斥：整章朗读 ↔ 音乐（RN shell 单一 playbackMode）；整章朗读 ↔ 金句（都是人声）。
                // 首页最多两路同时出声（RN homeGoldenVerseTwoSourceMutex）：
                // 开音乐 / 开金句时另外两路都在 → 关环境音；开环境音时人声与音乐都在 → 停音乐。
                // 读经朗读与音乐可以同时放：音乐压到 30%，不再直接暂停（Josh 2026-09-11）；金句人声仍然互斥
                audio.onWillPlay = { [weak music, weak home] in music?.setDucked(true); home?.stopVoice() }
                audio.onStopped = { [weak music] in music?.setDucked(false) }
                music.onWillPlay = { [weak audio, weak home, weak ambient] in
                    // 音乐起播时朗读在放 → 保持两路，音乐压低
                    music.setDucked(audio?.isPlaying ?? false)
                    if home?.voiceOn == true, ambient?.isOn == true { ambient?.stop() }
                }
                home.player.onWillPlay = { [weak audio, weak music, weak ambient] in
                    audio?.pause()
                    if music?.isPlaying == true, ambient?.isOn == true { ambient?.stop() }
                }
                ambient.onWillPlay = { [weak audio, weak home, weak music] in
                    let voice = (home?.voiceOn ?? false) || (audio?.isPlaying ?? false)
                    if voice, music?.isPlaying == true { music?.pause() }
                }
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
        ZStack {
            ShellTabBarHost(selection: $tab, parchmentBar: tab == .read || tab == .explore || tab == .plan, onCenterTap: openToday,
                            dockActive: readDockActive || planDockActive,
                            // 计划目录 / 详情是独立子页，不放底栏；播放页是主页级页面，底栏照常
                            showTabBar: !(tab == .plan && planRoute != .play && !showSearch) && authRoute == nil && !(tab == .music && musicChromeHidden)) {
                screen
            } dock: {
                // 搜索 / 收藏页盖在上面时藏坞（RN 非章页只在播放中才出坞）
                if readDockActive {
                    return AnyView(PlaybackDock(
                        audio: audio,
                        available: audioURL != nil,
                        onSearch: {
                            if let o = openedChapter { searchRef = SearchChapterRef(bookId: o.book.id, chapter: o.chapter) }
                            showSearch = true
                        },
                        onSkipNext: skipToNextChapter))
                }
                if planDockActive {
                    // 播放页的坞：左键是经文搜索（带当前章上下文）；播放键没建池时从选中章起播
                    return AnyView(PlaybackDock(
                        audio: audio,
                        available: planActiveAudioAvailable,
                        onSearch: {
                            let q = planPageQueue
                            searchRef = q.indices.contains(planActiveIndex) ? SearchChapterRef(bookId: q[planActiveIndex].bookId, chapter: q[planActiveIndex].chapter) : nil
                            showSearch = true
                        },
                        onSkipNext: planNext,
                        onToggle: planTogglePlay))
                }
                return AnyView(EmptyView())
            }

            if let book = openedBook, openedChapter == nil {
                ChapterPickerSheet(
                    book: book,
                    chapterCount: store.chapterCount(
                        translationId: store.translation.id, bookId: book.id),
                    onPick: { chapter in
                        openedChapter = (book, chapter)
                        openedBook = nil
                    },
                    onClose: { openedBook = nil },
                    locale: titleLocale,
                    bookLabel: bookLabel
                )
            }

            if showTranslationPanel {
                // 界面文案目前只有中文：面板里的译本名与分组名按中文界面走（系统英文时不混一行英文），繁体系统给繁体
                TranslationPanel(locale: appLocale, onClose: { showTranslationPanel = false })
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
                            openedChapter = (b, ref.chapter)
                        }
                    },
                    onClose: { xrefVerse = nil },
                    locale: displayLocale
                )
            }

            if let v = actionVerse, let opened = openedChapter {
                VerseActionSheet(
                    verse: v.number,
                    bookmarked: bookmarks.isBookmarked(translationId: store.translation.id, bookId: opened.book.id, chapter: opened.chapter, verse: v.number),
                    size: readSize,
                    onCopy: { copyVerse(v, in: opened); actionVerse = nil },
                    onBookmark: { toggleBookmark(v, in: opened); actionVerse = nil },
                    onShare: { shareVerse(v, in: opened); actionVerse = nil },
                    onMultiCopy: { selectedVerses = [v.number]; actionVerse = nil },
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
                    onLogout: { showMenu = false; Task { await sync.prepareSignOut(); auth.signOut() } },
                    onFeedback: { showMenu = false; openSupportMail() },
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
                            await sync.prepareSignOut()
                            if let err = await auth.deleteAccount() {
                                showToast(SiteCopy.localizeKnown(err, appLocale))
                            } else {
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
                    .padding(.bottom, 108)
            }

            if showSleepSheet {
                SleepTimerSheet(
                    remainingLabel: audio.sleepRemainingLabel ?? music.sleepRemainingLabel,
                    onPick: { m in setSleepTimerAll(m ?? 0) },
                    onClose: { showSleepSheet = false })
            }
        }
    }

    @ViewBuilder
    private var screen: some View {
        switch tab {
        case .home:
            HomeView(
                home: home, music: music, ambient: ambient, prefs: naturePrefs,
                sleepTimerMinutes: sleepTimerMinutes,
                // 点选场景：记次数、存档、跟场景默认环境音（RN selectScene source=user）
                onSelectScene: { id in
                    guard id != naturePrefs.sceneId else { return }
                    naturePrefs.bumpUsage(id)
                    naturePrefs.selectScene(id)
                    if let slot = NatureScenes.scene(id: id)?.defaultAmbient { ambient.start(slotId: slot) }
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
                onOpenMenu: { showMenu = true }
            )
        case .music:
            MusicView(player: music,
                      sleepActive: audio.sleepDeadline != nil || music.sleepDeadline != nil || home.sleepDeadline != nil || ambient.sleepDeadline != nil,
                      onSleepTimer: { showSleepSheet = true },
                      onChromeHidden: { hidden in withAnimation(.easeInOut(duration: 0.3)) { musicChromeHidden = hidden } })
        case .read:
            if showSearch {
                SearchView(prefs: searchPrefs, size: readSize, chapterRef: searchRef, locale: displayLocale,
                           onBack: { showSearch = false },
                           onOpenHit: { hit in
                               showSearch = false
                               guard let b = BibleCatalog.book(id: hit.bookId) else { return }
                               planFlowActive = false; listenChapter = nil; chapterFromPlan = false; openedBook = nil
                               focusVerse = hit.verse
                               openedChapter = (b, hit.chapter)
                           })
                .edgeSwipeBack { showSearch = false }
            } else if showFavorites {
                FavoritesView(bookmarks: bookmarks, size: readSize, locale: displayLocale,
                              onBack: { showFavorites = false },
                              onOpen: { item in
                                  showFavorites = false
                                  guard let b = BibleCatalog.book(id: item.bookId) else { return }
                                  planFlowActive = false; listenChapter = nil; chapterFromPlan = false; openedBook = nil
                                  focusVerse = item.verse
                                  openedChapter = (b, item.chapter)
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
                        selectedVerses = []
                        highlighting = false
                        openedChapter = nil
                        // 从计划页进来的章页：回计划 Tab、不停播（RN 返回上一页仍在放）
                        if chapterFromPlan {
                            chapterFromPlan = false; planFlowHost = .listen; tab = .plan
                            if !planFlowActive { listenChapter = nil }
                        } else {
                            planFlowActive = false; listenChapter = nil
                        }
                    },
                    onOpenSettings: { showTranslationPanel = true },
                    audio: audio,
                    bookmarks: bookmarks,
                    focusVerse: focusVerse,
                    onTapVerse: { xrefVerse = $0 },
                    onOpenSearch: { searchRef = SearchChapterRef(bookId: opened.book.id, chapter: opened.chapter); showSearch = true },
                    onOpenFavorites: { showFavorites = true },
                    onDoubleTapVerse: { v in toggleBookmark(v, in: opened) },
                    onLongPressVerse: { v in actionVerse = v },
                    selectedVerses: $selectedVerses,
                    highlights: chapterHighlights(opened),
                    paintColor: highlighting && !erasing ? highlightColor : nil,
                    eraseMode: highlighting && erasing,
                    onPaint: { verse, range in
                        highlights.paint(translationId: store.translation.id, bookId: opened.book.id,
                                         chapter: opened.chapter, verse: verse, range: range,
                                         color: erasing ? nil : highlightColor)
                    },
                    onToggleSelection: { v in
                        if selectedVerses.contains(v) { selectedVerses.remove(v) } else { selectedVerses.insert(v) }
                    },
                    onCopySelection: { copySelectedVerses(in: opened) },
                    onClearSelection: { selectedVerses = [] },
                    onOpenCatalog: { openedChapter = nil; openedBook = nil; planFlowActive = false; listenChapter = nil; chapterFromPlan = false },
                    onNavigate: { id, ch in
                        // 结尾的上一章 / 下一章：手动翻页就退出计划流
                        guard let b = BibleCatalog.book(id: id) else { return }
                        planFlowActive = false; listenChapter = nil; chapterFromPlan = false
                        openedChapter = (b, ch)
                    }
                )
                .onChange(of: "\(opened.book.id):\(opened.chapter)", initial: true) { _, _ in
                    // RN writeLastReadPosition + pushReadRecentChapter：最后位置 + 探索页「最近阅读」
                    activity.recordOpened(bookId: opened.book.id, chapter: opened.chapter, bookName: opened.book.name(displayLocale))
                }
            } else {
                CatalogView(
                    size: $readSize,
                    locale: titleLocale,
                    bookLabel: bookLabel,
                    onOpenBook: { openedBook = $0 },
                    onOpenSettings: { showTranslationPanel = true },
                    onOpenSearch: { searchRef = nil; showSearch = true },
                    onOpenFavorites: { showFavorites = true },
                    // 右侧竖排最后一个「历史」：回到上次读到的那一章（RN onLastRead）
                    onLastRead: activity.lastPosition.flatMap { last in
                        BibleCatalog.book(id: last.bookId).map { b in
                            {
                                planFlowActive = false; listenChapter = nil; chapterFromPlan = false
                                focusVerse = nil
                                openedBook = nil
                                openedChapter = (b, last.chapter)
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
                           onOpenHit: { hit in
                               showSearch = false
                               guard let b = BibleCatalog.book(id: hit.bookId) else { return }
                               planFlowActive = false; listenChapter = nil; openedBook = nil
                               chapterFromPlan = true; planFlowHost = .chapter
                               focusVerse = hit.verse
                               openedChapter = (b, hit.chapter)
                               tab = .read
                           })
                .edgeSwipeBack { showSearch = false }
            } else {
                switch planRoute {
                case .play:
                    PlanPlayView(store: plans, audio: audio, locale: appLocale, queue: planPageQueue,
                                 activeIndex: planActiveIndex, activePlaying: planActivePlaying,
                                 viewAhead: $planViewAhead, cursor: $planCursor,
                                 onPlayChapter: { planPlay(at: $0) }, onReadChapter: { planRead(at: $0) },
                                 onOpenPlans: { planRoute = .plans }, bookLabel: bookLabel, habitDates: activity.completedDateSet,
                                 onConfirmDay: { plans.setAheadDays(planContentAhead); planViewAhead = 0 },
                                 onStageSet: { planViewAhead = 0; planCursor = 0 })
                case .plans:
                    PlansListView(store: plans, onOpenPlan: { planRoute = .planDetail($0) }, onBack: { planRoute = .play },
                                  onOpenArticle: { slug in exploreArticle = ExploreArticles.article(slug); tab = .explore })
                    .edgeSwipeBack { planRoute = .play }
                case .planDetail(let id):
                    PlanDetailView(store: plans, planId: id,
                                   onBack: { planRoute = .plans },
                                   onOpenPlan: { planRoute = .planDetail($0) },
                                   onOpenChapter: { p in
                                       chapterFromPlan = true; planFlowHost = .chapter; planFlowActive = false; listenChapter = nil
                                       openPlanChapter(p, autoPlay: false)
                                       tab = .read
                                   },
                                   onGoHome: { planRoute = .play })
                    .edgeSwipeBack { planRoute = .plans }
                }
            }
        case .explore:
            ExploreView(article: $exploreArticle, auth: auth, activity: activity, locale: appLocale, onOpenLogin: { authRoute = .login },
                        onSignOut: { Task { await sync.prepareSignOut(); auth.signOut() } },
                        size: readSize,
                        bookmarks: bookmarks,
                        onOpenVerse: { id, ch, verse in
                            // 探索页的收藏：跳到读经 Tab 的那一节
                            guard let b = BibleCatalog.book(id: id) else { return }
                            planFlowActive = false; listenChapter = nil; chapterFromPlan = false
                            openedBook = nil
                            focusVerse = verse
                            openedChapter = (b, ch)
                            tab = .read
                        },
                        onOpenFavorites: { showFavorites = true; tab = .read },
                        onOpenChapter: { id, ch in
                // 文章里的经文链接：切到读经 Tab 直接开章
                guard let b = BibleCatalog.book(id: id) else { return }
                planFlowActive = false; listenChapter = nil; chapterFromPlan = false
                openedBook = nil
                openedChapter = (b, ch)
                tab = .read
            })
        }
    }
}
