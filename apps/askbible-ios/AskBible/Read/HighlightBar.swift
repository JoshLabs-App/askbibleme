import SwiftUI

/// 划重点时底部的调色卡片：四个颜色 + 擦除 + 完成。
/// 和长按操作单同一张羊皮卡片；画在播放坞之上，否则会被坞挡住。
struct HighlightBar: View {
    let locale: AppLocale
    @Binding var color: String
    @Binding var erasing: Bool
    var onDone: () -> Void

    @Environment(\.parchment) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(SiteCopy.t("native.highlight", locale))
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(theme.ink)
                    Text(SiteCopy.t("native.highlightHint", locale))
                        .font(.system(size: 12))
                        .foregroundStyle(theme.muted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Button(action: onDone) {
                    Text(SiteCopy.t("native.done", locale))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(theme.ink)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .padding(.bottom, 12)

            HStack(spacing: 12) {
                ForEach(VerseHighlightRules.palette, id: \.self) { hex in
                    Button {
                        color = hex
                        erasing = false
                    } label: {
                        // 所见即所得：色块用正文里实际铺出来的合成色，不是纯颜料色
                        Circle()
                            .fill(theme.canvas)
                            .overlay(Circle().fill(Color(uiColor: VerseHighlightRules.fillColor(hex))))
                            .frame(width: 34, height: 34)
                            .overlay(
                                Circle().stroke(theme.ink.opacity(!erasing && color == hex ? 0.75 : 0.12),
                                                lineWidth: !erasing && color == hex ? 2 : 0.5)
                            )
                            .contentShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
                Spacer(minLength: 8)
                Button { erasing = true } label: {
                    Text(SiteCopy.t("native.highlightErase", locale))
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(erasing ? theme.ink : theme.muted)
                        .padding(.horizontal, 12).frame(minHeight: 34)
                        .background(
                            Capsule().fill(erasing ? Color(rgb: 0xffb101, opacity: 0.22) : Color(parchment: 0xfff8eb, opacity: 0.5))
                        )
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 18).padding(.top, 14).padding(.bottom, 28)
        .frame(maxWidth: .infinity, alignment: .leading)
        // Josh 2026-09-16 真机确认画笔正常后改成玻璃。玻璃背景不像原来那张整屏羊皮图会吃触点
        // （DECISIONS 2026-09-13 Bug 2），所以不再需要 backgroundHitTesting: false 那个补丁。
        .askGlassRect(tone: .light, radius: AskCorner.card)
        .askFloatingShadow(.overlay)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .ignoresSafeArea(edges: .bottom)
    }
}
