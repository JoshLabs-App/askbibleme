import SwiftUI

/// 统一的摘录与四色印记条目（将收藏夹 VerseBookmarkStore 与四色划重点 VerseHighlightStore 合二为一，消灭划线孤岛）
struct UnifiedNoteEntry: Identifiable, Equatable {
    let id: String
    let translationId: String
    let bookId: String
    let bookNumber: Int
    let bookName: String
    let chapter: Int
    let verse: Int
    let text: String
    let primaryColorHex: String?
    let hasBookmark: Bool
    let highlightMap: [Int: String]
    let savedAt: Double
}

enum NoteColorFilter: String, CaseIterable, Identifiable {
    case all = "all"
    case yellow = "#FFB103"
    case green = "#A3B565"
    case blue = "#4E86A0"
    case red = "#C0625F"

    var id: String { rawValue }

    func label(_ locale: AppLocale) -> String {
        switch self {
        case .all: return AppLocale.pick("全部", "All", locale)
        case .yellow: return AppLocale.pick("灯油黄", "Amber", locale)
        case .green: return AppLocale.pick("橄榄绿", "Olive", locale)
        case .blue: return AppLocale.pick("青石蓝", "Slate", locale)
        case .red: return AppLocale.pick("石榴红", "Garnet", locale)
        }
    }

    var dotHex: String? {
        self == .all ? nil : rawValue
    }
}

/// 书房内嵌 & 独立摘录页共用的「摘录与印记」模块（带四色筛选与 3 秒防误删撤销托底）
struct UnifiedNotesBlock: View {
    @EnvironmentObject private var store: ScriptureStore
    @ObservedObject var bookmarks: VerseBookmarkStore
    @ObservedObject var highlights: VerseHighlightStore
    var locale: AppLocale = .zhCN
    var limit: Int? = nil
    var onOpenVerse: (_ bookId: String, _ chapter: Int, _ verse: Int) -> Void
    var onOpenMore: (() -> Void)? = nil
    var onShareCard: ((VerseSharePayload) -> Void)? = nil
    var onUndoAvailable: ((String, @escaping () -> Void) -> Void)? = nil

    @State private var filter: NoteColorFilter = .all
    @Environment(\.parchment) private var theme

    private var allEntries: [UnifiedNoteEntry] {
        var merged: [String: UnifiedNoteEntry] = [:]

        // 1) 双击/菜单收藏的经文
        for b in bookmarks.list {
            let key = "\(b.translationId):\(b.bookId):\(b.chapter):\(b.verse)"
            let hl = highlights.colors(translationId: b.translationId, bookId: b.bookId, chapter: b.chapter, verse: b.verse)
            let domColor = Self.dominantHex(in: hl) ?? "#FFB103"
            let num = BibleCatalog.book(id: b.bookId)?.number ?? 99
            merged[key] = UnifiedNoteEntry(
                id: key, translationId: b.translationId, bookId: b.bookId, bookNumber: num,
                bookName: b.bookName, chapter: b.chapter, verse: b.verse, text: b.text,
                primaryColorHex: domColor, hasBookmark: true, highlightMap: hl, savedAt: b.savedAt
            )
        }

        // 2) 四色划重点经文（此前无处回顾的孤岛数据）
        for (rawKey, byIdx) in highlights.store where !byIdx.isEmpty {
            if merged[rawKey] != nil { continue }
            let parts = rawKey.split(separator: ":", omittingEmptySubsequences: false).map(String.init)
            guard parts.count == 4,
                  let ch = Int(parts[2]), let vs = Int(parts[3]),
                  let book = BibleCatalog.book(id: parts[1]) else { continue }
            let tid = parts[0]
            let fallbackTid = store.searchFallbackId(for: tid) ?? "cuv-simp"
            let txt = store.verseText(translationId: tid, bookId: book.id, chapter: ch, verse: vs)
                ?? store.verseText(translationId: fallbackTid, bookId: book.id, chapter: ch, verse: vs)
                ?? ""
            guard !txt.isEmpty else { continue }
            merged[rawKey] = UnifiedNoteEntry(
                id: rawKey, translationId: tid, bookId: book.id, bookNumber: book.number,
                bookName: book.name(locale), chapter: ch, verse: vs, text: txt,
                primaryColorHex: Self.dominantHex(in: byIdx), hasBookmark: false,
                highlightMap: byIdx, savedAt: 0
            )
        }

        return merged.values.sorted { a, b in
            if a.savedAt != b.savedAt { return a.savedAt > b.savedAt }
            if a.bookNumber != b.bookNumber { return a.bookNumber < b.bookNumber }
            if a.chapter != b.chapter { return a.chapter < b.chapter }
            return a.verse < b.verse
        }
    }

