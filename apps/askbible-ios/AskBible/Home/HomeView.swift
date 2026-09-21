import SwiftUI

/// 首页：全屏场景视频 / 柔焦静帧 + 金句 + 底部「场景与音效」带。与 RN HomeNatureScreen 对等（Android HomeScreen 同构）：
/// 右上齿轮展开 字号/定时 行、环境音九槽、场景条（首格「模糊」），闲置 7 秒自动收起；
/// 最下一排是 安静专辑 / 金句朗读 / 下午茶专辑 三个开关（RN HomeNatureAlbumStrip）—— 咖啡杯是「下午茶」专辑，不是环境音。
/// 金句排版来自 verseTypography()：body 24 / 行高 37 / 700，ref 18 / 行高 26 / 700 / 上距 12，随字号档缩放。
struct HomeView: View {
    @ObservedObject var home: HomeVerseController
    @ObservedObject var music: MusicPlayer
    @ObservedObject var ambient: AmbientPlayer
    @ObservedObject var prefs: NatureHomePrefs
    /// 睡眠定时分钟数（0 = 未设），四路播放器共用
    var sleepTimerMinutes: Int
    var onSelectScene: (String) -> Void
    var onToggleAmbient: (String) -> Void
    var onCycleSleepTimer: () -> Void
    var onPressAlbum: (String) -> Void
    var onOpenMenu: () -> Void = {}
    /// 界面收起 / 唤回时通知壳：首页闲置后连系统底栏一起淡出，全景不被任何东西压着（Josh 2026-09-18）
    var onChromeHidden: (Bool) -> Void = { _ in }
    /// 最近读到的一章（ReadingActivityStore.recent.first）。隔天回来时首页顶部出现「回归卡」；
    /// nil = 没有任何阅读记录，卡片退化成「从这里开始」（DECISIONS 2026-09-18 Gentle Return）
    var lastRead: ReadingActivityStore.RecentChapter? = nil
    /// 点「接着走」：有记录就跳那一章，没有记录（nil）就进读经页
    var onResumeReading: (ReadingActivityStore.RecentChapter?) -> Void = { _ in }
    /// 回归卡出现 / 退场时通知壳：它在的时候把勋章 / 升级横幅压后，两块不抢首页顶部同一个位置
    /// （Josh 2026-09-18：回归卡只在隔天回来时出现，本来就稀有；升级横幅哪次都能补）
    var onReturnCardVisible: (Bool) -> Void = { _ in }

    @Environment(\.scenePhase) private var scenePhase
    @State private var toolsOpen = false
    @State private var idleEpoch = 0
    /// 闲置后收起菜单钮与专辑排，只留金句 + 底栏（DECISIONS 2026-09-16 首页方案 A）；点屏幕恢复
    @State private var chromeVisible = true
    /// 本次前台里已经点过或划走过回归卡，不再反复冒出来
    @State private var returnCardDone = false
    private var verse: GoldenVerse { home.verse }

    /// RN homeNatureLayoutMetrics / homeNatureScreenConstants / shellPlaybackTransportLayout 逐值
    private enum M {
        static let edgePad: CGFloat = 16          // HOME_SCENE_STRIP_EDGE_PAD
        static let iconGap: CGFloat = 16          // AMBIENT_ICON_GAP / QUICK_CONTROL_ICON_GAP
        static let rowGap: CGFloat = 22           // HOME_BOTTOM_ICON_ROW_GAP
        static let bandPadTop: CGFloat = 12       // HOME_NATURE_BOTTOM_BAND_PAD_TOP
        static let ambientIcon: CGFloat = 36      // AMBIENT_ICON_SIZE（芯片 = 图标）
        static let scaleTimerRowH: CGFloat = 36   // HOME_SCALE_TIMER_ROW_H
        static let scaleTimerIcon: CGFloat = 26
        static let thumb: CGFloat = 64            // HOME_SCENE_THUMB_SIZE
        static let thumbSlotPad: CGFloat = 10     // HOME_SCENE_THUMB_SLOT_PAD
        static let thumbGap: CGFloat = 10         // HOME_SCENE_THUMB_GAP
        static let sceneRowPadBottom: CGFloat = 6 // HOME_NATURE_BOTTOM_BAND_SCENE_ROW_PAD
        static let albumBtn: CGFloat = 52         // HOME_ALBUM_BTN_SIZE
        static let albumGap: CGFloat = 28         // transportMainGap
        static let toolsAutoCloseNs: UInt64 = 7_000_000_000  // HOME_SCENE_TOOLS_AUTO_CLOSE_MS
    }

