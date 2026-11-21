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

/// 手抄本藏书票（去游戏化版）：彻底移除 Lv.X、火苗连击倍率与 XP 经验血条，
/// 以古籍印鉴美学展示「安静相伴(天) | 已读章节 | 书卷火漆印 X/66」与 5 枚铜金书卷印章微缩架。
struct XPBar: View {
    @EnvironmentObject private var ach: AchievementStore
    var readDaysOverride: Int? = nil
    var compact = false
    @Environment(\.parchment) private var theme

    private static let previewBooks = ["GEN", "EXO", "PSA", "ISA", "JHN"]

    private var previewSeals: [(file: String, lit: Bool)] {
        let litIds = BibleCatalog.all.filter { ach.seals[$0.id] != nil }.map(\.id)
        var chosen: [String] = Array(litIds.prefix(5))
        for b in Self.previewBooks where chosen.count < 5 && !chosen.contains(b) {
            chosen.append(b)
        }
        return chosen.compactMap { bId in
            guard let book = BibleCatalog.book(id: bId) else { return nil }
            let idx = min(max(book.number, 1), MedalCatalog.seals.count) - 1
            return (MedalCatalog.seals[idx], ach.seals[bId] != nil)
        }
    }

    var body: some View {
        let doneOlive = theme.isDark ? Color(rgb: 0xA8BC72) : Color(rgb: 0x65775C)
        let days = readDaysOverride ?? max(ach.earned.isEmpty && ach.chaptersReadCount == 0 ? 0 : 1, ach.value(for: .streakDays))

        VStack(spacing: compact ? 10 : 14) {
            HStack(spacing: 0) {
                metricCell("\(days)", AppLocale.pick("安静相伴(天)", "Quiet Days"), doneOlive)
                hairline
                metricCell("\(ach.chaptersReadCount)", AppLocale.pick("已读章节", "Chapters"), theme.ink)
                hairline
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text("\(ach.seals.count)")
                        .askFont(size: compact ? 20 : 24, weight: .bold).monospacedDigit()
                        .foregroundStyle(theme.accentOt)
                    Text("/66")
                        .askFont(size: 13, weight: .semibold).monospacedDigit()
                        .foregroundStyle(theme.muted)
                }
                .overlay(alignment: .bottom) { EmptyView() }
                .modifier(MetricSubLabel(label: AppLocale.pick("书卷火漆印", "Book Seals"), color: theme.muted))
            }

            if !compact {
                Rectangle().fill(theme.border).frame(height: 0.75)

                HStack(spacing: 10) {
                    HStack(spacing: 8) {
                        ForEach(Array(previewSeals.enumerated()), id: \.offset) { _, item in
                            MedalIcon(key: item.file, tier: item.lit ? 1 : 0, size: 38)
                        }
                    }
                    Spacer(minLength: 4)
                    HStack(spacing: 3) {
                        Text(AppLocale.pick("印鉴墙", "Seal Wall"))
                            .askFont(size: 12.5, weight: .semibold)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 10, weight: .bold))
                    }
                    .foregroundStyle(theme.muted)
                }
            }
        }
    }

    private var hairline: some View {
        Rectangle().fill(theme.border).frame(width: 0.75, height: 38)
    }

    private func metricCell(_ value: String, _ label: String, _ color: Color) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .askFont(size: compact ? 20 : 24, weight: .bold).monospacedDigit()
                .foregroundStyle(color)
            Text(label)
                .askFont(size: 11.5)
                .foregroundStyle(theme.muted)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct MetricSubLabel: ViewModifier {
    let label: String
    let color: Color
    func body(content: Content) -> some View {
        VStack(spacing: 4) {
            content
            Text(label)
                .askFont(size: 11.5)
                .foregroundStyle(color)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
    }
}

/// 静默消费器（全面去游戏化）：阅读与听读过程中不再在屏幕上弹跳 +XP 数字飘字或播放街机感得分音，
/// 仅在后台静默消化队列，把安静留给经文与章末那道暖金微光。
struct XPFloater: View {
    @EnvironmentObject private var ach: AchievementStore

    var body: some View {
        Color.clear
            .frame(width: 0, height: 0)
            .allowsHitTesting(false)
            .onChange(of: ach.pending.count) { _, _ in drainQuietly() }
            .onAppear { drainQuietly() }
    }

    private func drainQuietly() {
        while let head = ach.pending.first {
            switch head {
            case .xp, .streak, .planDayDone, .levelUp:
                ach.consume()
            default:
                return
            }
        }
    }
}

/// 书卷印章与里程印记提示：仅在真正点亮书卷火漆印或读经纪念章时温和浮现（无 Lv 升级提示）
struct EarnedToast: View {
    @EnvironmentObject private var ach: AchievementStore
    @State private var pop = false

    private var first: AchievementStore.Event? {
        ach.pending.first {
            switch $0 {
            case .xp, .chapterRead, .streak, .planDayDone, .levelUp:
                return false
            default:
                return true
            }
        }
    }

    var body: some View {
        if let e = first {
            let d = describe(e)
            HStack(spacing: 12) {
                if let key = d.image {
                    MedalIcon(key: key, tier: d.tier, tierCount: d.tierCount, size: 46)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(d.title).askFont(size: 15.5, weight: .semibold)
                        .foregroundStyle(Color(parchment: 0x2B1D15))
                    Text(d.subtitle).askFont(size: 12.5)
                        .foregroundStyle(Color(parchment: 0x7A633A)).lineLimit(2)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .frame(maxWidth: 340)
            .background(Color(parchment: 0xFFFCF5), in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(rgb: 0xD97707, opacity: 0.35), lineWidth: 1))
            .shadow(color: .black.opacity(0.16), radius: 12, y: 4)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .scaleEffect(pop ? 1 : 0.88)
            .transition(.move(edge: .top).combined(with: .opacity))
            .onTapGesture { withAnimation { drop(e) } }
            .task(id: d.title) {
                AchievementFeedback.shared.play(.earn)
                pop = false
                withAnimation(.spring(response: 0.34, dampingFraction: 0.62)) { pop = true }
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
