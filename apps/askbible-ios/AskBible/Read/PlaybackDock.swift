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
    /// 播放键的自定义动作（计划播放页：没建池时从选中章起播）；nil 走 audio.toggle()
    var onToggle: (() -> Void)? = nil

    private let theme = Parchment.light

    private var elapsed: String { ChapterAudioPlayer.timeLabel(audio.currentTime) }
    /// RN 右侧显示总时长（formatClock(durationSec)），没有时长时是 "—:—"
    private var total: String {
        audio.duration > 0 ? ChapterAudioPlayer.timeLabel(audio.duration) : "\u{2014}:\u{2014}"
    }

    var body: some View {
        VStack(spacing: 0) {
            // RN wrap.borderTop 是 hairline（1 物理像素）的 border 色 —— 在羊皮纹上几乎看不见
            Rectangle()
                .fill(theme.border)
                .frame(height: 1 / UIScreen.main.scale)

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
        }
        // 底色由 ShellTabBarHost 连坞带底栏一起铺；这里不再单独铺一层（两层羊皮纹错位会在坞底露出一条接缝）
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
            .font(.system(size: ShellMetrics.timeFontSize, weight: .medium))
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
                    RepeatGlyph(one: audio.loopMode == .chapter,
                                color: audio.loopMode == .off ? theme.muted : theme.ink,
                                size: ShellMetrics.loopIconSize)
                        .frame(width: ShellMetrics.loopButtonSize, height: ShellMetrics.loopButtonSize)
                        .background {
                            // loopBtnOn: rgba(92, 64, 48, 0.1)
                            if audio.loopMode != .off {
                                Circle().fill(Color(rgb: 0x5c4030, opacity: 0.1))
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
    var one: Bool
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

            if one {
                Text("1")
                    .font(.system(size: 8 * s, weight: .bold))
                    .foregroundStyle(color)
                    .position(x: 12 * s, y: 12.3 * s)
            }
        }
        .frame(width: size, height: size)
    }
}
