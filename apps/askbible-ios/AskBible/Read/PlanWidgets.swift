import SwiftUI

/// 读经计划页的手机版视觉件（两端同构，Android 见 ui/PlanWidgets.kt）。
/// Josh 2026-09-09：介绍与内容要为手机看优化 —— 字不小于 13，段落改成要点，能点的做成卡片，整体简短、可视。
/// 文案来自 data/bible-reading-plans/mobile-brief.zh-CN.json（PlanText = PlanCopy 的 mobile.* 键）。
enum PlanText {
    static func t(_ key: String) -> String { PlanCopy.t("mobile." + key) }
    static func f(_ key: String, _ args: [String: String]) -> String { PlanCopy.f("mobile." + key, args) }
}

enum PlanIcons {
    /// mobile-brief 里的图标名 → Material 字形
    static func glyph(_ name: String) -> String {
        switch name {
        case "today": return MI.today
        case "loop": return MI.loop
        case "swap": return MI.swapHoriz
        case "stairs": return MI.stairs
        case "repeat": return MI.repeatGlyph
        case "book": return MI.menuBook
        case "sync": return MI.sync
        case "spa": return MI.spa
        case "replay": return MI.replay
        case "calendar": return MI.calendarMonth
        case "layers": return MI.layers
        default: return MI.today
        }
    }

    /// 轨道图标与色：旧约蓝 / 新约橙 / 智慧书绿（目录页的约别配色）
    static func track(_ id: String) -> (glyph: String, color: Color) {
        switch id {
        case "ot": return (MI.historyEdu, Color(rgb: 0x2E5E8C))
        case "nt": return (MI.autoStories, Color(rgb: 0xB8611E))
        default: return (MI.lightbulb, Color(rgb: 0x3F7A4A))
        }
    }
}

/// 要点胶囊：图标 16 + 文字 14/600
struct PlanFactChip: View {
    let fact: PlanFact
    private let theme = Parchment.light
    var body: some View {
        HStack(spacing: 6) {
            MaterialIcon(glyph: PlanIcons.glyph(fact.icon), size: 18, color: theme.muted)
            Text(fact.text).font(.system(size: 15, weight: .semibold)).foregroundStyle(theme.ink)
        }
        .padding(.horizontal, 12).padding(.vertical, 7)
        .background(Capsule().fill(theme.surface.opacity(0.85)))
        .overlay(Capsule().strokeBorder(theme.border, lineWidth: 0.5))
    }
}

/// 要点 chips 一行，放不下就折行（卡片里三颗 chip 曾被挤得每颗都换行）
struct PlanFactRow: View {
    let facts: [PlanFact]
    var centered = false
    var body: some View {
        PlanFlowLayout(centered: centered) {
            ForEach(Array(facts.enumerated()), id: \.offset) { _, f in PlanFactChip(fact: f).fixedSize() }
        }
        .frame(maxWidth: .infinity, alignment: centered ? .center : .leading)
    }
}

/// 自动换行的横排（iOS 16 Layout）：放不下就折到下一行；centered 时每行居中
struct PlanFlowLayout: Layout {
    var spacing: CGFloat = 8
    var rowSpacing: CGFloat = 8
    var centered = false

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        let rows = layoutRows(width: width, subviews: subviews)
        let height = rows.reduce(0) { $0 + $1.height } + CGFloat(max(0, rows.count - 1)) * rowSpacing
        let widest = rows.map(\.width).max() ?? 0
        return CGSize(width: width == .infinity ? widest : width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = layoutRows(width: bounds.width, subviews: subviews)
        var y = bounds.minY
        for row in rows {
            var x = bounds.minX + (centered ? max(0, (bounds.width - row.width) / 2) : 0)
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(at: CGPoint(x: x, y: y + (row.height - size.height) / 2), proposal: .unspecified)
                x += size.width + spacing
            }
            y += row.height + rowSpacing
        }
    }

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func layoutRows(width: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = [Row()]
        for (i, sub) in subviews.enumerated() {
            let size = sub.sizeThatFits(.unspecified)
            var row = rows[rows.count - 1]
            let extra = row.indices.isEmpty ? size.width : size.width + spacing
            if !row.indices.isEmpty, row.width + extra > width {
                rows.append(Row(indices: [i], width: size.width, height: size.height))
            } else {
                row.indices.append(i)
                row.width += extra
                row.height = max(row.height, size.height)
                rows[rows.count - 1] = row
            }
        }
        return rows
    }
}

