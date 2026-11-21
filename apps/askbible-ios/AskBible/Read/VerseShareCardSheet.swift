import SwiftUI
import UIKit

/// 经文书签图分享的数据载体
struct VerseSharePayload: Identifiable, Equatable {
    let id = UUID()
    let reference: String
    let translationName: String
    let text: String
}

/// 羊皮卷金句书签分享卡（支持「浅色羊皮 / 夜读沉香」双款切换，3x 高清出图分享或仅复制文字）
struct VerseShareCardSheet: View {
    let payload: VerseSharePayload
    let locale: AppLocale
    var onCopied: () -> Void = {}
    var onClose: () -> Void

    @State private var darkCard = false
    @Environment(\.parchment) private var theme

    var body: some View {
        ZStack {
            Color.black.opacity(0.68)
                .ignoresSafeArea()
                .onTapGesture(perform: onClose)

            VStack(spacing: 18) {
                Capsule()
                    .fill(.white.opacity(0.28))
                    .frame(width: 38, height: 4)
                    .padding(.top, 8)

                BookmarkCardCanvas(payload: payload, darkCard: darkCard)
                    .frame(maxWidth: 318)
                    .shadow(color: .black.opacity(0.42), radius: 22, y: 10)

                // 双款底色切换胶囊
                HStack(spacing: 0) {
                    stylePill(AppLocale.pick("浅色羊皮", "Warm Parchment", locale), active: !darkCard) {
                        withAnimation(.easeInOut(duration: 0.2)) { darkCard = false }
                    }
                    stylePill(AppLocale.pick("夜读沉香", "Night Agarwood", locale), active: darkCard) {
                        withAnimation(.easeInOut(duration: 0.2)) { darkCard = true }
                    }
                }
                .padding(3)
                .background(Capsule().fill(.white.opacity(0.12)))

                VStack(spacing: 10) {
                    Button {
                        shareRenderedCard()
                    } label: {
                        Text(AppLocale.pick("发送金句书签图", "Share Bookmark Image", locale))
                            .askFont(size: 16, weight: .bold)
                            .foregroundStyle(.white)
                            .frame(maxWidth: 318)
                            .frame(height: 48)
                            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(rgb: 0xD97707)))
                    }
                    .buttonStyle(.plain)

                    Button {
                        UIPasteboard.general.string = "\(payload.reference)\n\(payload.text)"
                        onCopied()
                        onClose()
                    } label: {
                        Text(AppLocale.pick("仅复制文字", "Copy Plain Text", locale))
                            .askFont(size: 14, weight: .medium)
                            .foregroundStyle(.white.opacity(0.78))
                            .frame(height: 36)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.bottom, 16)
            }
            .padding(.horizontal, 24)
        }
        .transition(.opacity)
    }

    private func stylePill(_ label: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .askFont(size: 13, weight: .semibold)
                .foregroundStyle(active ? Color(rgb: 0x1C1410) : .white.opacity(0.78))
                .padding(.horizontal, 18)
                .padding(.vertical, 8)
                .background(Capsule().fill(active ? Color(rgb: 0xF5EBE0) : Color.clear))
        }
        .buttonStyle(.plain)
    }

    @MainActor
    private func shareRenderedCard() {
        let exportView = BookmarkCardCanvas(payload: payload, darkCard: darkCard)
            .frame(width: 340)
            .padding(20)
            .background(darkCard ? Color(rgb: 0x120E0C) : Color(rgb: 0xE2CEAC))
        let renderer = ImageRenderer(content: exportView)
        renderer.scale = 3.0
        let items: [Any]
        if let img = renderer.uiImage {
            items = [img]
        } else {
            items = ["\(payload.reference)\n\(payload.text)\n— AskBible.me"]
        }
        let vc = UIActivityViewController(activityItems: items, applicationActivities: nil)
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        var top = scene?.keyWindow?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        vc.popoverPresentationController?.sourceView = top?.view
        top?.present(vc, animated: true)
    }
}

/// 书签画布本体（预览与 ImageRenderer 导出共用）
private struct BookmarkCardCanvas: View {
    let payload: VerseSharePayload
    let darkCard: Bool

