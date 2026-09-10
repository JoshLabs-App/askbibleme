import Foundation

// 会员登录纯规则对拍 harness。stdin 每行一个用例：kind\targ…；输出 JSON 字符串数组。
let input = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8) ?? ""
var lines = input.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
if lines.last == "" { lines.removeLast() }
var out: [String] = []
for line in lines {
    let f = line.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
    switch f[0] {
    case "err": let m = MemberAuthRules.mapAuthError(f[1]); out.append("\(m.error)|\(m.code)")
    case "name":
        let meta: [String: Any] = ["full_name": f[3], "name": f[4], "display_name": f[5]].filter { !($0.value as! String).isEmpty }
        out.append(MemberAuthRules.displayName(email: f[1], id: f[2], metadata: meta, fallback: f[6].isEmpty ? nil : f[6]))
    case "session":
        let now = ISO8601DateFormatter.flexible(f[2])!
        if let s = MemberAuthRules.parseSession(Data(f[1].utf8), now: now) {
            out.append("\(s.sessionToken)|\(s.user.id)|\(s.user.email)|\(s.user.name)|\(s.user.locale ?? "-")|\(s.user.createdAt ?? "-")")
        } else { out.append("null") }
    case "norm": out.append("\(MemberAuthRules.normalizeDisplayName(f[1]))|\(MemberAuthRules.isValidDisplayName(f[1]) ? 1 : 0)")
    case "greet": out.append(MemberAuthRules.greeting(f[1].isEmpty ? nil : MemberUser(id: "u", email: "e@x", name: f[1])))
    case "exp": out.append(MemberAuthRules.expiresAtISO(expiresAtSeconds: f[1].isEmpty ? nil : Double(f[1]), now: ISO8601DateFormatter.flexible(f[2])!))
    case "pkce": out.append(MemberOAuthRules.pkceChallenge(f[1]))
    case "nonce": out.append(MemberOAuthRules.sha256Hex(f[1]))
    case "authurl": out.append(MemberOAuthRules.authorizeURL(provider: f[1], redirectTo: f[2], challenge: f[3]))
    case "cburl": out.append(MemberOAuthRules.isCallbackURL(f[1]) ? "1" : "0")
    case "cbparse":
        let p = MemberOAuthRules.parseCallback(f[1])
        out.append("\(p.code ?? "-")|\(p.errorCode ?? "-")|\(p.accessToken ?? "-")|\(p.refreshToken ?? "-")")
    case "oautherr": out.append(MemberOAuthRules.resolveError(provider: f[1], code: f[2].isEmpty ? nil : f[2], error: f[3].isEmpty ? nil : f[3], cancelled: f[4] == "1") ?? "null")
    case "applename": out.append(MemberOAuthRules.appleFullName(given: f[1].isEmpty ? nil : f[1], family: f[2].isEmpty ? nil : f[2]) ?? "null")
    case "idcode": out.append(MemberOAuthRules.idTokenFailureCode(provider: f[1], message: f[2]))
    default: out.append("?")
    }
}
let enc = JSONEncoder(); enc.outputFormatting = [.withoutEscapingSlashes]
FileHandle.standardOutput.write(try enc.encode(out))
