import SwiftUI

/// 读经播放坞：100% 对齐安卓 `PlaybackDock.kt`（D-45）。
/// 底色由外层 `AskTabShell` 的 `ParchmentPinnedBottom` 连坞带底栏整宽无缝铺设。
struct PlaybackDock: View {
    @ObservedObject var audio: ChapterAudioPlayer
    var available: Bool = true
    var onSearch: () -> Void = {}
    var onSkipNext: () -> Void = {}
    var onToggle: (() -> Void)? = nil

    @Environment(\.parchment) private var theme

    private var elapsed: String { ChapterAudioPlayer.timeLabel(audio.currentTime) }
    private var total: String {
        audio.duration > 0 ? ChapterAudioPlayer.timeLabel(audio.duration) : "\u{2014}:\u{2014}"
    }

    var body: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(theme.border)
                .frame(height: 1 / UIScreen.main.scale)

            VStack(spacing: 0) {
                if let message = audio.errorMessage {
                    Text(message)
                        .askFont(size: 11)
                        .foregroundStyle(theme.divineSpeech)
                        .lineLimit(1)
                }
                scrubber
                    .padding(.bottom, ShellMetrics.dockMarginBottom)
                transport
                    .padding(.top, ShellMetrics.dockMarginBottom)
            }
            .padding(.top, ShellMetrics.dockPaddingTop)
            .padding(.horizontal, ShellMetrics.dockPaddingH)
            .padding(.bottom, ShellMetrics.dockMarginBottom)
        }
    }

    private var scrubber: some View {
        HStack(spacing: ShellMetrics.scrubberTimeGap) {
            timeText(elapsed)
                .frame(minWidth: ShellMetrics.timeLabelMinWidth, alignment: .leading)

            SeekableProgressBar(
                audio: audio,
                trackHeight: 3,
                trackColor: theme.isDark
                    ? Color.white.opacity(0.24)
                    : Color(red: 92 / 255, green: 64 / 255, blue: 48 / 255, opacity: 0.22)
            )

            timeText(total)
                .frame(minWidth: ShellMetrics.timeLabelMinWidth, alignment: .trailing)
        }
        .frame(minHeight: ShellMetrics.scrubberRowHeight)
        .padding(.horizontal, 4)
    }

    private func timeText(_ s: String) -> some View {
        Text(s)
            .askFont(size: ShellMetrics.timeFontSize, weight: .medium)
            .monospacedDigit()
            .foregroundStyle(theme.muted)
    }

    private var transport: some View {
        HStack(spacing: 0) {
            glyphButton(MI.search, size: ShellMetrics.loopIconSize, frame: ShellMetrics.transportButtonSize, action: onSearch)

            Spacer(minLength: 0)

            HStack(spacing: ShellMetrics.transportMainGap) {
                Button { audio.cycleRate() } label: {
                    SpeedRateImage(rate: Double(audio.rate), color: theme.ink)
                        .frame(minWidth: ShellMetrics.speedButtonSize,
                               minHeight: ShellMetrics.transportButtonSize)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                playButton

                Button { audio.cycleLoop() } label: {
                    RepeatGlyph(badge: audio.loopMode.badge,
                                color: audio.loopMode == .forward ? theme.muted : theme.ink,
                                size: ShellMetrics.loopIconSize)
                        .frame(width: ShellMetrics.loopButtonSize, height: ShellMetrics.loopButtonSize)
                        .background {
                            if audio.loopMode != .forward {
                                Circle().fill(theme.isDark ? Color.white.opacity(0.14) : Color(parchment: 0x5c4030, opacity: 0.1))
                            }
                        }
                        .contentShape(Circle())
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

    private var playButton: some View {
        Button {
            if let onToggle { onToggle() } else { audio.toggle() }
        } label: {
            ZStack {
                Circle().fill(audio.isPlaying ? Brand.logo : theme.ink)
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
            .contentShape(Circle())
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
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// 语速档位预渲染图（scripture-speed-*.png，56×22，tint 成 ink）
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
                Text(key == "1" ? "1x" : "\(rate)x").askFont(size: 22, weight: .bold).foregroundStyle(color)
            }
        }
        .frame(width: ShellMetrics.speedButtonSize, height: 22)
    }
}

struct RepeatGlyph: View {
    var badge: String?
    var color: Color
    var size: CGFloat = 24

    var body: some View {
        let s = size / 24
        ZStack {
            Path { p in
                p.move(to: CGPoint(x: 7, y: 7)); p.addLine(to: CGPoint(x: 15, y: 7))
                p.addCurve(to: CGPoint(x: 19, y: 11), control1: CGPoint(x: 17.21, y: 7), control2: CGPoint(x: 19, y: 8.79))
                p.addLine(to: CGPoint(x: 19, y: 12))
                p.move(to: CGPoint(x: 17, y: 17)); p.addLine(to: CGPoint(x: 9, y: 17))
                p.addCurve(to: CGPoint(x: 5, y: 13), control1: CGPoint(x: 6.79, y: 17), control2: CGPoint(x: 5, y: 15.21))
                p.addLine(to: CGPoint(x: 5, y: 12))
                p.move(to: CGPoint(x: 7, y: 4)); p.addLine(to: CGPoint(x: 4, y: 7)); p.addLine(to: CGPoint(x: 7, y: 10))
                p.move(to: CGPoint(x: 17, y: 20)); p.addLine(to: CGPoint(x: 20, y: 17)); p.addLine(to: CGPoint(x: 17, y: 14))
            }
            .applying(CGAffineTransform(scaleX: s, y: s))
            .stroke(color, style: StrokeStyle(lineWidth: 1.6 * s, lineCap: .round, lineJoin: .round))

            if let badge {
                Text(badge)
                    .askFont(size: 8 * s, weight: .bold)
                    .foregroundStyle(color)
                    .position(x: 12 * s, y: 12.3 * s)
            }
        }
        .frame(width: size, height: size)
    }
}

struct SeekableProgressBar: View {
    @ObservedObject var audio: ChapterAudioPlayer
    var trackHeight: CGFloat
    var trackColor: Color
    var fillColor: Color = Brand.logo

    @State private var dragFraction: Double?

    private var fraction: Double {
        dragFraction ?? min(max(audio.progress, 0), 1)
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(trackColor)
                Capsule().fill(fillColor).frame(width: geo.size.width * fraction)
            }
            .frame(height: trackHeight)
            .frame(maxHeight: .infinity, alignment: .center)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        guard audio.duration > 0, geo.size.width > 0 else { return }
                        dragFraction = min(max(value.location.x / geo.size.width, 0), 1)
                    }
                    .onEnded { value in
                        defer { dragFraction = nil }
                        guard audio.duration > 0, geo.size.width > 0 else { return }
                        let f = min(max(value.location.x / geo.size.width, 0), 1)
                        audio.seek(to: f * audio.duration)
                    }
            )
        }
        .frame(height: 44)
    }
}
