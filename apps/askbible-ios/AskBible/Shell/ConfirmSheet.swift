import SwiftUI

/// 不可逆操作的确认单（删除账户等）。用和长按操作单同一张羊皮卡片，不用系统 Alert：
/// 整个 App 的弹层都是这套样式，系统 Alert 会跳出羊皮卷的观感。
struct ConfirmSheet: View {
    let title: String
    let message: String
    let confirmTitle: String
    let cancelTitle: String
    var onConfirm: () -> Void
    var onCancel: () -> Void

    private let theme = Parchment.light

    var body: some View {
        ZStack(alignment: .bottom) {
            theme.modalBackdrop
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture(perform: onCancel)

            VStack(alignment: .leading, spacing: 0) {
                Text(title)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(theme.ink)
                Text(message)
                    .font(.system(size: 14))
                    .lineSpacing(4)
                    .foregroundStyle(theme.muted)
                    .padding(.top, 8)

                HStack(spacing: 10) {
                    Button(action: onCancel) {
                        Text(cancelTitle)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(theme.ink)
                            .frame(maxWidth: .infinity).frame(minHeight: 48)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color(rgb: 0xFFFCF5, opacity: 0.62)))
                            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(theme.border, lineWidth: 0.5))
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    Button(action: onConfirm) {
                        Text(confirmTitle)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Color.white)
                            .frame(maxWidth: .infinity).frame(minHeight: 48)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color(rgb: 0xB42318)))
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, 18)
            }
            .padding(.horizontal, 18).padding(.top, 16).padding(.bottom, 28)
            .frame(maxWidth: .infinity, alignment: .leading)
            .parchmentCard(cornerRadius: 16)
            .contentShape(Rectangle())
            .onTapGesture {}
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
