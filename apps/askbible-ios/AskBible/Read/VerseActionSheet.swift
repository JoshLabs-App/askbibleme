import SwiftUI
import UIKit

/// 长按某节弹出的操作单。对应 RN ReadChapterScreenVerseActionModal（ReadChapterBottomSheet 外壳）：
/// 标题「第 N 节」+ 右上「关闭」，三列格子：本节复制 / 双击收藏（已收藏则不出）/ 分享。
/// RN 的「划重点」还没接；「多选复制」2026-09-11 补上了。
struct VerseActionSheet: View {
    let verse: Int
    let bookmarked: Bool
    var size: ReadSize = .default
    var onCopy: () -> Void
    var onBookmark: () -> Void
    var onShare: () -> Void
    /// 多选复制：以这一节为起点进入选择态（RN runStartMultiCopy）
    var onMultiCopy: () -> Void = {}
    /// 划重点：进入划字模式（RN runOpenHighlightEditor）
    var onHighlight: () -> Void = {}
    var onClose: () -> Void

    private let theme = Parchment.light

    var body: some View {
        let fs = size.metrics.verseFontSize
        let iconSize = max(22, (fs * 1.15).rounded())
        let labelSize = max(13, (fs * 0.78).rounded())
        ZStack(alignment: .bottom) {
            Color(red: 28 / 255, green: 20 / 255, blue: 16 / 255, opacity: 0.35)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top, spacing: 12) {
                    Text(SiteCopy.f("pages.read.verseActionVerseTitle", ["verse": "\(verse)"])).font(.system(size: max(17, (fs * 0.95).rounded()), weight: .semibold)).foregroundStyle(theme.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Button(action: onClose) { Text(SiteCopy.t("pages.read.verseActionClose")).font(.system(size: (fs * 0.85).rounded())).foregroundStyle(theme.muted) }
                        .buttonStyle(.plain)
                }
                .padding(.bottom, 10)
                HStack(alignment: .top, spacing: 0) {
                    cell(MI.contentCopy, SiteCopy.t("pages.read.verseActionCopy"), iconSize, labelSize, onCopy)
                    if !bookmarked { cell(MI.bookmarkBorder, SiteCopy.t("pages.read.verseActionBookmark"), iconSize, labelSize, onBookmark) }
                    cell(MI.iosShare, SiteCopy.t("pages.read.verseActionShare"), iconSize, labelSize, onShare)
                    cell(MI.libraryAddCheck, SiteCopy.t("native.verseMultiCopy"), iconSize, labelSize, onMultiCopy)
                    cell(MI.brush, SiteCopy.t("native.highlight"), iconSize, labelSize, onHighlight)
                }
                .padding(.top, 4).padding(.bottom, 8)
            }
            .padding(.horizontal, 18).padding(.top, 14).padding(.bottom, 28)
            .frame(maxWidth: .infinity, alignment: .leading)
            .parchmentCard(cornerRadius: 16)
            .contentShape(Rectangle())
            .onTapGesture {}
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // 点空白关面板：手势挂整层（见 TranslationPanel 那条注）
        .contentShape(Rectangle())
        .onTapGesture(perform: onClose)
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