    private var bg: Color { darkCard ? Color(rgb: 0x1E1815) : Color(rgb: 0xEFE0C4) }
    private var ink: Color { darkCard ? Color(rgb: 0xF4EBE1) : Color(rgb: 0x1C1410) }
    private var muted: Color { darkCard ? Color(rgb: 0xB9A896) : Color(rgb: 0x5C4030) }
    private var rule: Color { Color(rgb: 0xD97707) }
    private var border: Color { darkCard ? Color.white.opacity(0.14) : Color(rgb: 0x78350F, opacity: 0.25) }

    var body: some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(rule)
                .frame(width: 36, height: 3)
                .padding(.top, 28)
                .padding(.bottom, 26)

            Text(payload.text)
                .font(.system(size: payload.text.count > 90 ? 16 : 18.5, weight: .semibold))
                .foregroundStyle(ink)
                .multilineTextAlignment(.center)
                .lineSpacing(8)
                .padding(.horizontal, 26)
                .frame(minHeight: 160)

            Rectangle()
                .fill(border)
                .frame(height: 0.75)
                .padding(.horizontal, 24)
                .padding(.top, 26)

            HStack {
                Text("\(payload.reference) · \(payload.translationName)")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(muted)
                    .lineLimit(1)
                Spacer(minLength: 8)
                Text("AskBible.me")
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(muted.opacity(0.68))
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 16)
        }
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(bg)
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(border, lineWidth: 1)
                )
        )
    }
}

/// 阅读器右上「Aa」7 档黄金排版与双语对照半屏面板
struct ReaderTypographySheet: View {
    @EnvironmentObject private var store: ScriptureStore
    @Binding var size: ReadSize
    let locale: AppLocale
    var onOpenMoreTranslations: () -> Void
    var onOpenSearch: () -> Void
    var onOpenFavorites: () -> Void
    var onClose: () -> Void

    @Environment(\.parchment) private var theme
    private static let steps: [ReadSize] = [.xs, .s, .m, .l, .xl, .xxl, .xxxl]

    private var currentStepIndex: Int {
        if let idx = Self.steps.firstIndex(of: size) { return idx }
        let allIdx = ReadSize.allCases.firstIndex(of: size) ?? 2
        return min(Self.steps.count - 1, max(0, allIdx))
    }

    private var bilingualOn: Bool { store.secondary != nil }

