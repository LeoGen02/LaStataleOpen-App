import SwiftUI
import UIKit
import UserNotifications

struct SettingsView: View {
    @EnvironmentObject private var session: SessionStore
    @AppStorage(SiteConfig.programNameKey) private var programName = SiteConfig.defaultProgramName
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
                Section {
                    NavigationLink {
                        ProgramPickerView()
                    } label: {
                        LabeledContent("Percorso", value: programName)
                    }
                } footer: {
                    Text("Il percorso mostrato nella scheda Corsi.")
                }
                CredentialsSection()
                RemindersSection()
                Section("Portale") {
                    Button("Apri il portale completo") { webTarget = WebTarget(url: SiteConfig.dashboardURL, title: "La Statale Open") }
                    Button("Profilo") { webTarget = WebTarget(url: SiteConfig.url("user/profile.php"), title: "Profilo") }
                    Button("Messaggi") { webTarget = WebTarget(url: SiteConfig.url("message/index.php"), title: "Messaggi") }
                }
                AboutSection()
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
    @EnvironmentObject private var data: PortalData
    @AppStorage(DeadlineNotifier.enabledKey) private var reminders = true

    var body: some View {
        Section {
            Toggle("Promemoria scadenze e nuovi avvisi", isOn: $reminders)
                .onChange(of: reminders) {
                    // Applica subito la scelta: riprogramma o cancella i promemoria già in coda e aggiorna il badge.
                    Task {
                        if reminders { await DeadlineNotifier.requestAuthorization() }
                        await DeadlineNotifier.schedule(for: data.events)
                        await DeadlineNotifier.updateBadge(data.unreadCount)
                    }
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

/// Versione, aggiornamenti, segnalazioni e note legali (anche in modalità web).
struct AboutSection: View {
    @EnvironmentObject private var updates: UpdateChecker
    @State private var copied = false

    var body: some View {
        Section {
            LabeledContent("Versione", value: "\(AppInfo.version) (build \(AppInfo.build))")
            if let update = updates.available {
                Link(destination: update.url) {
                    Label("Scarica la versione \(update.version)", systemImage: "arrow.down.circle.fill")
                }
            }
            Button {
                Task { await updates.check() }
            } label: {
                HStack {
                    Text("Controlla aggiornamenti")
                    Spacer()
                    if updates.isChecking { ProgressView() }
                }
            }
            .disabled(updates.isChecking || AppInfo.repository == nil)
            if let url = AppInfo.installGuideURL { Link("Guida all'installazione", destination: url) }
            if let url = AppInfo.releasesURL { Link("Novità delle versioni", destination: url) }
            if let url = AppInfo.newIssueURL(template: "bug_report.yml") { Link("Segnala un problema", destination: url) }
            if let url = AppInfo.newIssueURL(template: "feature_request.yml") { Link("Proponi un miglioramento", destination: url) }
            Button(copied ? "Copiate ✓" : "Copia le informazioni per la segnalazione") {
                UIPasteboard.general.string = AppInfo.diagnostics
                copied = true
            }
            if let url = AppInfo.privacyURL { Link("Privacy", destination: url) }
        } header: {
            Text("Informazioni")
        } footer: {
            VStack(alignment: .leading, spacing: 6) {
                if let result = updates.lastResult { Text(result) }
                Text(AppInfo.disclaimer)
            }
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
                    AboutSection()
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
