import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var data = PortalData()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Home", systemImage: "house") }
            CoursesView()
                .tabItem { Label("Corsi", systemImage: "books.vertical") }
            DeadlinesView()
                .tabItem { Label("Scadenze", systemImage: "calendar.badge.clock") }
            NotificationsView()
                .tabItem { Label("Avvisi", systemImage: "bell") }
                .badge(data.unreadCount)
            SettingsView()
                .tabItem { Label("Altro", systemImage: "gearshape") }
        }
        .environmentObject(data)
        .task { await data.refreshAll(using: session) }
        .onChange(of: scenePhase) { _, phase in
            // Al ritorno in primo piano aggiorna se i dati hanno più di 5 minuti (o non sono mai arrivati).
            guard phase == .active else { return }
            if data.lastUpdated.map({ Date().timeIntervalSince($0) > 5 * 60 }) ?? true {
                Task { await data.refreshAll(using: session) }
            }
        }
    }
}

struct HomeView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var data: PortalData
    @State private var webTarget: WebTarget?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Ciao, \(session.siteInfo?.firstname ?? session.siteInfo?.fullname ?? "studente")")
                            .font(.title2.bold())
                        Text("Percorso \(SiteConfig.programName) · La Statale Open")
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                } footer: {
                    if let last = data.lastUpdated {
                        Text("Aggiornato \(last.formatted(.relative(presentation: .named)))")
                    }
                }

                if let message = data.errorMessage ?? session.notice {
                    Section {
                        Label(message, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.orange)
                    }
                }

                Section("Prossime scadenze") {
                    // Da inizio giornata, come nella scheda Scadenze (i giorni precedenti stanno in "Scadute di recente").
                    let upcoming = data.events.filter { $0.date >= Calendar.current.startOfDay(for: Date()) }.prefix(5)
                    if upcoming.isEmpty {
                        Text(data.isLoading ? "Caricamento…" : "Nessuna scadenza imminente 🎉")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(Array(upcoming)) { event in
                        Button { open(event) } label: { EventRow(event: event) }
                            .buttonStyle(.plain)
                    }
                }

                Section("Ripresa rapida") {
                    if data.courses.isEmpty {
                        Text(data.isLoading ? "Caricamento…" : "Nessun corso trovato")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(data.courses.prefix(5)) { course in
                        NavigationLink(value: course) { CourseRow(course: course) }
                    }
                }

                Section("Portale") {
                    linkButton("Dashboard", systemImage: "rectangle.grid.2x2", url: SiteConfig.dashboardURL)
                    linkButton("Percorso \(SiteConfig.programName) (sito)", systemImage: "square.stack.3d.up", url: SiteConfig.programURL)
                    linkButton("Calendario", systemImage: "calendar", url: SiteConfig.calendarURL)
                    linkButton("Valutazioni", systemImage: "chart.bar", url: SiteConfig.gradesURL)
                }
            }
            .navigationTitle("Home")
            .refreshable { await data.refreshAll(using: session) }
            .navigationDestination(for: Course.self) { CourseDetailView(course: $0) }
            .portalBrowser($webTarget, session: session)
        }
    }

    private func linkButton(_ title: String, systemImage: String, url: URL) -> some View {
        Button { webTarget = WebTarget(url: url, title: title) } label: {
            Label(title, systemImage: systemImage)
        }
    }

    private func open(_ event: CalendarEvent) {
        guard let url = event.targetURL else { return }
        webTarget = WebTarget(url: url, title: event.name.htmlStripped)
    }
}

struct EventRow: View {
    let event: CalendarEvent

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(isOverdue ? Color.red : Color.accentColor)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(event.name.htmlStripped)
                    .font(.body.weight(.medium))
                if let course = event.course {
                    Text(course.fullname.htmlStripped)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Text(event.date, format: .dateTime.weekday(.wide).day().month().hour().minute())
                    .font(.caption)
                    .foregroundStyle(isOverdue ? AnyShapeStyle(Color.red) : AnyShapeStyle(.secondary))
            }
            Spacer()
            Text(event.date, style: .relative)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.trailing)
        }
        .contentShape(Rectangle())
    }

    private var isOverdue: Bool { event.overdue ?? (event.date < Date()) }

    private var icon: String {
        switch event.modulename {
        case "quiz": return "pencil.and.list.clipboard"
        case "assign": return "tray.and.arrow.up"
        case "forum": return "bubble.left.and.bubble.right"
        default: return "calendar"
        }
    }
}

struct CourseRow: View {
    let course: Course

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(course.title)
                .font(.body.weight(.medium))
            if let short = course.shortname, short != course.fullname {
                Text(short.htmlStripped)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let progress = course.progress {
                ProgressView(value: min(max(progress, 0), 100), total: 100) {
                    Text("Completamento \(Int(progress))%")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
    }
}
