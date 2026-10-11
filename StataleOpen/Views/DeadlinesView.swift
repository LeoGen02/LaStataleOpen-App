import SwiftUI

struct DeadlinesView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var data: PortalData
    @State private var webTarget: WebTarget?

    var body: some View {
        NavigationStack {
            List {
                if data.events.isEmpty {
                    ContentUnavailableView(
                        data.isLoading ? "Caricamento…" : "Nessuna scadenza",
                        systemImage: "calendar.badge.checkmark",
                        description: Text("Qui compaiono quiz, consegne ed e-tivity con una data di scadenza.")
                    )
                }
                if !overdue.isEmpty {
                    Section {
                        ForEach(overdue) { event in
                            eventButton(event)
                        }
                    } header: {
                        Label("Scadute di recente", systemImage: "exclamationmark.circle")
                            .foregroundStyle(.red)
                    }
                }
                ForEach(days, id: \.self) { day in
                    Section {
                        ForEach(groups[day] ?? []) { event in
                            eventButton(event)
                        }
                    } header: {
                        Text(dayTitle(day))
                    }
                }
            }
            .navigationTitle("Scadenze")
            .refreshable { await data.refreshAll(using: session) }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        webTarget = WebTarget(url: SiteConfig.calendarURL, title: "Calendario")
                    } label: {
                        Image(systemName: "calendar")
                    }
                }
            }
            .portalBrowser($webTarget, session: session)
        }
    }

    private func eventButton(_ event: CalendarEvent) -> some View {
        Button {
            if let url = event.targetURL { webTarget = WebTarget(url: url, title: event.name.htmlStripped) }
        } label: {
            EventRow(event: event)
        }
        .buttonStyle(.plain)
    }

    private var startOfToday: Date { Calendar.current.startOfDay(for: Date()) }

    /// Attività dei giorni passati ancora da completare (il portale restituisce le ultime due settimane).
    private var overdue: [CalendarEvent] {
        data.events.filter { $0.date < startOfToday }
    }

    private var groups: [Date: [CalendarEvent]] {
        Dictionary(grouping: data.events.filter { $0.date >= startOfToday }) { Calendar.current.startOfDay(for: $0.date) }
    }

    private var days: [Date] { groups.keys.sorted() }

    private func dayTitle(_ day: Date) -> String {
        let calendar = Calendar.current
        let full = day.formatted(.dateTime.weekday(.wide).day().month(.wide))
        if calendar.isDateInToday(day) { return "Oggi · \(full)" }
        if calendar.isDateInTomorrow(day) { return "Domani · \(full)" }
        return full
    }
}

struct NotificationsView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var data: PortalData
    @State private var webTarget: WebTarget?

    var body: some View {
        NavigationStack {
            List {
                if data.notifications.isEmpty {
                    ContentUnavailableView("Nessun avviso", systemImage: "bell.slash", description: Text("Annunci dei docenti, valutazioni e messaggi del forum compariranno qui."))
                }
                ForEach(data.notifications) { item in
                    Button { open(item) } label: { row(item) }
                        .buttonStyle(.plain)
                        .swipeActions {
                            if !item.read {
                                Button("Letto") { Task { await data.markRead(item, using: session) } }
                                    .tint(.blue)
                            }
                        }
                }
            }
            .navigationTitle("Avvisi")
            .refreshable { await data.refreshNotifications(using: session) }
            .toolbar {
                if data.unreadCount > 0 {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Segna tutti letti") { Task { await data.markAllRead(using: session) } }
                    }
                }
            }
            .portalBrowser($webTarget, session: session)
        }
    }

    private func row(_ item: PopupNotification) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Circle()
                .fill(item.read ? Color.clear : Color.accentColor)
                .frame(width: 8, height: 8)
                .padding(.top, 6)
            VStack(alignment: .leading, spacing: 3) {
                Text(item.subject.htmlStripped)
                    .font(item.read ? .body : .body.weight(.semibold))
                if let context = item.contexturlname {
                    Text(context.htmlStripped).font(.caption).foregroundStyle(.secondary)
                }
                Text(item.date, style: .relative)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .contentShape(Rectangle())
    }

    private func open(_ item: PopupNotification) {
        Task { await data.markRead(item, using: session) }
        if let string = item.contexturl, let url = URL(string: string) {
            webTarget = WebTarget(url: url, title: item.contexturlname?.htmlStripped ?? "Avviso")
        }
    }
}
