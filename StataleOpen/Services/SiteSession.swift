import Foundation

/// Sessione del sito: ciò che serve per leggere il portale come fanno le sue pagine quando i servizi per app
/// sono disattivati (`enablewebservices = 0`). Il cookie arriva dal login di Ateneo, la `sesskey` dalla pagina
/// (`M.cfg.sesskey`) e abilita `lib/ajax/service.php`, che Moodle tiene sempre attivo per il sito stesso.
struct SiteSessionState: Codable, Equatable {
    let sesskey: String
    let userID: Int
    let cookies: [StoredCookie]

    /// Intestazione `Cookie` per il portale: solo cookie del suo dominio e non scaduti.
    func cookieHeader(now: Date = Date()) -> String {
        cookies
            .filter { $0.appliesToPortal && !$0.isExpired(now: now) }
            .map { "\($0.name)=\($0.value)" }
            .joined(separator: "; ")
    }
}

/// Cookie salvato nel Portachiavi insieme alla sesskey, per riprendere la sessione alla riapertura dell'app.
struct StoredCookie: Codable, Equatable {
    let name: String
    let value: String
    let domain: String
    let path: String
    let isSecure: Bool
    let expires: Date?

    init(name: String, value: String, domain: String, path: String = "/", isSecure: Bool = true, expires: Date? = nil) {
        self.name = name
        self.value = value
        self.domain = domain
        self.path = path
        self.isSecure = isSecure
        self.expires = expires
    }

    init(_ cookie: HTTPCookie) {
        self.init(name: cookie.name, value: cookie.value, domain: cookie.domain, path: cookie.path,
                  isSecure: cookie.isSecure, expires: cookie.expiresDate)
    }

    var httpCookie: HTTPCookie? {
        var properties: [HTTPCookiePropertyKey: Any] = [
            .name: name, .value: value, .domain: domain, .path: path.isEmpty ? "/" : path,
        ]
        if isSecure { properties[.secure] = "TRUE" }
        if let expires { properties[.expires] = expires }
        return HTTPCookie(properties: properties)
    }

    /// Il browser lo manderebbe al portale: dominio uguale o padre (".unimi.it"), mai quello del login di Ateneo.
    var appliesToPortal: Bool {
        let cookieDomain = domain.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "."))
        let host = SiteConfig.moodleHost
        return !cookieDomain.isEmpty && (host == cookieDomain || host.hasSuffix("." + cookieDomain))
    }

    func isExpired(now: Date = Date()) -> Bool {
        expires.map { $0 <= now } ?? false
    }
}

/// Configurazione che ogni pagina Moodle pubblica in `M.cfg`.
struct SitePageConfig: Decodable, Equatable {
    let sesskey: String
    let userid: Int

    /// 0 = non autenticato, 1 = ospite: in entrambi i casi serve il login.
    var isLoggedIn: Bool { userid > 1 && !sesskey.isEmpty }

