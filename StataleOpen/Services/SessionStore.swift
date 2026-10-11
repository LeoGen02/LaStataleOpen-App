import Foundation
import WebKit
import UserNotifications

/// Stato di autenticazione dell'app.
/// - `.ready`: abbiamo un token dei web service Moodle → interfaccia nativa.
/// - `.webOnly`: il portale non consente l'accesso via app mobile → interfaccia basata sul sito.
@MainActor
final class SessionStore: ObservableObject {
    enum Phase {
        case checking, loggedOut, webOnly, ready
    }

    @Published private(set) var phase: Phase = .checking
    @Published private(set) var siteInfo: SiteInfo?
    @Published var notice: String?

    private(set) var client: MoodleClient?
    private var lastAutologin: Date?

    private static let siteInfoKey = "cachedSiteInfo"
    private static let webOnlyKey = "webOnlyMode"

    init() {
        if let token = KeychainStore.get(.token) {
            client = MoodleClient(token: token, privateToken: KeychainStore.get(.privateToken))
            siteInfo = Self.loadCachedSiteInfo()
            Task { await restore() }
        } else if UserDefaults.standard.bool(forKey: Self.webOnlyKey) {
            phase = .webOnly
        } else {
            phase = .loggedOut
        }
    }

    private func restore() async {
        guard let client else {
            phase = .loggedOut
            return
        }
        do {
            apply(try await client.siteInfo())
            phase = .ready
        } catch MoodleClientError.sessionExpired {
            expire()
        } catch {
            if siteInfo != nil {
                notice = "Portale non raggiungibile: dati non aggiornati."
                phase = .ready
            } else {
                notice = error.localizedDescription
                phase = .loggedOut
            }
        }
    }

    func completeLogin(token: String, privateToken: String?) async throws {
        let newClient = MoodleClient(token: token, privateToken: privateToken)
        let info = try await newClient.siteInfo()
        KeychainStore.set(token, for: .token)
        KeychainStore.set(privateToken, for: .privateToken)
        client = newClient
        lastAutologin = nil
        apply(info)
        UserDefaults.standard.set(false, forKey: Self.webOnlyKey)
        notice = nil
        phase = .ready
        _ = await DeadlineNotifier.requestAuthorization()
    }

    func useWebOnlyMode() {
        UserDefaults.standard.set(true, forKey: Self.webOnlyKey)
        notice = nil
        phase = .webOnly
    }

    func logout() async {
        clearToken()
        UserDefaults.standard.set(false, forKey: Self.webOnlyKey)
        await WKWebsiteDataStore.default().removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast)
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        try? await UNUserNotificationCenter.current().setBadgeCount(0)
        phase = .loggedOut
    }

    func expire() {
        clearToken()
        notice = MoodleClientError.sessionExpired.errorDescription
        phase = .loggedOut
    }

    /// Per le pagine Moodle prova ad usare l'autologin (tool_mobile), così la WebView è sempre autenticata.
    /// Moodle limita le richieste di chiave a una ogni ~6 minuti: nel frattempo valgono i cookie già ottenuti.
    func webURL(for target: URL) async -> URL {
        guard let client, client.privateToken != nil, let userID = siteInfo?.userid,
              target.host?.lowercased() == SiteConfig.moodleHost else { return target }
        if let lastAutologin, Date().timeIntervalSince(lastAutologin) < 6 * 60 { return target }
        lastAutologin = Date()
        guard let key = try? await client.autologinKey(), let base = URL(string: key.autologinurl) else { return target }
        return base.appendingQuery([
            "userid": String(userID),
            "key": key.key,
            "urltogo": target.absoluteString,
        ])
    }

    private func clearToken() {
        KeychainStore.set(nil, for: .token)
        KeychainStore.set(nil, for: .privateToken)
        UserDefaults.standard.removeObject(forKey: Self.siteInfoKey)
        PortalCache.clear()
        client = nil
        siteInfo = nil
        lastAutologin = nil
    }

    private func apply(_ info: SiteInfo) {
        siteInfo = info
        if let data = try? JSONEncoder().encode(info) {
            UserDefaults.standard.set(data, forKey: Self.siteInfoKey)
        }
    }

    private static func loadCachedSiteInfo() -> SiteInfo? {
        guard let data = UserDefaults.standard.data(forKey: siteInfoKey) else { return nil }
        return try? JSONDecoder().decode(SiteInfo.self, from: data)
    }
}

