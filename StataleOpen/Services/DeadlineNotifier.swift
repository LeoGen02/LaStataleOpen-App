import Foundation
import UserNotifications
import BackgroundTasks

/// Promemoria locali per le scadenze e notifiche per i nuovi avvisi del portale.
enum DeadlineNotifier {
    static let enabledKey = "deadlineReminders"
    private static let seenKey = "seenNotificationIDs"
    private static let prefix = "deadline-"

    static var isEnabled: Bool {
        UserDefaults.standard.object(forKey: enabledKey) as? Bool ?? true
    }

    @discardableResult
    static func requestAuthorization() async -> Bool {
        (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    static func schedule(for events: [CalendarEvent]) async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests()
        center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix(prefix) })
        guard isEnabled else { return }

        let now = Date()
        let reminders: [(seconds: TimeInterval, label: String)] = [(86_400, "domani"), (7_200, "tra 2 ore")]
        // iOS conserva al massimo 64 notifiche in coda.
        for event in events.filter({ $0.date > now }).sorted(by: { $0.date < $1.date }).prefix(25) {
            for reminder in reminders {
                let fireDate = event.date.addingTimeInterval(-reminder.seconds)
                guard fireDate > now else { continue }
                let content = UNMutableNotificationContent()
                content.title = "Scadenza \(reminder.label)"
                content.body = [event.name.htmlStripped, event.course?.fullname.htmlStripped].compactMap { $0 }.joined(separator: " — ")
                content.sound = .default
                let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate)
                let request = UNNotificationRequest(
                    identifier: "\(prefix)\(event.id)-\(Int(reminder.seconds))",
                    content: content,
                    trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
                )
                try? await center.add(request)
            }
        }
    }

    /// Registra gli avvisi già visti; con `post` notifica quelli nuovi (usato dall'aggiornamento in background).
    static func notifyNew(_ notifications: [PopupNotification], post: Bool) async {
        let defaults = UserDefaults.standard
        let firstRun = defaults.object(forKey: seenKey) == nil
        let seen = Set(defaults.array(forKey: seenKey) as? [Int] ?? [])
        if post && !firstRun && isEnabled {
            for item in notifications where !item.read && !seen.contains(item.id) {
                let content = UNMutableNotificationContent()
                content.title = item.contexturlname?.htmlStripped ?? "La Statale Open"
                content.body = item.subject.htmlStripped
                content.sound = .default
                let request = UNNotificationRequest(identifier: "notification-\(item.id)", content: content, trigger: nil)
                try? await UNUserNotificationCenter.current().add(request)
            }
        }
        let ids = Array(seen.union(notifications.map(\.id)).sorted().suffix(500))
        defaults.set(ids, forKey: seenKey)
    }
}

enum BackgroundRefresher {
    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: SiteConfig.backgroundRefreshID)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 60 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    static func run() async {
        schedule()
        guard let token = KeychainStore.get(.token) else { return }
        let client = MoodleClient(token: token, privateToken: nil)
        guard let info = try? await client.siteInfo() else { return }
        if let events = try? await client.upcomingEvents() {
            await DeadlineNotifier.schedule(for: events)
        }
        if let response = try? await client.notifications(userID: info.userid) {
            await DeadlineNotifier.notifyNew(response.notifications, post: true)
        }
    }
}
