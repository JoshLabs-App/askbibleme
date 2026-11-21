import SwiftUI

/// 左右换景、底部上拉调整。背景手势与控件分层，环境音只有开启后才随景切换。
struct HomeView: View {
    @ObservedObject var home: HomeVerseController
    @ObservedObject var music: MusicPlayer
    @ObservedObject var ambient: AmbientPlayer
    @ObservedObject var prefs: NatureHomePrefs
    var sleepTimerMinutes: Int
    var onSelectScene: (String) -> Void
    var onToggleAmbient: (String) -> Void
    var onCycleSleepTimer: () -> Void
    var onPressAlbum: (String) -> Void
    var onOpenMenu: () -> Void = {}
    var onOpenMusic: () -> Void = {}
    var onOpenVerseContext: () -> Void = {}
    var onBookmarkVerse: () -> Void = {}
    var onChromeHidden: (Bool) -> Void = { _ in }

    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.colorScheme) private var colorScheme
    @State private var toolsOpen = false
    @State private var albumsOpen = false
    @State private var idleEpoch = 0
    @State private var chromeVisible = true
    @State private var lockedBottomInset: CGFloat = 0
    private var ink: Color { colorScheme == .dark ? Color(rgb: 0xeee3d1) : Color(rgb: 0x493b2c) }
    private func copy(_ zh: String, _ en: String) -> String { AppLocale.pick(zh, en) }

    var body: some View {
        GeometryReader { geo in
            let fullHeight = geo.size.height + geo.safeAreaInsets.top + geo.safeAreaInsets.bottom
            ZStack(alignment: .top) {
                Color(rgb: 0x1a1512)
                if let poster = NatureScenes.posterImage(id: prefs.sceneId, soft: !prefs.liveVideo) {
                    Image(uiImage: poster).resizable().scaledToFill()
                        .frame(width: geo.size.width, height: fullHeight).clipped().allowsHitTesting(false)
                }
                if prefs.liveVideo {
                    HomeSceneVideo(sceneId: prefs.sceneId, paused: scenePhase != .active)
                        .frame(width: geo.size.width, height: fullHeight).allowsHitTesting(false)
                }
                // 只有背景接收换景与显隐手势，上层按钮不会冒泡到这里。
                Color.clear.contentShape(Rectangle())
                    .accessibilityLabel(copy("风景", "Scenery"))
                    .accessibilityValue(prefs.sceneId)
                    .accessibilityIdentifier("home.scenery")
                    .accessibilityAction(named: copy("打开音乐", "Open music")) { touch(); onOpenMusic() }
                    .accessibilityAction(named: copy("调整", "Adjust")) { setTools(true) }
                    .onTapGesture {
                        if albumsOpen { closeAlbums() }
                        else if toolsOpen { setTools(false) }
                        else {
                            withAnimation(.easeInOut(duration: 0.3)) { chromeVisible.toggle() }
                            onChromeHidden(!chromeVisible)
                            idleEpoch += 1
                        }
                    }
                    .gesture(DragGesture(minimumDistance: 20).onEnded { g in
                        guard !toolsOpen else { return }
                        if albumsOpen { closeAlbums(); return }
                        let dx = g.translation.width, dy = g.translation.height
                        if abs(dx) > 60 && abs(dx) > abs(dy) * 1.5 {
                            swipeScene(dx < 0 ? 1 : -1)
                        } else if dy < -50 && abs(dy) > abs(dx) * 1.5 && g.startLocation.y > fullHeight * 0.55 {
                            setTools(true)
                        } else if dy > 60 && dy > abs(dx) * 1.5 {
                            touch(); onOpenMusic()
                        }
                    })
                verseBlock
                    .padding(.horizontal, 24)
                    .padding(.top, geo.safeAreaInsets.top + 112)
                if !toolsOpen {
                    VStack(spacing: 0) {
                        Spacer(minLength: 0)
                        VStack(spacing: 14) {
                            if albumsOpen {
                                VStack(spacing: 10) {
                                    HStack {
                                        Text(copy("切换陪伴心境", "Choose mood"))
                                            .askFont(size: 12, weight: .semibold)
                                            .foregroundStyle(ink.opacity(0.68))
                                        Spacer()
                                        Button {
                                            closeAlbums(); onOpenMusic()
                                        } label: {
                                            HStack(spacing: 3) {
                                                Text(copy("完整曲库", "All tracks"))
                                                Image(systemName: "chevron.right").font(.system(size: 10, weight: .bold))
                                            }
                                            .askFont(size: 12, weight: .semibold)
                                            .foregroundStyle(Color(rgb: 0xD97707))
                                        }
                                        .buttonStyle(.plain)
                                    }
                                    albumOptions { album in music.selectAlbum(album); closeAlbums() }
                                }
                                .padding(14).frame(maxWidth: 340)
                                .foregroundStyle(ink)
                                .background(colorScheme == .dark ? Color(rgb: 0x28251f) : Color(rgb: 0xf7f0e4), in: RoundedRectangle(cornerRadius: 22))
                                .shadow(color: .black.opacity(0.22), radius: 16, y: 6)
                                .transition(.opacity.combined(with: .scale(scale: 0.96, anchor: .bottom)))
                            }

                            // 单排对称三触点：音乐(含当前心境) · 朗读 · 境况
                            HStack(spacing: 34) {
                                musicControl
                                circleControl(
                                    symbol: "speaker.wave.2.fill",
                                    title: copy("朗读", "Read aloud"),
                                    active: home.voiceOn,
                                    id: "home.voice"
                                ) {
                                    touch(); home.toggleVoice()
                                }
                                .disabled(!home.voiceAvailable)
                                .opacity(home.voiceAvailable ? 1 : 0.38)

                                circleControl(
                                    symbol: "slider.horizontal.3",
                                    title: copy("境况", "Ambience"),
                                    active: ambient.isOn || sleepTimerMinutes > 0,
                                    id: "home.ambience"
                                ) {
                                    setTools(true)
                                }
                            }

                            // 底部微光呼吸条：提示可上拉或轻点调环境音与画面
                            Button { setTools(true) } label: {
                                Capsule()
                                    .fill(.white.opacity(0.46))
                                    .frame(width: 34, height: 4)
                                    .padding(.vertical, 6)
                                    .padding(.horizontal, 20)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(copy("打开境况面板", "Open ambience adjustments"))
                        }
                        .gesture(DragGesture(minimumDistance: 20).onEnded { g in
                            if g.translation.height < -35 && abs(g.translation.height) > abs(g.translation.width) { setTools(true) }
                        })
                    }
                    .padding(.bottom, 102 + lockedBottomInset)
                    .opacity(chromeVisible ? 1 : 0.52)
                }
                if toolsOpen {
                    VStack(spacing: 0) {
                        Spacer(minLength: 0)
                        adjustmentPanel(maxHeight: fullHeight * 0.64)
                    }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .ignoresSafeArea()
            .onAppear { lockedBottomInset = max(lockedBottomInset, geo.safeAreaInsets.bottom) }
            .onChange(of: geo.safeAreaInsets.bottom) { _, value in
                lockedBottomInset = max(lockedBottomInset, value)
            }
        }
        .task(id: idleEpoch) {
            guard !toolsOpen, !albumsOpen else { return }
            try? await Task.sleep(nanoseconds: 7_000_000_000)
            guard !Task.isCancelled, !toolsOpen, !albumsOpen else { return }
            withAnimation(.easeInOut(duration: 0.6)) { chromeVisible = false }
            onChromeHidden(true)
        }
        .onDisappear { onChromeHidden(false) }
    }

    private func setTools(_ open: Bool) {
        withAnimation(.easeInOut(duration: 0.28)) { toolsOpen = open; albumsOpen = false; chromeVisible = true }
        onChromeHidden(open)
        idleEpoch += 1
    }
    private func touch() {
        idleEpoch += 1
        chromeVisible = true
        onChromeHidden(toolsOpen)
    }
    private func swipeScene(_ step: Int) {
        let scenes = NatureScenes.scenes
        guard let index = scenes.firstIndex(where: { $0.id == prefs.sceneId }), !scenes.isEmpty else { return }
        onSelectScene(scenes[(index + step + scenes.count) % scenes.count].id)
        idleEpoch += 1
    }
    private var verseBlock: some View {
        VStack(spacing: 14) {
            Text(home.verse.text)
                .askFont(size: HomeVerseTypography.bodySize(scale: prefs.textScale), weight: .bold)
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .lineSpacing(HomeVerseTypography.bodyLineHeight(scale: prefs.textScale) - HomeVerseTypography.bodySize(scale: prefs.textScale))
                .verseTextShadow()
                .onTapGesture(count: 2) {
                    touch()
                    onBookmarkVerse()
                }
                .onTapGesture(count: 1) {
                    withAnimation(.easeInOut(duration: 0.3)) { chromeVisible.toggle() }
                    onChromeHidden(!chromeVisible)
                    idleEpoch += 1
                }

            Button {
                touch()
                onOpenVerseContext()
            } label: {
                HStack(spacing: 6) {
                    Text(home.verse.reference)
                        .askFont(size: max(13, HomeVerseTypography.refSize(scale: prefs.textScale) * 0.78), weight: .semibold)
                        .foregroundStyle(.white.opacity(0.96))
                    Text("·")
                        .askFont(size: 12, weight: .bold)
                        .foregroundStyle(.white.opacity(0.48))
                    Text(copy("读上下文", "Read context"))
                        .askFont(size: 12, weight: .semibold)
                        .foregroundStyle(Color(rgb: 0xFFE3A3))
                    Image(systemName: "chevron.right")
                        .font(.system(size: 9.5, weight: .bold))
                        .foregroundStyle(Color(rgb: 0xFFE3A3))
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(
                    Capsule()
                        .fill(Color.black.opacity(0.36))
                        .overlay(Capsule().strokeBorder(.white.opacity(0.24), lineWidth: 0.75))
                )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("home.verse.context")
        }
    }
    private func closeAlbums() {
        withAnimation(.easeInOut(duration: 0.2)) { albumsOpen = false }
        touch()
    }
    private func openAlbums() {
        touch()
        withAnimation(.easeInOut(duration: 0.2)) { albumsOpen = true }
    }
    private var musicControl: some View {
        VStack(spacing: 7) {
            ZStack {
                Circle()
                    .fill(music.isPlaying ? Brand.logo : Color.black.opacity(0.28))
                    .overlay(Circle().strokeBorder(.white.opacity(music.isPlaying ? 0 : 0.22), lineWidth: 0.75))
                Image(systemName: albumSymbol(music.album))
                    .font(.system(size: 21, weight: .semibold))
                    .foregroundStyle(music.isPlaying ? Color(rgb: 0x1C1410) : .white)
            }
            .frame(width: 52, height: 52)
            .gesture(LongPressGesture(minimumDuration: 0.4).exclusively(before: TapGesture()).onEnded { result in
                switch result {
                case .first(true): openAlbums()
                case .second: touch(); onPressAlbum(music.album)
                default: break
                }
            })

            Button {
                if albumsOpen { closeAlbums() } else { openAlbums() }
            } label: {
                HStack(spacing: 3) {
                    Text(copy(music.album, albumEnglish(music.album)))
                        .askFont(size: 12, weight: .medium)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 9, weight: .bold))
                        .opacity(0.8)
                }
                .foregroundStyle(.white.opacity(0.92))
                .verseTextShadow()
                .padding(.horizontal, 4)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .frame(minWidth: 72)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(copy("音乐", "Music"))
        .accessibilityValue(copy(music.album, albumEnglish(music.album)) + " · " + (music.isPlaying ? copy("开启", "On") : copy("关闭", "Off")))
        .accessibilityIdentifier("home.music")
    }

    private func circleControl(symbol: String, title: String, active: Bool, id: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 7) {
                ZStack {
                    Circle()
                        .fill(active ? Brand.logo : Color.black.opacity(0.28))
                        .overlay(Circle().strokeBorder(.white.opacity(active ? 0 : 0.22), lineWidth: 0.75))
                    Image(systemName: symbol)
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(active ? Color(rgb: 0x1C1410) : .white)
                }
                .frame(width: 52, height: 52)
                Text(title)
                    .askFont(size: 12, weight: .medium)
                    .foregroundStyle(.white.opacity(0.92))
                    .verseTextShadow()
            }
            .frame(minWidth: 72)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityValue(active ? copy("开启", "On") : copy("关闭", "Off"))
        .accessibilityIdentifier(id)
    }
    private func albumOptions(onSelect: @escaping (String) -> Void) -> some View {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
                        ForEach(MusicCatalog.albums, id: \.self) { album in
                            let selected = music.album == album
                            Button { onSelect(album) } label: {
                                VStack(spacing: 7) {
                                    Image(systemName: albumSymbol(album)).font(.system(size: 23))
                                    Text(copy(album, albumEnglish(album)))
                                        .askFont(size: 12).multilineTextAlignment(.center)
                                }
                                .frame(maxWidth: .infinity, minHeight: 68)
                                .padding(.vertical, 6)
                                .background(selected ? Brand.logo.opacity(0.22) : ink.opacity(0.05), in: RoundedRectangle(cornerRadius: 14))
                                .overlay(RoundedRectangle(cornerRadius: 14).stroke(selected ? Color(rgb: 0xb88a35) : .clear, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(copy(album, albumEnglish(album)))
                            .accessibilityAddTraits(selected ? .isSelected : [])
                            .accessibilityIdentifier("home.album.\(album)")
                        }
                    }
    }
    private func soundButton(_ symbol: String, title: String, on: Bool, id: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: symbol).font(.system(size: 26))
                Text(title).askFont(size: 12)
            }
            .foregroundStyle(on ? Brand.logo : .white).verseTextShadow()
            .frame(minWidth: 64, minHeight: 64).contentShape(Rectangle())
        }
        .buttonStyle(.plain).accessibilityLabel(title)
        .accessibilityValue(on ? copy("开启", "On") : copy("关闭", "Off"))
        .accessibilityIdentifier(id)
    }
    private func adjustmentPanel(maxHeight: CGFloat) -> some View {
        VStack(spacing: 0) {
            Button { setTools(false) } label: {
                VStack(spacing: 10) {
                    Capsule().fill(ink.opacity(0.35)).frame(width: 42, height: 4)
                    Text(copy("调整", "Adjust")).askFont(size: 17, weight: .semibold)
                }.frame(maxWidth: .infinity).padding(.vertical, 14).contentShape(Rectangle())
            }
            .buttonStyle(.plain).accessibilityLabel(copy("收起调整", "Close adjustments"))
            .accessibilityIdentifier("home.adjust.close")
            .gesture(DragGesture(minimumDistance: 15).onEnded { g in
                if g.translation.height > 35 && g.translation.height > abs(g.translation.width) { setTools(false) }
            })
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    sectionTitle(copy("声音", "Sound"))
                    Toggle(copy("环境音", "Ambient sound"), isOn: Binding(get: { ambient.isOn }, set: { on in
                        if on { ambient.start(slotId: NatureScenes.scene(id: prefs.sceneId)?.defaultAmbient ?? AmbientScenes.defaultSlotId) }
                        else { ambient.stop() }
                    }))
                        .accessibilityIdentifier("home.ambient")
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(AmbientScenes.slots) { slot in
                                Button { onToggleAmbient(slot.id) } label: {
                                    VStack(spacing: 7) {
                                        Image(systemName: ambientSymbol(slot.id)).font(.system(size: 23))
                                        Text(copy(slot.label, slot.labelEn)).askFont(size: 12)
                                    }
                                    .frame(minWidth: 64, minHeight: 68).padding(.horizontal, 6)
                                    .background(ambient.slotId == slot.id ? Brand.logo.opacity(0.22) : ink.opacity(0.05), in: RoundedRectangle(cornerRadius: 14))
                                }.buttonStyle(.plain)
                                .accessibilityLabel(copy(slot.label, slot.labelEn))
                                .accessibilityAddTraits(ambient.slotId == slot.id ? .isSelected : [])
                                .accessibilityIdentifier("home.ambient.\(slot.id)")
                            }
                        }
                    }
                    HStack {
                        Image(systemName: "speaker.wave.1")
                        Slider(value: $ambient.volume, in: 0...1)
                            .accessibilityLabel(copy("环境音音量", "Ambient volume"))
                    }.disabled(!ambient.isOn).opacity(ambient.isOn ? 1 : 0.4)
                    sectionTitle(copy("音乐专辑", "Music albums"))
                    albumOptions { music.selectAlbum($0) }
                    sectionTitle(copy("画面", "Picture"))
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(NatureScenes.scenes) { scene in
                                Button { onSelectScene(scene.id) } label: {
                                    VStack(spacing: 6) {
                                        if let image = NatureScenes.thumbImage(id: scene.id) {
                                            Image(uiImage: image).resizable().scaledToFill().frame(width: 90, height: 58).clipped()
                                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(prefs.sceneId == scene.id ? Brand.logo : .clear, lineWidth: 2))
                                        }
                                        Text(copy(scene.title, scene.titleEn)).askFont(size: 12)
                                    }
                                }.buttonStyle(.plain).accessibilityIdentifier("home.scene.\(scene.id)")
                            }
                        }.padding(2)
                    }
                    Toggle(copy("动态画面", "Live scenery"), isOn: Binding(get: { prefs.liveVideo }, set: { prefs.toggleLiveVideo($0) }))
                    sectionTitle(copy("阅读与休息", "Reading & rest"))
                    HStack {
                        Text(copy("字号", "Text size")); Spacer()
                        Button { prefs.bumpTextScale(-1) } label: { Image(systemName: "minus").frame(width: 44, height: 44) }
                            .accessibilityLabel(copy("缩小字号", "Smaller text"))
                        Button { prefs.bumpTextScale(1) } label: { Image(systemName: "plus").frame(width: 44, height: 44) }
                            .accessibilityLabel(copy("放大字号", "Larger text"))
                    }
                    Button(action: onCycleSleepTimer) {
                        HStack {
                            Text(copy("睡眠定时", "Sleep timer")); Spacer()
                            Text(sleepTimerMinutes == 0 ? copy("关闭", "Off") : "\(sleepTimerMinutes) " + copy("分钟", "min"))
                            Image(systemName: "chevron.right").font(.caption)
                        }.frame(minHeight: 44)
                    }.buttonStyle(.plain)
                }.padding(.horizontal, 24).padding(.bottom, 36)
            }
        }
        .askFont(size: 15).foregroundStyle(ink).tint(Color(rgb: 0xb88a35))
        .frame(maxHeight: maxHeight)
        .background(colorScheme == .dark ? Color(rgb: 0x28251f) : Color(rgb: 0xf7f0e4), in: UnevenRoundedRectangle(topLeadingRadius: 28, topTrailingRadius: 28))
    }
    private func sectionTitle(_ title: String) -> some View {
        HStack { Text(title).askFont(size: 13, weight: .medium); Rectangle().fill(ink.opacity(0.12)).frame(height: 1) }
    }
    private func ambientSymbol(_ id: String) -> String {
        switch id {
        case "scene-water": return "drop"
        case "scene-rain": return "cloud.rain"
        case "scene-birds": return "bird"
        case "scene-white-noise": return "waveform"
        case "scene-wind": return "wind"
        case "scene-fire": return "flame"
        case "scene-waves": return "water.waves"
        case "scene-thunder": return "cloud.bolt.rain"
        default: return "cup.and.saucer"
        }
    }
    private func albumSymbol(_ album: String) -> String {
        switch album {
        case "安静": return "leaf"
        case "下午茶": return "cup.and.saucer"
        case "赞美诗": return "music.note.list"
        case "钢琴": return "pianokeys"
        case "睡眠": return "moon.stars"
        case "专注工作": return "deskclock"
        default: return "music.note"
        }
    }
    private func albumEnglish(_ album: String) -> String {
        switch album { case "安静": return "Quiet"; case "下午茶": return "Afternoon tea"; case "专注工作": return "Focus"; case "睡眠": return "Sleep"; case "赞美诗": return "Hymns"; case "钢琴": return "Piano"; default: return album }
    }
}