/// Dati condivisi tra le schede (corsi, scadenze, avvisi).
@MainActor
final class PortalData: ObservableObject {
    @Published var courses: [Course] = []
    @Published var events: [CalendarEvent] = []
    @Published var notifications: [PopupNotification] = []
    @Published var unreadCount = 0
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var lastUpdated: Date?

    /// All'avvio mostra subito gli ultimi dati scaricati (utile anche offline), poi aggiorna dal portale.
    init() {
        if let cached = PortalCache.load() {
            courses = cached.courses
            events = cached.events
            notifications = cached.notifications
            unreadCount = cached.notifications.filter { !$0.read }.count
            lastUpdated = cached.savedAt
        }
    }

    func refreshAll(using session: SessionStore) async {
        guard !isLoading, let client = session.client, let userID = session.siteInfo?.userid else { return }
        isLoading = true
        defer { isLoading = false }

        // Se il portale non risponde restano i dati della copia locale, con la loro data.
        var reachedPortal = false
        do {
            courses = try await client.userCourses(userID: userID)
                .sorted { ($0.lastaccess ?? 0) > ($1.lastaccess ?? 0) }
            errorMessage = nil
            reachedPortal = true
        } catch {
            if handle(error, session: session) { return }
        }

        if let fetched = try? await client.upcomingEvents() {
            events = fetched.sorted { $0.date < $1.date }
            await DeadlineNotifier.schedule(for: fetched)
            reachedPortal = true
        }
        await refreshNotifications(using: session)
        if reachedPortal {
            lastUpdated = Date()
            saveCache()
        }
    }

    func refreshNotifications(using session: SessionStore) async {
        guard let client = session.client, let userID = session.siteInfo?.userid else { return }
        guard let response = try? await client.notifications(userID: userID) else { return }
        notifications = response.notifications
        unreadCount = response.unreadcount ?? response.notifications.filter { !$0.read }.count
        await DeadlineNotifier.notifyNew(response.notifications, post: false)
        await DeadlineNotifier.updateBadge(unreadCount)
        saveCache()
    }

    private func saveCache() {
        guard let lastUpdated else { return }
        PortalCache.save(PortalCache.Snapshot(courses: courses, events: events, notifications: notifications, savedAt: lastUpdated))
    }

    func markRead(_ notification: PopupNotification, using session: SessionStore) async {
        guard !notification.read, let client = session.client else { return }
        try? await client.markNotificationRead(notification.id)
        await refreshNotifications(using: session)
    }

    func markAllRead(using session: SessionStore) async {
        guard let client = session.client, let userID = session.siteInfo?.userid else { return }
        try? await client.markAllNotificationsRead(userID: userID)
        await refreshNotifications(using: session)
    }

    /// Ritorna true se l'errore ha chiuso la sessione.
    @discardableResult
    func handle(_ error: Error, session: SessionStore) -> Bool {
        if (error as? MoodleClientError) == .sessionExpired {
            session.expire()
            return true
        }
        errorMessage = error.localizedDescription
        return false
    }
}

/// Copia locale degli ultimi dati scaricati, nella cartella Caches dell'app.
enum PortalCache {
    struct Snapshot: Codable {
        let courses: [Course]
        let events: [CalendarEvent]
        let notifications: [PopupNotification]
        /// Momento dell'ultimo aggiornamento riuscito dal portale.
        let savedAt: Date
    }

    private static var fileURL: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("portal-cache.json")
    }

    static func load() -> Snapshot? {
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return try? JSONDecoder().decode(Snapshot.self, from: data)
    }

    static func save(_ snapshot: Snapshot) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        try? data.write(to: fileURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    static func clear() {
        try? FileManager.default.removeItem(at: fileURL)
    }
}
