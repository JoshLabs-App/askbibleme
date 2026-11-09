import Foundation

let today = "2026-11-09"
func check(_ expected: Bool, _ label: String, natural: Bool = true, active: Bool = true,
           count: Int = 3, index: Int = 2, day: String? = "2026-11-09", enabled: Bool = true, available: Bool = true) {
    let result = PlanDevotionalHandoff.shouldPlay(naturalEnd: natural, active: active, count: count,
        index: index, listeningDay: day, today: today, enabled: enabled, available: available)
    precondition(result == expected, label)
}
check(true, "today's final chapter")
check(false, "disabled", enabled: false)
check(false, "manual skip", natural: false)
check(false, "ordinary chapter", active: false)
check(false, "empty queue", count: 0, index: -1)
check(false, "middle chapter", index: 1)
check(false, "past day", day: "2026-11-08")
check(false, "future day", day: "2026-11-10")
check(false, "no captured day", day: nil)
check(false, "not eligible", available: false)
check(true, "single-chapter plan", count: 1, index: 0)
let suite = "me.askbible.tests.devotional.\(UUID().uuidString)"
let defaults = UserDefaults(suiteName: suite)!
precondition(!defaults.bool(forKey: "devotional.after-reading"))
defaults.set(true, forKey: "devotional.after-reading")
precondition(UserDefaults(suiteName: suite)!.bool(forKey: "devotional.after-reading"))
defaults.removePersistentDomain(forName: suite)
print("PASS: 11 handoff cases and preference default/persistence")