/// 「怎么读」一行：金色圆底图标 + 16/500 短句
struct PlanHowRow: View {
    let fact: PlanFact
    private let theme = Parchment.light
    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            ZStack {
                Circle().fill(Brand.logo.opacity(0.2))
                MaterialIcon(glyph: PlanIcons.glyph(fact.icon), size: 20, color: theme.ink)
            }
            .frame(width: 36, height: 36).contentShape(Rectangle())
            Text(fact.text).font(.system(size: 17, weight: .medium)).lineSpacing(6).foregroundStyle(theme.inkSoft)
            Spacer(minLength: 0)
        }
    }
}

/// 今日读经卡：轨道图标 / 轨道名 13 / 书章 22/700 / 说明 14 / 可选进度条；整卡可点进章
struct PlanTodayCard: View {
    var track: String?
    let label: String
    let title: String
    var subtitle: String?
    var progress: Double?
    let action: () -> Void
    private let theme = Parchment.light
    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                if let track {
                    let style = PlanIcons.track(track)
                    ZStack {
                        Circle().fill(style.color.opacity(0.14))
                        MaterialIcon(glyph: style.glyph, size: 24, color: style.color)
                    }
                    .frame(width: 46, height: 46)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(label).font(.system(size: 14, weight: .semibold)).kerning(0.6).foregroundStyle(theme.faint)
                    Text(title).font(.system(size: 22, weight: .bold)).foregroundStyle(theme.ink).lineLimit(2)
                    if let subtitle { Text(subtitle).font(.system(size: 15)).foregroundStyle(theme.muted) }
                    if let progress { PlanProgressBar(value: progress).padding(.top, 4) }
                }
                Spacer(minLength: 0)
                MaterialIcon(glyph: MI.chevronRight, size: 26, color: theme.faint)
            }
            .padding(.horizontal, 16).padding(.vertical, 14)
            .background(RoundedRectangle(cornerRadius: 14).fill(Color(rgb: 0xFFFCF5, opacity: 0.72)))
            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(theme.border, lineWidth: 0.5))
        }
        .buttonStyle(.plain)
    }
}

struct PlanProgressBar: View {
    let value: Double
    private let theme = Parchment.light
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(theme.border)
                Capsule().fill(Brand.logo).frame(width: g.size.width * min(1, max(0, value)))
            }
        }
        .frame(height: 5)
    }
}

