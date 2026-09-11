import SwiftUI

/// 音乐页：专辑舞台（渐变 + 光球 + 各专辑动画，见 MusicSceneViews）+ 底部心境切换与传输控制。
/// 播放状态全部来自 MusicPlayer；心境条 = MusicCatalog.albums（与 RN KNOWN_MUSIC_ALBUMS 同序）。
struct MusicView: View {
    @ObservedObject var player: MusicPlayer
    var sleepActive: Bool = false
    var onSleepTimer: () -> Void = {}
    /// 睡眠专辑自动隐藏了按钮时通知壳把底栏也藏起来（RN setMusicAutoHideChrome → ShellTabBar）
    var onChromeHidden: (Bool) -> Void = { _ in }
    /// 拖进度条时的预览比例；nil = 没在拖
    @State private var dragRatio: Double?
    /// RN useMusicHomeSleepAutoHide：睡眠专辑放着的时候 5 秒没碰屏幕就把按钮 / 曲名 / 定时器都藏起来，碰一下再出现并重新计时
    @State private var uiVisible = true
    @State private var hideTask: Task<Void, Never>?
    private static let autoHideMs: UInt64 = 5_000

    private var sleepAutoHide: Bool { player.album == "睡眠" && player.isPlaying && player.track != nil }

    private func resetAutoHide() {
        hideTask?.cancel(); hideTask = nil
        if !uiVisible { withAnimation(.easeInOut(duration: 0.25)) { uiVisible = true } }
        guard sleepAutoHide else { return }
        hideTask = Task {
            try? await Task.sleep(nanoseconds: Self.autoHideMs * 1_000_000)
            guard !Task.isCancelled else { return }
            withAnimation(.easeInOut(duration: 0.6)) { uiVisible = false }
        }
    }

    var body: some View {
        GeometryReader { geo in
            let safeTop = geo.safeAreaInsets.top
            let safeBottom = geo.safeAreaInsets.bottom

            ZStack {
                // 专辑舞台：渐变 + 光球 + 该专辑的动画层（RN 各专辑各一套：鱼群 / 咖啡豆 / 星月 / 行星）；停播时定格
                MusicAlbumStage(album: player.album, active: player.isPlaying)
                    // RN MusicHomeStageTapSurface：视觉大区域点一下暂停、再点一下播放（曲目列表与按钮在上层，不受影响）
                    .overlay(alignment: .top) {
                        // 只盖舞台上半段（曲目列表以上），列表 / 按钮藏起来后点下半段只算「碰一下回来」
                        Color.clear.contentShape(Rectangle()).frame(height: geo.size.height * 0.42)
                            .onTapGesture { if player.track != nil { player.toggle() } }
                    }

                // 触碰探测（睡眠专辑自动隐藏的「碰一下回来」）：window 级识别器，不吞按钮事件
                TouchObserver(onTouch: { resetAutoHide() }).frame(width: 0, height: 0)

                sleepTimerButton(safeTop: safeTop)
                    .opacity(uiVisible ? 1 : 0)
                    .allowsHitTesting(uiVisible)

                VStack(spacing: 0) {
                    Spacer()
                    trackTitles
                    moodRow.padding(.top, 30)
                    scrubber.padding(.top, 22)
                    transport.padding(.top, 6)
                }
                .padding(.bottom, ShellMetrics.dockBottomPad(safeBottom: safeBottom) + 12)
                .opacity(uiVisible ? 1 : 0)
                .allowsHitTesting(uiVisible)
            }
            .ignoresSafeArea()
            .onAppear { resetAutoHide() }
            .onDisappear { hideTask?.cancel(); hideTask = nil; uiVisible = true; onChromeHidden(false) }
            .onChange(of: sleepAutoHide) { _, _ in resetAutoHide() }
            .onChange(of: uiVisible) { _, v in onChromeHidden(!v) }
        }
    }

    private func sleepTimerButton(safeTop: CGFloat) -> some View {
        Button(action: onSleepTimer) {
            // RN MusicHomeSleepTimerButton：timer 26，开着 LOGO 黄，否则白
            MaterialIcon(glyph: MI.timer, size: 26, color: sleepActive ? Brand.logo : .white)
                .frame(width: 50, height: 50)
                .shellIconShadow()
        }
        .buttonStyle(.plain)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            .padding(.top, safeTop + 6)
            .padding(.trailing, ShellMetrics.topChromeSideInset)
    }

    /// 队列面板（RN MusicHomeQueuePanel）：当前专辑全部曲目可上下滑，40pt 一行、视口 168、首尾留白让任一行能滚到正中，上下 46pt 渐隐；
    /// 当前曲 18 号白粗体，其余 14 号白 48%；点哪首就切哪首；切曲后自动滚到正中。
    private static let queueRow: CGFloat = 40
    private static let queueViewport: CGFloat = 168
    private static let queueFade: CGFloat = 46

