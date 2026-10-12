import Foundation

struct SiteInfo: Codable, Equatable {
    let userid: Int
    let fullname: String
    let firstname: String?
    let username: String?
    let sitename: String?

    /// Nome per il saluto; nil se il portale non l'ha ancora detto.
    var greetingName: String? {
        [firstname, fullname].compactMap { $0?.trimmingCharacters(in: .whitespaces) }.first { !$0.isEmpty }
    }
}

struct Course: Codable, Identifiable, Hashable {
    let id: Int
    let fullname: String
    let shortname: String?
    let displayname: String?
    let summary: String?
    let category: Int?
    let categoryid: Int?
    let progress: Double?
    let lastaccess: Int?

    var title: String { (displayname ?? fullname).htmlStripped }
    var webURL: URL { SiteConfig.url("course/view.php?id=\(id)") }
}

struct CourseSection: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let section: Int?
    let summary: String?
    let modules: [CourseModule]
}

struct CourseModule: Codable, Identifiable, Hashable {
    let id: Int
    let url: String?
    let name: String
    let modname: String
    let modplural: String?
    let description: String?
    let uservisible: Bool?
    let completion: Int?
    let completiondata: CompletionData?
    let contents: [ModuleContent]?
    let dates: [ModuleDate]?

    var kind: ActivityKind { ActivityKind.classify(self) }
    var isCompleted: Bool { (completiondata?.state ?? 0) == 1 || (completiondata?.state ?? 0) == 2 }
    var tracksCompletion: Bool { (completion ?? 0) != 0 }
    var allowsManualCompletion: Bool { completion == 1 }
    var dueDate: Date? {
        guard let dates, !dates.isEmpty else { return nil }
        let preferred = dates.first { label in
            let l = label.label.lowercased()
            return l.contains("scaden") || l.contains("due") || l.contains("chiu") || l.contains("close")
        } ?? dates.last!
        return Date(timeIntervalSince1970: TimeInterval(preferred.timestamp))
    }
}

struct CompletionData: Codable, Hashable {
    let state: Int
}

struct ModuleContent: Codable, Hashable {
    let type: String
    let filename: String?
    let fileurl: String?
    let filesize: Int?
    let mimetype: String?
}

struct ModuleDate: Codable, Hashable {
    let label: String
    let timestamp: Int
}

/// Raggruppamento delle attività come le presenta il corso: lezioni, esercizi, e-tivity.
enum ActivityKind: String, CaseIterable, Identifiable {
    case lesson, exercise, etivity, other

    var id: String { rawValue }

    var title: String {
        switch self {
        case .lesson: return "Lezioni"
        case .exercise: return "Esercizi"
        case .etivity: return "E-tivity"
        case .other: return "Altro"
        }
    }

    var systemImage: String {
        switch self {
        case .lesson: return "play.rectangle"
        case .exercise: return "pencil.and.list.clipboard"
        case .etivity: return "person.2.wave.2"
        case .other: return "square.grid.2x2"
        }
    }

    static func classify(_ module: CourseModule) -> ActivityKind {
        let name = module.name.lowercased()
        if name.contains("e-tivit") || name.contains("etivit") { return .etivity }
        if name.contains("annunci") || name.contains("notizie") || name.contains("news") { return .other }
        if name.contains("eserciz") || name.contains("esercitaz") || name.contains("autovalutazione") { return .exercise }
        if name.contains("lezion") || name.contains("videolez") { return .lesson }
        switch module.modname {
        case "quiz":
            return .exercise
        case "assign", "forum", "workshop", "wiki", "glossary", "choice", "feedback", "data":
            return .etivity
        case "resource", "page", "url", "folder", "book", "scorm", "lesson", "h5pactivity", "hvp", "imscp", "lti", "kalvidres", "kalvidpres":
            return .lesson
        default:
            return .other
        }
    }
}

struct CalendarEvent: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let modulename: String?
    let eventtype: String?
    let timestart: Int
    let timesort: Int?
    let course: EventCourse?
    let url: String?
    let overdue: Bool?
    let action: EventAction?

    var date: Date { Date(timeIntervalSince1970: TimeInterval(timesort ?? timestart)) }
    var targetURL: URL? { (action?.url).flatMap(URL.init(string:)) ?? url.flatMap(URL.init(string:)) }
}

struct EventCourse: Codable, Hashable {
    let id: Int
    let fullname: String
}

struct EventAction: Codable, Hashable {
    let name: String
    let url: String?
    let actionable: Bool?
}

struct EventsResponse: Codable {
    let events: [CalendarEvent]
}

struct CourseCategory: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let parent: Int
    let coursecount: Int?
    let description: String?
}

struct CoursesByFieldResponse: Codable {
    let courses: [Course]
}

struct PopupNotification: Codable, Identifiable, Hashable {
    let id: Int
    let subject: String
    let smallmessage: String?
    let timecreated: Int
    let read: Bool
    let contexturl: String?
    let contexturlname: String?

    var date: Date { Date(timeIntervalSince1970: TimeInterval(timecreated)) }
}

struct PopupNotificationsResponse: Codable {
    let notifications: [PopupNotification]
    let unreadcount: Int?
}

struct AutologinKeyResponse: Codable {
    let key: String
    let autologinurl: String
}

struct GenericResponse: Codable {
    let status: Bool?
}

struct MoodleError: Decodable {
    let exception: String?
    let errorcode: String?
    let message: String?
}
