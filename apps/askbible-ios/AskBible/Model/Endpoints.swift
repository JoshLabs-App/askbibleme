import Foundation

/// 防封换线（docs/anti-block-endpoints.md、DECISIONS D-20）：代码里不写死单个域名。
///
/// 每个角色内置一组候选域，启动后并发探测，取**列表里最靠前**那条通的并缓存到 UserDefaults；
/// 候选表本身从桶根的 `endpoints.json` 更新（真源 `data/endpoints.json`），加新域不用发版。
/// 三端同一套：安卓 `Endpoints.kt`、网页 `lib/endpoints/`。照听到 `Endpoints.swift` 改的。
///
/// 只依赖 Foundation —— `tools/*-check.mjs` 的对拍会把这个文件和各音源文件一起用 swiftc 编译。
enum Endpoints {

    // MARK: 角色

    enum Role: String, CaseIterable {
        /// R2 桶 `askbible-media`：金句语音、音乐、场景、勋章图、整本库
        case media
        /// 主站接口：在线译本、章节朗读地址解析、注销账号
        case site
        /// Supabase：登录、会员同步
        case api

        /// 内置默认候选域（`npm run check:endpoints` 核对它和 data/endpoints.json 一致）。
        /// 线上列表排在这些前面，但内置的永远垫在末尾兜底——线上表写坏了也不至于把客户端锁死。
        /// 每个角色的第一条就是老版本写死的那个地址，所以没探测前的行为和老版本一模一样。
        var builtin: [String] {
            switch self {
            case .media: return ["https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev/", "https://askbible-media.joshlabs.app/"]
            case .site:  return ["https://askbible.me/", "https://askbible-site.joshlabs.app/"]
            case .api:   return ["https://tgobadhdylarhssudplc.supabase.co/", "https://askbible-sb.joshlabs.app/"]
            }
        }
    }

    /// 探测用的小文件。取不到（404）不算失败，见 `probe(_:)`。
    private static let probePath = "healthz.txt"
    /// 回前台时最多这么久重探一次
    private static let refreshInterval: TimeInterval = 10 * 60

    // MARK: 当前生效的域

    private static let lock = NSLock()
    private static var chosen: [Role: String] = {
        var m: [Role: String] = [:]
        for r in Role.allCases { m[r] = cachedHost(r) ?? r.builtin[0] }
        return m
    }()
    private static var lastRefresh: Date?

    /// 带结尾斜杠的当前域，如 `https://askbible.me/`
    static func host(_ r: Role) -> String {
        lock.lock(); defer { lock.unlock() }
        return chosen[r] ?? r.builtin[0]
    }

    /// 不带结尾斜杠的当前域——原来那些 `r2PublicBase + "/audio/…"` 的拼法不用改
    static var mediaBase: String { String(host(.media).dropLast()) }
    static var siteBase: String { String(host(.site).dropLast()) }
    static var apiBase: String { String(host(.api).dropLast()) }

    /// 该角色认得的全部候选域（线上 + 内置），带结尾斜杠
    static func allHosts(_ r: Role) -> [String] { candidates(r) }

    /// 把写死了某条 media 线路的绝对地址换到当前线路上（译本目录里的整本库下载地址这类数据）。
    /// 不是 media 候选域的地址原样返回。
    static func rebasedMedia(_ url: String) -> String {
        for h in candidates(.media) where url.hasPrefix(h) { return host(.media) + url.dropFirst(h.count) }
        return url
    }

    // MARK: 本地缓存

    private static func hostKey(_ r: Role) -> String { "endpointHost.\(r.rawValue)" }
    private static func listKey(_ r: Role) -> String { "endpointList.\(r.rawValue)" }

    private static func cachedHost(_ r: Role) -> String? {
        let h = UserDefaults.standard.string(forKey: hostKey(r))
        return (h?.isEmpty == false) ? h : nil
    }

    /// 候选顺序：线上列表（缓存下来的）→ 内置，去重
    private static func candidates(_ r: Role) -> [String] {
        let remote = UserDefaults.standard.stringArray(forKey: listKey(r)) ?? []
        var seen = Set<String>()
        return (remote + r.builtin).map(normalized).filter { $0.hasPrefix("https://") && seen.insert($0).inserted }
    }

    private static func normalized(_ s: String) -> String {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty || t.hasSuffix("/") ? t : t + "/"
    }

    // MARK: 探测

    /// 启动后、回前台时在后台调。挑出可用域、拉新的候选表。`force` 为 false 时 10 分钟内不重复探。
    static func refresh(force: Bool = false) async {
        lock.lock()
        let recent = lastRefresh.map { Date().timeIntervalSince($0) < refreshInterval } ?? false
        if recent && !force { lock.unlock(); return }
        lastRefresh = Date()
        lock.unlock()

        await pickAll()
        await fetchList()          // 新列表可能引入更靠前的候选，再挑一次
        await pickAll()
    }

    private static func pickAll() async {
        await withTaskGroup(of: (Role, String?).self) { group in
            for r in Role.allCases { group.addTask { (r, await pick(r)) } }
            for await (r, host) in group {
                guard let host else { continue }
                lock.lock(); chosen[r] = host; lock.unlock()
                UserDefaults.standard.set(host, forKey: hostKey(r))
            }
        }
    }

    /// 并发探测该角色的全部候选域，取**列表里最靠前**的那个通的
    /// （不是最快的：顺序稳定，不会每次启动换来换去）。全挂就返回 nil，保留原来的。
    private static func pick(_ r: Role) async -> String? {
        let list = candidates(r)
        guard !list.isEmpty else { return nil }
        let ok = await withTaskGroup(of: (Int, Bool).self) { group -> [Int: Bool] in
            for (i, h) in list.enumerated() { group.addTask { (i, await probe(h)) } }
            var m: [Int: Bool] = [:]
            for await (i, good) in group { m[i] = good }
            return m
        }
        return list.indices.first { ok[$0] == true }.map { list[$0] }
    }

    /// 通不通只看「有没有 HTTP 响应」：被墙表现为 DNS 失败 / TLS 重置 / 超时，而不是 404。
    /// 所以探测文件没放的域（主站、Supabase）也照样算通。
    private static func probe(_ host: String) async -> Bool {
        guard let url = URL(string: host + probePath) else { return false }
        var req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 6)
        req.httpMethod = "HEAD"
        guard let (_, resp) = try? await URLSession.shared.data(for: req),
              let http = resp as? HTTPURLResponse else { return false }
        return http.statusCode < 500
    }

    /// 从当前 media 域（桶根）拉候选表，存下来下次启动就生效
    private static func fetchList() async {
        guard let url = URL(string: host(.media) + "endpoints.json") else { return }
        let req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 10)
        guard let (d, resp) = try? await URLSession.shared.data(for: req),
              let http = resp as? HTTPURLResponse, http.statusCode == 200,
              let obj = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
              let roles = obj["roles"] as? [String: Any] else { return }
        for r in Role.allCases {
            guard let spec = roles[r.rawValue] as? [String: Any],
                  let list = spec["candidates"] as? [String] else { continue }
            let clean = list.map(normalized).filter { $0.hasPrefix("https://") }
            if !clean.isEmpty { UserDefaults.standard.set(clean, forKey: listKey(r)) }
        }
    }
}