    private var trackTitles: some View {
        let q = player.queue
        let fade = Self.queueFade / Self.queueViewport
        return ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    ForEach(q, id: \.self) { i in
                        let active = i == player.trackIndex
                        Button { player.select(index: i) } label: {
                            Text(MusicCatalog.tracks[i].localizedTitle)
                                .font(.system(size: active ? 18 : 14, weight: active ? .semibold : .regular))
                                .foregroundStyle(active ? Color.white : Color.white.opacity(0.48))
                                .lineLimit(1)
                                .frame(maxWidth: .infinity)
                                .frame(height: Self.queueRow)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .id(i)
                    }
                }
                .padding(.vertical, (Self.queueViewport - Self.queueRow) / 2)
            }
            .frame(maxWidth: 300)
            .frame(height: Self.queueViewport)
            .mask(LinearGradient(stops: [.init(color: .clear, location: 0), .init(color: .black, location: fade),
                                         .init(color: .black, location: 1 - fade), .init(color: .clear, location: 1)],
                                 startPoint: .top, endPoint: .bottom))
            .onAppear { proxy.scrollTo(player.trackIndex, anchor: .center) }
            .onChange(of: player.trackIndex) { _, i in withAnimation(.easeInOut(duration: 0.6)) { proxy.scrollTo(i, anchor: .center) } }
            .onChange(of: player.album) { _, _ in proxy.scrollTo(player.trackIndex, anchor: .center) }
        }
        .padding(.horizontal, 24)
    }

    private var moodRow: some View {
        HStack(spacing: 0) {
            ForEach(MusicCatalog.albums, id: \.self) { album in
                let on = album == player.album
                Button { player.selectAlbum(album) } label: {
                    VStack(spacing: 7) {
                        let g = MusicAlbumGlyph.glyph(album)
                        MaterialIcon(glyph: g.glyph, size: 24, color: on ? Brand.logo : .white, community: g.community)
                        Text(MusicAlbumRules.shortLabel(album))
                            .font(.system(size: 12, weight: on ? .semibold : .regular))
                    }
                    .foregroundStyle(on ? Brand.logo : .white)
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 14)
    }

    /// 进度条：左侧已播、右侧总长（RN 音乐页显示的是总长，不是剩余）；可拖可点
    private var scrubber: some View {
        let ratio = dragRatio ?? player.progress
        let total = player.displayDuration
        return HStack(spacing: 12) {
            Text(ChapterAudioPlayer.timeLabel(ratio * total))
                .font(.system(size: ShellMetrics.timeFontSize))
                .foregroundStyle(.white.opacity(0.62))
                .frame(minWidth: ShellMetrics.timeLabelMinWidth, alignment: .leading)
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.28)).frame(height: 3)
                    Capsule().fill(.white.opacity(0.92))
                        .frame(width: max(0, g.size.width * ratio), height: 3)
                }
                .frame(width: g.size.width, height: g.size.height)
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { v in dragRatio = min(1, max(0, v.location.x / g.size.width)) }
                        .onEnded { v in
                            let r = min(1, max(0, v.location.x / g.size.width))
                            dragRatio = nil
                            player.seek(ratio: r)
                        }
                )
            }
            .frame(height: 24)
            Text(ChapterAudioPlayer.timeLabel(total))
                .font(.system(size: ShellMetrics.timeFontSize))
                .foregroundStyle(.white.opacity(0.62))
                .frame(minWidth: ShellMetrics.timeLabelMinWidth, alignment: .trailing)
        }
        .padding(.horizontal, 22)
    }

    private var transport: some View {
        HStack {
            // 单曲循环（左）/ 整专辑循环（右）：开着的带圆底，与 RN loopBtnOn 一致
            loopButton(one: true, on: player.repeatMode == .one) { player.toggleRepeatOne() }
            Spacer()
            // RN MusicHomeTransportButtonRow：skip 36 白、播放 64 白底 #1C1410 图标 34、循环自绘 24（开 白 / 关 白 .48）
            Button { player.previous() } label: { icon(MI.skipPrevious, size: ShellMetrics.skipIconSize, color: .white) }
                .buttonStyle(.plain)
            Spacer()
            Button { player.toggle() } label: {
                ZStack {
                    Circle().fill(.white)
                    if player.isLoading {
                        ProgressView().tint(Color(rgb: 0x1C1410))
                    } else {
                        MaterialIcon(glyph: player.isPlaying ? MI.pause : MI.playArrow,
                                     size: ShellMetrics.playIconSize, color: Color(rgb: 0x1C1410))
                            .offset(x: player.isPlaying ? 0 : ShellMetrics.playIconNudge)
                    }
                }
                .frame(width: ShellMetrics.playButtonSize, height: ShellMetrics.playButtonSize)
            }
            .buttonStyle(.plain)
            Spacer()
            Button { player.next() } label: { icon(MI.skipNext, size: ShellMetrics.skipIconSize, color: .white) }
                .buttonStyle(.plain)
            Spacer()
            loopButton(one: false, on: player.repeatMode == .all) { player.toggleRepeatAll() }
        }
        .padding(.horizontal, 16)
    }

    private func loopButton(one: Bool, on: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            ZStack {
                Circle().fill(.white.opacity(on ? 0.14 : 0))
                RepeatGlyph(badge: one ? "1" : nil, color: .white.opacity(on ? 1 : 0.48), size: ShellMetrics.loopIconSize)
            }
            .frame(width: 44, height: 44).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func icon(_ glyph: String, size: CGFloat, color: Color) -> some View {
        MaterialIcon(glyph: glyph, size: size, color: color)
            .frame(width: 48, height: 48)
    }
}

/// 固定种子的随机数，保证鱼群分布每次启动一致（RN 版靠 seed 做同样的事）
