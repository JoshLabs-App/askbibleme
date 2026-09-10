import SwiftUI

/// 读经计划目录页（手机版精简排版，与 Android PlansListScreen 同构）：
/// 标题 + 一句引言，两张主推卡（徽标 / 标题 / 一句话 / 要点 chips），下面是经典日课表。
/// 原来照 RN 搬的长段导语与 blurb 都收进详情页的「了解更多」。
struct PlansListView: View {
    @ObservedObject var store: ReadingPlanStore
    var onOpenPlan: (String) -> Void
    var onBack: () -> Void
    /// 正式研读卡上的「背景与原理见 麦克阿瑟的研经方法 →」（RN ReadPlansFeaturedPlanCard → 探索文章）
    var onOpenArticle: (String) -> Void = { _ in }
    private let theme = Parchment.light

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(PlanCopy.t("pages.read.plansTitle"))
                            .font(.system(size: 30, weight: .bold))
                            .foregroundStyle(theme.ink)
                            .frame(maxWidth: .infinity)
                            .padding(.top, geo.safeAreaInsets.top + 64)
                        Text(PlanText.t("plansIntro"))
                            .font(.system(size: 17))
                            .foregroundStyle(theme.muted)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 10)

                        VStack(spacing: 14) {
                            ForEach(ReadingPlanCatalog.featured) { plan in
                                FeaturedPlanCard(plan: plan, isActive: store.isActive(plan.planId), onOpenArticle: onOpenArticle) { onOpenPlan(plan.planId) }
                            }
                        }
                        .padding(.top, 24)

                        PlanSectionHeader(title: PlanText.t("plansOtherHeading"), hint: PlanText.t("plansOtherLead"))
                            .padding(.top, 32)
                        VStack(spacing: 12) {
                            ForEach(ReadingPlanCatalog.others) { plan in
                                ClassicPlanCard(plan: plan, isActive: store.isActive(plan.planId)) { onOpenPlan(plan.planId) }
                            }
                        }
                        .padding(.top, 14)
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 24)
                }

                PlanBackButton(safeTop: geo.safeAreaInsets.top, action: onBack)
            }
            .background(ParchmentBackground(theme: theme).ignoresSafeArea())
        }
    }
}

/// 主推卡：正式研读金底 + 「推荐」，轻松读经米白底；徽标 / 标题 24 / 一句话 16 / 要点 chips / 查看 ›
struct FeaturedPlanCard: View {
    let plan: ReadingPlanEntry
    let isActive: Bool
    var onOpenArticle: (String) -> Void = { _ in }
    let onPress: () -> Void
    /// RN NT_DEEP_REPEAT_EXPLORE_ARTICLE_SLUG
    static let ntDeepArticleSlug = "a-macarthur-lifelong-bible-reading"
    private let theme = Parchment.light
    private var isNtDeep: Bool { plan.planId == ReadingPlanCatalog.ntDeepRepeatId }

    var body: some View {
        Button(action: onPress) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 8) {
                    Text(plan.badge)
                        .font(.system(size: 14, weight: .semibold)).kerning(0.8)
                        .foregroundStyle(Color(rgb: 0x4D3522, opacity: 0.8))
                    if isNtDeep {
                        Text(PlanCopy.t("pages.read.plansFeaturedNtDeepPromo"))
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color(rgb: 0x4D3522, opacity: 0.88))
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(Capsule().fill(Color(rgb: 0xFFB101, opacity: 0.28)))
                    }
                    Spacer(minLength: 0)
                    if isActive { PlanStatusPill(text: PlanText.t("activePill")) }
                }
                Text(plan.title).font(.system(size: 24, weight: .bold)).foregroundStyle(theme.ink).padding(.top, 8)
                Text(plan.tagline).font(.system(size: 17)).lineSpacing(6)
                    .foregroundStyle(Color(rgb: 0x2B1D15, opacity: 0.84)).padding(.top, 6)
                PlanFactRow(facts: plan.facts).padding(.top, 14)
                if isNtDeep {
                    Button { onOpenArticle(Self.ntDeepArticleSlug) } label: {
                        Text(PlanCopy.t("pages.read.plansMethodPath2Reference") + " " + PlanCopy.t("pages.read.plansMethodPath2ArticleLink") + " →")
                            .font(.system(size: 14)).underline().foregroundStyle(Color(rgb: 0x4D3522, opacity: 0.72))
                    }
                    .buttonStyle(.plain).padding(.top, 10)
                }
                HStack {
                    Spacer()
                    Text(PlanText.t("open") + " ›").font(.system(size: 16, weight: .semibold)).foregroundStyle(theme.muted)
                }
                .padding(.top, 12)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 16)
            .background(RoundedRectangle(cornerRadius: 14).fill(isNtDeep ? Color(rgb: 0xFFECBF, opacity: 0.94) : Color(rgb: 0xFFFCF5, opacity: 0.72)))
            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(
                isActive ? Color(rgb: 0x452D1C, opacity: 0.42) : (isNtDeep ? Color(rgb: 0xFFB101, opacity: 0.72) : Color(rgb: 0x78350F, opacity: 0.2)),
                lineWidth: isNtDeep ? 1.5 : 0.5))
        }
        .buttonStyle(.plain)
    }
}

/// 经典日课表卡：标题 18 / 英文表名 13 / 一句话 15（最多两行）/ 天数 · 单日段数 chips
struct ClassicPlanCard: View {
    let plan: ReadingPlanEntry
    let isActive: Bool
    let onPress: () -> Void
    private let theme = Parchment.light

    var body: some View {
        Button(action: onPress) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 8) {
                        Text(plan.title).font(.system(size: 18, weight: .semibold)).foregroundStyle(theme.ink)
                        if isActive { PlanStatusPill(text: PlanText.t("activePill")) }
                    }
                    if !plan.subtitle.isEmpty {
                        Text(plan.subtitle).font(.system(size: 14)).foregroundStyle(theme.faint).padding(.top, 3)
                    }
                    Text(plan.tagline).font(.system(size: 16)).lineSpacing(5).foregroundStyle(theme.muted).lineLimit(2).padding(.top, 6)
                    PlanFactRow(facts: plan.facts).padding(.top, 10)
                }
                Spacer(minLength: 0)
                MaterialIcon(glyph: MI.chevronRight, size: 26, color: theme.faint)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(RoundedRectangle(cornerRadius: 12).fill(theme.surface.opacity(0.5)))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(isActive ? Color(rgb: 0x452D1C, opacity: 0.42) : theme.border, lineWidth: isActive ? 1 : 0.5))
        }
        .buttonStyle(.plain)
    }
}
