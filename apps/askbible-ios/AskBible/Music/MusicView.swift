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
            // 任何触碰都算「用户还在」：不吞事件，按钮照常响应（RN root onTouchStart={resetUiAutoHide}）
            .simultaneousGesture(DragGesture(minimumDistance: 0).onChanged { _ in resetAutoHide() })
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

    /// 队列窗口：上一曲 / 当前曲 / 下一曲（RN 队列面板滚到当前曲居中的样子）。点上下曲直接切。
    private var trackTitles: some View {
        VStack(spacing: 6) {
            Button { player.previous() } label: {
                Text(player.previousTrack?.title ?? " ")
                    .font(.system(size: 15))
                    .foregroundStyle(.white.opacity(0.34))
                    .lineLimit(1)
            }
            .buttonStyle(.plain)
            Text(player.track?.title ?? "\u{2014}")
                .font(.system(size: 23, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .shadow(color: .black.opacity(0.4), radius: 5, y: 2)
            Button { player.next() } label: {
                Text(player.nextTrack?.title ?? " ")
                    .font(.system(size: 15))
                    .foregroundStyle(.white.opacity(0.30))
                    .lineLimit(1)
            }
            .buttonStyle(.plain)
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
                RepeatGlyph(one: one, color: .white.opacity(on ? 1 : 0.48), size: ShellMetrics.loopIconSize)
            }
            .frame(width: 44, height: 44)
        }
        .buttonStyle(.plain)
    }

    private func icon(_ glyph: String, size: CGFloat, color: Color) -> some View {
        MaterialIcon(glyph: glyph, size: size, color: color)
            .frame(width: 48, height: 48)
    }
}

/// 固定种子的随机数，保证鱼群分布每次启动一致（RN 版靠 seed 做同样的事）