    private var filteredEntries: [UnifiedNoteEntry] {
        let base: [UnifiedNoteEntry]
        if filter == .all {
            base = allEntries
        } else {
            base = allEntries.filter { entry in
                entry.primaryColorHex == filter.rawValue || entry.highlightMap.values.contains { VerseHighlightRules.normalizeColor($0) == filter.rawValue }
            }
        }
        if let limit { return Array(base.prefix(limit)) }
        return base
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text(AppLocale.pick("摘录与印记", "Notes & Highlights", locale))
                    .askFont(size: 18, weight: .bold)
                    .foregroundStyle(theme.ink)
                Spacer()
                if let onOpenMore, allEntries.count > (limit ?? Int.max) {
                    Button(action: onOpenMore) {
                        HStack(spacing: 2) {
                            Text(AppLocale.pick("全部 \(allEntries.count) 条", "All \(allEntries.count)", locale))
                            Image(systemName: "chevron.right").font(.system(size: 10, weight: .bold))
                        }
                        .askFont(size: 13, weight: .semibold)
                        .foregroundStyle(theme.muted)
                    }
                    .buttonStyle(.plain)
                }
            }

            // 四色颜料筛选胶囊
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) {
                    ForEach(NoteColorFilter.allCases) { item in
                        let on = filter == item
                        Button {
                            withAnimation(.easeInOut(duration: 0.18)) { filter = item }
                        } label: {
                            HStack(spacing: 6) {
                                if let hex = item.dotHex {
                                    Circle()
                                        .fill(Color(hex: hex))
                                        .frame(width: 9, height: 9)
                                }
                                Text(item.label(locale))
                                    .askFont(size: 12.5, weight: on ? .bold : .medium)
                            }
                            .foregroundStyle(on ? theme.canvas : theme.ink)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(Capsule().fill(on ? theme.ink : theme.surface.opacity(0.75)))
                            .overlay(Capsule().strokeBorder(on ? Color.clear : theme.border, lineWidth: 0.75))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            if filteredEntries.isEmpty {
                Text(filter == .all
                     ? AppLocale.pick("阅读经文时轻点染色或双击收藏，你的亮光会安静留在这里。", "Highlight or save verses while reading to keep them here.", locale)
                     : AppLocale.pick("这一色还没有留下印记。", "No highlights in this pigment yet.", locale))
                    .askFont(size: 13.5)
                    .lineSpacing(4)
                    .foregroundStyle(theme.faint)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 14)
            } else {
                VStack(spacing: 10) {
                    ForEach(filteredEntries) { item in
                        noteCard(item)
                    }
                }
            }
        }
    }

    private func noteCard(_ item: UnifiedNoteEntry) -> some View {
        let bookTitle = BibleCatalog.book(id: item.bookId)?.name(locale) ?? item.bookName
        let trLabel = ScriptureTranslation.find(item.translationId)?.label(locale) ?? item.translationId
        let refLabel = "\(bookTitle) \(item.chapter):\(item.verse)"
        let tintHex = item.primaryColorHex ?? "#FFB103"

        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text("\(refLabel) · \(trLabel)")
                    .askFont(size: 13, weight: .bold)
                    .foregroundStyle(theme.muted)
                Spacer(minLength: 4)
                if let onShareCard {
                    Button {
                        onShareCard(VerseSharePayload(reference: refLabel, translationName: trLabel, text: item.text))
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundStyle(theme.muted.opacity(0.8))
                            .frame(width: 28, height: 28)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                Button {
                    removeWithUndo(item)
                } label: {
                    Text(AppLocale.pick("移出", "Remove", locale))
                        .askFont(size: 11.5, weight: .medium)
                        .foregroundStyle(theme.faint)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 4)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }

            Button {
                onOpenVerse(item.bookId, item.chapter, item.verse)
            } label: {
                Text(locale.zh(item.text))
                    .askFont(size: 15, weight: .medium)
                    .lineSpacing(5)
                    .foregroundStyle(theme.ink)
                    .lineLimit(limit != nil ? 3 : 6)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(Color(uiColor: VerseHighlightRules.fillColor(tintHex)))
                    )
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(theme.border, lineWidth: 1))
    }

    private func removeWithUndo(_ item: UnifiedNoteEntry) {
        let hadBookmark = item.hasBookmark
        let savedHl = item.highlightMap
        if hadBookmark {
            _ = bookmarks.toggle(bookId: item.bookId, bookName: item.bookName, chapter: item.chapter,
                                 verse: item.verse, translationId: item.translationId, text: item.text)
        }
        if !savedHl.isEmpty {
            highlights.clear(translationId: item.translationId, bookId: item.bookId, chapter: item.chapter, verse: item.verse)
        }
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
        onUndoAvailable?(AppLocale.pick("已移出摘录", "Removed from notes", locale)) {
            if hadBookmark {
                _ = bookmarks.toggle(bookId: item.bookId, bookName: item.bookName, chapter: item.chapter,
                                     verse: item.verse, translationId: item.translationId, text: item.text)
            }
            for (idx, col) in savedHl {
                highlights.paint(translationId: item.translationId, bookId: item.bookId,
                                 chapter: item.chapter, verse: item.verse, range: idx...idx, color: col)
            }
        }
    }

    private static func dominantHex(in map: [Int: String]) -> String? {
        guard !map.isEmpty else { return nil }
        var counts: [String: Int] = [:]
        for col in map.values {
            let norm = VerseHighlightRules.normalizeColor(col)
            counts[norm, default: 0] += 1
        }
        return counts.max { $0.value < $1.value }?.key
    }
}

