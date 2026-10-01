import SwiftUI

/// 首页金句的字体（DECISIONS D-19）：思源宋体 700 的子集 AskBibleSong，和网页版首页同一套
/// （scripts/build-verse-font.py 生成，字表 = 站内中文译本用到的全部字）。
/// 字体里只有中文：含汉字的用它；英文、在线版本的其它文字和日文用系统衬线体，免得一句里两种字体混排。
enum VerseFont {
    static let song = IconFont.register("AskBibleSong-Bold")

    /// fixedSize：和原来的 `.system(size:)` 一样不跟系统字号缩放，金句大小只听首页自己的字号档
    static func font(for text: String, size: CGFloat) -> Font {
        if !song.isEmpty, isChinese(text) { return .custom(song, fixedSize: size) }
        return .system(size: size, weight: .bold, design: .serif)
    }

    /// 有汉字、没有假名（日文译本的汉字很多不在字表里）
    static func isChinese(_ text: String) -> Bool {
        var han = false
        for s in text.unicodeScalars {
            if (0x3040...0x30FF).contains(s.value) { return false }
            if (0x4E00...0x9FFF).contains(s.value) { han = true }
        }
        return han
    }
}
