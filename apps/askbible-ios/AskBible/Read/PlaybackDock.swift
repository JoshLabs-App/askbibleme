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
                    SpeedRateImage(rate: Double(audio.rate), color: theme.ink, accent: theme.accentOt)
                        .frame(minWidth: ShellMetrics.speedButtonSize,
                               minHeight: ShellMetrics.transportButtonSize)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                playButton

                Button { audio.cycleLoop() } label: {
                    RepeatGlyph(badge: audio.loopMode == .chapter ? "1" : nil,
                                color: audio.loopMode == .forward ? theme.muted.opacity(0.85) : theme.accentOt,
                                size: ShellMetrics.loopIconSize)
                        .frame(width: ShellMetrics.loopButtonSize, height: ShellMetrics.loopButtonSize)
                        .background {
                            if audio.loopMode != .forward {
                                Circle().fill(theme.accentOt.opacity(0.15))
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

/// 圆角线框倍速徽章（1.0x / 1.25x / 1.5x / 2.0x），与循环、跳章保持同一描边粗细与视觉高度
struct SpeedRateImage: View {
    let rate: Double
    let color: Color
    var accent: Color = Color(rgb: 0xC1660B)

    private var label: String {
        switch Int((rate * 100).rounded()) {
        case 75: return "0.75x"
        case 125: return "1.25x"
        case 150: return "1.5x"
        case 175: return "1.75x"
        case 200: return "2.0x"
        default: return "1.0x"
        }
    }

    private var active: Bool {
        abs(rate - 1.0) > 0.01
    }

    var body: some View {
        Text(label)
            .font(.system(size: 11.5, weight: .bold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(active ? accent : color)
            .padding(.horizontal, 7)
            .frame(minWidth: 38, minHeight: 22)
            .background(
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .fill(active ? accent.opacity(0.15) : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .strokeBorder(active ? accent : color.opacity(0.55), lineWidth: 1.55)
            )
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
                p.move(to: CGPoint(x: 17, y: 3)); p.addLine(to: CGPoint(x: 20.5, y: 6.5)); p.addLine(to: CGPoint(x: 17, y: 10))
                p.move(to: CGPoint(x: 3.5, y: 11)); p.addLine(to: CGPoint(x: 3.5, y: 9.5))
                p.addCurve(to: CGPoint(x: 6.5, y: 6.5), control1: CGPoint(x: 3.5, y: 7.84), control2: CGPoint(x: 4.84, y: 6.5))
                p.addLine(to: CGPoint(x: 20.5, y: 6.5))

                p.move(to: CGPoint(x: 7, y: 21)); p.addLine(to: CGPoint(x: 3.5, y: 17.5)); p.addLine(to: CGPoint(x: 7, y: 14))
                p.move(to: CGPoint(x: 20.5, y: 13)); p.addLine(to: CGPoint(x: 20.5, y: 14.5))
                p.addCurve(to: CGPoint(x: 17.5, y: 17.5), control1: CGPoint(x: 20.5, y: 16.16), control2: CGPoint(x: 19.16, y: 17.5))
                p.addLine(to: CGPoint(x: 3.5, y: 17.5))
            }
            .applying(CGAffineTransform(scaleX: s, y: s))
            .stroke(color, style: StrokeStyle(lineWidth: 1.8 * s, lineCap: .round, lineJoin: .round))

            if let badge {
                Text(badge)
                    .font(.system(size: 8.5 * s, weight: .bold, design: .rounded))
                    .foregroundStyle(color)
                    .position(x: 12 * s, y: 12.1 * s)
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
