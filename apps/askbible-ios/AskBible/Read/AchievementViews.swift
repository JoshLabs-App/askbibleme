import SwiftUI

/// 勋章 / 印章图：R2 按需下载（512px WebP，约 55KB），存 Caches 下次直接读。
/// 不打进安装包，也不进 Documents（不占用户备份空间，清掉了会自己重下）。
enum MedalImage {
    private static let dir: URL = {
        let d = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("medals", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }()
    private static var memory: [String: UIImage] = [:]

    static func cached(_ url: URL) -> UIImage? {
        let key = url.lastPathComponent
        if let i = memory[key] { return i }
        guard let d = try? Data(contentsOf: dir.appendingPathComponent(key)), let i = UIImage(data: d) else { return nil }
        memory[key] = i
        return i
    }

    static func load(_ url: URL) async -> UIImage? {
        if let i = cached(url) { return i }
        guard let (data, resp) = try? await URLSession.shared.data(from: url),
              (resp as? HTTPURLResponse)?.statusCode == 200, let image = UIImage(data: data) else { return nil }
        try? data.write(to: dir.appendingPathComponent(url.lastPathComponent), options: .atomic)
        memory[url.lastPathComponent] = image
        return image
    }
}

/// 一枚勋章图：未获得显示压暗的剪影，获得后按档位上铜 / 银 / 金的暖色
struct MedalIcon: View {
    let key: String
    var tier: Int = 0          // 0 = 未获得
    var tierCount: Int = 1
    var size: CGFloat = 64
    @State private var image: UIImage?

    /// 档位配色：单档给金，多档从铜走到金
    private var tint: Color {
        guard tier > 0 else { return .clear }
        let t = tierCount <= 1 ? 1.0 : Double(tier - 1) / Double(tierCount - 1)
        if t < 0.34 { return Color(rgb: 0xB87333) }        // 铜
        if t < 0.67 { return Color(rgb: 0xB9BFC6) }        // 银
        return Color(rgb: 0xE8B44A)                        // 金
    }

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image)
                    .resizable().scaledToFit()
                    .saturation(tier > 0 ? 1 : 0)
                    .opacity(tier > 0 ? 1 : 0.28)
                    .overlay {
                        if tier > 0 {
                            Image(uiImage: image).resizable().scaledToFit()
                                .foregroundStyle(tint).blendMode(.overlay).opacity(0.45)
                        }
                    }
            } else {
                Circle().fill(Color(parchment: 0xF2E4CF)).opacity(0.6)
            }
        }
        .frame(width: size, height: size)
        .task(id: key) {
            guard let url = MedalCatalog.imageURL(key) else { return }
            if let i = MedalImage.cached(url) { image = i; return }
            image = await MedalImage.load(url)
        }
    }
}

/// 常驻等级条：称号 + 等级 + 会动的 XP 进度 + 连续天数倍率。
/// 「一直在涨」的主要载体——XP 变化时数字滚动、条子推进，倍率 > 1 时挂一颗火苗角标。
struct XPBar: View {
    @EnvironmentObject private var ach: AchievementStore
    var compact = false

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 4 : 6) {
            HStack(spacing: 8) {
                Text("Lv.\(ach.level)")
                    .font(.system(size: compact ? 12 : 14, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color(rgb: 0xFFB101))
                Text(MedalLevels.title(ach.level))
                    .font(.system(size: compact ? 12 : 14, weight: .semibold))
                    .foregroundStyle(Color(parchment: 0x5C4030))
                Spacer(minLength: 0)
                if ach.streakMultiplier > 1.001 {
                    HStack(spacing: 2) {
                        Image(systemName: "flame.fill").font(.system(size: 10))
                        Text(String(format: "×%.2f", ach.streakMultiplier))
                            .font(.system(size: 11, weight: .bold, design: .rounded).monospacedDigit())
                    }
                    .foregroundStyle(Color(rgb: 0xE06C2A))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color(rgb: 0xE06C2A, opacity: 0.12), in: Capsule())
                }
                Text("\(ach.xpInLevel) / \(ach.xpForLevel)")
                    .font(.system(size: compact ? 11 : 12, weight: .medium, design: .rounded).monospacedDigit())
                    .foregroundStyle(Color(parchment: 0x7A633A))
                    .contentTransition(.numericText())
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color(parchment: 0xF2E4CF))
                    Capsule()
                        .fill(LinearGradient(colors: [Color(rgb: 0xFFC94D), Color(rgb: 0xFFB101)],
                                             startPoint: .leading, endPoint: .trailing))
                        .frame(width: max(6, geo.size.width * ach.levelProgress))
                        .shadow(color: Color(rgb: 0xFFB101, opacity: 0.5), radius: 4)
                }
            }
            .frame(height: compact ? 6 : 8)
        }
        .animation(.spring(response: 0.45, dampingFraction: 0.8), value: ach.totalXP)
    }
}

/// +XP 飘字：从下往上飘、放大再淡出。读 / 听的时候几秒就来一次，就是「一直有反馈」那个手感。
struct XPFloater: View {
    @EnvironmentObject private var ach: AchievementStore
    @State private var shown: [(id: Int, text: String, big: Bool)] = []
    @State private var seq = 0

