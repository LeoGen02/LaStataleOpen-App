import Foundation

/// Controlla sulle release GitHub se esiste una versione più recente di quella installata.
/// Al massimo una volta al giorno in automatico; a mano da Altro → Informazioni.
@MainActor
final class UpdateChecker: ObservableObject {
    struct Update: Equatable {
        let version: String
        let url: URL
    }

    @Published private(set) var available: Update?
    @Published private(set) var isChecking = false
    @Published private(set) var lastResult: String?

    private static let lastCheckKey = "updateLastCheck"
    private static let latestVersionKey = "updateLatestVersion"
    private static let latestURLKey = "updateLatestURL"
    private static let interval: TimeInterval = 24 * 3600

    init() {
        // Ripropone l'ultimo aggiornamento trovato, se è ancora più recente di quello installato.
        let defaults = UserDefaults.standard
        if let version = defaults.string(forKey: Self.latestVersionKey),
           let string = defaults.string(forKey: Self.latestURLKey), let url = URL(string: string),
           Self.isNewer(version, than: AppInfo.version) {
            available = Update(version: version, url: url)
        }
    }

    func checkIfNeeded() async {
        if let last = UserDefaults.standard.object(forKey: Self.lastCheckKey) as? Date,
           Date().timeIntervalSince(last) < Self.interval { return }
        await check()
    }

    func check() async {
        guard !isChecking else { return }
        guard let api = AppInfo.latestReleaseAPI else {
            lastResult = "Questa build non è collegata a un repository GitHub."
            return
        }
        isChecking = true
        defer { isChecking = false }

        var request = URLRequest(url: api)
        request.timeoutInterval = 15
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard status == 200 else {
                // 404: repository privato o nessuna release pubblicata ancora.
                lastResult = status == 404 ? "Nessuna release pubblica trovata su GitHub." : "GitHub non ha risposto (HTTP \(status))."
                return
            }
            let release = try JSONDecoder().decode(Release.self, from: data)
            UserDefaults.standard.set(Date(), forKey: Self.lastCheckKey)
            let version = Self.normalized(release.tagName)
            if Self.isNewer(version, than: AppInfo.version), let url = URL(string: release.htmlURL) {
                available = Update(version: version, url: url)
                UserDefaults.standard.set(version, forKey: Self.latestVersionKey)
                UserDefaults.standard.set(release.htmlURL, forKey: Self.latestURLKey)
                lastResult = "È disponibile la versione \(version)."
            } else {
                available = nil
                lastResult = "Hai l'ultima versione (\(AppInfo.version))."
            }
        } catch {
            lastResult = "Controllo non riuscito: \(error.localizedDescription)"
        }
    }

    private struct Release: Decodable {
        let tagName: String
        let htmlURL: String

        enum CodingKeys: String, CodingKey {
            case tagName = "tag_name"
            case htmlURL = "html_url"
        }
    }

    /// "v1.2.0" → "1.2.0".
    nonisolated static func normalized(_ tag: String) -> String {
        var value = tag.trimmingCharacters(in: .whitespaces)
        if value.first == "v" || value.first == "V" { value.removeFirst() }
        return value
    }

    /// Confronto numerico per componenti: 1.10.0 > 1.9.2, "1.2" == "1.2.0"; un tag non numerico non è mai più recente.
    nonisolated static func isNewer(_ candidate: String, than current: String) -> Bool {
        let a = components(normalized(candidate))
        let b = components(normalized(current))
        guard (a.first ?? nil) != nil else { return false }
        for index in 0..<max(a.count, b.count) {
            let x = index < a.count ? (a[index] ?? 0) : 0
            let y = index < b.count ? (b[index] ?? 0) : 0
            if x != y { return x > y }
        }
        return false
    }

    /// Ogni componente vale per le sue cifre iniziali ("1-beta" → 1); nil se non ne ha.
    nonisolated private static func components(_ version: String) -> [Int?] {
        version.split(separator: ".").map { Int($0.prefix { $0.isNumber }) }
    }
}
