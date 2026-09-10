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

    @Environment(\.scenePhase) private var scenePhase
    @State private var toolsOpen = false
    @State private var idleEpoch = 0
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

                // 顶部渐变，保图标可读
                LinearGradient(
                    colors: [Color(rgb: 0x1c1410, opacity: 0.42), .clear],
                    startPoint: .top, endPoint: .bottom
                )
                .frame(height: 180)
                .frame(maxHeight: .infinity, alignment: .top)

                verseBlock
                    .padding(.horizontal, 22)
                    .padding(.top, safeTop + 99)

                topChrome(safeTop: safeTop)

                bottomBand
                    .frame(maxHeight: .infinity, alignment: .bottom)
                    .padding(.bottom, 92 + geo.safeAreaInsets.bottom)
            }
            .ignoresSafeArea()
        }
        // 点开设置后闲置 7 秒自动收起（HOME_SCENE_TOOLS_AUTO_CLOSE_MS）；任何一次操作都重新计时
        .task(id: toolsOpen ? idleEpoch : -1) {
            guard toolsOpen else { return }
            try? await Task.sleep(nanoseconds: M.toolsAutoCloseNs)
            if !Task.isCancelled { toolsOpen = false }
        }
    }

    private func touch() { idleEpoch += 1 }

    // MARK: 金句

    private var verseBlock: some View {
        let scale = prefs.textScale
        return VStack(spacing: 0) {
            Text(verse.text)
                .font(.system(size: HomeVerseTypography.bodySize(scale: scale), weight: .bold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .lineSpacing(HomeVerseTypography.bodyLineHeight(scale: scale) - HomeVerseTypography.bodySize(scale: scale))
                .verseBodyShadow()

            Text(verse.reference)
                .font(.system(size: HomeVerseTypography.refSize(scale: scale), weight: .bold))
                .foregroundStyle(.white)
                .kerning(0.1)
                .padding(.top, HomeVerseTypography.refTopGap(scale: scale))
                .verseBodyShadow()
        }
    }

    // MARK: 顶部

    private func topChrome(safeTop: CGFloat) -> some View {
        // RN HomeNatureScreenTopChrome：展开中或环境音开着时齿轮点亮 LOGO 色
        let settingsLit = toolsOpen || ambient.isOn
        return HStack {
            // RN ShellMenuButton menu 28 / HomeNatureScreenTopChrome settings 28
            chromeButton(MI.menu, color: .white, action: onOpenMenu)
            Spacer()
            chromeButton(MI.settings, color: settingsLit ? Brand.logo : .white) {
                touch()
                toolsOpen.toggle()
            }
        }
        .padding(.horizontal, ShellMetrics.topChromeSideInset)
        .padding(.top, safeTop + ShellMetrics.topChromeOffset)
        .frame(maxHeight: .infinity, alignment: .top)
    }

    private func chromeButton(_ glyph: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            MaterialIcon(glyph: glyph, size: 28, color: color)
                .frame(width: ShellMetrics.topChromeButton, height: ShellMetrics.topChromeButton)
                .shellIconShadow()
        }
        .buttonStyle(.plain)
    }

    // MARK: 底部带

    /// bottomBand：paddingTop 12，各排之间 22；展开时上面多出 字号/定时 行、环境音、场景条
    private var bottomBand: some View {
        VStack(spacing: M.rowGap) {
            if toolsOpen {
                scaleTimerRow
                ambientRow
                sceneStrip
            }
            albumRow
        }
        .padding(.top, M.bandPadTop)
    }

    /// RN HomeVerseScaleTimerControl：减 / 加 / 定时（定时开着亮黄并角标分钟数）
    private var scaleTimerRow: some View {
        let idle = Color.white.opacity(0.78)
        let timerOn = sleepTimerMinutes > 0
        return HStack(spacing: M.iconGap) {
            quickChip(MI.remove, color: idle) { touch(); prefs.bumpTextScale(-1) }
            quickChip(MI.add, color: idle) { touch(); prefs.bumpTextScale(1) }
            Button { touch(); onCycleSleepTimer() } label: {
                MaterialIcon(glyph: MI.timer, size: M.scaleTimerIcon, color: timerOn ? Brand.logo : idle)
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
                                .frame(width: M.ambientIcon, height: M.ambientIcon)
                                .scaleEffect(selected ? 1.06 : 1)
                                .opacity(selected ? 1 : 0.6)
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
            if home.voiceAvailable {
                albumButton(MI.volumeUp, on: home.voiceOn) { touch(); home.toggleVoice() }
            }
            albumButton(MCI.coffeeOutline, community: true, on: playingAlbum == "下午茶") { touch(); onPressAlbum("下午茶") }
        }
        .frame(height: M.albumBtn)
    }

    private func albumButton(_ glyph: String, community: Bool = false, on: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            MaterialIcon(glyph: glyph, size: ShellMetrics.tabIconSize, color: on ? Brand.logo : .white, community: community)
                .frame(width: M.albumBtn, height: M.albumBtn)
                .shellIconShadow()
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
