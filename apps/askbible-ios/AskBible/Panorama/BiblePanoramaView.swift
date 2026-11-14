import SwiftUI

struct BiblePanoramaView: View {
    let locale: AppLocale
    let currentBook: String?
    let currentChapter: Int
    let locateRequest: Int
    var onResume: () -> Void
    var onRead: (String, Int) -> Void
    @Environment(\.parchment) private var theme
    @State private var expandedActs: Set<Int> = []
    @State private var expandedSections: Set<String> = []
    @State private var expandedBooks: Set<String> = []
    private let data = BiblePanorama.shared
    private func t(_ zh: String, _ en: String) -> String { AppLocale.pick(zh,en,locale) }
    private var current: (Int, PanoramaSection)? { currentBook.flatMap { data.location($0,currentChapter) } }
    var body: some View {
        ZStack {
            ScrollViewReader { proxy in
                VStack(spacing: 0) {
                    if let book = currentBook, let ref = BibleCatalog.book(id: book) {
                        HStack {
                            Button(t("继续阅读", "Resume reading") + " · \(ref.name(locale)) \(currentChapter)", action: onResume)
                            Spacer(minLength: 12)
                            Button(t("定位", "Locate")) { locate(proxy) }
                        }.askFont(size: 13).padding(.horizontal,24).padding(.vertical,12)
                    }
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 20) {
                            Text(t("圣经全景", "Bible panorama")).askFont(size: 30,weight:.bold)
                            Text(t("一个故事，从创造走向新创造。", "One story, from creation to new creation.")).askFont(size:14).foregroundStyle(theme.ink.opacity(0.7))
                            ForEach(data.acts.indices,id:\.self) { index in
                                actView(index).id(index)
                            }
                            Text(t("六幕是阅读导览，不是圣经原有的分卷。书卷可跨越多个阶段；诗歌、智慧与先知书按处境和主题连接。", "The six acts are a reading guide, not the Bible's own divisions. Books can span stages; poetry, wisdom, and prophecy connect through context and themes.")).askFont(size:12).foregroundStyle(theme.ink.opacity(0.65))
                        }.padding(24)
                            .padding(.bottom, ShellMetrics.tabBarClearance + 120)
                    }
                    .parchmentFade(.tabbar)
                }
                .onChange(of: locateRequest) { _,_ in locate(proxy) }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // 与圣经目录共用铺底；仅背景延伸到刘海和底部安全区。
        .background(ParchmentBackground(theme: theme).ignoresSafeArea())
        .foregroundStyle(theme.ink).buttonStyle(.plain)
    }
    private func locate(_ proxy: ScrollViewProxy) {
        if let (i,s) = current { expandedActs.insert(i);expandedSections.insert(s.id);proxy.scrollTo(i,anchor:.top) }
    }
    private func toggle<T: Hashable>(_ value: T, in set: inout Set<T>) { if set.contains(value) { set.remove(value) } else { set.insert(value) } }
    private func actView(_ index: Int) -> some View {
        let act = data.acts[index]
        return HStack(alignment:.top,spacing:12) {
            Text("\(index+1)").askFont(size:13,weight:.bold).frame(width:28,height:28).background(theme.accentOt.opacity(0.15),in:Circle())
            VStack(alignment:.leading,spacing:12) {
                Button { toggle(index,in:&expandedActs) } label: {
                    HStack(spacing:10) {
                        PanoramaLineArt(stage:index).stroke(theme.accentOt,lineWidth:1.2).frame(width:58,height:65).accessibilityHidden(true)
                        VStack(alignment:.leading,spacing:5) {
                            Text(t(act.zh,act.en)).askFont(size:22,weight:.bold)
                            Text(t(act.subtitleZh,act.subtitleEn)).askFont(size:14).foregroundStyle(theme.ink.opacity(0.7))
                            if current?.0 == index { Text(t("你正在这里", "You are here")).askFont(size:12).foregroundStyle(theme.accentOt) }
                        }.frame(maxWidth:.infinity,alignment:.leading)
                        Image(systemName:expandedActs.contains(index) ? "minus" : "plus").accessibilityHidden(true)
                    }.contentShape(Rectangle())
                }.accessibilityValue(expandedActs.contains(index) ? t("已展开", "Expanded") : t("已收起", "Collapsed"))
                if expandedActs.contains(index) {
                    ForEach(act.sections) { section in
                        sectionView(section, alwaysOpen: act.sections.count <= 2)
                    }
                }
            }
        }.padding(.bottom,12)
    }
    private func sectionView(_ section: PanoramaSection, alwaysOpen: Bool) -> some View {
        let expanded = alwaysOpen || expandedSections.contains(section.id)
        return VStack(alignment:.leading,spacing:12) {
            if !alwaysOpen {
                Button { toggle(section.id,in:&expandedSections) } label: {
                    HStack { Text(t(section.zh,section.en)).askFont(size:18,weight:.semibold);Spacer();Image(systemName:expanded ? "minus" : "plus") }
                        .frame(minHeight:44).contentShape(Rectangle())
                }
            }
            if expanded {
                Text(t(section.summaryZh,section.summaryEn)).askFont(size:14)
                if let note = data.notes[section.id] {
                    Text(t("经文脉络", "Scripture in context")).askFont(size:15,weight:.semibold)
                    Text(t(note.zh,note.en)).askFont(size:14)
                    ForEach(note.links.indices,id:\.self) { i in
                        let link = note.links[i]
                        Button { onRead(link.bookId,link.chapter) } label: {
                            VStack(alignment:.leading,spacing:8) {
                                Text(t(link.kindZh,link.kindEn)+" · "+(BibleCatalog.book(id:link.bookId)?.name(locale) ?? link.bookId)+" \(link.chapter)"+(link.verses.isEmpty ? "" : ":\(link.verses)")).askFont(size:14,weight:.semibold)
                                Text(t(link.reasonZh,link.reasonEn)).askFont(size:13)
                                Text(t("阅读所在章 ›", "Read this chapter ›")).askFont(size:12)
                            }.frame(maxWidth:.infinity,alignment:.leading).padding(12).background(theme.accentOt.opacity(0.07),in:RoundedRectangle(cornerRadius:8))
                        }
                    }
                }
            }
            ForEach(section.spans.indices,id:\.self) { i in bookView(section.spans[i],section:section) }
        }
    }
    @ViewBuilder private func bookView(_ span: PanoramaSpan, section: PanoramaSection) -> some View {
        if let book = BibleCatalog.book(id:span.bookId), let intro = data.introductions[span.bookId] {
            let key = "\(section.id):\(span.bookId):\(span.first)"
            let expanded = expandedBooks.contains(key)
            let isCurrent = currentBook == span.bookId && (span.first...span.last).contains(currentChapter)
            VStack(alignment:.leading,spacing:12) {
                Button { toggle(key,in:&expandedBooks) } label: {
                    HStack(spacing:12) {
                        Image(systemName:"book.closed").askFont(size:28).accessibilityHidden(true)
                        VStack(alignment:.leading,spacing:7) {
                            if isCurrent { Text(t("你正在这里 · 第\(currentChapter)章", "You are here · Chapter \(currentChapter)")).askFont(size:12).foregroundStyle(theme.accentOt) }
                            Text(book.name(locale)).askFont(size:18,weight:.bold)
                            Text(t(intro.zh,intro.en)).askFont(size:13)
                            Text(span.first == 1 && span.last == book.chapterCount ? t("圣经书卷 · \(book.chapterCount)章", "Bible book · \(book.chapterCount) chapters") : t("圣经书卷 · 第\(span.first)—\(span.last)章", "Bible book · chapters \(span.first)–\(span.last)")).askFont(size:11).foregroundStyle(theme.ink.opacity(0.65))
                        }.frame(maxWidth:.infinity,alignment:.leading)
                        Image(systemName:expanded ? "minus" : "plus").accessibilityHidden(true)
                    }.contentShape(Rectangle())
                }
                if expanded {
                    Text(t("在全经中的位置 · ", "In the story · ")+t(section.zh,section.en)).askFont(size:15,weight:.semibold)
                    Text(t(section.summaryZh,section.summaryEn)).askFont(size:14)
                    Text(t("阅读线索：", "Reading pointers: ")+intro.references).askFont(size:12)
                    Text(t("选择章节", "Choose a chapter")).askFont(size:15,weight:.semibold)
                    LazyVGrid(columns:[GridItem(.adaptive(minimum:56))]) {
                        ForEach(span.first...span.last,id:\.self) { chapter in
                            Button { onRead(span.bookId,chapter) } label: { Text("\(chapter)").askFont(size:18).frame(maxWidth:.infinity,minHeight:48).contentShape(Rectangle()) }
                        }
                    }
                    Button(t("收起详情", "Collapse details")) { expandedBooks.remove(key) }.askFont(size:13).frame(minHeight:44)
                }
            }.padding(14).background(isCurrent ? theme.accentOt.opacity(0.12) : theme.surface.opacity(0.3),in:RoundedRectangle(cornerRadius:10))
                .overlay(RoundedRectangle(cornerRadius:10).stroke(theme.accentOt.opacity(isCurrent ? 1 : 0.4),lineWidth:1))
        }
    }
}

