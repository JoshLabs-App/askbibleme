import SwiftUI

/// 划重点时底部的调色卡片：四个颜色 + 擦除 + 完成。
/// 和长按操作单同一张羊皮卡片；画在播放坞之上，否则会被坞挡住。
struct HighlightBar: View {
    let locale: AppLocale
    @Binding var color: String
    @Binding var erasing: Bool
    var onDone: () -> Void

    private let theme = Parchment.light

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
                        Circle()
                            .fill(Color(hex: hex))
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
                            Capsule().fill(erasing ? Color(rgb: 0xffb101, opacity: 0.22) : Color(rgb: 0xfff8eb, opacity: 0.5))
                        )
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 18).padding(.top, 14).padding(.bottom, 28)
        .frame(maxWidth: .infinity, alignment: .leading)
        .parchmentCard(cornerRadius: 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .ignoresSafeArea(edges: .bottom)
    }
}