    /// Legge sesskey e utente dall'HTML di una pagina del portale (`"sesskey":"…"`, `"userId":123`).
    static func parse(html: String) -> SitePageConfig? {
        guard let sesskey = html.firstCapture(of: #""sesskey"\s*:\s*"([A-Za-z0-9]+)""#),
              let user = html.firstCapture(of: #""userId"\s*:\s*"?(\d+)"#), let userid = Int(user) else { return nil }
        let config = SitePageConfig(sesskey: sesskey, userid: userid)
        return config.isLoggedIn ? config : nil
    }
}

// MARK: - lib/ajax/service.php

enum SiteAjax {
    /// Codici con cui Moodle dice che la sessione non c'è più o la sesskey non vale.
    static let expiredCodes: Set<String> = ["servicerequireslogin", "invalidsesskey", "sessionerroruser", "sessionerroruser2", "requireloginerror"]

    static func requestBody(method: String, args: [String: Any]) throws -> Data {
        try JSONSerialization.data(withJSONObject: [["index": 0, "methodname": method, "args": args]])
    }

    /// Estrae `data` dalla risposta `[{"error": false, "data": …}]`, oppure lancia l'errore di Moodle.
    static func unwrap(_ data: Data, function: String) throws -> Data {
        guard let json = try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) else {
            // Pagina HTML al posto del JSON: di solito il login di Ateneo dopo un redirect.
            throw MoodleClientError.sessionExpired
        }
        if let object = json as? [String: Any] {
            throw error(from: object)
        }
        guard let first = (json as? [Any])?.first as? [String: Any] else {
            throw MoodleClientError.decoding(function)
        }
        if (first["error"] as? Bool) == true {
            throw error(from: first["exception"] as? [String: Any] ?? first)
        }
        guard let payload = first["data"] else { throw MoodleClientError.decoding(function) }
        if payload is NSNull { return Data("null".utf8) }
        return try JSONSerialization.data(withJSONObject: payload, options: [.fragmentsAllowed])
    }

    private static func error(from object: [String: Any]) -> MoodleClientError {
        let code = object["errorcode"] as? String
        if let code, expiredCodes.contains(code) { return .sessionExpired }
        let message = (object["message"] as? String) ?? (object["error"] as? String) ?? code ?? "Errore del portale"
        return .server(message.htmlStripped)
    }
}

// MARK: - Risposte delle funzioni usate con la sessione del sito

/// `core_course_get_enrolled_courses_by_timeline_classification`
struct TimelineCoursesResponse: Decodable {
    struct TimelineCourse: Decodable {
        let id: Int
        let fullname: String
        let shortname: String?
        let fullnamedisplay: String?
        let summary: String?
        let progress: Double?
        let hasprogress: Bool?
        let timeaccess: Int?
    }

    let courses: [TimelineCourse]

    var asCourses: [Course] {
        courses.map { c in
            Course(id: c.id, fullname: c.fullname, shortname: c.shortname, displayname: c.fullnamedisplay,
                   summary: c.summary, category: nil, categoryid: nil,
                   progress: c.hasprogress == false ? nil : c.progress, lastaccess: c.timeaccess)
        }
    }
}

/// `core_user_get_users_by_field`: nome per il saluto in Home.
struct SiteUser: Decodable {
    let id: Int
    let fullname: String
    let firstname: String?
    let username: String?

    var siteInfo: SiteInfo {
        SiteInfo(userid: id, fullname: fullname, firstname: firstname, username: username, sitename: "La Statale Open")
    }
}

/// `core_courseformat_get_state`: la struttura del corso che usa l'indice laterale delle pagine del portale.
struct CourseFormatState: Decodable {
    struct CourseInfo: Decodable {
        let sectionlist: [LenientInt]?
    }

    struct Section: Decodable {
        let id: LenientInt
        let number: LenientInt?
        let title: String
        let cmlist: [LenientInt]?
    }

    struct Module: Decodable {
        let id: LenientInt
        let name: String
        /// Nome interno del tipo (quiz, assign, resource…); `modname` è il nome tradotto ("Quiz", "Compito").
        let module: String?
        let modname: String?
        let url: String?
        let uservisible: Bool?
        let completionstate: Int?
    }

    let course: CourseInfo
    let section: [Section]
    let cm: [Module]

