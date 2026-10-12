import Foundation

/// Da dove l'app legge i dati del portale. Le schede usano solo queste funzioni, qualunque sia la strada:
/// - `MoodleClient`: web service per app mobile (token), se il portale li abilita;
/// - `SiteSessionClient`: la sessione del sito (cookie del login di Ateneo + sesskey), come le pagine del portale.
protocol PortalAPI {
    func userCourses(userID: Int) async throws -> [Course]
    func courseContents(courseID: Int) async throws -> [CourseSection]
    func upcomingEvents(from start: Date, limit: Int) async throws -> [CalendarEvent]
    func categories(parent: Int) async throws -> [CourseCategory]
    func courses(inCategory categoryID: Int) async throws -> [Course]
    func notifications(userID: Int) async throws -> PopupNotificationsResponse
    func markNotificationRead(_ id: Int) async throws
    func markAllNotificationsRead(userID: Int) async throws
    func setManualCompletion(moduleID: Int, completed: Bool) async throws
    /// Indirizzo per aprire un file del corso (con il token, se la strada lo richiede).
    func authenticatedFileURL(_ string: String) -> URL?
}

extension PortalAPI {
    /// Scadenze dagli ultimi 14 giorni in poi (per la sezione "Scadute di recente").
    func upcomingEvents() async throws -> [CalendarEvent] {
        try await upcomingEvents(from: Date().addingTimeInterval(-14 * 86_400), limit: 50)
    }
}

extension MoodleClient: PortalAPI {}
