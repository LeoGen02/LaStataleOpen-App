import SwiftUI
import WebKit

struct LoginView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var username = KeychainStore.get(.username) ?? ""
    @State private var password = KeychainStore.get(.password) ?? ""
    @AppStorage(CredentialAutofill.autoLoginKey) private var autoLogin = true
    @State private var showLoginFlow = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Image(systemName: "graduationcap.fill")
                            .font(.system(size: 44))
                            .foregroundStyle(.tint)
                        Text("La Statale Open")
                            .font(.title.bold())
                        Text("Percorso \(SiteConfig.programName) · lezioni, esercizi, e-tivity e scadenze in un'app.")
                            .foregroundStyle(.secondary)
                        Text(AppInfo.shortDisclaimer)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 8)
                }

                if let notice = session.notice {
                    Section {
                        Label(notice, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.orange)
                    }
                }

                Section {
                    TextField("nome.cognome@studenti.unimi.it", text: $username)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                    Toggle("Accesso automatico", isOn: $autoLogin)
                } header: {
                    Text("Credenziali di Ateneo")
                } footer: {
                    Text("Le credenziali restano solo su questo iPhone, nel Portachiavi, e servono a compilare la pagina di login ufficiale dell'Ateneo. Puoi anche lasciarle vuote e accedere a mano.")
                }

                Section {
                    Button {
                        KeychainStore.set(username.trimmingCharacters(in: .whitespaces), for: .username)
                        KeychainStore.set(password, for: .password)
                        showLoginFlow = true
                    } label: {
                        Label("Accedi", systemImage: "person.badge.key")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .listRowBackground(Color.clear)
                }
            }
            .navigationTitle("Accesso")
            .fullScreenCover(isPresented: $showLoginFlow) {
                LoginFlowView()
                    .environmentObject(session)
            }
        }
    }
}

/// Mostra la pagina di login reale dell'Ateneo, poi ottiene il token dei web service Moodle.
struct LoginFlowView: View {
    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss
    @State private var isLoading = true
    @State private var status = "Apertura della pagina di login…"
    @State private var errorText: String?
    @State private var showWebOnlyPrompt = false
    @State private var reloadID = UUID()

    var body: some View {
        NavigationStack {
            LoginWebView(isLoading: $isLoading, status: $status, onToken: { token, privateToken in
                Task { @MainActor in
                    status = "Accesso riuscito, carico i tuoi dati…"
                    do {
                        try await session.completeLogin(token: token, privateToken: privateToken)
                    } catch {
                        errorText = error.localizedDescription
                    }
                }
            }, onLaunchUnavailable: {
                Task { @MainActor in showWebOnlyPrompt = true }
            })
            .id(reloadID)
            .overlay(alignment: .top) {
                if isLoading { ProgressView().padding() }
            }
            .safeAreaInset(edge: .bottom) {
                Text(status)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(8)
                    .background(.bar)
            }
            .navigationTitle("Login di Ateneo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button { reloadID = UUID() } label: { Image(systemName: "arrow.clockwise") }
                }
            }
            .alert("Accesso non riuscito", isPresented: Binding(get: { errorText != nil }, set: { if !$0 { errorText = nil } })) {
                Button("Riprova") { reloadID = UUID() }
                Button("Usa la modalità web") { session.useWebOnlyMode() }
                Button("Annulla", role: .cancel) {}
            } message: {
                Text(errorText ?? "")
            }
            .alert("App mobile non abilitata", isPresented: $showWebOnlyPrompt) {
                Button("Usa la modalità web") { session.useWebOnlyMode() }
                Button("Riprova") { reloadID = UUID() }
                Button("Annulla", role: .cancel) {}
            } message: {
                Text("Sei entrato nel portale, ma non è stato possibile collegare l'app ai servizi Moodle. Puoi comunque usare l'app in modalità web, con le pagine del portale ottimizzate per iPhone.")
            }
        }
    }
}

struct LoginWebView: UIViewRepresentable {
    @Binding var isLoading: Bool
    @Binding var status: String
    var onToken: (String, String?) -> Void
    var onLaunchUnavailable: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.load(URLRequest(url: SiteConfig.loginURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.parent = self
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var parent: LoginWebView
        private let passport = String(Int.random(in: 100_000_000...999_999_999))
        private var launchAttempts = 0
        private var autoSubmitted = false
        private var finished = false

        init(parent: LoginWebView) {
            self.parent = parent
        }

        private var launchURL: URL {
            SiteConfig.url("admin/tool/mobile/launch.php").appendingQuery([
                "service": "moodle_mobile_app",
                "passport": passport,
                "urlscheme": SiteConfig.urlScheme,
            ])
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url, let scheme = url.scheme?.lowercased() else {
                decisionHandler(.allow)
                return
            }
            if scheme == SiteConfig.urlScheme {
                decisionHandler(.cancel)
                handleTokenURL(url)
                return
            }
            if !["http", "https", "about", "data", "blob"].contains(scheme) {
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            parent.isLoading = true
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            report(error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            report(error)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.isLoading = false
            guard !finished, let url = webView.url, let host = url.host?.lowercased() else { return }

            if CredentialAutofill.isLoginPage(url) {
                parent.status = CredentialAutofill.hasCredentials ? "Compilo le credenziali salvate…" : "Inserisci le credenziali di Ateneo"
                let submit = CredentialAutofill.autoLoginEnabled && !autoSubmitted
                CredentialAutofill.run(in: webView, submit: submit) { [weak self] submitted in
                    if submitted {
                        self?.autoSubmitted = true
                        self?.parent.status = "Accesso in corso…"
                    }
                }
                return
            }

            guard host == SiteConfig.moodleHost else { return }

            if url.path.lowercased().contains("/admin/tool/mobile/launch.php") {
                inspectLaunchPage(webView)
                return
            }

            // Siamo dentro Moodle: chiediamo il token per l'app.
            if launchAttempts < 2 {
                launchAttempts += 1
                parent.status = "Collegamento dell'app al portale…"
                webView.load(URLRequest(url: launchURL))
            } else {
                fail()
            }
        }

        /// Su iOS Moodle può mostrare una pagina con un link al posto del redirect diretto.
        private func inspectLaunchPage(_ webView: WKWebView) {
            let script = "(function(){var a=document.querySelector('a[href^=\"\(SiteConfig.urlScheme):\"]'); if(a){ window.location.href = a.href; return 'clicked'; } return 'none';})();"
            webView.evaluateJavaScript(script) { [weak self] result, _ in
                guard let self, !self.finished else { return }
                if (result as? String) == "clicked" { return }
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
                    guard let self, !self.finished else { return }
                    self.fail()
                }
            }
        }

        private func handleTokenURL(_ url: URL) {
            // La pagina di Moodle può aprire il link due volte (onload + nostro click): vale solo il primo.
            guard !finished else { return }
            guard let launch = MoodleLaunchToken.parse(url) else { return fail() }
            finished = true
            parent.onToken(launch.token, launch.privateToken)
        }

        private func fail() {
            guard !finished else { return }
            finished = true
            parent.status = "Collegamento non riuscito"
            parent.onLaunchUnavailable()
        }

        private func report(_ error: Error) {
            parent.isLoading = false
            let nsError = error as NSError
            // -999: navigazione annullata (es. intercettazione del token), 102: caricamento interrotto.
            if nsError.code == NSURLErrorCancelled || nsError.code == 102 { return }
            parent.status = error.localizedDescription
        }
    }
}