    var body: some View {
        GeometryReader { geo in
            let safeTop = geo.safeAreaInsets.top
            // GeometryReader 量到的是扣掉安全区的高度；外层 ZStack 又 ignoresSafeArea 顶到屏幕底，
            // 底图只按 geo.size 裁的话，底栏那一截露出的是黑底 —— 原版底栏在首页是透明的，底图要铺到最底。
            let fullHeight = geo.size.height + geo.safeAreaInsets.top + geo.safeAreaInsets.bottom
            ZStack(alignment: .top) {
                Color(rgb: 0x1a1512)

                // 底图：柔焦静帧一直垫着（关 live 就只看它），live 时循环视频出首帧后盖上来
                if let poster = NatureScenes.posterImage(id: prefs.sceneId, soft: !prefs.liveVideo) {
                    Image(uiImage: poster)
                        .resizable()
                        .scaledToFill()
                        .frame(width: geo.size.width, height: fullHeight)
                        .clipped()
                }
                if prefs.liveVideo {
                    HomeSceneVideo(sceneId: prefs.sceneId, paused: scenePhase != .active)
                        .frame(width: geo.size.width, height: fullHeight)
                }

                // 顶部原来有一层 180pt 暗渐变保图标可读；图标现在是玻璃圆钮，自带对比，
                // 这层只剩把天空压暗的副作用 —— Josh 2026-09-16：「首页上面不要一层阴影层」，去掉。

                verseBlock
                    .allowsHitTesting(false)
                    .padding(.horizontal, 22)
                    .padding(.top, safeTop + 99)

                // 回归卡坐在最上面。zIndex(1) 是必须的：上面那层整屏 Color.clear 会把点击吃掉，
                // 不抬起来按钮看着在、点不动。
                if showReturnCard {
                    returnCard
                        .padding(.horizontal, 20)
                        .padding(.top, safeTop + 10)
                        .zIndex(1)
                        .transition(.opacity)
                        // 自己的退场计时：到点就收，和底栏那条闲置逻辑互不依赖
                        .task {
                            try? await Task.sleep(nanoseconds: M.toolsAutoCloseNs)
                            guard !Task.isCancelled else { return }
                            withAnimation(.easeInOut(duration: 0.4)) { returnCardDone = true }
                        }
                }

                // 设置齿轮回到右上（Josh 2026-09-21）。2026-09-16 曾把它塞进底部专辑排末尾，
                // 结果专辑排的宽度会随它出现/消失而变，三颗常用键跟着左右挪——那是他这次要去掉的位移。
                HStack {
                    Spacer()
                    chromeButton(MI.settings,
                                 color: (toolsOpen || ambient.isOn) ? Brand.logo : .white.opacity(0.9)) {
                        touch(); toolsOpen.toggle()
                    }
                }
                .padding(.horizontal, ShellMetrics.topChromeSideInset)
                .padding(.top, geo.safeAreaInsets.top + ShellMetrics.topChromeOffset)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .opacity(chromeVisible ? 1 : 0.55)
                .animation(.easeInOut(duration: 0.4), value: chromeVisible)
                .allowsHitTesting(true)

                // 常用键要一直够得着，所以这一带不整体淡出，只在闲置时压淡；
                // 底栏没了之后它可以往下坐一些（Josh 2026-09-18）
                // 用 VStack + Spacer 推到底，**不要**用 frame(maxHeight:.infinity)：
                // 那样这一层会撑满整屏并吃掉所有点击（玻璃容器把空白区也算命中区），
                // 于是界面收起后点屏幕再也叫不回来。Spacer 不参与命中，点击照常落到 ZStack 的手势上。
                VStack(spacing: 0) {
                    Spacer(minLength: 0)
                    bottomBand
                }
                // 位置固定：闲置时只压淡、不位移（Josh 2026-09-21）。
                // 原来 92 → 36 会让三颗常用键在底栏淡出时整体往下坠一截。
                .padding(.bottom, 92 + geo.safeAreaInsets.bottom)
                    .opacity(chromeVisible ? 1 : 0.55)
                    .animation(.easeInOut(duration: 0.4), value: chromeVisible)
            }
            .ignoresSafeArea()
            // 点空白处：收起的界面叫回来；已显示时再点就立即收起。
            // 用 simultaneousGesture 挂在整个 ZStack 上：铺一层透明视图接不住（场景视频是
            // UIViewRepresentable，撑满的底部层也会抢），而普通 onTapGesture 会被子视图吃掉。
            // simultaneous 同时收到，按钮各自的点击照常生效。
            .simultaneousGesture(TapGesture().onEnded {
                let next = !chromeVisible
                if toolsOpen { toolsOpen = false }
                withAnimation(.easeInOut(duration: 0.3)) { chromeVisible = next }
                onChromeHidden(!next)
                idleEpoch += 1
            })
            // 回归卡在 / 不在，报给壳：它在的时候勋章 / 升级横幅让位（两块抢首页顶部同一个位置）
            .onAppear { onReturnCardVisible(showReturnCard) }
            .onChange(of: showReturnCard) { _, up in onReturnCardVisible(up) }
            .onDisappear { onReturnCardVisible(false) }
        }
        // 点开设置后闲置 7 秒自动收起（HOME_SCENE_TOOLS_AUTO_CLOSE_MS）；任何一次操作都重新计时
        // 闲置 7 秒：先收设置簇，再过 7 秒淡出整层界面；任何一次操作都重新计时
        .task(id: idleEpoch) {
            try? await Task.sleep(nanoseconds: M.toolsAutoCloseNs)
            guard !Task.isCancelled else { return }
            if toolsOpen { toolsOpen = false; idleEpoch += 1; return }
            withAnimation(.easeInOut(duration: 0.6)) { chromeVisible = false }
            onChromeHidden(true)
        }
    }

