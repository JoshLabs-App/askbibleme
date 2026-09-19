import SwiftUI

/// 成就页：顶上是等级条和三个数字，中间勋章墙，下面 66 卷书卷印章。
/// 未获得的也全部列出来（压暗 + 进度条）——看得见下一档才有奔头。
struct AchievementsView: View {
    @EnvironmentObject private var ach: AchievementStore
    @Environment(\.dismiss) private var dismiss
    private let cols = [GridItem(.adaptive(minimum: 92), spacing: 14)]

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                header
                soundToggle
                medalWall
                sealWall
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 18)
        }
        .background(ParchmentBackground().ignoresSafeArea())
        .navigationTitle(SiteCopy.t("native.achievements"))
        .navigationBarTitleDisplayMode(.inline)
    }

    /// 成就音效开关。放在成就墙里，而不是另开一个设置页 ——
    /// 用户想关它的时候，人就在这一屏（刚被响了一下）。
    private var soundToggle: some View {
        Toggle(isOn: Binding(
            get: { AchievementFeedback.soundEnabled },
            set: { on in
                AchievementFeedback.soundEnabled = on
                // 打开的当下响一声，让人知道是什么声
                if on { AchievementFeedback.shared.play(.earn) }
            }
        )) {
            VStack(alignment: .leading, spacing: 2) {
                Text(SiteCopy.t("native.achievementSound"))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color(parchment: 0x2B1D15))
                Text(SiteCopy.t("native.achievementSoundHint"))
                    .font(.system(size: 12))
                    .foregroundStyle(Color(parchment: 0x7A633A))
            }
        }
        .tint(Color(rgb: 0xFFB101))
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(Color(parchment: 0xFFFCF5, opacity: 0.75), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(parchment: 0xC9A672, opacity: 0.35), lineWidth: 1))
    }

    private var header: some View {
        VStack(spacing: 14) {
            XPBar()
            HStack(spacing: 0) {
                stat("\(ach.totalXP)", SiteCopy.t("native.totalXP"))
                divider
                stat("\(ach.chaptersReadCount)", SiteCopy.t("native.chaptersReadLabel"))
                divider
                stat(String(format: "×%.2f", ach.streakMultiplier), SiteCopy.t("native.streakBonus"))
            }
        }
        .padding(16)
        .background(Color(parchment: 0xFFFCF5, opacity: 0.92), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color(parchment: 0xF2E4CF), lineWidth: 1))
    }

    private var divider: some View {
        Rectangle().fill(Color(parchment: 0xF2E4CF)).frame(width: 1, height: 30)
    }

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(size: 19, weight: .heavy, design: .rounded).monospacedDigit())
                .foregroundStyle(Color(parchment: 0x2B1D15))
                .contentTransition(.numericText())
            Text(label).font(.system(size: 11)).foregroundStyle(Color(parchment: 0x7A633A))
        }
        .frame(maxWidth: .infinity)
    }

    private var medalWall: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle(SiteCopy.t("native.medals"),
                         SiteCopy.f("native.medalsProgress",
                                    ["n": "\(ach.earned.count)", "total": "\(MedalCatalog.all.count)"]))
            LazyVGrid(columns: cols, spacing: 18) {
                ForEach(MedalCatalog.all) { def in
                    MedalCell(def: def, earned: ach.earned[def.key], current: ach.value(for: def.metric))
                }
            }
        }
    }

    private var sealWall: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle(SiteCopy.t("native.bookSeals"),
                         SiteCopy.f("native.sealsProgress", ["n": "\(ach.seals.count)"]))
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 64), spacing: 10)], spacing: 14) {
                ForEach(BibleCatalog.all, id: \.id) { book in
                    let file = MedalCatalog.seals[min(max(book.number, 1), MedalCatalog.seals.count) - 1]
                    VStack(spacing: 4) {
                        MedalIcon(key: file, tier: ach.seals[book.id] != nil ? 1 : 0, size: 56)
                        Text(book.name(AppLocale.current))
                            .font(.system(size: 10))
                            .foregroundStyle(Color(parchment: ach.seals[book.id] != nil ? 0x5C4030 : 0x7A633A))
                            .opacity(ach.seals[book.id] != nil ? 1 : 0.55)
                            .lineLimit(1).minimumScaleFactor(0.7)
                    }
                }
            }
        }
    }

    private func sectionTitle(_ title: String, _ sub: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).font(.system(size: 17, weight: .bold)).foregroundStyle(Color(parchment: 0x2B1D15))
            Spacer()
            Text(sub).font(.system(size: 12, design: .rounded).monospacedDigit())
                .foregroundStyle(Color(parchment: 0x7A633A))
        }
    }
}

/// 单枚勋章：图 + 名 + 「离下一档还差多少」的细进度条
private struct MedalCell: View {
    let def: MedalDef
    let earned: AchievementStore.Earned?
    let current: Int

    private var tier: Int { earned?.tier ?? 0 }
    /// 下一档门槛；已满档为 nil
    private var next: Int? { tier < def.tiers.count ? def.tiers[tier] : nil }
    private var progress: Double {
        guard let next else { return 1 }
        let from = tier > 0 ? def.tiers[tier - 1] : 0
        return min(1, max(0, Double(current - from) / Double(max(1, next - from))))
    }

    var body: some View {
        VStack(spacing: 6) {
            MedalIcon(key: def.key, tier: tier, tierCount: def.tiers.count, size: 72)
            Text(def.localizedName())
                .font(.system(size: 12, weight: tier > 0 ? .semibold : .regular))
                .foregroundStyle(Color(parchment: tier > 0 ? 0x2B1D15 : 0x7A633A))
                .lineLimit(1).minimumScaleFactor(0.75)
            if let next {
                VStack(spacing: 3) {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color(parchment: 0xF2E4CF))
                            Capsule().fill(Color(rgb: 0xFFB101, opacity: 0.85))
                                .frame(width: max(2, geo.size.width * progress))
                        }
                    }
                    .frame(height: 4)
                    Text("\(current) / \(next)")
                        .font(.system(size: 10, design: .rounded).monospacedDigit())
                        .foregroundStyle(Color(parchment: 0x7A633A))
                }
            } else {
                Text(def.localizedCondition(tier: tier))
                    .font(.system(size: 10)).foregroundStyle(Color(parchment: 0x7A633A))
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
        }
        .frame(maxWidth: .infinity)
    }
}
