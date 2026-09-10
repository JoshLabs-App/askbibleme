import Foundation

// 音乐页动画参数对拍 harness。stdin 每行一个用例：kind\targ…；输出 JSON 字符串数组。数值统一保留 4 位小数。
let input = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8) ?? ""
var lines = input.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
if lines.last == "" { lines.removeLast() }
func n(_ v: Double) -> String { String(format: "%.4f", v) }
var out: [String] = []
for line in lines {
    let f = line.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
    switch f[0] {
    case "prand": out.append(n(MusicVisuals.pseudoRandom01(Double(f[1])!)))
    case "scene":
        let s = MusicVisuals.scene(f[1])
        out.append([s.flatGradient, s.showCenterOrb, s.centerOrbSway, s.showSideOrbs, s.fish, s.breathRing, s.coffee, s.sleepSky, s.planets].map { $0 ? "1" : "0" }.joined()
                   + "|" + MusicVisuals.gradient(f[1]).map { String(format: "%06x", $0) }.joined(separator: ","))
    case "fishseed":
        let s = MusicVisuals.fishSeeds[Int(f[1])!]
        out.append([n(s.baseAngleDeg), n(s.radius), n(s.size), n(s.opacity), "\(s.orbitHarmonic)", n(s.shimmerOffset), "\(s.swimBucket)", n(s.swimOffset), n(s.tangentialAmp), n(s.radialAmp), n(s.headingAmp)].joined(separator: ","))
    case "fishframe":
        let r = MusicVisuals.fishFrame(MusicVisuals.fishSeeds[Int(f[1])!], tMs: Double(f[2])!)
        out.append([n(r.x), n(r.y), n(r.headingDeg), n(r.scale), n(r.opacity)].joined(separator: ","))
    case "orbit":
        let l = MusicVisuals.coffeeOrbitLayout(width: Double(f[1])!, height: Double(f[2])!, viewportHeight: Double(f[3])!, viewportTop: Double(f[4])!)
        out.append([n(l.cx), n(l.cy), n(l.innerRadius), n(l.outerRadius)].joined(separator: ","))
    case "bean":
        let l = MusicVisuals.coffeeOrbitLayout(width: Double(f[2])!, height: Double(f[3])!, viewportHeight: Double(f[3])!)
        let b = MusicVisuals.beanNode(Int(f[1])!, layout: l)
        out.append([b.isLeader ? "L" : (b.isFollower ? "F\(b.followIndex)" : "-"), n(b.direction), n(b.angle), n(b.radius), n(b.beanW), n(b.beanH), n(b.orbitPhaseDeg), n(b.followerBaseDeg), n(b.opacity), n(b.orbitMs), n(b.bobDelayMs), n(b.bobUpMs), n(b.bobDownMs)].joined(separator: ","))
    case "beanframe":
        let l = MusicVisuals.coffeeOrbitLayout(width: Double(f[2])!, height: Double(f[3])!, viewportHeight: Double(f[3])!)
        let nodes = MusicVisuals.beanNodes(l)
        let r = MusicVisuals.beanFrame(nodes[Int(f[1])!], leaderOrbitMs: nodes[0].orbitMs, tMs: Double(f[4])!)
        out.append([n(r.x), n(r.y), n(r.rotationDeg), n(r.scale), n(r.opacity)].joined(separator: ","))
    case "star":
        let s = MusicVisuals.star(Int(f[1])!, width: Double(f[2])!, height: Double(f[3])!)
        let r = MusicVisuals.starFrame(s, tMs: Double(f[4])!)
        out.append([n(s.x), n(s.y), n(s.size), n(s.trailSpan), n(s.trailTilt), n(s.upMs), n(s.downMs), n(r.opacity), n(r.dx), n(r.dy)].joined(separator: ","))
    case "meteor":
        let m = MusicVisuals.meteor(Int(f[1])!, width: Double(f[2])!, height: Double(f[3])!)
        let r = MusicVisuals.meteorFrame(m, tMs: Double(f[4])!)
        out.append([n(m.startX), n(m.startY), n(m.driftX), n(m.driftY), n(m.scale), n(m.length), n(m.periodMs), n(r.opacity), n(r.dx), n(r.dy)].joined(separator: ","))
    case "glow":
        let g = MusicVisuals.glowFrame(tMs: Double(f[1])!)
        out.append([g.mainScale, g.mainX, g.mainY, g.mainOpacity, g.leftScale, g.leftOpacity, g.rightScale, g.rightOpacity, g.coreScale, g.coreXWide, g.coreOpacity].map(n).joined(separator: ","))
    case "breath":
        let b = MusicVisuals.breathFrame(tMs: Double(f[1])!)
        out.append([b.scale, b.circleOpacity, b.glowOpacity, MusicVisuals.cupGlowOpacity(tMs: Double(f[1])!), MusicVisuals.moonOpacity(tMs: Double(f[1])!)].map(n).joined(separator: ","))
    case "planet":
        let p = MusicVisuals.planetFrame(tMs: Double(f[1])!)
        out.append([p.orbitADeg, p.orbitBDeg, p.mistOuterOpacity, p.mistInnerOpacity].map(n).joined(separator: ","))
    default: out.append("?")
    }
}
let enc = JSONEncoder(); enc.outputFormatting = [.withoutEscapingSlashes]
FileHandle.standardOutput.write(try enc.encode(out))