    var body: some View {
        ZStack(alignment: .bottom) {
            theme.modalBackdrop
                .ignoresSafeArea()
                .onTapGesture(perform: onClose)

            VStack(spacing: 18) {
                Capsule()
                    .fill(theme.ink.opacity(0.24))
                    .frame(width: 36, height: 4)
                    .padding(.top, 10)

                Text("Aa")
                    .askFont(size: 22, weight: .bold)
                    .foregroundStyle(theme.ink)

                // 7 档圆点字号滑杆
                HStack(spacing: 14) {
                    Button {
                        let nextIdx = max(0, currentStepIndex - 1)
                        size = Self.steps[nextIdx]
                    } label: {
                        Text("A-")
                            .askFont(size: 15, weight: .semibold)
                            .foregroundStyle(theme.ink)
                            .frame(width: 38, height: 38)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    GeometryReader { geo in
                        let count = Self.steps.count
                        let w = max(1, geo.size.width)
                        let stepW = w / CGFloat(count - 1)
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(theme.borderStrong)
                                .frame(height: 2.5)
                            HStack(spacing: 0) {
                                ForEach(0..<count, id: \.self) { idx in
                                    Circle()
                                        .fill(idx <= currentStepIndex ? theme.accentOt : theme.borderStrong)
                                        .frame(width: idx == currentStepIndex ? 18 : 7, height: idx == currentStepIndex ? 18 : 7)
                                        .frame(maxWidth: idx == 0 || idx == count - 1 ? nil : .infinity)
                                        .contentShape(Rectangle())
                                        .onTapGesture {
                                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                            size = Self.steps[idx]
                                        }
                                }
                            }
                        }
                        .frame(maxHeight: .infinity)
                        .gesture(
                            DragGesture(minimumDistance: 0)
                                .onChanged { g in
                                    let idx = min(count - 1, max(0, Int((g.location.x / stepW).rounded())))
                                    if Self.steps[idx] != size {
                                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                        size = Self.steps[idx]
                                    }
                                }
                        )
                    }
                    .frame(height: 32)

                    Button {
                        let nextIdx = min(Self.steps.count - 1, currentStepIndex + 1)
                        size = Self.steps[nextIdx]
                    } label: {
                        Text("A+")
                            .askFont(size: 18, weight: .bold)
                            .foregroundStyle(theme.ink)
                            .frame(width: 38, height: 38)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 8)

                Divider().overlay(theme.border)

                // 双语对照琥珀夹注一键开关
                Toggle(isOn: Binding(
                    get: { bilingualOn },
                    set: { on in
                        if on {
                            let defaultSecId = store.translation.isZh
                                ? (ScriptureTranslation.find("esv") != nil ? "esv" : "web-en")
                                : "cuv-simp"
                            if let sec = ScriptureTranslation.find(defaultSecId), sec.id != store.translation.id {
                                store.secondary = sec
                            }
                        } else {
                            store.secondary = nil
                        }
                    }
                )) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(AppLocale.pick("双语对照夹注", "Bilingual Marginalia", locale))
                            .askFont(size: 15.5, weight: .semibold)
                            .foregroundStyle(theme.ink)
                        Text(bilingualOn
                             ? "\(store.translation.label(locale)) + \(store.secondary?.label(locale) ?? "")"
                             : AppLocale.pick("在段落下方以琥珀细线并列第二译本", "Show secondary translation with amber marginalia", locale))
                            .askFont(size: 12)
                            .foregroundStyle(theme.muted)
                    }
                }
                .tint(Brand.logo)

                // 常用主译本速切 + 更多译本
                HStack(spacing: 6) {
                    ForEach(["cuv-simp", "cuv-trad", "esv", "web-en"], id: \.self) { tid in
                        if let tr = ScriptureTranslation.find(tid) {
                            let active = store.translation.id == tr.id
                            Button {
                                store.translation = tr
                                if store.secondary?.id == tr.id { store.secondary = nil }
                            } label: {
                                Text(tr.shortBadgeLabel(locale))
                                    .askFont(size: 12.5, weight: .semibold)
                                    .foregroundStyle(active ? theme.ink : theme.muted)
                                    .lineLimit(1)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 8)
                                    .background(
                                        RoundedRectangle(cornerRadius: 9, style: .continuous)
                                            .fill(active ? theme.surface : Color.clear)
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    Button {
                        onClose()
                        onOpenMoreTranslations()
                    } label: {
                        Text(AppLocale.pick("更多 ›", "More ›", locale))
                            .askFont(size: 12.5, weight: .semibold)
                            .foregroundStyle(theme.accentOt)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)
                }
                .padding(4)
                .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(theme.ink.opacity(0.06)))

                // 快捷跳转：本章搜索 · 摘录与印记
                HStack(spacing: 10) {
                    Button {
                        onClose(); onOpenSearch()
                    } label: {
                        Label(AppLocale.pick("搜索经文", "Search", locale), systemImage: "magnifyingglass")
                            .askFont(size: 13.5, weight: .semibold)
                            .foregroundStyle(theme.ink)
                            .frame(maxWidth: .infinity)
                            .frame(height: 40)
                            .background(RoundedRectangle(cornerRadius: 11).fill(theme.surface))
                            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(theme.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)

                    Button {
                        onClose(); onOpenFavorites()
                    } label: {
                        Label(AppLocale.pick("摘录与印记", "Notes & Highlights", locale), systemImage: "bookmark")
                            .askFont(size: 13.5, weight: .semibold)
                            .foregroundStyle(theme.ink)
                            .frame(maxWidth: .infinity)
                            .frame(height: 40)
                            .background(RoundedRectangle(cornerRadius: 11).fill(theme.surface))
                            .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(theme.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.bottom, 18)
            }
            .padding(.horizontal, 20)
            .background(ParchmentBackground(theme: theme))
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 26, bottomLeadingRadius: 0, bottomTrailingRadius: 0, topTrailingRadius: 26, style: .continuous))
            .askFloatingShadow(.overlay)
        }
    }
}

private extension ScriptureTranslation {
    func shortBadgeLabel(_ locale: AppLocale) -> String {
        switch id {
        case "cuv-simp": return "和合本"
        case "cuv-trad": return "和合繁"
        case "esv": return "ESV"
        case "web-en": return "WEB"
        default: return label(locale)
        }
    }
}
