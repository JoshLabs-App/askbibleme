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

    /// 安静档（读经页）：去掉封面和章名，控件小一档、不带「下一章」文字，整块矮一截。
    /// Josh 2026-09-21：「播放栏太大了，也太吵，影响阅读」——读经页的主角是经文，
    /// 坞只需要够按；计划播放页不开这档（那页坞就是主角）。
    /// 读经 / 圣经页的坞：走**安卓那套**完整单栏布局（`fullBody`，几何来自三端对拍的 ShellMetrics），
    /// 贴底铺满、不透明纸底、顶一条 hairline。Josh 2026-09-21：「换回原来的，像安卓那样子的」。
    var quiet: Bool = false

    /// 安静档的底色：**不透明**深沉香木。玻璃底会把底下的经文透上来，字压字最难读——
    /// Josh 2026-09-21：「透明玻璃在影响阅读，还不如原来的黑播放栏」。
    /// 跟界面深色模式联动：夜里要比纸面（#1A1512）更暗一档，否则这条栏比周围还亮。
    private var quietFill: Color { theme.isDark ? Color(parchment: 0x100C0A) : Color(parchment: 0x241A13) }
    /// 深底上的前景一律纸色，不能再用 theme 的墨色（那是给浅底用的）
    private func quietFg(_ opacity: Double) -> Color { Color(parchment: 0xECD9B9, opacity: opacity) }

    var body: some View {
        if quiet { nativeBody } else if compact { compactBody } else { fullBody }
    }

    /// 读经 / 圣经页的坞：**苹果原生质感**——系统分隔线、SF Symbols、系统字体与 .secondary 层级，
    /// 播放键是裸字形不是实心圆钮（Apple Music / Podcasts 的迷你栏就是这样）。
    /// 底色跟页面一致（`theme.scriptureBackground`，不透明），贴底铺满。
    /// Josh 2026-09-21：「改苹果原生，但是需要底色跟页面一致」。
    private var nativeBody: some View {
        VStack(spacing: 6) {
            HStack(spacing: 10) {
                Text(elapsed)
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 36, alignment: .leading)
                SeekableProgressBar(
                    audio: audio,
                    trackHeight: 4,
                    trackColor: Color.primary.opacity(0.12),
                    fillColor: theme.accentOt
                )
                Text(remaining)
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 40, alignment: .trailing)
            }
            .frame(height: 22)

            HStack(spacing: 0) {
                // 语速：Podcasts 那种文字胶囊，比自绘的速度图更「系统」
                Button { audio.cycleRate() } label: {
                    Text(String(format: "%g\u{00D7}", audio.rate))
                        .font(.footnote.weight(.semibold).monospacedDigit())
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(Color.primary.opacity(0.07)))
                        .frame(width: 60, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Spacer(minLength: 0)

                Button { audio.cycleLoop() } label: {
                    Image(systemName: audio.loopMode.badge == "1" ? "repeat.1" : "repeat")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(audio.loopMode == .forward ? AnyShapeStyle(.secondary) : AnyShapeStyle(theme.accentOt))
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Spacer(minLength: 0)

                Button {
                    if let onToggle { onToggle() } else { audio.toggle() }
                } label: {
                    Group {
                        if audio.isLoading && audio.wantsPlayback {
                            ProgressView()
                        } else {
                            Image(systemName: audio.isPlaying ? "pause.fill" : "play.fill")
                                .font(.system(size: 30, weight: .regular))
                                .foregroundStyle(theme.ink)
                        }
                    }
                    .frame(width: 52, height: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Spacer(minLength: 0)

                Button(action: onSkipNext) {
                    Image(systemName: "forward.end.fill")
                        .font(.system(size: 20, weight: .regular))
                        .foregroundStyle(theme.ink)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(!available)
                .opacity(available ? 1 : 0.3)

                Spacer(minLength: 0)

                Button(action: onSearch) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 18, weight: .regular))
                        .foregroundStyle(.secondary)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 6)
        .padding(.bottom, 2)
        // 底色跟页面一致，且必须不透明 —— 坞是浮在经文上的 overlay。
        // 用 `alignedParchment` 而不是纯色 canvas：页面是**带纸纹**的羊皮底，
        // 坞铺一块纯色就成了一块板，Josh 2026-09-23「圣经页的播放栏还不是羊皮卷的」说的就是这个。
        .background(alignedParchment(theme: theme))
        .overlay(alignment: .top) { Divider() }
    }

    /// 紧凑档：音乐页那套语言 —— 深底、白前景、白圆播放键、进度条白轨白填充，
    /// transport 用 Spacer 均分（Josh 2026-09-21：「像音乐那样，更好看好操作」）。
    /// 读经页（quiet）再去掉封面和章名，并贴底铺满；计划播放页保留封面章名。
    private var compactBody: some View {
        VStack(spacing: quiet ? 6 : 8) {
            HStack(spacing: quiet ? 0 : 10) {
                if !quiet { artwork }

                VStack(alignment: .leading, spacing: 4) {
                    if !title.isEmpty && !quiet {
                        Text(title)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(.white.opacity(0.95))
                            .lineLimit(1)
                    }
                    // 还没加载出时长前不画进度行（00:00 / —:— 是纯噪声）
                    if !quiet || audio.duration > 0 {
                        HStack(spacing: 12) {
                            timeText(elapsed)
                                .frame(minWidth: ShellMetrics.timeLabelMinWidth, alignment: .leading)
                            // 音乐页同款：轨 白 0.28 / 填充 白 0.92 / 高 3，触控框 24
                            SeekableProgressBar(
                                audio: audio,
                                trackHeight: 3,
                                trackColor: .white.opacity(0.28),
                                fillColor: .white.opacity(0.92)
                            )
                            timeText(remaining)
                                .frame(minWidth: ShellMetrics.timeLabelMinWidth, alignment: .trailing)
                        }
                    }
                }
            }

            // transport：音乐页的布局 —— 两端是次要键，中间大播放键，全靠 Spacer 均分
            HStack(spacing: 0) {
                Button { audio.cycleRate() } label: {
                    SpeedRateImage(rate: Double(audio.rate), color: .white.opacity(0.62))
                        .scaleEffect(0.9)
                        // 图标可以小，触控框一律 44（Josh 真机反馈过「图标小会误点」）
                        .frame(width: 48, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Spacer(minLength: 0)

                Button { audio.cycleLoop() } label: {
                    ZStack {
                        Circle().fill(.white.opacity(audio.loopMode == .forward ? 0 : 0.14))
                        RepeatGlyph(badge: audio.loopMode.badge,
                                    color: .white.opacity(audio.loopMode == .forward ? 0.48 : 1),
                                    size: 22)
                    }
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Spacer(minLength: 0)

                // 音乐页的播放键：白底 + 深墨图标（这里不用琥珀 —— 深底上白圆更像播放器）
                Button {
                    if let onToggle { onToggle() } else { audio.toggle() }
                } label: {
                    ZStack {
                        Circle().fill(.white)
                        if audio.isLoading && audio.wantsPlayback {
                            ProgressView().tint(Color(rgb: 0x1C1410))
                        } else {
                            Image(systemName: audio.isPlaying ? "pause.fill" : "play.fill")
                                .font(.system(size: 20, weight: .bold))
                                .foregroundStyle(Color(rgb: 0x1C1410))
                        }
                    }
                    .frame(width: 46, height: 46)
                    .contentShape(Circle())
                }
                .buttonStyle(.plain)

                Spacer(minLength: 0)

                Button(action: onSkipNext) {
                    Image(systemName: "forward.end.fill")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundStyle(.white.opacity(available ? 0.92 : 0.3))
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(!available)

                Spacer(minLength: 0)

                Button(action: onSearch) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 17, weight: .regular))
                        .foregroundStyle(.white.opacity(0.62))
                        .frame(width: 48, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, quiet ? 14 : 12)
        .padding(.top, quiet ? 8 : 8)
        // 贴底那一版下边不用留白，系统底栏紧接着
        .padding(.bottom, quiet ? 6 : 8)
        .background(
            // 贴底档只圆上面两角；浮层档四角都圆（半径对齐外层 askGlassRect，
            // 小半径会在四角漏出玻璃，经文照样透上来）
            UnevenRoundedRectangle(
                topLeadingRadius: AskCorner.sheet,
                bottomLeadingRadius: quiet ? 0 : AskCorner.sheet,
                bottomTrailingRadius: quiet ? 0 : AskCorner.sheet,
                topTrailingRadius: AskCorner.sheet,
                style: .continuous
            )
            .fill(quietFill)
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
            // 安卓 wrap.borderTop 那条 hairline：贴底档要靠它跟经文划界
            if quiet {
                Rectangle()
                    .fill(theme.border)
                    .frame(height: 1 / UIScreen.main.scale)
            }
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
        // 浮层档的底色由 ShellTabBarHost 的玻璃胶囊承担；
        // 贴底档自己铺一层**不透明**纸底（对应安卓的 bottomScrim）——
        // 坞是浮在经文上的 overlay，透明底会让字压字（Josh 2026-09-21）
        .background(quiet ? AnyView(alignedParchment(theme: theme)) : AnyView(Color.clear))
    }

    private var scrubber: some View {
        HStack(spacing: ShellMetrics.scrubberTimeGap) {
            timeText(elapsed)
                .frame(minWidth: ShellMetrics.timeLabelMinWidth, alignment: .leading)

            // MinimalProgressBar：轨 rgba(92,64,48,.22) / 填充 LOGO 黄，高 3 圆角 1.5
            SeekableProgressBar(
                audio: audio,
                trackHeight: 3,
                trackColor: Color(red: 92 / 255, green: 64 / 255, blue: 48 / 255, opacity: 0.22)
            )

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
            .foregroundStyle(compact ? .white.opacity(0.62) : theme.muted)
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

/// 可拖动的播放进度条。
///
/// Josh 2026-09-19：「播放条需要可以拉动」。原来只是画了一根 Capsule，没有任何手势。
/// 两个要点：
/// - **触控区要够高**：轨道本身只有 2–3pt，手指点不中。外面套一个 44pt 高的透明
///   contentShape，视觉不变、能点。（和上面那条「图标小是设计，触控小是 bug」一个道理。）
/// - **拖动时用本地值**：松手后播放器要几百毫秒才报新位置，期间若还读 audio.progress，
///   进度条会先弹回旧位置再跳过去。拖动中一律显示 dragFraction。
struct SeekableProgressBar: View {
    @ObservedObject var audio: ChapterAudioPlayer
    /// 轨道高度（迷你坞 2、展开坞 3）
    var trackHeight: CGFloat
    var trackColor: Color
    /// 填充色：默认 LOGO 黄（展开坞）；紧凑坞是深底白前景那套，传白 0.92
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
            // 轨道在 44pt 高的透明框里垂直居中：视觉还是细线，手指有地方落
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

/// 贴底坞的羊皮底：**不能**直接塞一个 `ParchmentBackground`。
/// 那张纸纹是按整屏 stretch 铺的，塞进只有百来点高的坞里会把整张纹理压扁，
/// 和坞上方页面的纹理接不上，接缝一眼就看得出来。
///
/// 这里把纸纹按**整屏高度**画出来，再往上偏移，让坞露出的正好是这张纸最底下那一条 ——
/// 和页面是同一张图的同一段，接缝消失。坞是贴着屏幕底的（dockFlush），所以偏移量
/// 就是「整屏高 − 坞高」。
@ViewBuilder
func alignedParchment(theme: Parchment) -> some View {
    GeometryReader { g in
        let screenH = UIScreen.main.bounds.height
        ParchmentBackground(theme: theme)
            .frame(width: g.size.width, height: screenH)
            .offset(y: -(screenH - g.size.height))
    }
}
