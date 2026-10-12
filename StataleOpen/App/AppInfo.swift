import Foundation

/// Versione, build e repository GitHub di questa copia dell'app, letti dall'Info.plist
/// (la build di GitHub Actions li imposta da tag, commit e repository).
enum AppInfo {
    static var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "?"
    }

    static var build: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "?"
    }

    /// "proprietario/nome" del repository da cui arriva la build; nil se non configurato.
    /// Chi fa un fork riceve automaticamente il proprio (vedi STATALE_REPOSITORY in project.yml).
    static var repository: String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "StataleOpenRepository") as? String else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        guard !trimmed.contains("$"), trimmed.split(separator: "/").count == 2 else { return nil }
        return trimmed
    }

    static var repositoryURL: URL? { repository.flatMap { URL(string: "https://github.com/\($0)") } }
    static var releasesURL: URL? { repositoryURL?.appendingPathComponent("releases") }
    static var privacyURL: URL? { repositoryURL?.appendingPathComponent("blob/main/PRIVACY.md") }
    static var installGuideURL: URL? { repositoryURL?.appendingPathComponent("blob/main/docs/INSTALLAZIONE.md") }
    static var latestReleaseAPI: URL? { repository.flatMap { URL(string: "https://api.github.com/repos/\($0)/releases/latest") } }

    static let disclaimer = "App non ufficiale realizzata da studenti: non è affiliata né approvata dall'Università degli Studi di Milano. Le credenziali restano su questo iPhone; l'app comunica solo con i server dell'Ateneo e con GitHub per controllare gli aggiornamenti."
    static let shortDisclaimer = "App non ufficiale, non affiliata all'Università degli Studi di Milano."

    static var systemVersion: String {
        let v = ProcessInfo.processInfo.operatingSystemVersion
        return "iOS \(v.majorVersion).\(v.minorVersion).\(v.patchVersion)"
    }

    /// Identificativo del modello, ad es. "iPhone16,2" (iPhone 15 Pro Max).
    static var deviceModel: String {
        var info = utsname()
        uname(&info)
        return withUnsafeBytes(of: &info.machine) { raw in
            String(decoding: raw.prefix { $0 != 0 }, as: UTF8.self)
        }
    }

    /// Testo da incollare in una segnalazione: nessun dato personale, nessuna credenziale.
    static var diagnostics: String {
        """
        Statale Open \(version) (build \(build))
        \(systemVersion) · \(deviceModel)
        Percorso: \(SiteConfig.programName) (categoria \(SiteConfig.programCategoryID))
        """
    }

    /// Nuova issue su GitHub con il modulo indicato e versione/dispositivo già compilati
    /// (i nomi dei parametri sono gli `id` dei campi in .github/ISSUE_TEMPLATE).
    static func newIssueURL(template: String) -> URL? {
        guard let repositoryURL,
              var components = URLComponents(url: repositoryURL.appendingPathComponent("issues/new"), resolvingAgainstBaseURL: false) else { return nil }
        components.queryItems = [
            URLQueryItem(name: "template", value: template),
            URLQueryItem(name: "versione", value: "\(version) (build \(build))"),
            URLQueryItem(name: "dispositivo", value: "\(systemVersion) · \(deviceModel)"),
        ]
        return components.url
    }
}