    var body: some View {
        VStack(spacing: 6) {
            ForEach(shown, id: \.id) { item in
                Text(item.text)
                    .font(.system(size: item.big ? 22 : 16, weight: .heavy, design: .rounded).monospacedDigit())
                    .foregroundStyle(Color(rgb: 0xFFB101))
                    .shadow(color: .black.opacity(0.28), radius: 4, y: 1)
                    .transition(.asymmetric(
                        insertion: .scale(scale: 0.4).combined(with: .offset(y: 14)).combined(with: .opacity),
                        removal: .offset(y: -56).combined(with: .scale(scale: 1.12)).combined(with: .opacity)))
            }
        }
        .allowsHitTesting(false)
        .onChange(of: ach.pending.count) { _, _ in pump() }
        .onAppear { pump() }
    }

    private func pump() {
        guard case .xp(let n, _)? = ach.pending.first else {
            // 非 XP 事件（勋章 / 升级）交给 EarnedToast，这里不动
            return
        }
        ach.consume()
        seq += 1
        let id = seq
        AchievementFeedback.shared.play(.xp)
        // dampingFraction 0.52：比原来更弹一点，弹出来才「动态」
        withAnimation(.spring(response: 0.3, dampingFraction: 0.52)) {
            shown.append((id, "+\(n)", n >= MedalXP.perChapterRead))
            if shown.count > 3 { shown.removeFirst() }
        }
        Task {
            try? await Task.sleep(for: .seconds(1.1))
            withAnimation(.easeOut(duration: 0.4)) { shown.removeAll { $0.id == id } }
            pump()
        }
    }
}

/// 获得提示：勋章 / 印章 / 升级各弹一条，2.8 秒收起，点一下提前关
struct EarnedToast: View {
    @EnvironmentObject private var ach: AchievementStore
    /// 弹入的回弹
    @State private var pop = false
    /// 升级金边的呼吸
    @State private var pulse = false

    private func isLevelUp(_ e: AchievementStore.Event) -> Bool {
        if case .levelUp = e { return true }
        return false
    }

    private var first: AchievementStore.Event? {
        ach.pending.first { if case .xp = $0 { return false }; if case .chapterRead = $0 { return false }; return true }
    }

    var body: some View {
        if let e = first {
            let d = describe(e)
            HStack(spacing: 12) {
                if let key = d.image { MedalIcon(key: key, tier: d.tier, tierCount: d.tierCount, size: 48) }
                else {
                    ZStack {
                        Circle().fill(Color(rgb: 0xFFB101, opacity: 0.18))
                        Text("Lv.\(ach.level)").font(.system(size: 15, weight: .heavy, design: .rounded))
                            .foregroundStyle(Color(rgb: 0xFFB101))
                    }.frame(width: 48, height: 48)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(d.title).font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color(parchment: 0x2B1D15))
                    Text(d.subtitle).font(.system(size: 13))
                        .foregroundStyle(Color(parchment: 0x7A633A)).lineLimit(2)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .frame(maxWidth: 340)
            .background(Color(parchment: 0xFFFCF5), in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(rgb: 0xFFB101, opacity: 0.35), lineWidth: 1))
            .shadow(color: .black.opacity(0.18), radius: 14, y: 4)
            // 升级那一下给一圈会呼吸的金边，比勋章更隆重
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color(rgb: 0xFFB101), lineWidth: isLevelUp(e) ? 2 : 0)
                    .opacity(pulse ? 0.15 : 0.9)
                    .animation(isLevelUp(e)
                               ? .easeInOut(duration: 0.75).repeatForever(autoreverses: true)
                               : .default,
                               value: pulse)
            )
            .scaleEffect(pop ? 1 : 0.86)
            .transition(.move(edge: .top).combined(with: .opacity))
            .onTapGesture { withAnimation { drop(e) } }
            .task(id: d.title) {
                // 声音 + 触感：升级用三声上行钟，勋章 / 卷印用单声钟
                AchievementFeedback.shared.play(isLevelUp(e) ? .levelUp : .earn)
                pop = false
                withAnimation(.spring(response: 0.34, dampingFraction: 0.55)) { pop = true }
                pulse = isLevelUp(e)
                try? await Task.sleep(for: .seconds(2.8))
                withAnimation { drop(e) }
            }
        }
    }

    private func drop(_ e: AchievementStore.Event) {
        while let f = ach.pending.first, f != e { ach.consume() }
        if ach.pending.first == e { ach.consume() }
    }

    private func describe(_ e: AchievementStore.Event) -> (title: String, subtitle: String, image: String?, tier: Int, tierCount: Int) {
        switch e {
        case .medal(let key, let tier):
            guard let def = MedalCatalog.def(key) else { return ("", "", nil, 0, 1) }
            return (def.localizedName(), def.localizedCondition(tier: tier), key, tier, def.tiers.count)
        case .sealEarned(let bookId):
            let book = BibleCatalog.all.first { $0.id == bookId }
            let n = book.map { $0.number } ?? 1
            let file = MedalCatalog.seals[min(max(n, 1), MedalCatalog.seals.count) - 1]
            return (SiteCopy.t("native.sealEarned"),
                    book?.name(AppLocale.current) ?? bookId, file, 1, 1)
        case .levelUp(let lv):
            return (SiteCopy.f("native.levelUp", ["level": "\(lv)"]), MedalLevels.title(lv), nil, 0, 1)
        default:
            return ("", "", nil, 0, 1)
        }
    }
}
