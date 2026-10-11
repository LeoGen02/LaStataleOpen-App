import SwiftUI
import UserNotifications

struct SettingsView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var webTarget: WebTarget?

    var body: some View {
        NavigationStack {
            Form {
                if let info = session.siteInfo {
                    Section("Account") {
                        LabeledContent("Studente", value: info.fullname)
                        if let username = info.username { LabeledContent("Utente", value: username) }
                        LabeledContent("Portale", value: info.sitename?.htmlStripped ?? SiteConfig.moodleHost)
                    }
                }
                CredentialsSection()
                RemindersSection()
                Section("Portale") {
                    Button("Apri il portale completo") { webTarget = WebTarget(url: SiteConfig.dashboardURL, title: "La Statale Open") }
                    Button("Profilo") { webTarget = WebTarget(url: SiteConfig.url("user/profile.php"), title: "Profilo") }
                    Button("Messaggi") { webTarget = WebTarget(url: SiteConfig.url("message/index.php"), title: "Messaggi") }
                }
                Section {
                    Button("Esci", role: .destructive) { Task { await session.logout() } }
                } footer: {
                    Text("Uscendo vengono cancellati token e cookie del portale. Le credenziali salvate restano finché non le rimuovi.")
                }
            }
            .navigationTitle("Altro")
            .portalBrowser($webTarget, session: session)
        }
    }
}

struct CredentialsSection: View {
    @State private var username = KeychainStore.get(.username) ?? ""
    @State private var password = KeychainStore.get(.password) ?? ""
    @AppStorage(CredentialAutofill.autoLoginKey) private var autoLogin = true
    @State private var saved = false

    var body: some View {
        Section {
            TextField("Email di Ateneo", text: $username)
                .textContentType(.username)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            SecureField("Password", text: $password)
                .textContentType(.password)
            Toggle("Accesso automatico", isOn: $autoLogin)
            Button(saved ? "Salvate ✓" : "Salva credenziali") {
                KeychainStore.set(username.trimmingCharacters(in: .whitespaces), for: .username)
                KeychainStore.set(password, for: .password)
                saved = true
            }
            Button("Rimuovi credenziali", role: .destructive) {
                KeychainStore.set(nil, for: .username)
                KeychainStore.set(nil, for: .password)
                username = ""
                password = ""
                saved = false
            }
        } header: {
            Text("Credenziali")
        } footer: {
            Text("Conservate nel Portachiavi di questo iPhone; usate solo per compilare il login di Ateneo quando la sessione scade.")
        }
        .onChange(of: username) { saved = false }
        .onChange(of: password) { saved = false }
    }
}

struct RemindersSection: View {
    @AppStorage(DeadlineNotifier.enabledKey) private var reminders = true

    var body: some View {
        Section {
            Toggle("Promemoria scadenze e nuovi avvisi", isOn: $reminders)
                .onChange(of: reminders) {
                    if reminders { Task { await DeadlineNotifier.requestAuthorization() } }
                }
            Button("Invia notifica di prova") {
                Task {
                    guard await DeadlineNotifier.requestAuthorization() else { return }
                    let content = UNMutableNotificationContent()
                    content.title = "La Statale Open"
                    content.body = "Le notifiche funzionano."
                    let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 3, repeats: false)
                    try? await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "test", content: content, trigger: trigger))
                }
            }
        } header: {
            Text("Notifiche")
        } footer: {
            Text("Ricevi un promemoria 24 ore e 2 ore prima di ogni scadenza. I nuovi avvisi vengono controllati quando iOS concede l'aggiornamento in background.")
        }
    }
}

/// Modalità usata se il portale non abilita l'accesso via app mobile: pagine del sito in schede native.
struct WebOnlyTabView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        TabView {
            PortalBrowser(target: WebTarget(url: SiteConfig.dashboardURL, title: "Home", authenticate: false))
                .tabItem { Label("Home", systemImage: "house") }
            PortalBrowser(target: WebTarget(url: SiteConfig.programURL, title: "Percorso \(SiteConfig.programName)", authenticate: false))
                .tabItem { Label("Corsi", systemImage: "books.vertical") }
            PortalBrowser(target: WebTarget(url: SiteConfig.calendarURL, title: "Scadenze", authenticate: false))
                .tabItem { Label("Scadenze", systemImage: "calendar.badge.clock") }
            NavigationStack {
                Form {
                    Section {
                        Text("Stai usando la modalità web: il portale non ha concesso l'accesso tramite i servizi per app mobile.")
                            .foregroundStyle(.secondary)
                        Button("Riprova il collegamento") { Task { await session.logout() } }
                    }
                    CredentialsSection()
                    Section {
                        Button("Esci", role: .destructive) { Task { await session.logout() } }
                    }
                }
                .navigationTitle("Altro")
            }
            .tabItem { Label("Altro", systemImage: "gearshape") }
        }
    }
}
