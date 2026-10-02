import Foundation

// 防封换线的联网自检 harness，tools/endpoints-live-check.mjs 用。
// 场景：上次缓存的线路和候选表第一条都是连不上的域 → 探测后必须落到一条真能连上的线路，
// 并且候选表被线上 endpoints.json 换掉。输出与 Kotlin 侧（core --endpoints）同形状的 JSON。

let dead = "https://blocked.invalid/"
let keys = Endpoints.Role.allCases.flatMap { ["endpointHost.\($0.rawValue)", "endpointList.\($0.rawValue)"] }
for r in Endpoints.Role.allCases {
    UserDefaults.standard.set(dead, forKey: "endpointHost.\(r.rawValue)")
    UserDefaults.standard.set([dead], forKey: "endpointList.\(r.rawValue)")
}

let before = [Endpoints.mediaBase, Endpoints.siteBase, Endpoints.apiBase]
let done = DispatchSemaphore(value: 0)
Task { await Endpoints.refresh(force: true); done.signal() }
done.wait()
let after = [Endpoints.mediaBase, Endpoints.siteBase, Endpoints.apiBase]

let out: [String: Any] = [
    "before": before, "after": after,
    "media": Endpoints.allHosts(.media), "site": Endpoints.allHosts(.site), "api": Endpoints.allHosts(.api),
]
// harness 的 UserDefaults 落在本机偏好设置里，跑完清掉，别影响下一次
for k in keys { UserDefaults.standard.removeObject(forKey: k) }
print(String(data: try! JSONSerialization.data(withJSONObject: out, options: [.sortedKeys, .withoutEscapingSlashes]), encoding: .utf8)!)