/// 整宽主按钮 52 高：filled = 墨底米字；否则米底墨字（次要）
struct PlanPrimaryButton: View {
    let title: String
    var filled = true
    let action: () -> Void
    private let theme = Parchment.light
    var body: some View {
        Button(action: action) {
            Text(title).font(.system(size: 17, weight: .semibold))
                .foregroundStyle(filled ? Color(rgb: 0xF5EFE4) : theme.ink)
                .frame(maxWidth: .infinity).frame(height: 52)
                .background(RoundedRectangle(cornerRadius: 14).fill(filled ? theme.ink : theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(filled ? Color.clear : theme.ink.opacity(0.35), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

struct PlanSectionHeader: View {
    let title: String
    var hint: String?
    private let theme = Parchment.light
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.system(size: 20, weight: .bold)).foregroundStyle(theme.ink)
            if let hint { Text(hint).font(.system(size: 15)).foregroundStyle(theme.muted) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// 「✓ 当前计划 · 第 N 天」金色胶囊
struct PlanStatusPill: View {
    let text: String
    var body: some View {
        HStack(spacing: 6) {
            MaterialIcon(glyph: MI.checkCircle, size: 18, color: Color(rgb: 0x8A5A00))
            Text(text).font(.system(size: 15, weight: .semibold)).foregroundStyle(Color(rgb: 0x5B3A00))
        }
        .padding(.horizontal, 12).padding(.vertical, 7)
        .background(Capsule().fill(Brand.logo.opacity(0.26)))
    }
}

/// 单选格（深读节奏 / 起算方式）：标题 18/700 + 副题 13，选中金底金边
struct PlanChoiceTile: View {
    let title: String
    let subtitle: String
    let on: Bool
    let action: () -> Void
    private let theme = Parchment.light
    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Text(title).font(.system(size: 18, weight: .bold)).foregroundStyle(theme.ink)
                Text(subtitle).font(.system(size: 14, weight: .medium)).foregroundStyle(theme.muted).multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity).padding(.vertical, 12).padding(.horizontal, 8)
            .background(RoundedRectangle(cornerRadius: 12).fill(on ? Brand.logo.opacity(0.28) : theme.surface.opacity(0.6)))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(on ? Brand.logo : theme.border, lineWidth: on ? 1.5 : 0.5))
        }
        .buttonStyle(.plain)
    }
}

/// 第几天步进器：44 触控键 + 24/700 数字
struct PlanStepper: View {
    @Binding var value: Int
    let range: ClosedRange<Int>
    private let theme = Parchment.light
    var body: some View {
        HStack(spacing: 16) {
            step(MI.remove, enabled: value > range.lowerBound) { value = max(range.lowerBound, value - 1) }
            HStack(spacing: 4) {
                Text("第").font(.system(size: 16)).foregroundStyle(theme.muted)
                Text("\(value)").font(.system(size: 24, weight: .bold)).foregroundStyle(theme.ink).frame(minWidth: 44)
                Text("天").font(.system(size: 16)).foregroundStyle(theme.muted)
            }
            step(MI.add, enabled: value < range.upperBound) { value = min(range.upperBound, value + 1) }
        }
    }
    private func step(_ glyph: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            MaterialIcon(glyph: glyph, size: 22, color: theme.ink)
                .frame(width: 44, height: 44).contentShape(Rectangle())
                .background(RoundedRectangle(cornerRadius: 10).fill(theme.surface))
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(theme.border, lineWidth: 0.5))
                .opacity(enabled ? 1 : 0.4)
        }
        .buttonStyle(.plain).disabled(!enabled)
    }
}

/// 展开 / 收起（「了解更多」「展开全部 52 阶」）
struct PlanDisclosure<Content: View>: View {
    let openTitle: String
    let closeTitle: String
    @ViewBuilder let content: () -> Content
    @State private var open = false
    private let theme = Parchment.light
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button { withAnimation(.easeInOut(duration: 0.2)) { open.toggle() } } label: {
                HStack(spacing: 4) {
                    Text(open ? closeTitle : openTitle).font(.system(size: 16, weight: .semibold)).foregroundStyle(theme.muted)
                    MaterialIcon(glyph: open ? MI.expandLess : MI.expandMore, size: 22, color: theme.muted)
                }
                .frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            if open { content() }
        }
    }
}

/// 跳到另一条路线的卡：标题 17/600 + 一句 14 + 右箭头
struct PlanLinkCard: View {
    let title: String
    let lead: String
    let action: () -> Void
    private let theme = Parchment.light
    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.system(size: 17, weight: .semibold)).foregroundStyle(theme.ink)
                    Text(lead).font(.system(size: 15)).foregroundStyle(theme.muted)
                }
                Spacer(minLength: 0)
                MaterialIcon(glyph: MI.arrowForward, size: 24, color: theme.ink)
            }
            .padding(16)
            .background(RoundedRectangle(cornerRadius: 14).fill(theme.surface.opacity(0.6)))
            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(theme.border, lineWidth: 0.5))
        }
        .buttonStyle(.plain)
    }
}

/// 子页左上返回键（RN ShellSystemBackButton）
/// 左上返回箭头（整块 44×44 可点：图标外的透明部分默认不算点击区，真机点 x<24 没反应）：页面在 GeometryReader（不 ignoresSafeArea）里，内容本来就从安全区下方开始，这里只留 8pt，
/// 不能再加 safeAreaInsets.top —— 那会把箭头压到比系统默认位置低一个状态栏（Josh 真机 2026-09-10）
struct PlanBackButton: View {
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: "arrow.left")
                .font(.system(size: 22, weight: .medium))
                .foregroundStyle(Parchment.light.ink)
                .frame(width: 44, height: 44).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.leading, 12)
        .padding(.top, 8)
    }
}