    private func touch() {
        idleEpoch += 1
        if !chromeVisible {
            withAnimation(.easeInOut(duration: 0.3)) { chromeVisible = true }
            onChromeHidden(false)
        }
    }

    // MARK: 回归卡

    /// 显示条件：**隔天**才出——今天已经读过就不提（那是「你做得够不够」，不是「你走到哪了」）。
    /// 跟着 chromeVisible 一起淡出：首页的价值是全景不被打扰，回归卡不常驻压在风景上（Josh 2026-09-18）。
    private var showReturnCard: Bool {
        // returnCardDone 由卡片自己的 7 秒计时置位，**不依赖 chromeVisible**：
        // 「首页闲置隐藏底栏」那条还在等真机确认，可能退回成底栏常驻（chromeVisible 恒为 true）。
        // 卡片自带退场，那条怎么定都不会把它永久钉在首页顶部（与安卓 ReturnCard 同构）。
        guard !returnCardDone, chromeVisible else { return false }
        guard let p = lastRead else { return true }
        return !Calendar.current.isDateInToday(Date(timeIntervalSince1970: p.at / 1000))
    }

    /// 「你回来了 / 我们上次停在这里 · 马太福音 13」+「接着走」，点一下直接进那一章。
    /// 只陈述走到哪了，不写天数、不写完成度、不催（DECISIONS 2026-09-18 明确不做的那一串）。
    private var returnCard: some View {
        let resume = lastRead
        let title = resume.map { "\(SiteCopy.t("native.returnResumeTitle")) · \($0.bookName) \($0.chapter)" }
            ?? SiteCopy.t("native.returnFreshTitle")
        return Button {
            returnCardDone = true
            touch()
            onResumeReading(resume)
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(SiteCopy.t("native.returnGreeting"))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.82))
                    Text(title)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 8)
                Text(SiteCopy.t("native.returnResumeAction"))
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Brand.logo)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
            // 不垫 iOS 26 的 clear 玻璃：浅色场景（晴天湖面 / 日出天空）下它会提亮成一块发白的板子，
            // 和 2026-09-18 撤掉设置簇玻璃底是同一个原因。改成深褐半透底，与安卓 ReturnCard 同值。
            .background(RoundedRectangle(cornerRadius: 18).fill(Color(rgb: 0x1c1410, opacity: 0.55)))
            .askFloatingShadow()
        }
        .buttonStyle(.plain)
    }

    // MARK: 金句

    private var verseBlock: some View {
        let scale = prefs.textScale
        return VStack(spacing: 0) {
            Text(verse.text)
                .font(.system(size: HomeVerseTypography.bodySize(scale: scale), weight: .bold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .lineSpacing(HomeVerseTypography.bodyLineHeight(scale: scale) - HomeVerseTypography.bodySize(scale: scale))
                .verseTextShadow()

            Text(verse.reference)
                .font(.system(size: HomeVerseTypography.refSize(scale: scale), weight: .bold))
                .foregroundStyle(.white)
                .kerning(0.1)
                .padding(.top, HomeVerseTypography.refTopGap(scale: scale))
                .verseTextShadow()
        }
    }

    // MARK: 顶部

    private func topChrome(safeTop: CGFloat) -> some View {
        // RN HomeNatureScreenTopChrome：展开中或环境音开着时齿轮点亮 LOGO 色
        // 方案 A（2026-09-16）：右上齿轮移到底部专辑排末尾，顶部只留一颗淡一点的菜单钮，画面上方保持干净
        HStack {
            chromeButton(MI.menu, color: .white.opacity(0.85), action: onOpenMenu)
            Spacer()
        }
        .padding(.horizontal, ShellMetrics.topChromeSideInset)
        .padding(.top, safeTop + ShellMetrics.topChromeOffset)
        .frame(maxHeight: .infinity, alignment: .top)
    }

    /// 玻璃小圆钮（DECISIONS 2026-09-15：操作 = 玻璃）。不再靠双层黑影在视频上硬造层次。
    private func chromeButton(_ glyph: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            MaterialIcon(glyph: glyph, size: 22, color: color)
                // 玻璃不再着色（Josh 要原生质感），白图标的对比改由这层极轻阴影负责
                .askGlassIconShadow()
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
                .askGlassCapsule(tone: .dark, interactive: true)
                .askFloatingShadow()
        }
        .buttonStyle(.plain)
    }

    // MARK: 底部带

    /// bottomBand：paddingTop 12，各排之间 22；展开时上面多出 字号/定时 行、环境音、场景条
    private var bottomBand: some View {
        // 齿轮展开的那堆东西收进**一块**玻璃控制簇（GPT 评审：不要做成一排各自为政的玻璃按钮），
        // 专辑排自己是一块玻璃胶囊；两块同处一个 AskGlassGroup，iOS 26 下展开/收起有玻璃形变过渡。
        AskGlassGroup(spacing: 14) {
            VStack(spacing: 14) {
                if toolsOpen {
                    VStack(spacing: M.rowGap) {
                        scaleTimerRow
                        ambientRow
                        sceneStrip
                    }
                    .padding(.vertical, 14)
                    // 不再给这簇垫玻璃：iOS 26 的 clear 玻璃在浅色场景（晴天湖面）上会提亮成一块发白的板子，
                    // 风景被蒙住，场景缩略图反被压暗（Josh 2026-09-18「玻璃在浅色状态下很不好看」）。
                    // 跟专辑排 2026-09-16 那次同一个处理：图标直接浮在画面上，可读性交给图标自己的阴影。
                    .padding(.horizontal, AskGlassMetrics.capsuleInset)
                }
                // 专辑排不要玻璃底（Josh 2026-09-16）：白图标直接浮在画面上，靠图标阴影保可读
                albumRow
            }
        }
        .padding(.top, M.bandPadTop)
    }

    /// RN HomeVerseScaleTimerControl：减 / 加 / 定时（定时开着亮黄并角标分钟数）
    private var scaleTimerRow: some View {
        // 玻璃是 .clear（不着色），白图标全靠自己的不透明度和阴影压住亮天空 —— 0.78 在雪山湖面上看不见（Josh 2026-09-18）
        let idle = Color.white.opacity(0.95)
        let timerOn = sleepTimerMinutes > 0
        return HStack(spacing: M.iconGap) {
            quickChip(MI.remove, color: idle) { touch(); prefs.bumpTextScale(-1) }
            quickChip(MI.add, color: idle) { touch(); prefs.bumpTextScale(1) }
            Button { touch(); onCycleSleepTimer() } label: {
                MaterialIcon(glyph: MI.timer, size: M.scaleTimerIcon, color: timerOn ? Brand.logo : idle)
                    .shadow(color: .black.opacity(0.45), radius: 4, x: 0, y: 1)
                    .frame(width: M.scaleTimerRowH, height: M.scaleTimerRowH)
                    .overlay(alignment: .topTrailing) {
                        if timerOn {
                            // quickControlTimerBadge：右上角 -2/-6，黑 .55 圆角 8，黄字 10/700
                            Text("\(sleepTimerMinutes)")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(Brand.logo)
                                .padding(.horizontal, 3)
                                .padding(.vertical, 1)
                                .background(RoundedRectangle(cornerRadius: 8).fill(Color.black.opacity(0.55)))
                                .offset(x: 6, y: -2)
                        }
                    }
            }
            .buttonStyle(.plain)
        }
        .frame(height: M.scaleTimerRowH)
    }

    private func quickChip(_ glyph: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            MaterialIcon(glyph: glyph, size: M.scaleTimerIcon, color: color)
                .shadow(color: .black.opacity(0.45), radius: 4, x: 0, y: 1)
                .frame(width: M.scaleTimerRowH, height: M.scaleTimerRowH)
        }
        .buttonStyle(.plain)
    }

    /// 环境音九槽横条：选中 LOGO 色 + 放大 1.06，其余白 .6；选中项滚到视口居中（ambientStripScrollX）
    private var ambientRow: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: M.iconGap) {
                    ForEach(AmbientScenes.slots) { slot in
                        let selected = ambient.slotId == slot.id
                        Button { touch(); onToggleAmbient(slot.id) } label: {
                            MaterialIcon(glyph: Self.ambientGlyph(slot.id), size: M.ambientIcon,
                                         color: selected ? Brand.logo : .white, community: true)
                                .shadow(color: .black.opacity(0.45), radius: 4, x: 0, y: 1)
                                .frame(width: M.ambientIcon, height: M.ambientIcon)
                                .scaleEffect(selected ? 1.06 : 1)
                                .opacity(selected ? 1 : 0.8)
                        }
                        .buttonStyle(.plain)
                        .id(slot.id)
                    }
                }
                .padding(.horizontal, M.edgePad)
            }
            .frame(height: M.ambientIcon)
            .onAppear { if let id = ambient.slotId { proxy.scrollTo(id, anchor: .center) } }
            .onChange(of: ambient.slotId) { _, id in
                if let id { withAnimation { proxy.scrollTo(id, anchor: .center) } }
            }
        }
    }

    private static func ambientGlyph(_ id: String) -> String {
        switch id {
        case "scene-water": return MCI.water
        case "scene-rain": return MCI.weatherRainy
        case "scene-birds": return MCI.bird
        case "scene-white-noise": return MCI.radioTower
        case "scene-wind": return MCI.weatherWindy
        case "scene-fire": return MCI.fire
        case "scene-waves": return MCI.waves
        case "scene-thunder": return MCI.weatherLightning
        default: return MCI.coffee
        }
    }

    /// 场景条：首格「模糊」（关 live 时选中），后面按点选次数排的九个场景圆图（sortNatureScenesByUsage）
    private var sceneStrip: some View {
        let scenes = NatureScenes.sortedByUsage(prefs.usage)
        return ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: M.thumbGap) {
                    SceneThumb(selected: !prefs.liveVideo, image: nil) {
                        touch()
                        prefs.toggleLiveVideo(!prefs.liveVideo)
                    }
                    .id("scene-blur-toggle")
                    ForEach(scenes) { s in
                        SceneThumb(selected: s.id == prefs.sceneId, image: NatureScenes.thumbImage(id: s.id)) {
                            touch()
                            onSelectScene(s.id)
                        }
                        .id(s.id)
                    }
                }
                // sceneLeftPad = 16 - (slot - thumb)/2
                .padding(.leading, M.edgePad - M.thumbSlotPad / 2)
                .padding(.trailing, M.edgePad)
                .padding(.bottom, M.sceneRowPadBottom)
            }
            .onAppear { proxy.scrollTo(prefs.sceneId, anchor: .center) }
            .onChange(of: prefs.sceneId) { _, id in withAnimation { proxy.scrollTo(id, anchor: .center) } }
        }
    }

    /// RN HomeNatureAlbumStrip：安静（music-note-outline）/ 金句 volume-up / 下午茶（coffee-outline），
    /// 触控 52、间距 28（transportMainGap）、图标 36；专辑亮 = 正在出声的就是它
    private var albumRow: some View {
        let playingAlbum = music.isPlaying ? music.track?.album : nil
        return HStack(spacing: M.albumGap) {
            albumButton(MCI.musicNoteOutline, community: true, on: playingAlbum == "安静") { touch(); onPressAlbum("安静") }
            // 金句朗读只有和合本 / WEBP 两套：显示的是别的版本（法语等）时没有对得上的朗读，喇叭不出
            // 朗读不可用（法语等没有对得上的朗读）时保留空槽，不塌缩 ——
            // 塌缩会让左右两颗横向挪位（Josh 2026-09-21「不要动，不要移位置」）
            albumButton(MI.volumeUp, on: home.voiceOn) { touch(); home.toggleVoice() }
                .opacity(home.voiceAvailable ? 1 : 0)
                .allowsHitTesting(home.voiceAvailable)
            albumButton(MCI.coffeeOutline, community: true, on: playingAlbum == "下午茶") { touch(); onPressAlbum("下午茶") }
        }
        .frame(height: M.albumBtn)
    }

    private func albumButton(_ glyph: String, community: Bool = false, on: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            MaterialIcon(glyph: glyph, size: ShellMetrics.tabIconSize, color: on ? Brand.logo : .white, community: community)
                .shadow(color: .black.opacity(0.45), radius: 4, x: 0, y: 1)
                .frame(width: M.albumBtn, height: M.albumBtn)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// HomeSceneThumb：64 圆图，未选中缩 .9 / 60% 不透明，弹簧过渡；没图的格子（「模糊」）画 blur 图标。
/// 槽位宽 74（64 + 10），上下各撑 10 给放大与阴影留地方。
private struct SceneThumb: View {
    let selected: Bool
    let image: UIImage?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle().fill(Color(rgb: 0x1c1814, opacity: 0.75))
                if let image {
                    Image(uiImage: image).resizable().scaledToFill()
                } else {
                    MaterialIcon(glyph: MCI.blur, size: 28, color: .white.opacity(0.88), community: true)
                }
            }
            .frame(width: 64, height: 64)
            .clipShape(Circle())
            .shadow(color: .black.opacity(selected ? 0.45 : 0.3), radius: selected ? 5 : 3, y: 2)
            .scaleEffect(selected ? 1 : 0.9)
            .opacity(selected ? 1 : 0.6)
            .animation(.spring(response: 0.35, dampingFraction: 0.75), value: selected)
            .padding(.vertical, 10)
            .frame(width: 74)
        }
        .buttonStyle(.plain)
    }
}
