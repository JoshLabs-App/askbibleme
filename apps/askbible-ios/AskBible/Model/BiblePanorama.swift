import Foundation

struct PanoramaSpan: Decodable { let bookId: String; let first: Int; let last: Int }
struct PanoramaSection: Decodable, Identifiable { let id: String; let zh: String; let en: String; let summaryZh: String; let summaryEn: String; let spans: [PanoramaSpan] }
struct PanoramaAct: Decodable { let zh: String; let en: String; let subtitleZh: String; let subtitleEn: String; let sections: [PanoramaSection] }
struct PanoramaIntroduction: Decodable { let zh: String; let en: String; let references: String }
struct PanoramaReadingLink: Decodable { let bookId: String; let chapter: Int; let verses: String; let kindZh: String; let kindEn: String; let reasonZh: String; let reasonEn: String }
struct PanoramaReadingNote: Decodable { let zh: String; let en: String; let links: [PanoramaReadingLink] }
struct BiblePanorama: Decodable {
    let acts: [PanoramaAct]
    let introductions: [String: PanoramaIntroduction]
    let notes: [String: PanoramaReadingNote]
    static let shared: BiblePanorama = {
        guard let url = Bundle.main.url(forResource: "panorama", withExtension: "json"),
              let data = try? Data(contentsOf: url), let decoded = try? JSONDecoder().decode(BiblePanorama.self, from: data) else {
            assertionFailure("Missing validated panorama content")
            return BiblePanorama(acts: [], introductions: [:], notes: [:])
        }
        return decoded
    }()
    func location(_ book: String, _ chapter: Int) -> (Int, PanoramaSection)? {
        let order = book == "REV" && chapter >= 21 ? [5,4] : Array(acts.indices)
        for i in order where acts.indices.contains(i) {
            if let s = acts[i].sections.first(where: { $0.spans.contains { $0.bookId == book && ($0.first...$0.last).contains(chapter) } }) { return (i,s) }
        }
        return nil
    }
}
