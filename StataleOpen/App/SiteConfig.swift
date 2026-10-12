import Foundation

/// Indirizzi e costanti del portale "La Statale Open" (Moodle myAriel, Università degli Studi di Milano).
enum SiteConfig {
    static let moodleHost = "lastataleopen.myariel.unimi.it"
    static let ssoHost = "elearning.unimi.it"
    static let baseURL = URL(string: "https://lastataleopen.myariel.unimi.it/")!

    /// Pagina di login SSO di Ateneo; al termine rimanda al login Moodle.
    static var loginURL: URL {
        var components = URLComponents(string: "https://elearning.unimi.it/authentication/skin/lastataleopen/it/login.aspx")!
        components.queryItems = [URLQueryItem(name: "url", value: url("login/index.php").absoluteString)]
        return components.url!
    }

    /// Percorso mostrato nella scheda Corsi: predefinito SecAI (categoria 2, contiene i cluster),
    /// modificabile in Altro → Percorso per chi segue un altro percorso del portale.
    static let defaultProgramID = 2
    static let defaultProgramName = "SecAI"
    static let programIDKey = "programCategoryID"
    static let programNameKey = "programName"

    static var programCategoryID: Int {
        UserDefaults.standard.object(forKey: programIDKey) as? Int ?? defaultProgramID
    }

    static var programName: String {
        UserDefaults.standard.string(forKey: programNameKey) ?? defaultProgramName
    }

    /// Schema usato da Moodle (tool_mobile) per restituire il token all'app.
    static let urlScheme = "stataleopen"
    static let backgroundRefreshID = "it.leonardo.stataleopen.refresh"

    static func url(_ path: String) -> URL {
        URL(string: path, relativeTo: baseURL)!.absoluteURL
    }

    static var dashboardURL: URL { url("my/") }
    static var programURL: URL { url("course/index.php?categoryid=\(programCategoryID)") }
    static var calendarURL: URL { url("calendar/view.php?view=upcoming") }
    static var gradesURL: URL { url("grade/report/overview/index.php") }
}

extension String {
    /// Rimuove tag HTML e decodifica le entità più comuni restituite da Moodle.
    var htmlStripped: String {
        var s = replacingOccurrences(of: "<br\\s*/?>", with: "\n", options: [.regularExpression, .caseInsensitive])
        s = s.replacingOccurrences(of: "</p>", with: "\n", options: .caseInsensitive)
        s = s.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
        let entities = [
            "&nbsp;": " ", "&quot;": "\"", "&#39;": "'", "&apos;": "'", "&lt;": "<", "&gt;": ">",
            "&agrave;": "à", "&egrave;": "è", "&eacute;": "é", "&igrave;": "ì", "&ograve;": "ò", "&ugrave;": "ù",
            "&Agrave;": "À", "&Egrave;": "È", "&rsquo;": "’", "&lsquo;": "‘", "&ldquo;": "“", "&rdquo;": "”", "&ndash;": "–", "&mdash;": "—",
        ]
        for (entity, value) in entities {
            s = s.replacingOccurrences(of: entity, with: value)
        }
        s = s.decodingNumericEntities().replacingOccurrences(of: "&amp;", with: "&")
        s = s.replacingOccurrences(of: "\n{3,}", with: "\n\n", options: .regularExpression)
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func decodingNumericEntities() -> String {
        guard contains("&#"), let regex = try? NSRegularExpression(pattern: "&#(x?[0-9a-fA-F]+);") else { return self }
        let ns = self as NSString
        var result = ""
        var last = 0
        for match in regex.matches(in: self, range: NSRange(location: 0, length: ns.length)) {
            result += ns.substring(with: NSRange(location: last, length: match.range.location - last))
            let raw = ns.substring(with: match.range(at: 1))
            let code = raw.hasPrefix("x") ? Int(raw.dropFirst(), radix: 16) : Int(raw)
            if let code, let scalar = Unicode.Scalar(code) {
                result.append(Character(scalar))
            } else {
                result += ns.substring(with: match.range)
            }
            last = match.range.location + match.range.length
        }
        result += ns.substring(from: last)
        return result
    }
}

enum FormEncoding {
    private static let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")

    static func escape(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }

    static func encode(_ fields: [String: String]) -> String {
        fields.map { "\(escape($0.key))=\(escape($0.value))" }.joined(separator: "&")
    }
}

extension URL {
    /// Aggiunge parametri alla query con codifica rigorosa (anche & = + ? vengono codificati).
    func appendingQuery(_ fields: [String: String]) -> URL {
        guard var components = URLComponents(url: self, resolvingAgainstBaseURL: false) else { return self }
        let extra = FormEncoding.encode(fields)
        if let existing = components.percentEncodedQuery, !existing.isEmpty {
            components.percentEncodedQuery = existing + "&" + extra
        } else {
            components.percentEncodedQuery = extra
        }
        return components.url ?? self
    }

    /// Indirizzo da aprire in Safari, condividere o copiare: senza il token dei web service
    /// (che darebbe accesso all'account) e con il percorso dei file valido via cookie.
    var sanitizedForSharing: URL {
        guard var components = URLComponents(url: self, resolvingAgainstBaseURL: false),
              let items = components.queryItems, items.contains(where: { $0.name == "token" }) else { return self }
        let remaining = items.filter { $0.name != "token" }
        components.queryItems = remaining.isEmpty ? nil : remaining
        components.path = components.path.replacingOccurrences(of: "/webservice/pluginfile.php", with: "/pluginfile.php")
        return components.url ?? self
    }
}