/// 独立「摘录与印记」全屏页（从目录页或书房「全部」进入）
struct FavoritesView: View {
    @ObservedObject var bookmarks: VerseBookmarkStore
    @ObservedObject var highlights: VerseHighlightStore
    var size: ReadSize = .default
    var locale: AppLocale = .zhCN
    var onBack: () -> Void
    var onOpenVerse: (_ bookId: String, _ chapter: Int, _ verse: Int) -> Void

    @State private var sharePayload: VerseSharePayload?
    @State private var undoMessage: String?
    @State private var undoAction: (() -> Void)?
    @State private var undoTask: Task<Void, Never>?
    @Environment(\.parchment) private var theme

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            Button(action: onBack) {
                                Image(systemName: "chevron.left")
                                    .askFont(size: 19, weight: .semibold)
                                    .foregroundStyle(theme.ink)
                                    .frame(width: 40, height: 40, alignment: .leading)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            Spacer()
                        }

                        UnifiedNotesBlock(
                            bookmarks: bookmarks,
                            highlights: highlights,
                            locale: locale,
                            limit: nil,
                            onOpenVerse: onOpenVerse,
                            onShareCard: { sharePayload = $0 },
                            onUndoAvailable: { msg, restore in
                                presentUndo(msg, restore: restore)
                            }
                        )
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 12)
                    .padding(.bottom, ShellMetrics.tabBarClearance + 40 + geo.safeAreaInsets.bottom + 90)
                }
                .ignoresSafeArea(edges: .bottom)
                .parchmentFade(.tabbar)

                if let msg = undoMessage {
                    UndoCapsuleToast(message: msg, locale: locale) {
                        undoTask?.cancel()
                        undoAction?()
                        withAnimation(.easeOut(duration: 0.18)) { undoMessage = nil; undoAction = nil }
                    }
                    .padding(.bottom, ShellMetrics.tabBarClearance + geo.safeAreaInsets.bottom + 18)
                }

                if let payload = sharePayload {
                    VerseShareCardSheet(payload: payload, locale: locale) {
                        sharePayload = nil
                    }
                    .zIndex(30)
                }
            }
        }
        .background(ParchmentBackground(theme: theme).ignoresSafeArea())
    }

    private func presentUndo(_ msg: String, restore: @escaping () -> Void) {
        undoTask?.cancel()
        undoAction = restore
        withAnimation(.easeOut(duration: 0.18)) { undoMessage = msg }
        undoTask = Task {
            try? await Task.sleep(for: .seconds(3.4))
            if Task.isCancelled { return }
            await MainActor.run {
                withAnimation(.easeIn(duration: 0.2)) { undoMessage = nil; undoAction = nil }
            }
        }
    }
}

/// 3 秒防误删撤销胶囊提示条
struct UndoCapsuleToast: View {
    let message: String
    let locale: AppLocale
    var onUndo: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Text(message)
                .askFont(size: 13.5, weight: .medium)
                .foregroundStyle(Color(rgb: 0xF4EBE1))
            Button(action: onUndo) {
                Text(AppLocale.pick("撤销", "Undo", locale))
                    .askFont(size: 13.5, weight: .bold)
                    .foregroundStyle(Brand.logo)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .background(Capsule().fill(Color(rgb: 0x1C1410, opacity: 0.92)))
        .shadow(color: .black.opacity(0.22), radius: 10, y: 4)
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}
