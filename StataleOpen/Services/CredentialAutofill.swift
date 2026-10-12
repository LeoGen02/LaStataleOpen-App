import Foundation
import WebKit

/// Compila (ed eventualmente invia una sola volta) il modulo di login con le credenziali del Portachiavi.
enum CredentialAutofill {
    static let autoLoginKey = "autoLogin"

    static var autoLoginEnabled: Bool {
        UserDefaults.standard.object(forKey: autoLoginKey) as? Bool ?? true
    }

    static var hasCredentials: Bool {
        !(KeychainStore.get(.username) ?? "").isEmpty && !(KeychainStore.get(.password) ?? "").isEmpty
    }

    static func isLoginPage(_ url: URL?) -> Bool {
        guard let url, let host = url.host?.lowercased() else { return false }
        if host == SiteConfig.ssoHost { return true }
        return host == SiteConfig.moodleHost && url.path.lowercased().hasPrefix("/login/")
    }

    /// Esegue lo script; `completion` riceve true se il modulo è stato inviato.
    static func run(in webView: WKWebView, submit: Bool, completion: @escaping (Bool) -> Void) {
        fill(in: webView, submit: submit) { completion($0 == "submitted") }
    }

    /// Come `run`, ma riporta l'esito dello script: "submitted", "filled", "nopw" (nessun campo password) o "nocreds".
    static func fill(in webView: WKWebView, submit: Bool, completion: @escaping (String) -> Void) {
        guard let username = KeychainStore.get(.username), let password = KeychainStore.get(.password),
              !username.isEmpty, !password.isEmpty,
              let data = try? JSONSerialization.data(withJSONObject: [username, password]),
              let json = String(data: data, encoding: .utf8) else {
            completion("nocreds")
            return
        }
        let script = source + "(\(json), \(submit ? "true" : "false"));"
        webView.evaluateJavaScript(script) { result, _ in
            completion(result as? String ?? "")
        }
    }

    private static let source = """
    (function(creds, submit) {
      var pw = document.querySelector('input[type="password"]');
      if (!pw) { return 'nopw'; }
      function visible(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); }
      var user = null;
      var candidates = document.querySelectorAll('input[type="text"], input[type="email"], input:not([type])');
      for (var i = 0; i < candidates.length; i++) {
        var c = candidates[i];
        if (!visible(c)) { continue; }
        if (c.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING) { user = c; }
      }
      function setValue(el, v) {
        var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (user) { setValue(user, creds[0]); }
      setValue(pw, creds[1]);
      if (!submit) { return 'filled'; }
      var scope = pw.form || document;
      var btn = scope.querySelector('input[type="submit"], button[type="submit"]');
      if (!btn) {
        var all = scope.querySelectorAll('a, button, input[type="button"]');
        for (var j = 0; j < all.length; j++) {
          var t = (all[j].innerText || all[j].value || '').trim();
          if (/^(accedi|login|log in|entra|sign in)$/i.test(t)) { btn = all[j]; break; }
        }
      }
      if (btn) { btn.click(); return 'submitted'; }
      if (pw.form) { pw.form.submit(); return 'submitted'; }
      return 'filled';
    })
    """
}
