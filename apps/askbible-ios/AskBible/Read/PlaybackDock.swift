import SwiftUI

/// 读经播放坞。几何逐值搬自 `shellPlaybackTransportLayout.ts`，图标与 RN `ReadScripturePlaybackDock` 同源：
/// 进度行 minHeight 23 / 时间 12pt 500 minWidth 36；下一行 space-between 分三段，
/// 左 search 24（框 44），中段 gap 28 装「语速图 56×22 + 播放 64（图标 34）+ 循环 44（自绘 24）」，右 skip-next 36（框 48）。
struct PlaybackDock: View {
    @ObservedObject var audio: ChapterAudioPlayer
    /// 当前译本没有可播音源时置灰（RN 版同样按 readChapterAudioAvailable 决定）
    var available: Bool = true
    var onSearch: () -> Void = {}
    var onSkipNext: () -> Void = {}
    /// 紧凑档点中间那条：展开完整 transport（语速 / 循环 / 搜索 在紧凑档放不下）
    var onExpand: () -> Void = {}
    /// 播放键的自定义动作（计划播放页：没建池时从选中章起播）；nil 走 audio.toggle()
    var onToggle: (() -> Void)? = nil
    /// 紧凑档左上显示的章名（「创世记 1」）。空串就只显示时间行
    var title: String = ""
    /// 紧凑档左侧缩略图用的自然场景 id（借首页场景图当封面 —— 章节朗读本身没有封面图）
    var artworkSceneId: String? = nil
    /// 「下一章」标签的界面语言
    var locale: AppLocale = .zhCN

    private var nextLabel: String {
        switch locale {
        case .en: return "Next\nChapter"
        case .zhTW: return "下一章"
        case .zhCN: return "下一章"
        }
    }

    @Environment(\.parchment) private var theme

    private var elapsed: String { ChapterAudioPlayer.timeLabel(audio.currentTime) }
    /// RN 右侧显示总时长（formatClock(durationSec)），没有时长时是 "—:—"
    private var total: String {
        audio.duration > 0 ? ChapterAudioPlayer.timeLabel(audio.duration) : "\u{2014}:\u{2014}"
    }

    /// 倒计时（Josh 圈的参考图里右边是 -3:42，不是总时长）
    private var remaining: String {
        guard audio.duration > 0 else { return "\u{2014}:\u{2014}" }
        return "-" + ChapterAudioPlayer.timeLabel(max(0, audio.duration - audio.currentTime))
    }

    /// 紧凑档：浮在系统底栏上方的迷你播放器。两行 —— 上行「封面 + 章名 + 进度 + 倒计时」，
    /// 下行「语速 / 循环 / 琥珀大播放键 / 下一章」。按 Josh 2026-09-16 圈定的参考图做。
    var compact: Bool = false

    var body: some View {
        if compact { compactBody } else { fullBody }
    }

