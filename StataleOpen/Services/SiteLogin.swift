import Foundation
import UIKit
import WebKit

/// Legge la sessione del sito da una WebView che ha appena aperto una pagina del portale.
@MainActor
enum SiteSessionReader {
    private static let script = "(function(){try{return JSON.stringify({sesskey:M.cfg.sesskey,userid:M.cfg.userId});}catch(e){return '';}})();"

    static func read(from webView: WKWebView) async -> SiteSessionState? {
        let json: String = await withCheckedContinuation { continuation in
            webView.evaluateJavaScript(script) { result, _ in
                continuation.resume(returning: result as? String ?? "")
            }
        }
        guard let config = try? JSONDecoder().decode(SitePageConfig.self, from: Data(json.utf8)), config.isLoggedIn else { return nil }
        let cookies = await PortalCookies.current(in: webView.configuration.websiteDataStore)
        guard !cookies.isEmpty else { return nil }
        return SiteSessionState(sesskey: config.sesskey, userID: config.userid, cookies: cookies)
    }
}

/// Cookie del portale nell'archivio delle WebView (login, browser interno), condiviso con la sessione del sito.
@MainActor
enum PortalCookies {
    static func current(in store: WKWebsiteDataStore = .default()) async -> [StoredCookie] {
        await store.httpCookieStore.allCookies()
            .map { StoredCookie($0) }
            .filter { $0.appliesToPortal && !$0.isExpired() }
    }

    /// Alla riapertura dell'app: il browser interno ritrova la sessione salvata.
    static func restore(_ cookies: [StoredCookie], into store: WKWebsiteDataStore = .default()) async {
        for cookie in cookies where !cookie.isExpired() {
            if let httpCookie = cookie.httpCookie {
                await store.httpCookieStore.setCookie(httpCookie)
            }
        }
    }
}

/// Rinnova la sessione del sito senza mostrare nulla: apre il portale in una WebView invisibile,
/// compila il login di Ateneo con le credenziali del Portachiavi (se l'accesso automatico è attivo) e legge la nuova sessione.
/// Se serve l'utente (credenziali assenti o rifiutate, passaggi in più) restituisce nil e l'app mostra la schermata di accesso.
@MainActor
final class SilentLogin: NSObject, WKNavigationDelegate {
    private var webView: WKWebView?
    private var continuation: CheckedContinuation<SiteSessionState?, Never>?
    private var submitted = false

    static func run(timeout: TimeInterval = 40) async -> SiteSessionState? {
        let login = SilentLogin()
        return await login.start(timeout: timeout)
    }

    private func start(timeout: TimeInterval) async -> SiteSessionState? {
        await withCheckedContinuation { continuation in
            self.continuation = continuation
            let configuration = WKWebViewConfiguration()
            configuration.websiteDataStore = .default()
            let webView = WKWebView(frame: CGRect(x: -2_000, y: 0, width: 390, height: 844), configuration: configuration)
            webView.navigationDelegate = self
            webView.alpha = 0
            webView.isUserInteractionEnabled = false
            // Dentro la finestra ma fuori dallo schermo: alcune pagine non completano gli script in una WebView staccata.
            let window = UIApplication.shared.connectedScenes
                .compactMap { ($0 as? UIWindowScene)?.keyWindow }
                .first
            window?.addSubview(webView)
            self.webView = webView
            webView.load(URLRequest(url: SiteConfig.dashboardURL))
            Task { [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                self?.finish(nil)
            }
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard continuation != nil, let url = webView.url else { return }

        if CredentialAutofill.isLoginPage(url) {
            let submit = !submitted && CredentialAutofill.autoLoginEnabled
            CredentialAutofill.fill(in: webView, submit: submit) { [weak self] result in
                guard let self else { return }
                switch result {
                case "submitted":
                    self.submitted = true
                case "nopw":
                    break // pagina intermedia del login: si aspetta la prossima
                default:
                    // Di nuovo la richiesta di password dopo l'invio, o niente da inviare: serve l'utente.
                    self.finish(nil)
                }
            }
            return
        }

        guard url.host?.lowercased() == SiteConfig.moodleHost else { return }
        Task { [weak self] in
            let state = await SiteSessionReader.read(from: webView)
            self?.finish(state)
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let code = (error as NSError).code
        if code == NSURLErrorCancelled || code == 102 { return }
        finish(nil)
    }

    private func finish(_ state: SiteSessionState?) {
        guard let continuation else { return }
        self.continuation = nil
        webView?.stopLoading()
        webView?.navigationDelegate = nil
        webView?.removeFromSuperview()
        webView = nil
        continuation.resume(returning: state)
    }
}
