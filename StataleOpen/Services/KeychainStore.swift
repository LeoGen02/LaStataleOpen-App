import Foundation
import Security

/// Salva token e credenziali nel Portachiavi di iOS (mai in chiaro, mai nel repository).
enum KeychainStore {
    enum Key: String {
        case token, privateToken, username, password, siteSession
    }

    private static let service = "it.leonardo.stataleopen"

    private static func baseQuery(_ key: Key) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
        ]
    }

    static func set(_ value: String?, for key: Key) {
        SecItemDelete(baseQuery(key) as CFDictionary)
        guard let value, !value.isEmpty, let data = value.data(using: .utf8) else { return }
        var query = baseQuery(key)
        query[kSecValueData as String] = data
        // Disponibile anche durante l'aggiornamento in background dopo il primo sblocco.
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(query as CFDictionary, nil)
    }

    static func get(_ key: Key) -> String? {
        var query = baseQuery(key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