    private var compactBody: some View {
        // 几何按 Josh 2026-09-16 给的效果图逐项对齐：整块更紧凑，控件比之前小一档，
        // 「下一章」带两行文字标签（效果图里的 Next Chapter）。
        VStack(spacing: 8) {
            HStack(spacing: 10) {
                artwork

                VStack(alignment: .leading, spacing: 4) {
                    if !title.isEmpty {
                        Text(title)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(theme.scripturePrimaryText)
                            .lineLimit(1)
                    }
                    HStack(spacing: 8) {
                        timeText(elapsed)
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color(parchment: 0x5c4030, opacity: 0.20))
                            GeometryReader { geo in
                                Capsule().fill(Brand.logo).frame(width: geo.size.width * audio.progress)
                            }
                        }
                        .frame(height: 2)
                        timeText(remaining)
                    }
                }
            }
            HStack(spacing: 0) {
                Button { audio.cycleRate() } label: {
                    SpeedRateImage(rate: Double(audio.rate), color: theme.scriptureSecondaryText.opacity(0.75))
                        .scaleEffect(0.82)
                        // 视觉尺寸按效果图走，但点击框一律撑到 44 —— 上一轮照效果图把框也缩了，
                        // Josh 真机反馈「图标都比较小，会误点」。图标小是设计，触控小是 bug。
                        .frame(width: 48, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Spacer(minLength: 0)

                Button { audio.cycleLoop() } label: {
                    RepeatGlyph(badge: audio.loopMode.badge,
                                color: audio.loopMode == .forward ? theme.scriptureSecondaryText : theme.scripturePrimaryText,
                                size: 19)
                        .opacity(0.8)
                        .frame(width: 48, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Button {
                    if let onToggle { onToggle() } else { audio.toggle() }
                } label: {
                    ZStack {
                        Circle().fill(Brand.logo)
                        if audio.isLoading && audio.wantsPlayback {
                            ProgressView().tint(theme.ink)
                        } else {
                            Image(systemName: audio.isPlaying ? "pause.fill" : "play.fill")
                                .font(.system(size: 19, weight: .bold))
                                .foregroundStyle(theme.ink)
                        }
                    }
                    .frame(width: 42, height: 42)
                    .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 18)

                // 下一章：图标 + 两行小字标签（效果图里的 Next Chapter）
                Button(action: onSkipNext) {
                    HStack(spacing: 5) {
                        Image(systemName: "forward.end.fill")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(theme.scriptureSecondaryText)
                        Text(nextLabel)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(theme.scriptureSecondaryText)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                            .fixedSize()
                    }
                    .frame(height: 44)
                    .padding(.horizontal, 4)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(!available)
                .opacity(available ? 1 : 0.35)

                Spacer(minLength: 0)

                Button(action: onSearch) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 15, weight: .regular))
                        .foregroundStyle(theme.scriptureSecondaryText.opacity(0.8))
                        .frame(width: 48, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        // 整块垫一层纸色底色玻璃（Josh 2026-09-16：「原来做的 GPT 图这里是有一层底色玻璃的」，
        // 只垫文字行时，按钮行背后经文透出来太吵）。玻璃边缘仍由外层 askGlass 提供高光。
        .background(
            RoundedRectangle(cornerRadius: AskCorner.control, style: .continuous)
                .fill(theme.scriptureBackground.opacity(0.78))
        )
    }

    /// 封面：用当前自然场景的缩略图（没有就画一本书的字形底）
    private var artwork: some View {
        let shape = RoundedRectangle(cornerRadius: 10, style: .continuous)
        return Group {
            if let id = artworkSceneId, let image = NatureScenes.thumbImage(id: id) {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                ZStack {
                    theme.scriptureAccent.opacity(0.18)
                    Image(systemName: "book.fill")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(theme.scriptureAccent)
                }
            }
        }
        .frame(width: 40, height: 40)
        .clipShape(shape)
        .overlay(shape.strokeBorder(theme.border, lineWidth: 0.5))
    }

    private var fullBody: some View {
        VStack(spacing: 0) {
            VStack(spacing: 0) {
                if let message = audio.errorMessage {
                    Text(message)
                        .font(.system(size: 11))
                        .foregroundStyle(theme.divineSpeech)
                        .lineLimit(1)
                }
                scrubber
                    .padding(.bottom, ShellMetrics.dockMarginBottom)  // scrubberMarginBottom 2
                transport
                    .padding(.top, ShellMetrics.dockMarginBottom)     // transportMarginTop 2
            }
            .padding(.top, ShellMetrics.dockPaddingTop)
            .padding(.horizontal, ShellMetrics.dockPaddingH)
            .padding(.bottom, ShellMetrics.dockMarginBottom)
            // 坞与底栏现在同处一块玻璃胶囊内（DECISIONS 2026-09-15），分隔靠一条内缩的 hairline，
            // 不再靠 6pt 空隙 + 各自的矩形底。原来坞顶那条 border 去掉了 —— 它会压在胶囊的玻璃边缘上。
            Rectangle()
                .fill(theme.border.opacity(0.55))
                .frame(height: 1 / UIScreen.main.scale)
                .padding(.horizontal, 24)
        }
        // 底色由 ShellTabBarHost 的玻璃胶囊承担；这里不铺任何底
    }

    private var scrubber: some View {
        HStack(spacing: ShellMetrics.scrubberTimeGap) {
            timeText(elapsed)
                .frame(minWidth: ShellMetrics.timeLabelMinWidth, alignment: .leading)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    // MinimalProgressBar：轨 rgba(92,64,48,.22) / 填充 LOGO 黄，高 3 圆角 1.5
                    Capsule().fill(Color(red: 92 / 255, green: 64 / 255, blue: 48 / 255, opacity: 0.22))
                    Capsule()
                        .fill(Brand.logo)
                        .frame(width: geo.size.width * audio.progress)
                }
            }
            .frame(height: 3)

            timeText(total)
                .frame(minWidth: ShellMetrics.timeLabelMinWidth, alignment: .trailing)
        }
        .frame(minHeight: ShellMetrics.scrubberRowHeight)
        .padding(.horizontal, 4)
    }

    private func timeText(_ s: String) -> some View {
        Text(s)
            .font(.system(size: compact ? 11 : ShellMetrics.timeFontSize, weight: compact ? .semibold : .medium))
            .monospacedDigit()
            .foregroundStyle(theme.muted)
    }

    private var transport: some View {
        HStack(spacing: 0) {
            glyphButton(MI.search, size: ShellMetrics.loopIconSize, frame: ShellMetrics.loopButtonSize, action: onSearch)

            Spacer(minLength: 0)

            HStack(spacing: ShellMetrics.transportMainGap) {
                Button { audio.cycleRate() } label: {
                    SpeedRateImage(rate: Double(audio.rate), color: theme.ink)
                        .frame(minWidth: ShellMetrics.speedButtonSize,
                               minHeight: ShellMetrics.transportButtonSize)
                }
                .buttonStyle(.plain)

                playButton

                Button { audio.cycleLoop() } label: {
                    RepeatGlyph(badge: audio.loopMode.badge,
                                color: audio.loopMode == .forward ? theme.muted : theme.ink,
                                size: ShellMetrics.loopIconSize)
                        .frame(width: ShellMetrics.loopButtonSize, height: ShellMetrics.loopButtonSize)
                        .background {
                            // loopBtnOn: rgba(92, 64, 48, 0.1)
                            if audio.loopMode != .forward {
                                Circle().fill(Color(parchment: 0x5c4030, opacity: 0.1))
                            }
                        }
                }
                .buttonStyle(.plain)
            }

            Spacer(minLength: 0)

            glyphButton(MI.skipNext, size: ShellMetrics.skipIconSize, frame: ShellMetrics.transportButtonSize, action: onSkipNext)
                .disabled(!available)
                .opacity(available ? 1 : 0.35)
        }
        .padding(.horizontal, 4)
    }

    /// 停止时是 ink 底 / surfaceSolid 图标；播放中翻成 LOGO 黄底 / ink 图标；play-arrow 右挪 3（playIconNudge）
    private var playButton: some View {
        Button {
            if let onToggle { onToggle() } else { audio.toggle() }
        } label: {
            ZStack {
                Circle().fill(audio.isPlaying ? Brand.logo : theme.ink)
                // 只有用户点了播放、还没出声时才转圈；开章预载不转
                if audio.isLoading && audio.wantsPlayback {
                    ProgressView()
                        .tint(audio.isPlaying ? theme.ink : theme.surfaceSolid)
                } else {
                    MaterialIcon(glyph: audio.isPlaying ? MI.pause : MI.playArrow,
                                 size: ShellMetrics.playIconSize,
                                 color: audio.isPlaying ? theme.ink : theme.surfaceSolid)
                        .offset(x: audio.isPlaying ? 0 : ShellMetrics.playIconNudge)
                }
            }
            .frame(width: ShellMetrics.playButtonSize, height: ShellMetrics.playButtonSize)
        }
        .buttonStyle(.plain)
        .disabled(!available)
        .opacity(available ? 1 : 0.35)
    }

    private func glyphButton(_ glyph: String, size: CGFloat, frame: CGFloat,
                             action: @escaping () -> Void) -> some View {
        Button(action: action) {
            MaterialIcon(glyph: glyph, size: size, color: theme.ink)
                .frame(width: frame, height: frame)
        }
        .buttonStyle(.plain)
    }
}

/// 语速档位用 RN 同一套预渲染图（scripture-speed-*.png，56×22，tint 成 ink），不受系统字体大小影响
struct SpeedRateImage: View {
    let rate: Double
    let color: Color

    private var key: String {
        switch Int((rate * 100).rounded()) {
        case 75: return "075"
        case 125: return "125"
        case 150: return "15"
        case 175: return "175"
        case 200: return "2"
        default: return "1"
        }
    }

    var body: some View {
        Group {
            if let img = UIImage(named: "scripture-speed-\(key)") {
                Image(uiImage: img.withRenderingMode(.alwaysTemplate))
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .foregroundStyle(color)
            } else {
                Text(key == "1" ? "1x" : "\(rate)x").font(.system(size: 22, weight: .bold)).foregroundStyle(color)
            }
        }
        .frame(width: ShellMetrics.speedButtonSize, height: 22)
    }
}

/// RN `MusicRepeatAllIcon` / `MusicRepeatOneIcon`（react-native-svg 手绘）：24 格里两段圆角箭头，描边 1.6 圆头；单章版中间一个 8pt 粗体 "1"
struct RepeatGlyph: View {
    /// 角标：本章「1」、本书「B」、继续往前 nil
    var badge: String?
    var color: Color
    var size: CGFloat = 24

    var body: some View {
        let s = size / 24
        ZStack {
            Path { p in
                // M7 7h8a4 4 0 0 1 4 4v1（四分之一圆用三次贝塞尔近似，k = 0.5523 × 4）
                p.move(to: CGPoint(x: 7, y: 7)); p.addLine(to: CGPoint(x: 15, y: 7))
                p.addCurve(to: CGPoint(x: 19, y: 11), control1: CGPoint(x: 17.21, y: 7), control2: CGPoint(x: 19, y: 8.79))
                p.addLine(to: CGPoint(x: 19, y: 12))
                // M17 17H9a4 4 0 0 1-4-4v-1
                p.move(to: CGPoint(x: 17, y: 17)); p.addLine(to: CGPoint(x: 9, y: 17))
                p.addCurve(to: CGPoint(x: 5, y: 13), control1: CGPoint(x: 6.79, y: 17), control2: CGPoint(x: 5, y: 15.21))
                p.addLine(to: CGPoint(x: 5, y: 12))
                // M7 4 4 7l3 3   M17 20l3-3-3-3
                p.move(to: CGPoint(x: 7, y: 4)); p.addLine(to: CGPoint(x: 4, y: 7)); p.addLine(to: CGPoint(x: 7, y: 10))
                p.move(to: CGPoint(x: 17, y: 20)); p.addLine(to: CGPoint(x: 20, y: 17)); p.addLine(to: CGPoint(x: 17, y: 14))
            }
            .applying(CGAffineTransform(scaleX: s, y: s))
            .stroke(color, style: StrokeStyle(lineWidth: 1.6 * s, lineCap: .round, lineJoin: .round))

            if let badge {
                Text(badge)
                    .font(.system(size: 8 * s, weight: .bold))
                    .foregroundStyle(color)
                    .position(x: 12 * s, y: 12.3 * s)
            }
        }
        .frame(width: size, height: size)
    }
}


/// 挂进 TabView 的读经坞。系统给两种位置：贴在底栏上方的 `inline`（矮，只够一行）
/// 与用户上拉后的 `expanded`（高，能放完整 transport）。两档共用同一个 `PlaybackDock`，
/// 只切 `compact` —— 一套控件，两个尺寸，不是两份实现。
@available(iOS 26, *)
struct PlaybackDockAccessory: View {
    @Environment(\.tabViewBottomAccessoryPlacement) private var placement
    let dock: PlaybackDock

    var body: some View {
        var d = dock
        // 实测（iOS 26.5 模拟器）：挂在底栏上方时 placement 报的是 .expanded，但系统给的高度只有一行，
        // 完整 transport 会被裁掉。所以不看 placement，accessory 里一律用紧凑档；
        // 完整 transport 留给后面做上拉展开（见 redesign 文档「还没做的」）。
        d.compact = true
        _ = placement
        return d
    }
}
