import SwiftUI
import UIKit

/// 长按某节弹出的操作单。对应 RN ReadChapterScreenVerseActionModal（ReadChapterBottomSheet 外壳）：
/// 标题「第 N 节」+ 右上「关闭」，三列格子：本节复制 / 双击收藏（已收藏则不出）/ 分享。
/// RN 还有「多选复制」「划重点」两项，本轮未接。
struct VerseActionSheet: View {
    let verse: Int
    let bookmarked: Bool
    var size: ReadSize = .default
    var onCopy: () -> Void
    var onBookmark: () -> Void
    var onShare: () -> Void
    var onClose: () -> Void

    private let theme = Parchment.light

    var body: some View {
        let fs = size.metrics.verseFontSize
        let iconSize = max(22, (fs * 1.15).rounded())
        let labelSize = max(13, (fs * 0.78).rounded())
        ZStack(alignment: .bottom) {
            Color(red: 28 / 255, green: 20 / 255, blue: 16 / 255, opacity: 0.35).ignoresSafeArea().onTapGesture(perform: onClose)
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top, spacing: 12) {
                    Text("第 \(verse) 节").font(.system(size: max(17, (fs * 0.95).rounded()), weight: .semibold)).foregroundStyle(theme.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Button(action: onClose) { Text("关闭").font(.system(size: (fs * 0.85).rounded())).foregroundStyle(theme.muted) }
                        .buttonStyle(.plain)
                }
                .padding(.bottom, 10)
                HStack(alignment: .top, spacing: 0) {
                    cell(MI.contentCopy, "本节复制", iconSize, labelSize, onCopy)
                    if !bookmarked { cell(MI.bookmarkBorder, "双击收藏", iconSize, labelSize, onBookmark) }
                    cell(MI.iosShare, "分享", iconSize, labelSize, onShare)
                }
                .padding(.top, 4).padding(.bottom, 8)
            }
            .padding(.horizontal, 18).padding(.top, 14).padding(.bottom, 28)
            .frame(maxWidth: .infinity, alignment: .leading)
            .parchmentCard(cornerRadius: 16)
        }
    }

    private func cell(_ glyph: String, _ label: String, _ icon: CGFloat, _ font: CGFloat, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 8) {
                MaterialIcon(glyph: glyph, size: icon, color: theme.ink)
                Text(label).font(.system(size: font, weight: .medium)).foregroundStyle(theme.ink).lineSpacing(2).multilineTextAlignment(.center).lineLimit(2)
            }
            .frame(maxWidth: .infinity).padding(.horizontal, 6).padding(.vertical, 14)
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
    }
}

/// 收藏 / 复制后的轻提示（RN ReadVerseBookmarkFeedback）：底部 108 + 安全区，深色胶囊，进 160ms · 停 1400ms · 出 220ms
struct VerseFeedbackToast: View {
    let message: String?

    var body: some View {
        if let message {
            Text(message)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color(rgb: 0xF7F4EF))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(Capsule().fill(Color(red: 28 / 255, green: 20 / 255, blue: 16 / 255, opacity: 0.82)))
                .transition(.opacity)
                .allowsHitTesting(false)
        }
    }
}

/// 复制 / 分享用的经文文案，与 RN 同一格式：
/// 复制 = 「书名 章:节 经文」一行（lib formatScriptureVerseClipboard）；分享 = 「书名 章:节」换行经文（Share.share message）
enum VerseShareText {
    static func clipboard(bookName: String, chapter: Int, verse: Int, text: String) -> String {
        "\(bookName) \(chapter):\(verse) \(text.trimmingCharacters(in: .whitespacesAndNewlines))".trimmingCharacters(in: .whitespacesAndNewlines)
    }
    static func share(bookName: String, chapter: Int, verse: Int, text: String) -> String {
        "\(bookName) \(chapter):\(verse)\n\(text)"
    }
}
