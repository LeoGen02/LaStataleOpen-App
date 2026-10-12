import Foundation

/// Legge il portale con la sessione del sito, senza i servizi per app: le stesse richieste che fanno
/// le sue pagine (`lib/ajax/service.php` con cookie e sesskey) più due pagine HTML per l'elenco dei percorsi.
/// Se la sessione scade chiede a `renew` di rinnovarla (vedi `SessionStore.renewSiteSession`) e riprova una volta.
actor SiteSessionClient: PortalAPI {
    typealias Renewal = @MainActor () async -> SiteSessionState?

    private(set) var state: SiteSessionState
    private let renew: Renewal?
    private let urlSession: URLSession
    private let decoder = JSONDecoder()

    init(state: SiteSessionState, renew: Renewal?) {
        self.state = state
        self.renew = renew
        urlSession = Self.makeURLSession()
    }

    /// Cookie gestiti a mano: sono quelli della sessione del login, non quelli di un archivio condiviso.
    private static func makeURLSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpShouldSetCookies = false
        configuration.httpCookieAcceptPolicy = .never
        configuration.timeoutIntervalForRequest = 30
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: configuration)
    }

    // MARK: - Trasporto

    func ajax<T: Decodable>(_ method: String, _ args: [String: Any] = [:]) async throws -> T {
        try await withRenewal { try await self.ajaxOnce(method, args) }
    }

    private func ajaxOnce<T: Decodable>(_ method: String, _ args: [String: Any]) async throws -> T {
        var request = URLRequest(url: SiteConfig.url("lib/ajax/service.php").appendingQuery(["sesskey": state.sesskey, "info": method]))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(state.cookieHeader(), forHTTPHeaderField: "Cookie")
        request.httpBody = try SiteAjax.requestBody(method: method, args: args)

        let (data, response) = try await urlSession.data(for: request)
        let http = response as? HTTPURLResponse
        if let url = http?.url, !Self.isPortalPage(url) { throw MoodleClientError.sessionExpired }
        let status = http?.statusCode ?? 0
        guard (200..<300).contains(status) else { throw MoodleClientError.invalidResponse(status) }

        let payload = try SiteAjax.unwrap(data, function: method)
        do {
            return try decoder.decode(T.self, from: payload)
        } catch {
            throw MoodleClientError.decoding(method)
        }
    }

    private func page(_ url: URL) async throws -> String {
        try await withRenewal { try await self.pageOnce(url) }
    }

    private func pageOnce(_ url: URL) async throws -> String {
        try await Self.fetchPage(url, cookieHeader: state.cookieHeader(), session: urlSession).html
    }

    /// Se la sessione è scaduta la rinnova (una volta) e ripete la richiesta.
    private func withRenewal<T>(_ operation: () async throws -> T) async throws -> T {
        let used = state
        do {
            return try await operation()
        } catch MoodleClientError.sessionExpired {
            // Un'altra richiesta l'ha già rinnovata nel frattempo: basta riprovare.
            if state != used { return try await operation() }
            guard let renew, let fresh = await renew() else { throw MoodleClientError.sessionExpired }
            state = fresh
            return try await operation()
        }
    }

    /// Pagine del portale fuori dal login: se una richiesta finisce altrove la sessione non c'è più.
    static func isPortalPage(_ url: URL) -> Bool {
        url.host?.lowercased() == SiteConfig.moodleHost && !url.path.lowercased().hasPrefix("/login/")
    }

    private static func fetchPage(_ url: URL, cookieHeader: String, session: URLSession) async throws -> (html: String, url: URL?) {
        var request = URLRequest(url: url)
        request.setValue(cookieHeader, forHTTPHeaderField: "Cookie")
        let (data, response) = try await session.data(for: request)
        let http = response as? HTTPURLResponse
        if let final = http?.url, !isPortalPage(final) { throw MoodleClientError.sessionExpired }
        let status = http?.statusCode ?? 0
        guard (200..<300).contains(status) else { throw MoodleClientError.invalidResponse(status) }
        return (html: String(decoding: data, as: UTF8.self), url: http?.url)
    }

    // MARK: - Sessione

    /// Usa i cookie già presenti (es. il browser interno ha rifatto il login): legge la sesskey da una pagina del portale.
    static func adopt(cookies: [StoredCookie]) async -> SiteSessionState? {
        let candidate = SiteSessionState(sesskey: "", userID: 0, cookies: cookies)
        guard !candidate.cookieHeader().isEmpty,
              let page = try? await fetchPage(SiteConfig.dashboardURL, cookieHeader: candidate.cookieHeader(), session: makeURLSession()),
              let config = SitePageConfig.parse(html: page.html) else { return nil }
        return SiteSessionState(sesskey: config.sesskey, userID: config.userid, cookies: cookies)
    }

    /// Il portale ha i servizi per app attivi? (`tool_mobile_get_public_config`, senza login.)
    /// In caso di dubbio risponde false: la sessione del sito funziona comunque.
    static func appServicesEnabled() async -> Bool {
        var request = URLRequest(url: SiteConfig.url("lib/ajax/service-nologin.php").appendingQuery(["info": "tool_mobile_get_public_config"]))
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? SiteAjax.requestBody(method: "tool_mobile_get_public_config", args: [:])
        struct PublicConfig: Decodable {
            let enablewebservices: Int?
            let enablemobilewebservice: Int?
        }
        guard let response = try? await makeURLSession().data(for: request),
              let payload = try? SiteAjax.unwrap(response.0, function: "tool_mobile_get_public_config"),
              let config = try? JSONDecoder().decode(PublicConfig.self, from: payload) else { return false }
        return config.enablewebservices == 1 && config.enablemobilewebservice == 1
    }

    func currentUser() async throws -> SiteInfo {
        let users: [SiteUser] = try await ajax("core_user_get_users_by_field", ["field": "id", "values": [String(state.userID)]])
        guard let user = users.first else { throw MoodleClientError.decoding("core_user_get_users_by_field") }
        return user.siteInfo
    }

    // MARK: - PortalAPI

    func userCourses(userID: Int) async throws -> [Course] {
        let response: TimelineCoursesResponse = try await ajax("core_course_get_enrolled_courses_by_timeline_classification", [
            "classification": "all",
            "limit": 0,
            "offset": 0,
        ])
        return response.asCourses
    }

    func courseContents(courseID: Int) async throws -> [CourseSection] {
        // La funzione restituisce lo stato come testo JSON.
        let json: String = try await ajax("core_courseformat_get_state", ["courseid": courseID])
        do {
            return try decoder.decode(CourseFormatState.self, from: Data(json.utf8)).sections
        } catch {
            throw MoodleClientError.decoding("core_courseformat_get_state")
        }
    }

    func upcomingEvents(from start: Date, limit: Int) async throws -> [CalendarEvent] {
        let response: EventsResponse = try await ajax("core_calendar_get_action_events_by_timesort", [
            "timesortfrom": Int(start.timeIntervalSince1970),
            "limitnum": limit,
            "limittononsuspendedevents": true,
        ])
        return response.events
    }

    func categories(parent: Int) async throws -> [CourseCategory] {
        let html = try await page(SiteConfig.url("course/index.php?categoryid=\(parent)&browse=categories&perpage=1000"))
        return SitePages.categories(fromHTML: html, parent: parent)
    }

    func courses(inCategory categoryID: Int) async throws -> [Course] {
        let html = try await page(SiteConfig.url("course/index.php?categoryid=\(categoryID)&browse=courses&perpage=1000"))
        return SitePages.courses(fromHTML: html, categoryID: categoryID)
    }

    func notifications(userID: Int) async throws -> PopupNotificationsResponse {
        try await ajax("message_popup_get_popup_notifications", [
            "useridto": userID,
            "newestfirst": true,
            "limit": 50,
            "offset": 0,
        ])
    }

    func markNotificationRead(_ id: Int) async throws {
        let _: GenericResponse = try await ajax("core_message_mark_notification_read", [
            "notificationid": id,
            "timeread": Int(Date().timeIntervalSince1970),
        ])
    }

    func markAllNotificationsRead(userID: Int) async throws {
        let _: Bool = try await ajax("core_message_mark_all_notifications_as_read", ["useridto": userID])
    }

    func setManualCompletion(moduleID: Int, completed: Bool) async throws {
        let _: GenericResponse = try await ajax("core_completion_update_activity_completion_status_manually", [
            "cmid": moduleID,
            "completed": completed,
        ])
    }

    /// I file si aprono nel browser interno, che ha già i cookie della sessione.
    nonisolated func authenticatedFileURL(_ string: String) -> URL? {
        URL(string: string)
    }
}
