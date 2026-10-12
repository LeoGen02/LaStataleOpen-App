import Foundation
import WebKit
import UserNotifications

/// Stato di autenticazione dell'app.
/// - `.ready`: interfaccia nativa, con i web service per app (token) oppure con la sessione del sito;
/// - `.webOnly`: l'utente ha scelto di usare direttamente le pagine del portale.
@MainActor
final class SessionStore: ObservableObject {
    enum Phase {
        case checking, loggedOut, webOnly, ready
    }

    /// Strada usata per leggere il portale.
    enum Access {
        /// Web service per app mobile (token, come l'app Moodle ufficiale).
        case appServices
        /// Sessione del sito (cookie del login di Ateneo + sesskey), per i portali con i servizi per app disattivati.
        case siteSession
    }

    @Published private(set) var phase: Phase = .checking
    @Published private(set) var siteInfo: SiteInfo?
    @Published private(set) var access: Access = .appServices
    @Published var notice: String?

    private(set) var client: PortalAPI?
    private var lastAutologin: Date?
    private var renewal: Task<SiteSessionState?, Never>?

    private static let siteInfoKey = "cachedSiteInfo"
    private static let webOnlyKey = "webOnlyMode"

    init() {
        if let token = KeychainStore.get(.token) {
            client = MoodleClient(token: token, privateToken: KeychainStore.get(.privateToken))
            siteInfo = Self.loadCachedSiteInfo()
            Task { await restore() }
        } else if let state = Self.storedSiteSession() {
            // Sessione del sito: si riparte subito con i dati salvati; se il portale l'ha chiusa
            // la prima richiesta la rinnova da sola (SiteSessionClient → renewSiteSession).
            access = .siteSession
            siteInfo = Self.loadCachedSiteInfo() ?? SiteInfo(userid: state.userID, fullname: "", firstname: nil, username: nil, sitename: nil)
            client = makeSiteClient(state)
            phase = .ready
            Task { await PortalCookies.restore(state.cookies) }
        } else if UserDefaults.standard.bool(forKey: Self.webOnlyKey) {
            phase = .webOnly
        } else {
            phase = .loggedOut
        }
    }

    private func restore() async {
        guard let client = client as? MoodleClient else {
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
        Self.saveSiteSession(nil)
        KeychainStore.set(token, for: .token)
        KeychainStore.set(privateToken, for: .privateToken)
        client = newClient
        access = .appServices
        lastAutologin = nil
        apply(info)
        UserDefaults.standard.set(false, forKey: Self.webOnlyKey)
        notice = nil
        phase = .ready
        _ = await DeadlineNotifier.requestAuthorization()
    }

    /// Accesso riuscito sul sito, con i servizi per app disattivati: l'app usa la sessione del sito.
    func completeSiteLogin(_ state: SiteSessionState) async {
        KeychainStore.set(nil, for: .token)
        KeychainStore.set(nil, for: .privateToken)
        Self.saveSiteSession(state)
        let siteClient = makeSiteClient(state)
        client = siteClient
        access = .siteSession
        lastAutologin = nil
        let fallback = SiteInfo(userid: state.userID, fullname: "", firstname: nil, username: nil, sitename: nil)
        apply((try? await siteClient.currentUser()) ?? fallback)
        UserDefaults.standard.set(false, forKey: Self.webOnlyKey)
        notice = nil
        phase = .ready
        _ = await DeadlineNotifier.requestAuthorization()
    }

    /// Rinnova la sessione del sito quando il portale l'ha chiusa. Una sola volta anche se più richieste falliscono insieme.
    func renewSiteSession() async -> SiteSessionState? {
        if let renewal { return await renewal.value }
        let task = Task { @MainActor () -> SiteSessionState? in
            // 1. Il browser interno ha già una sessione valida (es. ha appena rifatto il login)?
            if let adopted = await SiteSessionClient.adopt(cookies: await PortalCookies.current()) { return adopted }
            // 2. Login di Ateneo in una WebView invisibile, con le credenziali del Portachiavi.
            return await SilentLogin.run()
        }
        renewal = task
        let state = await task.value
        renewal = nil
        if let state, access == .siteSession, phase == .ready {
            Self.saveSiteSession(state)
        }
        return state
    }

    /// Nome per il saluto, se al login non era arrivato (sessione del sito).
    func refreshSiteUserIfNeeded() async {
        guard let siteClient = client as? SiteSessionClient, (siteInfo?.greetingName ?? "").isEmpty,
              let info = try? await siteClient.currentUser() else { return }
        apply(info)
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
    /// Con la sessione del sito i cookie sono già nella WebView.
    func webURL(for target: URL) async -> URL {
        guard let client = client as? MoodleClient, client.privateToken != nil, let userID = siteInfo?.userid,
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

    private func makeSiteClient(_ state: SiteSessionState) -> SiteSessionClient {
        SiteSessionClient(state: state) { [weak self] in
            await self?.renewSiteSession()
        }
    }

    private func clearToken() {
        KeychainStore.set(nil, for: .token)
        KeychainStore.set(nil, for: .privateToken)
        Self.saveSiteSession(nil)
        UserDefaults.standard.removeObject(forKey: Self.siteInfoKey)
        PortalCache.clear()
        renewal?.cancel()
        renewal = nil
        client = nil
        siteInfo = nil
        access = .appServices
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

    /// Sessione del sito salvata nel Portachiavi (cookie e sesskey valgono quanto una password finché il portale non li scade).
    nonisolated static func storedSiteSession() -> SiteSessionState? {
        guard let json = KeychainStore.get(.siteSession) else { return nil }
        return try? JSONDecoder().decode(SiteSessionState.self, from: Data(json.utf8))
    }

    private static func saveSiteSession(_ state: SiteSessionState?) {
        let json = state.flatMap { try? JSONEncoder().encode($0) }.flatMap { String(data: $0, encoding: .utf8) }
        KeychainStore.set(json, for: .siteSession)
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
        await session.refreshSiteUserIfNeeded()

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
