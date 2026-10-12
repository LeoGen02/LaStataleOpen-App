import Foundation

/// Token che Moodle (admin/tool/mobile/launch.php) restituisce all'app nel link `schema://token=BASE64`.
/// Il testo decodificato ha il formato `firma:::token[:::tokenPrivato]`.
struct MoodleLaunchToken: Equatable {
    let token: String
    let privateToken: String?

    static func parse(_ url: URL) -> MoodleLaunchToken? {
        let string = url.absoluteString
        guard let range = string.range(of: "token=") else { return nil }
        let raw = (String(string[range.upperBound...]).removingPercentEncoding ?? "")
            .trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        // "/" fa parte dell'alfabeto base64: si toglie quella finale (aggiunta da alcuni sistemi) solo se così com'è non si decodifica.
        let withoutSlash = raw.hasSuffix("/") ? String(raw.dropLast()) : raw
        guard let decoded = decodeBase64(raw) ?? decodeBase64(withoutSlash) else { return nil }
        let parts = decoded.components(separatedBy: ":::")
        guard parts.count >= 2, !parts[1].isEmpty else { return nil }
        return MoodleLaunchToken(token: parts[1], privateToken: parts.count > 2 && !parts[2].isEmpty ? parts[2] : nil)
    }

    private static func decodeBase64(_ string: String) -> String? {
        var padded = string
        while padded.count % 4 != 0 { padded += "=" }
        guard let data = Data(base64Encoded: padded),
              let text = String(data: data, encoding: .utf8), text.contains(":::") else { return nil }
        return text
    }
}
