import Foundation

enum MoodleClientError: LocalizedError, Equatable {
    case sessionExpired
    case invalidResponse(Int)
    case server(String)
    case decoding(String)
    case missingPrivateToken

    var errorDescription: String? {
        switch self {
        case .sessionExpired: return "La sessione è scaduta: accedi di nuovo."
        case .invalidResponse(let code): return "Risposta non valida dal portale (HTTP \(code))."
        case .server(let message): return message
        case .decoding(let function): return "Formato di risposta inatteso (\(function))."
        case .missingPrivateToken: return "Accesso automatico non disponibile."
        }
    }
}

/// Client per i web service REST di Moodle (servizio "moodle_mobile_app", lo stesso dell'app ufficiale Moodle).
final class MoodleClient {
    let token: String
    let privateToken: String?
    private let session: URLSession
    private let decoder = JSONDecoder()

    init(token: String, privateToken: String?, session: URLSession = .shared) {
        self.token = token
        self.privateToken = privateToken
        self.session = session
    }

    func call<T: Decodable>(_ function: String, _ params: [String: String] = [:]) async throws -> T {
        var fields = params
        fields["wstoken"] = token
        fields["wsfunction"] = function
        fields["moodlewsrestformat"] = "json"
        fields["moodlewssettingfilter"] = "true"
        fields["moodlewssettingfileurl"] = "true"

        var request = URLRequest(url: SiteConfig.url("webservice/rest/server.php"))
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/x-www-form-urlencoded; charset=utf-8", forHTTPHeaderField: "Content-Type")
        request.httpBody = FormEncoding.encode(fields).data(using: .utf8)

        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else { throw MoodleClientError.invalidResponse(status) }

        if let error = try? decoder.decode(MoodleError.self, from: data), error.exception != nil || error.errorcode != nil {
            if error.errorcode == "invalidtoken" { throw MoodleClientError.sessionExpired }
            throw MoodleClientError.server(error.message ?? error.errorcode ?? "Errore del portale")
        }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw MoodleClientError.decoding(function)
        }
    }

    // MARK: - Funzioni

    func siteInfo() async throws -> SiteInfo {
        try await call("core_webservice_get_site_info")
    }

    func userCourses(userID: Int) async throws -> [Course] {
        try await call("core_enrol_get_users_courses", ["userid": String(userID)])
    }

    func courseContents(courseID: Int) async throws -> [CourseSection] {
        try await call("core_course_get_contents", ["courseid": String(courseID)])
    }

    func upcomingEvents(from start: Date, limit: Int) async throws -> [CalendarEvent] {
        let response: EventsResponse = try await call("core_calendar_get_action_events_by_timesort", [
            "timesortfrom": String(Int(start.timeIntervalSince1970)),
            "limitnum": String(limit),
            "limittononsuspendedevents": "1",
        ])
        return response.events
    }

    func categories(parent: Int) async throws -> [CourseCategory] {
        try await call("core_course_get_categories", [
            "criteria[0][key]": "parent",
            "criteria[0][value]": String(parent),
            "addsubcategories": "0",
        ])
    }

    func courses(inCategory categoryID: Int) async throws -> [Course] {
        let response: CoursesByFieldResponse = try await call("core_course_get_courses_by_field", [
            "field": "category",
            "value": String(categoryID),
        ])
        return response.courses
    }

    func notifications(userID: Int) async throws -> PopupNotificationsResponse {
        try await call("message_popup_get_popup_notifications", [
            "useridto": String(userID),
            "limit": "50",
            "offset": "0",
        ])
    }

    func markNotificationRead(_ id: Int) async throws {
        let _: GenericResponse = try await call("core_message_mark_notification_read", [
            "notificationid": String(id),
            "timeread": String(Int(Date().timeIntervalSince1970)),
        ])
    }

    func markAllNotificationsRead(userID: Int) async throws {
        let _: Bool = try await call("core_message_mark_all_notifications_as_read", ["useridto": String(userID)])
    }

    func setManualCompletion(moduleID: Int, completed: Bool) async throws {
        let _: GenericResponse = try await call("core_completion_update_activity_completion_status_manually", [
            "cmid": String(moduleID),
            "completed": completed ? "1" : "0",
        ])
    }

    func autologinKey() async throws -> AutologinKeyResponse {
        guard let privateToken else { throw MoodleClientError.missingPrivateToken }
        return try await call("tool_mobile_get_autologin_key", ["privatetoken": privateToken])
    }

    /// I file restituiti dai web service (webservice/pluginfile.php) richiedono il token.
    func authenticatedFileURL(_ string: String) -> URL? {
        guard let url = URL(string: string) else { return nil }
        guard url.host?.lowercased() == SiteConfig.moodleHost, url.path.contains("pluginfile.php") else { return url }
        return url.appendingQuery(["token": token])
    }
}
