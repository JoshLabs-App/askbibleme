import Foundation
import UserNotifications

/// 每日读经提醒（对齐 RN notification-prefs + localNotificationScheduler 的 readingReminder 那一路）：
/// 每天同一时刻一条本地通知，文案「读经提醒 / 今天可以安静读一会儿经。」。
/// 偏好只存本机（RN 也一样，不进会员同步）。金句推送 RN 还有一路，原生先只做读经提醒。
@MainActor
final class ReadingReminder: ObservableObject {
    static let shared = ReadingReminder()

    private let defaults = UserDefaults.standard
    private static let enabledKey = "askbible-reading-reminder-enabled-v1"
    private static let hourKey = "askbible-reading-reminder-hour-v1"
    private static let minuteKey = "askbible-reading-reminder-minute-v1"
    private static let requestId = "askbible.reading-reminder.daily"

    /// RN DEFAULT_NOTIFICATION_PREFS：默认开，07:00
    @Published private(set) var enabled: Bool
    @Published private(set) var hour: Int
    @Published private(set) var minute: Int
    /// 用户拒过通知权限：界面上提示去系统设置
    @Published private(set) var denied = false

    private init() {
        enabled = defaults.object(forKey: Self.enabledKey) as? Bool ?? false
        hour = defaults.object(forKey: Self.hourKey) as? Int ?? 7
        minute = defaults.object(forKey: Self.minuteKey) as? Int ?? 0
    }

    var timeLabel: String { String(format: "%02d:%02d", hour, minute) }

    /// 开关 + 改时间统一走这里：关就撤销，开就（申请权限后）重排
    func apply(enabled nextEnabled: Bool, hour nextHour: Int, minute nextMinute: Int, locale: AppLocale) async {
        hour = max(0, min(23, nextHour))
        minute = max(0, min(59, nextMinute))
        defaults.set(hour, forKey: Self.hourKey)
        defaults.set(minute, forKey: Self.minuteKey)

        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [Self.requestId])

        guard nextEnabled else {
            enabled = false
            defaults.set(false, forKey: Self.enabledKey)
            return
        }

        let granted = (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
        guard granted else {
            denied = true
            enabled = false
            defaults.set(false, forKey: Self.enabledKey)
            return
        }
        denied = false

        let content = UNMutableNotificationContent()
        content.title = SiteCopy.t("native.reminderTitle", locale)
        content.body = SiteCopy.t("native.reminderBody", locale)
        content.sound = .default
        var components = DateComponents()
        components.hour = hour
        components.minute = minute
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        try? await center.add(UNNotificationRequest(identifier: Self.requestId, content: content, trigger: trigger))

        enabled = true
        defaults.set(true, forKey: Self.enabledKey)
    }

    /// 换界面语言后文案要跟着换：开着就按新语言重排一次
    func refreshCopy(locale: AppLocale) async {
        guard enabled else { return }
        await apply(enabled: true, hour: hour, minute: minute, locale: locale)
    }
}