struct PanoramaLineArt: Shape {
    let stage: Int
    func path(in rect: CGRect) -> Path {
        var p = Path()
        func line(_ x:CGFloat,_ y:CGFloat,_ a:CGFloat,_ b:CGFloat) { p.move(to:CGPoint(x:x,y:y));p.addLine(to:CGPoint(x:a,y:b)) }
        line(5,70,95,70)
        switch stage {
        case 0,1,5:
            line(48,69,50,24);line(50,47,28,28);line(50,43,73,22);line(50,35,43,15)
            if stage != 1 { for (x,y) in [(25,24),(40,18),(57,16),(73,23),(34,36),(65,36)] { p.addEllipse(in:CGRect(x:x-12,y:y-12,width:24,height:24)) } }
            if stage == 5 { p.move(to:CGPoint(x:58,y:70));p.addCurve(to:CGPoint(x:40,y:80),control1:CGPoint(x:95,y:72),control2:CGPoint(x:15,y:73)) }
        case 2:
            line(17,64,48,24);line(48,24,80,64);line(80,64,17,64);line(48,24,48,64);line(48,24,63,64)
            for (x,y) in [(15,14),(72,10),(87,28),(35,7)] { line(CGFloat(x-3),CGFloat(y),CGFloat(x+3),CGFloat(y));line(CGFloat(x),CGFloat(y-3),CGFloat(x),CGFloat(y+3)) }
        case 3: line(48,65,48,8);line(30,25,67,25)
        default:
            for (x,y) in [(25,14),(70,8),(96,28)] {
                p.move(to:CGPoint(x:48,y:70));p.addQuadCurve(to:CGPoint(x:x,y:y),control:CGPoint(x:60,y:45))
                line(CGFloat(x-6),CGFloat(y+9),CGFloat(x),CGFloat(y));line(CGFloat(x),CGFloat(y),CGFloat(x+5),CGFloat(y+9))
            }
        }
        return p.applying(CGAffineTransform(scaleX:rect.width/100,y:rect.height/80))
    }
}