    /// Sezioni e attività nell'ordine del corso, nei modelli già usati dalle schede.
    var sections: [CourseSection] {
        var modules: [Int: Module] = [:]
        for module in cm where modules[module.id.value] == nil { modules[module.id.value] = module }
        var byID: [Int: Section] = [:]
        for item in section where byID[item.id.value] == nil { byID[item.id.value] = item }
        let order = course.sectionlist?.map(\.value) ?? section.map(\.id.value)

        return order.compactMap { byID[$0] }.map { item in
            CourseSection(
                id: item.id.value,
                name: item.title,
                section: item.number?.value,
                summary: nil,
                // Le sottosezioni compaiono già come sezioni a sé: la loro voce nell'elenco sarebbe un doppione.
                modules: (item.cmlist ?? []).compactMap { modules[$0.value] }.filter { $0.module != "subsection" }.map(\.courseModule)
            )
        }
    }
}

extension CourseFormatState.Module {
    var courseModule: CourseModule {
        let type = module ?? "unknown"
        return CourseModule(
            id: id.value,
            url: url,
            name: name,
            modname: type,
            modplural: modname,
            // Le etichette non hanno una pagina: il loro testo (abbreviato da Moodle) è il nome.
            description: type == "label" ? name : nil,
            uservisible: uservisible,
            // Lo stato non dice se il completamento è manuale: si prova e, se Moodle rifiuta, si mostra il suo messaggio.
            completion: completionstate == nil ? 0 : 1,
            completiondata: completionstate.map { CompletionData(state: $0) },
            contents: nil,
            dates: nil
        )
    }
}

/// Numero che Moodle a volte manda come stringa ("12" invece di 12).
struct LenientInt: Decodable, Hashable {
    let value: Int

    init(_ value: Int) { self.value = value }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let int = try? container.decode(Int.self) {
            value = int
        } else if let string = try? container.decode(String.self), let int = Int(string) {
            value = int
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Numero non valido")
        }
    }
}

// MARK: - Pagine HTML (elenco categorie e insegnamenti: non hanno una funzione AJAX)

enum SitePages {
    /// Sottocategorie (cluster) di `course/index.php?categoryid=…&browse=categories`.
    static func categories(fromHTML html: String, parent: Int) -> [CourseCategory] {
        let pattern = #"data-categoryid="(\d+)"[^>]*>[\s\S]*?class="categoryname[^"]*"[^>]*>\s*<a[^>]*>([\s\S]*?)</a>"#
        var seen = Set<Int>()
        return html.allMatches(of: pattern).compactMap { groups in
            guard let id = Int(groups[0]), id != parent, seen.insert(id).inserted else { return nil }
            let name = groups[1].htmlStripped
            guard !name.isEmpty else { return nil }
            return CourseCategory(id: id, name: name, parent: parent, coursecount: nil, description: nil)
        }
    }

    /// Insegnamenti di `course/index.php?categoryid=…&browse=courses`.
    static func courses(fromHTML html: String, categoryID: Int) -> [Course] {
        let boxes = #"data-courseid="(\d+)"[^>]*>[\s\S]*?class="coursename[^"]*"[^>]*>\s*<a[^>]*>([\s\S]*?)</a>"#
        // Temi che ridisegnano l'elenco: si ripiega sui link agli insegnamenti.
        let links = #"<a[^>]+href="[^"]*/course/view\.php\?id=(\d+)"[^>]*>([\s\S]*?)</a>"#
        for pattern in [boxes, links] {
            var seen = Set<Int>()
            let courses: [Course] = html.allMatches(of: pattern).compactMap { groups in
                guard let id = Int(groups[0]), id > 1 else { return nil }
                let name = groups[1].htmlStripped
                guard !name.isEmpty, seen.insert(id).inserted else { return nil }
                return Course(id: id, fullname: name, shortname: nil, displayname: nil, summary: nil,
                              category: categoryID, categoryid: categoryID, progress: nil, lastaccess: nil)
            }
            if !courses.isEmpty { return courses }
        }
        return []
    }
}

extension String {
    /// Primo gruppo catturato dall'espressione, se c'è.
    func firstCapture(of pattern: String) -> String? {
        allMatches(of: pattern).first?.first
    }

    /// Gruppi catturati di ogni corrispondenza.
    func allMatches(of pattern: String) -> [[String]] {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return [] }
        let ns = self as NSString
        return regex.matches(in: self, range: NSRange(location: 0, length: ns.length)).map { match in
            (1..<match.numberOfRanges).map { index in
                let range = match.range(at: index)
                return range.location == NSNotFound ? "" : ns.substring(with: range)
            }
        }
    }
}
